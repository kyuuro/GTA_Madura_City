#!/usr/bin/env python3
"""Iterasi 56: siapkan model "Indonesian Police Dalmas" (mixboni, Sketchfab, CC BY 4.0) jadi GLB ringan untuk game.
  python3 tools/prep_polisi.py <zip-atau-glb sumber> assets/npc_polisi.glb [target_segitiga=7000] [tekstur=1024]
Sumber asli: mesh statis 555 rb segitiga + tekstur 2048 px (19 MB), berdiri (lengan sudah turun), menghadap +Z, tangan kiri (+X) memegang perisai.
Hasil: 1 SkinnedMesh + 1 material, 18 tulang bernama gaya Mixamo (sama dengan npc_sma), klip 'Idle' & 'Run' dipanggang, tinggi 1.0, kaki di y=0, depan +Z,
badan dipusatkan di x=z=0 (perisai menjulur ke sisi +X). Perisai dibobot kaku ke LeftArm; ayunan lengan kiri diredam supaya perisai tidak mengayun liar.
Cara: (1) simpul disatukan per posisi, mesh disederhanakan QEM (fast-simplification; mesh asli terlalu banyak jahitan UV untuk dipecah per-UV),
(2) bobot kulit berbasis jarak ke tulang, (3) UV baru dibuat xatlas, (4) tekstur di-BAKE ulang dari mesh+tekstur asli (titik terdekat dgn normal sejalan) + padding.
Kebutuhan: numpy, pillow, opencv-python, scipy, fast-simplification, xatlas (pip)."""
import sys, io, os, zipfile
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from glbkit import *
from rigkit import *
from prep_npc_chars import T_RUN, T_IDLE
import fast_simplification as fs, xatlas
from scipy.spatial import cKDTree

X0, Z0 = -0.075, -0.05     # pusat badan di model asli (tanpa perisai); jadi titik pusat karakter
# (nama, induk, posisi dunia model asli). Left = +X. Y model asli: -0.95 (sol sepatu) .. 0.95 (puncak helm)
J = [('Hips', None, (X0, -0.05, -0.04)), ('Spine', 'Hips', (X0, 0.08, -0.04)), ('Spine1', 'Spine', (X0, 0.25, -0.04)), ('Spine2', 'Spine1', (X0, 0.40, -0.05)),
     ('Neck', 'Spine2', (X0, 0.58, -0.06)), ('Head', 'Neck', (X0, 0.66, -0.04)),
     ('LeftArm', 'Spine2', (0.17, 0.52, -0.10)), ('LeftForeArm', 'LeftArm', (0.19, 0.32, -0.13)), ('LeftHand', 'LeftForeArm', (0.205, 0.13, -0.15)),
     ('RightArm', 'Spine2', (-0.32, 0.52, -0.10)), ('RightForeArm', 'RightArm', (-0.365, 0.32, -0.145)), ('RightHand', 'RightForeArm', (-0.385, 0.13, -0.17)),
     ('LeftUpLeg', 'Hips', (0.065, -0.08, -0.07)), ('LeftLeg', 'LeftUpLeg', (0.065, -0.55, -0.06)), ('LeftFoot', 'LeftLeg', (0.07, -0.85, -0.08)),
     ('RightUpLeg', 'Hips', (-0.205, -0.08, -0.07)), ('RightLeg', 'RightUpLeg', (-0.205, -0.55, -0.06)), ('RightFoot', 'RightLeg', (-0.20, -0.85, -0.08))]
