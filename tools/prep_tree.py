#!/usr/bin/env python3
"""Ubah 'Tree Animate' (RandyGF, CC BY 4.0) -> assets/kenney/pohon/trees.glb: 3 varian pohon ringan untuk pohon pinggir jalan.
Pakai: python3 tools/prep_tree.py <tree_animate.glb> assets/kenney/pohon/trees.glb [preview.png]
Sumber: 1 file berisi 3 pohon berdampingan (x ~ -150, -68, 0), 18,7 rb segitiga, 9 tekstur 512-1024 px (8,9 MB), material KHR_materials_pbrSpecularGlossiness
(TIDAK didukung three.js >= r147) + 5 morph target angin pada daun. Di sini:
  - dipisah jadi 3 mesh (tree_a/b/c), alas y=0 di pusat batang, skala x SCALE ke meter
  - batang+cabang besar: simpul digabung per posisi lalu disederhanakan (QEM, tools/qem.py), tekstur kulit jadi bercak warna di atlas
  - daun: kartu 'ranting berdaun' (3 segitiga/kartu) dipilih merata per voxel, sisanya dibuang; kartu terpilih DIBESARKAN supaya kanopi tetap rimbun
  - kartu cabang (mesh Branch) dibuang; morph target dibuang (goyang angin dibuat di shader roads.js, murah & tiap pohon beda fase)
  - normal daun dibuat 'bola' (dari pusat kanopi ke luar + sedikit ke atas) supaya kanopi berbayang halus
  - 1 material PBR biasa (baseColor atlas 512x512 RGBA, alpha-test), 1 draw call per varian"""
import sys, io, os, json, struct
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glbkit import load, acc, image_bytes, Writer
from qem import decimate
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

SRC, DST = sys.argv[1], sys.argv[2]; PREV = sys.argv[3] if len(sys.argv) > 3 else None
SCALE = 0.075                  # unit sumber -> meter (tinggi 58-75 -> 4,4-5,7 m, lebar kanopi 5-7 m; pohon lama procedural: tinggi 6,7 m, lebar ~5 m). Di game masih x0,85-1,15 per pohon + ?h_pohon=
TRUNK_TRIS = [300, 300, 240]   # target segitiga batang per varian
LEAF_CARDS = [200, 165, 125]   # kartu daun yang dipertahankan per varian (3 segitiga/kartu)
GROW = 0.8                     # faktor pembesaran kartu = GROW * sqrt(total/dipertahankan) (maks GROW_MAX)
GROW_MAX = 3.2
LEAF_GAIN = 1.3                # terangkan warna daun (sumber gelap; di game masih dikali warna per-pohon)
NCOL = 96                      # jumlah warna palet atlas (PNG-8)
AT = 512; LEAF_ROWS = 448      # atlas AT x AT: baris 0..447 = daun, 448..511 = bercak kulit kayu
rng = np.random.default_rng(7)

g, B = load(SRC)
mat = {m['name']: i for i, m in enumerate(g['materials'])}
def mesh_by_mat(name):
    for m in g['meshes']:
        for p in m['primitives']:
            if p.get('material') == mat[name]: return p
pb, pl = mesh_by_mat('Bark'), mesh_by_mat('Leaf')
def tex_img(matname):
    sg = g['materials'][mat[matname]]['extensions']['KHR_materials_pbrSpecularGlossiness']
    return Image.open(io.BytesIO(image_bytes(g, B, g['textures'][sg['diffuseTexture']['index']]['source']))).convert('RGBA')
bark_img, leaf_img = tex_img('Bark'), tex_img('Leaf')

