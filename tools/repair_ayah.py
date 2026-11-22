#!/usr/bin/env python3
"""Iterasi 83: PERBAIKAN npc_ayah.glb yang 'pecah seperti keramik' (sumber ayah.glb asli tidak ada di proyek, jadi memperbaiki dari GLB hasil prep_npc_chars2.py).
Penyebab: QEM prep_npc_chars2.py memecah jahitan UV -> 6.000 segitiga jadi kepingan terpisah (7.848 dari 12.924 tepi = tepi terbuka), tekstur atlas 'robekan kertas'.
Cara: (1) titik-titik rapat di permukaan kepingan -> volume voksel; (2) penutupan morfologis (tutup retakan <= 2R) + isi bagian dalam; (3) marching cubes pada volume yang dihaluskan -> permukaan LUAR utuh;
(4) QEM (tools/qem.py) ke ~TARGET segitiga; (5) bobot skin dari simpul lama terdekat, WARNA dari tekstur lama (median titik permukaan terdekat) -> COLOR_0 (tanpa tekstur/UV lagi).
Rangka + klip Idle/Run dipakai apa adanya (posisi di ruang yang sama: tinggi 1, kaki y=0).
  python3 tools/repair_ayah.py assets/npc_ayah.glb assets/npc_ayah.glb"""
import sys, io, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
from skimage import measure
sys.path.insert(0, os.path.dirname(__file__))
from glbkit import *
from qem import decimate

H = float(os.environ.get("AY_H", 0.0045)); R = float(os.environ.get("AY_R", 0.020)); SIGMA = 1.1; TARGET = 9000; KW = 6; KC = 14