# kapsul bobot: (tulang, A, B, radius) - jarak permukaan ke kapsul menentukan bobot
SEG = [('Hips', (X0, -0.14, -0.04), (X0, 0.08, -0.04), 0.19), ('Spine', (X0, 0.08, -0.04), (X0, 0.25, -0.04), 0.19), ('Spine1', (X0, 0.25, -0.04), (X0, 0.40, -0.05), 0.19),
       ('Spine2', (X0, 0.40, -0.05), (X0, 0.56, -0.06), 0.19), ('Neck', (X0, 0.56, -0.06), (X0, 0.66, -0.04), 0.07), ('Head', (X0, 0.66, -0.04), (X0, 0.90, -0.03), 0.13),
       ('LeftArm', (0.17, 0.52, -0.10), (0.19, 0.32, -0.13), 0.06), ('LeftForeArm', (0.19, 0.32, -0.13), (0.205, 0.13, -0.15), 0.055), ('LeftHand', (0.205, 0.13, -0.15), (0.21, -0.03, -0.15), 0.05),
       ('RightArm', (-0.32, 0.52, -0.10), (-0.365, 0.32, -0.145), 0.06), ('RightForeArm', (-0.365, 0.32, -0.145), (-0.385, 0.13, -0.17), 0.055), ('RightHand', (-0.385, 0.13, -0.17), (-0.39, -0.03, -0.17), 0.05),
       ('LeftUpLeg', (0.065, -0.08, -0.07), (0.065, -0.55, -0.06), 0.09), ('LeftLeg', (0.065, -0.55, -0.06), (0.07, -0.85, -0.08), 0.075), ('LeftFoot', (0.07, -0.85, -0.08), (0.07, -0.93, 0.10), 0.07),
       ('RightUpLeg', (-0.205, -0.08, -0.07), (-0.205, -0.55, -0.06), 0.09), ('RightLeg', (-0.205, -0.55, -0.06), (-0.20, -0.85, -0.08), 0.075), ('RightFoot', (-0.20, -0.85, -0.08), (-0.20, -0.93, 0.10), 0.07)]
LEG = {'LeftUpLeg': 1, 'LeftLeg': 1, 'LeftFoot': 1, 'RightUpLeg': 0, 'RightLeg': 0, 'RightFoot': 0}   # nilai = sisi (1 = +X)

def seg_dist(P, A, B):
    A = np.array(A); B = np.array(B); d = B - A; t = np.clip(((P - A) @ d) / (d @ d), 0, 1); return np.linalg.norm(P - (A + t[:, None] * d), axis=1)

def shield_mask(P):   # perisai = cangkang busur (pusat x=0,z=-0.17, radius 0.38..0.50) di sisi +X
    r = np.hypot(P[:, 0], P[:, 2] + 0.17)
    return (P[:, 0] > -0.03) & (P[:, 1] > -0.48) & (P[:, 1] < 0.43) & (r > 0.375) & (r < 0.51)

def weights(P):
    names = [j[0] for j in J]; ix = {n: i for i, n in enumerate(names)}; n = len(P); Wt = np.zeros((n, len(J)))
    for nm, A, B, r in SEG:
        e = np.maximum(seg_dist(P, A, B) - r, 0) + 0.012; w = e ** -3.0
        if nm in LEG:   # kaki hanya untuk sisinya sendiri (lunak di tengah)
            t = np.clip((P[:, 0] - X0) / 0.05 * 0.5 + 0.5, 0, 1); s = t * t * (3 - 2 * t); w = w * (s if LEG[nm] else 1 - s)
        Wt[:, ix[nm]] += w
    sh = shield_mask(P); Wt[sh] = 0; Wt[sh, ix['LeftArm']] = 1.0
    top = np.argsort(-Wt, axis=1)[:, :4]; Wk = np.take_along_axis(Wt, top, 1); Wk = Wk / Wk.sum(1, keepdims=True)
    return top, Wk, sh