# ---- atlas ----
la = np.array(leaf_img.resize((AT, LEAF_ROWS), Image.LANCZOS)).astype(np.float32)
opaque = la[..., 3] > 100; mean_leaf = la[opaque][:, :3].mean(0) * LEAF_GAIN
la[..., :3] = np.clip(la[..., :3] * LEAF_GAIN, 0, 255)
la[~opaque, :3] = np.clip(mean_leaf, 0, 255)           # latar transparan = warna daun (tanpa halo gelap/magenta saat mipmap)
ba = np.array(bark_img.resize((AT, AT - LEAF_ROWS), Image.LANCZOS)).astype(np.float32); ba[..., :3] = np.clip(ba[..., :3] * 1.15, 0, 255); ba[..., 3] = 255
atlas = np.concatenate([la, ba], 0).astype(np.uint8)
buf = io.BytesIO(); q = Image.fromarray(atlas, 'RGBA').quantize(colors=NCOL, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)   # PNG berpalet (alpha ikut palet)
atlas = np.array(q.convert('RGBA')); q.save(buf, 'PNG', optimize=True); png = buf.getvalue()
print('atlas', atlas.shape, len(png) // 1024, 'KB; warna daun rata-rata', mean_leaf.round(0))

# ---- geometri sumber ----
Pb = acc(g, B, pb['attributes']['POSITION']).astype(np.float64); Fb = acc(g, B, pb['indices']).reshape(-1, 3).astype(int)
Pl = acc(g, B, pl['attributes']['POSITION']).astype(np.float64); Fl = acc(g, B, pl['indices']).reshape(-1, 3).astype(int); Ul = acc(g, B, pl['attributes']['TEXCOORD_0']).astype(np.float64)
low = np.sort(Pb[Pb[:, 1] < 3][:, 0]); cuts = np.where(np.diff(low) > 25)[0]
groups = np.split(low, cuts + 1); cxs = [grp.mean() for grp in groups]; bounds = [-1e9] + [(cxs[i] + cxs[i + 1]) / 2 for i in range(len(cxs) - 1)] + [1e9]
print('pohon ditemukan:', len(cxs), 'pusat x', np.round(cxs, 1))
assert len(cxs) == 3
cz = [Pb[(Pb[:, 1] < 3) & (Pb[:, 0] >= bounds[i]) & (Pb[:, 0] < bounds[i + 1])][:, 2].mean() for i in range(3)]
y0 = Pb[:, 1].min()

def smooth_normals(P, F):
    n = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]); N = np.zeros_like(P)
    for k in range(3): np.add.at(N, F[:, k], n)
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)