def main(src, dst):
    g, B = load(src); pr = g['meshes'][0]['primitives'][0]; a = pr['attributes']
    P = acc(g, B, a['POSITION']).astype(float); UV = acc(g, B, a['TEXCOORD_0']).astype(float); J = acc(g, B, a['JOINTS_0']).astype(int); Wt = acc(g, B, a['WEIGHTS_0']).astype(float)
    F = acc(g, B, pr['indices']).reshape(-1, 3).astype(int)
    img = np.asarray(Image.open(io.BytesIO(image_bytes(g, B, 0))).convert('RGB')); ih, iw = img.shape[:2]
    def tex(uv):
        x = np.clip((uv[:, 0] * iw).astype(int), 0, iw - 1); y = np.clip((uv[:, 1] * ih).astype(int), 0, ih - 1); return (img[y, x] / 255.0) ** 2.2   # sRGB -> linear (COLOR_0 glTF = linear)
    # (1) titik rapat di permukaan kepingan (+ warna tekstur)
    A = np.linalg.norm(np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]), axis=1) / 2; sp = H * 0.6
    rng = np.random.default_rng(1); pts = [P]; cols = [tex(UV)]
    for t in range(len(F)):
        n = int(min(900, max(3, A[t] / (sp * sp / 2)))); r1, r2 = rng.random(n), rng.random(n); fl = r1 + r2 > 1; r1[fl] = 1 - r1[fl]; r2[fl] = 1 - r2[fl]
        b = np.c_[1 - r1 - r2, r1, r2]; i0, i1, i2 = F[t]
        pts.append(b @ P[[i0, i1, i2]]); cols.append(tex(b @ UV[[i0, i1, i2]]))
    pts = np.vstack(pts); cols = np.vstack(cols); print('titik permukaan', len(pts))
    # (2) volume voksel
    lo = pts.min(0) - 4 * R; hi = pts.max(0) + 4 * R; dims = np.ceil((hi - lo) / H).astype(int) + 1; print('grid', dims)
    occ = np.zeros(dims, bool); ij = np.round((pts - lo) / H).astype(int); occ[ij[:, 0], ij[:, 1], ij[:, 2]] = True
    rv = int(round(R / H)); st = ndi.generate_binary_structure(3, 1)
    d_in = ndi.distance_transform_edt(~occ); solid = d_in <= rv                              # dilasi bulat R (tutup retakan)
    solid = ndi.binary_fill_holes(solid)                                                     # isi bagian dalam
    d_out = ndi.distance_transform_edt(solid); solid = d_out > rv * 0.85                     # erosi balik (ketebalan lengan/kaki kembali)
    lab, nl = ndi.label(solid); sz = ndi.sum(solid, lab, range(1, nl + 1)); solid = lab == (1 + int(np.argmax(sz))); print('komponen', nl, 'volume', solid.sum())
    vol = ndi.gaussian_filter(solid.astype(float), SIGMA)
    V, Fm, _, _ = measure.marching_cubes(vol, 0.5); V = V * H + lo; print('marching cubes', len(V), 'simpul', len(Fm), 'segitiga')
    # (3) bobot skin + warna dari data lama
    tv = cKDTree(P); d, ix = tv.query(V, k=KW); w = 1 / (d ** 2 + 1e-6); w /= w.sum(1, keepdims=True)
    NJ = int(J.max()) + 1; Jn = np.zeros((len(V), 4), int); Wn = np.zeros((len(V), 4))
    for i in range(len(V)):
        acc_ = {}
        for k in range(KW):
            for j, ww in zip(J[ix[i, k]], Wt[ix[i, k]]):
                if ww > 0: acc_[j] = acc_.get(j, 0) + ww * w[i, k]
        top = sorted(acc_.items(), key=lambda x: -x[1])[:4]; s = sum(x[1] for x in top)
        for q, (j, ww) in enumerate(top): Jn[i, q] = j; Wn[i, q] = ww / s
    sv = np.einsum('ij,ij->i', V[Fm[:, 0]], np.cross(V[Fm[:, 1]], V[Fm[:, 2]])).sum() / 6   # volume bertanda: >0 = sisi depan (CCW) menghadap KELUAR
    if sv < 0: Fm = Fm[:, ::-1].copy()
    print('volume bertanda', sv, '-> flip' if sv < 0 else '-> ok')
    def vnormals(Vv, Ff):
        Nn = np.zeros_like(Vv); fn = np.cross(Vv[Ff[:, 1]] - Vv[Ff[:, 0]], Vv[Ff[:, 2]] - Vv[Ff[:, 0]])
        for k in range(3): np.add.at(Nn, Ff[:, k], fn)
        return Nn / (np.linalg.norm(Nn, axis=1, keepdims=True) + 1e-12)
    N0 = vnormals(V, Fm)
    if len(Fm) > TARGET:
        P2, UV2, N2, J2, W2, F2 = decimate(V, np.zeros((len(V), 2)), N0, Jn, Wn, Fm, TARGET, seam_lock=False); print('QEM', len(Fm), '->', len(F2))
    else: P2, N2, J2, W2, F2 = V, N0, Jn, Wn, Fm
    N2 = vnormals(P2, F2)
    tp = cKDTree(pts); d, ix = tp.query(P2, k=KC); C = np.median(cols[ix], axis=1)
    C = np.clip(C, 0, 1)
    # (5) tulis GLB: rangka/klip disalin dari berkas lama
    w = Writer(); amap = {}
    def cp(i):
        if i in amap: return amap[i]
        ac = g['accessors'][i]; arr = acc(g, B, i)
        if ac.get('normalized'): raise SystemExit('accessor normalized tak didukung')
        arr = arr.astype(CT[ac['componentType']]); amap[i] = w.accessor(arr, ac['componentType'], ac['type'], minmax=('min' in ac)); return amap[i]
    pos = w.accessor(P2.astype(np.float32), 5126, 'VEC3', 34962, minmax=True); nor = w.accessor(N2.astype(np.float32), 5126, 'VEC3', 34962)
    col = w.accessor(np.c_[C, np.ones(len(C))].astype(np.float32), 5126, 'VEC4', 34962); jj = w.accessor(J2.astype(np.uint8), 5121, 'VEC4', 34962)
    ww_ = w.accessor(W2.astype(np.float32), 5126, 'VEC4', 34962); ixa = w.accessor(F2.astype(np.uint16).ravel().reshape(-1, 1), 5123, 'SCALAR', 34963)
    g2 = {'asset': {'version': '2.0', 'generator': 'gta-suramadu tools/repair_ayah.py'}, 'scene': g['scene'], 'scenes': g['scenes'], 'nodes': g['nodes']}
    sk = dict(g['skins'][0]); sk['inverseBindMatrices'] = cp(sk['inverseBindMatrices']); g2['skins'] = [sk]
    g2['meshes'] = [{'name': g['meshes'][0]['name'], 'primitives': [{'attributes': {'POSITION': pos, 'NORMAL': nor, 'COLOR_0': col, 'JOINTS_0': jj, 'WEIGHTS_0': ww_}, 'indices': ixa, 'material': 0, 'mode': 4}]}]
    g2['materials'] = [{'name': 'warna', 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0.0, 'roughnessFactor': 0.9}}]
    anims = []
    for an in g['animations']:
        samp = [{'input': cp(s['input']), 'output': cp(s['output']), 'interpolation': s.get('interpolation', 'LINEAR')} for s in an['samplers']]
        anims.append({'name': an['name'], 'samplers': samp, 'channels': an['channels']})
    g2['animations'] = anims; w.save(dst, g2); print(f'{len(P2)} simpul, {len(F2)} segitiga, {os.path.getsize(dst)/1024:.0f} KB -> {dst}')

if __name__ == '__main__': main(sys.argv[1], sys.argv[2])