def bake(Plo, Nlo, Flo, UVlo, Phi, Nhi, Chi, size):
    """Raster tiap segitiga mesh ringan di ruang UV, cari titik mesh asli terdekat (dari 8 kandidat, pilih yang normalnya paling sejalan) -> warna."""
    tree = cKDTree(Phi); pts = []; nrm = []; pix = []
    for f in Flo:
        uv = UVlo[f] * size; x0, y0 = np.floor(uv.min(0)).astype(int) - 1, None
        mn = np.floor(uv.min(0)).astype(int) - 1; mx = np.ceil(uv.max(0)).astype(int) + 1
        xs, ys = np.meshgrid(np.arange(max(mn[0], 0), min(mx[0], size)), np.arange(max(mn[1], 0), min(mx[1], size)))
        if xs.size == 0: continue
        q = np.c_[xs.ravel() + 0.5, ys.ravel() + 0.5]; a, b, c = uv; d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(d) < 1e-9: continue
        w0 = ((b[1] - c[1]) * (q[:, 0] - c[0]) + (c[0] - b[0]) * (q[:, 1] - c[1])) / d; w1 = ((c[1] - a[1]) * (q[:, 0] - c[0]) + (a[0] - c[0]) * (q[:, 1] - c[1])) / d; w2 = 1 - w0 - w1
        m = (w0 >= -0.02) & (w1 >= -0.02) & (w2 >= -0.02)
        if not m.any(): continue
        W = np.c_[w0[m], w1[m], w2[m]]; pts.append(W @ Plo[f]); n_ = W @ Nlo[f]; nrm.append(n_ / (np.linalg.norm(n_, axis=1, keepdims=True) + 1e-12)); pix.append(np.c_[xs.ravel()[m], ys.ravel()[m]])
    pts = np.vstack(pts); nrm = np.vstack(nrm); pix = np.vstack(pix)
    dist, idx = tree.query(pts, k=8); score = (Nhi[idx] * nrm[:, None, :]).sum(2) - dist * 8.0   # normal sejalan lebih penting daripada selisih kecil jarak
    best = idx[np.arange(len(pts)), score.argmax(1)]
    img = np.zeros((size, size, 3), np.uint8); cov = np.zeros((size, size), bool); img[pix[:, 1], pix[:, 0]] = Chi[best]; cov[pix[:, 1], pix[:, 0]] = True
    from scipy import ndimage
    ii = ndimage.distance_transform_edt(~cov, return_distances=False, return_indices=True); img = img[ii[0], ii[1]]   # padding: isi area kosong dari piksel terpakai terdekat
    return Image.fromarray(img), cov.mean()