trees = []
for t in range(3):
    lo, hi = bounds[t], bounds[t + 1]
    # --- batang ---
    sel = Fb[(Pb[Fb].mean(1)[:, 0] >= lo) & (Pb[Fb].mean(1)[:, 0] < hi)]
    key = {}; remap = {}; PP = []
    for v in np.unique(sel):
        k = tuple(np.round(Pb[v], 3))
        if k not in key: key[k] = len(PP); PP.append(Pb[v])
        remap[v] = key[k]
    PP = np.array(PP); FF = np.array([[remap[a], remap[b], remap[c]] for a, b, c in sel]); FF = FF[(FF[:, 0] != FF[:, 1]) & (FF[:, 1] != FF[:, 2]) & (FF[:, 0] != FF[:, 2])]
    nv = len(PP); z3 = np.zeros((nv, 3)); J = np.zeros((nv, 4), int); W = np.zeros((nv, 4)); W[:, 0] = 1
    P2, _, _, _, _, F2 = decimate(PP, np.zeros((nv, 2)), z3, J, W, FF, TRUNK_TRIS[t], seam_lock=False)
    print(f'pohon {"abc"[t]}: batang {len(FF)} -> {len(F2)} segitiga')
    # --- daun: kartu = komponen terhubung 3 segitiga ---
    ci = Pl[Fl].mean(1)[:, 0]; msk = (ci >= lo) & (ci < hi); Ft = Fl[msk]
    n = len(Pl); r = np.r_[Ft[:, 0], Ft[:, 1]]; c = np.r_[Ft[:, 1], Ft[:, 2]]
    nc, lab = connected_components(coo_matrix((np.ones(len(r)), (r, c)), shape=(n, n)), directed=False)
    cards = {}
    for fi, f in enumerate(Ft): cards.setdefault(lab[f[0]], []).append(fi)
    ids = list(cards); cen = np.array([Pl[Ft[cards[k]].ravel()].mean(0) for k in ids])
    want = LEAF_CARDS[t]; lo_s, hi_s = 0.5, 60.0   # ukuran voxel: cari yang menghasilkan ~want voxel terisi
    for _ in range(40):
        s = (lo_s * hi_s) ** 0.5; occ = len({tuple(v) for v in np.floor(cen / s).astype(int)})
        if occ > want: lo_s = s
        else: hi_s = s
    s = hi_s; vox = {}
    for i, v in enumerate(np.floor(cen / s).astype(int)): vox.setdefault(tuple(v), []).append(i)
    pick = [rng.choice(v) for v in vox.values()]
    grow = min(GROW_MAX, GROW * (len(ids) / len(pick)) ** 0.5)
    print(f'  daun {len(ids)} kartu -> {len(pick)} (voxel {s:.1f}), pembesaran x{grow:.2f}')
    LP, LU, LF = [], [], []; base = 0
    for i in pick:
        fs = Ft[cards[ids[i]]]; vs = np.unique(fs); loc = {v: j for j, v in enumerate(vs)}
        cc = Pl[vs].mean(0); LP.append(cc + (Pl[vs] - cc) * grow); LU.append(Ul[vs]); LF.append(np.vectorize(loc.get)(fs) + base); base += len(vs)
    LP = np.vstack(LP); LU = np.vstack(LU); LF = np.vstack(LF)
    # --- gabung, pindah ke asal (alas batang di y=0), skala ke meter ---
    org = np.array([cxs[t], P2[:, 1].min(), cz[t]])   # alas batang tiap varian tepat di y=0 (setelah penyederhanaan)
    P2 = (P2 - org) * SCALE; LP = (LP - org) * SCALE
    cen_c = np.array([0, (LP[:, 1].min() + LP[:, 1].max()) / 2, 0])
    nl = LP - cen_c; nl /= np.linalg.norm(nl, axis=1, keepdims=True) + 1e-9; nl += np.array([0, 0.35, 0]); nl /= np.linalg.norm(nl, axis=1, keepdims=True)
    Nt = smooth_normals(P2, F2); zb_ = np.linalg.norm(Nt, axis=1) < 0.5   # simpul tanpa muka berarti -> normal keluar dari sumbu batang
    if zb_.any(): o_ = P2[zb_] - np.array([0, P2[zb_][:, 1].mean(), 0]); o_[:, 1] = 0.3; Nt[zb_] = o_ / (np.linalg.norm(o_, axis=1, keepdims=True) + 1e-9)
    print('  normal batang nol diperbaiki:', int(zb_.sum()))
    ut = np.c_[0.12 + 0.76 * rng.random(len(P2)), 0.9 + 0.08 * rng.random(len(P2))]   # bercak kulit kayu di baris 448..511 (v 0,875..1)
    ul = np.c_[LU[:, 0], LU[:, 1] * LEAF_ROWS / AT]
    P_ = np.vstack([P2, LP]).astype('f4'); N_ = np.vstack([Nt, nl]).astype('f4'); U_ = np.vstack([ut, ul]).astype('f4'); F_ = np.vstack([F2, LF + len(P2)])
    assert len(P_) < 65535
    trees.append(dict(P=P_, N=N_, U=U_, F=F_.astype('u2'), nt=len(F2), nl=len(LF)))
    print(f'  hasil {len(P_)} simpul, {len(F_)} segitiga, tinggi {P_[:, 1].max():.2f} m, lebar {np.ptp(P_[:, 0]):.2f} x {np.ptp(P_[:, 2]):.2f} m')

# ---- tulis GLB ----
w = Writer(); meshes = []; nodes = []
for t, d in enumerate(trees):
    a = {'POSITION': w.accessor(d['P'], 5126, 'VEC3', 34962, minmax=True), 'NORMAL': w.accessor(d['N'], 5126, 'VEC3', 34962), 'TEXCOORD_0': w.accessor(d['U'], 5126, 'VEC2', 34962)}
    meshes.append({'name': 'tree_' + 'abc'[t], 'primitives': [{'attributes': a, 'indices': w.accessor(d['F'].reshape(-1), 5123, 'SCALAR', 34963), 'material': 0}]})
    nodes.append({'name': 'tree_' + 'abc'[t], 'mesh': t})