def prep(src, dst, target=7000, tex_px=1024, quiet=False):
    if src.endswith('.zip'):
        z = zipfile.ZipFile(src); open('/tmp/_polisi.glb', 'wb').write(z.read('source/model.glb')); src = '/tmp/_polisi.glb'
    g, B = load(src); pr = g['meshes'][0]['primitives'][0]; a = pr['attributes']
    P = acc(g, B, a['POSITION']).astype(float); N = acc(g, B, a['NORMAL']).astype(float); UV = acc(g, B, a['TEXCOORD_0']).astype(float); F = acc(g, B, pr['indices']).reshape(-1, 3).astype(int)
    tex = Image.open(io.BytesIO(image_bytes(g, B, 0))).convert('RGB'); tri0 = len(F)
    t = np.array(tex.resize((1024, 1024), Image.LANCZOS)); C = t[np.clip((UV[:, 1] * 1024).astype(int), 0, 1023), np.clip((UV[:, 0] * 1024).astype(int), 0, 1023)]   # warna tiap simpul asli
    # --- sederhanakan (satukan simpul per posisi dulu) ---
    key = np.round(P * 1e5).astype(np.int64); _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.ravel()
    Pw = P[first]; Fw = inv[F]; Fw = Fw[(Fw[:, 0] != Fw[:, 1]) & (Fw[:, 1] != Fw[:, 2]) & (Fw[:, 0] != Fw[:, 2])]
    P2, F2 = fs.simplify(Pw, Fw.astype(np.int64), target_count=target, agg=7)[:2]; P2 = P2.astype(float); F2 = F2.astype(int)
    # buang komponen kecil yang nyasar
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    e = np.r_[F2[:, [0, 1]], F2[:, [1, 2]]]; nc, lab = connected_components(coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(len(P2), len(P2))), directed=False)
    keep = np.bincount(lab[F2[:, 0]], minlength=nc) >= 0.02 * len(F2); F2 = F2[keep[lab[F2[:, 0]]]]
    used = np.unique(F2); rm = -np.ones(len(P2), int); rm[used] = np.arange(len(used)); P2 = P2[used]; F2 = rm[F2]
    tri = P2[F2]; fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]); N2 = np.zeros_like(P2)
    for k in range(3): np.add.at(N2, F2[:, k], fn)
    N2 /= np.linalg.norm(N2, axis=1, keepdims=True) + 1e-12
    if not quiet: print(f'  segitiga {tri0} -> {len(F2)}, simpul {len(P)} -> {len(P2)}')
    # --- UV baru (xatlas) + bake tekstur ---
    at = xatlas.Atlas(); at.add_mesh(P2.astype(np.float32), F2.astype(np.uint32), N2.astype(np.float32)); po = xatlas.PackOptions(); po.resolution = tex_px; po.padding = 3; po.bruteForce = False; at.generate(pack_options=po)
    vm, Fx, uvx = at.get_mesh(0); Fx = Fx.astype(int); vm = vm.astype(int); UVx = np.asarray(uvx, float)
    Px, Nx = P2[vm], N2[vm]
    if not quiet: print(f'  xatlas: {len(Px)} simpul, atlas {at.width}x{at.height}, terpakai {at.utilization*100:.0f}%')
    Jx, Wx, sh = weights(Px)
    if not quiet: print(f'  simpul perisai: {sh.sum()}')
    tex2, cov = bake(Px, Nx, Fx, UVx, P, N, C, tex_px)
    if not quiet: print(f'  bake selesai, piksel terisi {cov*100:.0f}%')
    # --- normalisasi: kaki di y=0, tinggi 1, badan di x=z=0 ---
    y0 = Px[:, 1].min(); H = Px[:, 1].max() - y0; s = 1.0 / H; off = np.array([X0, y0, Z0])
    Pn = (Px - off) * s
    ix = {j[0]: i for i, j in enumerate(J)}; wp = {j[0]: (np.array(j[2], float) - off) * s for j in J}
    joints = [{'name': nm, 'parent': ix[p] if p else -1, 't': wp[nm] - (wp[p] if p else np.zeros(3)), 'q': np.array([0, 0, 0, 1.0])} for nm, p, _ in J]
    Mr = rest_mats(joints); IBM = [np.linalg.inv(m) for m in Mr]; er = np.abs(skin_points(Pn, Jx, Wx, Mr, IBM) - Pn).max()
    if not quiet: print(f'  uji rest-pose skinning: galat maks {er:.2e}')
    clips = bake_clips(joints, T_RUN, T_IDLE, cfg=dict(noPhi=True, armLm=0.12, thigh=0.34, knee=0.65, arm=0.30, fore=0.30, fore0=0.25))
    buf = io.BytesIO(); tex2.save(buf, 'JPEG', quality=85, optimize=True)
    write_glb(dst, 'npc_polisi', Pn, UVx, Nx, Jx, Wx, Fx, joints, clips, buf.getvalue(), rough=0.9)
    if not quiet: print(f'  {len(Pn)} simpul, {len(joints)} tulang; {os.path.getsize(dst)/1024:.0f} KB -> {dst}')
    return Pn, UVx, Nx, Jx, Wx, Fx, joints, clips, tex2, sh

if __name__ == '__main__':
    src, dst = sys.argv[1:3]; prep(src, dst, int(sys.argv[3]) if len(sys.argv) > 3 else 7000, int(sys.argv[4]) if len(sys.argv) > 4 else 1024)