iv = w.view(png)
gl = {'asset': {'version': '2.0', 'generator': 'prep_tree.py', 'extras': {'author': 'RandyGF (https://sketchfab.com/RandyGF)', 'license': 'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)', 'source': 'https://sketchfab.com/3d-models/tree-animate-f0f9eb5e6c104bbb8e1f41c97019e6f2', 'title': 'Tree Animate (disederhanakan: 3 varian, atlas 512 px, tanpa morph)'}},
      'scene': 0, 'scenes': [{'nodes': [0, 1, 2]}], 'nodes': nodes, 'meshes': meshes, 'images': [{'bufferView': iv, 'mimeType': 'image/png'}],
      'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}], 'textures': [{'sampler': 0, 'source': 0}],
      'materials': [{'name': 'pohon', 'doubleSided': True, 'alphaMode': 'MASK', 'alphaCutoff': 0.4, 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 1}}]}
os.makedirs(os.path.dirname(DST) or '.', exist_ok=True); w.save(DST, gl)
print('OK', DST, os.path.getsize(DST) // 1024, 'KB; segitiga per varian', [len(d['F']) for d in trees])

# ---- pratinjau numpy (alpha-test, normal per simpul) ----
if PREV:
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    def raster(d, view, W=260, H=330):
        P = d['P'].astype(float); N = d['N'].astype(float); U = d['U'].astype(float); F = d['F'].astype(int)
        X, Z = (P[:, 0], P[:, 2]) if view == 'front' else (-P[:, 2], P[:, 0]); Y = P[:, 1]; sc = H * 0.92 / 8.0
        sx = X * sc + W / 2; sy = H * 0.96 - Y * sc; img = np.ones((H, W, 3)) * np.array((0.78, 0.88, 0.97)); zb = np.full((H, W), -1e9)
        Ld = np.array([0.4, 0.8, 0.45]) if view == 'front' else np.array([0.45, 0.8, -0.4]); Ld /= np.linalg.norm(Ld)
        tex = atlas.astype(float) / 255; th, tw, _ = tex.shape
        for a, b, c in F:
            x0, x1 = int(max(0, min(sx[[a, b, c]]))), int(min(W - 1, max(sx[[a, b, c]]) + 1)); y0_, y1 = int(max(0, min(sy[[a, b, c]]))), int(min(H - 1, max(sy[[a, b, c]]) + 1))
            if x1 < x0 or y1 < y0_: continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + .5, np.arange(y0_, y1 + 1) + .5)
            A = np.array([[sx[a], sx[b], sx[c]], [sy[a], sy[b], sy[c]], [1, 1, 1]])
            try: inv = np.linalg.inv(A)
            except np.linalg.LinAlgError: continue
            bc = np.tensordot(inv, np.stack([gx.ravel(), gy.ravel(), np.ones(gx.size)]), axes=(1, 0)); ok = (bc >= -1e-6).all(0)
            if not ok.any(): continue
            bcc = bc[:, ok]; px = gx.ravel()[ok].astype(int); py = gy.ravel()[ok].astype(int); zz = bcc[0] * Z[a] + bcc[1] * Z[b] + bcc[2] * Z[c]
            u = (bcc[0] * U[a, 0] + bcc[1] * U[b, 0] + bcc[2] * U[c, 0]) * tw; v = (bcc[0] * U[a, 1] + bcc[1] * U[b, 1] + bcc[2] * U[c, 1]) * th
            col = tex[np.clip(v.astype(int), 0, th - 1), np.clip(u.astype(int), 0, tw - 1)]
            nn = bcc[0][:, None] * N[a] + bcc[1][:, None] * N[b] + bcc[2][:, None] * N[c]; nn /= np.linalg.norm(nn, axis=1, keepdims=True) + 1e-9
            lit = 0.42 + 0.7 * np.clip(nn @ Ld, 0, 1)
            win = (col[:, 3] > 0.4) & (zz > zb[py, px])
            if win.any(): img[py[win], px[win]] = col[win, :3] * lit[win, None]; zb[py[win], px[win]] = zz[win]
        return np.clip(img, 0, 1)
    fig, ax = plt.subplots(2, 3, figsize=(10.5, 8.4))
    for t, d in enumerate(trees):
        for r, vw in enumerate(('front', 'side')): ax[r, t].imshow(raster(d, vw)); ax[r, t].axis('off'); ax[r, t].set_title(f'tree_{"abc"[t]} {vw} ({len(d["F"])} tri)', fontsize=8)
    plt.tight_layout(); plt.savefig(PREV, dpi=80); print('pratinjau', PREV)
