#!/usr/bin/env python3
"""Iterasi 80: "minimarket - indomaret" (Pojan, Sketchfab, CC BY 4.0) -> assets/kenney/rumah/indomaret.glb (varian bangunan di buildings.js KH_VAR).
Pakai: python3 tools/prep_indomaret.py minimarket_-_indomaret.glb [skala=0.38]
Sumber = satu SCENE (toko utama x -12..12 + 2 ruko tetangga besar di x<-12.5 + tiang lampu + baut + isi rak). Yang dipakai: HANYA toko utama (x -12.5..12.5), tanpa tiang lampu, baut, rak interior,
dua pita hitam 2.8 rb segitiga & jam kecil (detail berat, nyaris tak terlihat dari jalan). Warna (tekstur x faktor) dipanggang jadi warna per-vertex -> 1 material, 1 draw call per chunk.
Kaca (BLEND) diganti biru gelap buram. Skala 0.38 (toko asli 24 m lebar -> 9,1 m; tinggi 4,9 m). Keluaran: pusat x/z, alas y=0, depan (pintu/papan nama) = -Z, sama dengan model rumah lain."""
import sys, io, os
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glbkit, prep_houses as H

DROP = {'Object_24', 'Object_5', 'Object_15', 'Object_72', 'Object_73', 'Object_11', 'Object_34', 'Object_41', 'Object_13', 'Object_81', 'Object_75', 'Object_77', 'Object_54', 'Object_56', 'Object_79'}
GLASS = np.array([0.012, 0.03, 0.05])   # linear; kaca etalase dibuat biru gelap buram (aslinya BLEND alpha 0.25)

def local(n):
    if 'matrix' in n: return np.array(n['matrix'], float).reshape(4, 4).T
    S = np.diag(list(n.get('scale', [1, 1, 1])) + [1]); R = np.eye(4); R[:3, :3] = glbkit.qmat(n.get('rotation', [0, 0, 0, 1])); T = np.eye(4); T[:3, 3] = n.get('translation', [0, 0, 0]); return T @ R @ S

def main(src, S=0.38, out=None):
    g, B = glbkit.load(src); imgs = {}
    def img(i):
        if i not in imgs: imgs[i] = Image.open(io.BytesIO(glbkit.image_bytes(g, B, i))).convert('RGB')
        return imgs[i]
    Ps, Ns, Cs, Is, base = [], [], [], [], 0
    def walk(i, M):
        nonlocal base
        n = g['nodes'][i]; M = M @ local(n)
        if 'mesh' in n and n.get('name') not in DROP:
            for pr in g['meshes'][n['mesh']]['primitives']:
                a = pr['attributes']; P = glbkit.acc(g, B, a['POSITION']).astype(float); P = (np.c_[P, np.ones(len(P))] @ M.T)[:, :3]
                if P[:, 0].min() < -12.6 or P[:, 0].max() > 12.6: continue   # ruko tetangga (kiri)
                N = glbkit.acc(g, B, a['NORMAL']).astype(float) @ np.linalg.inv(M[:3, :3]); mat = g['materials'][pr['material']]; pb = mat.get('pbrMetallicRoughness', {})
                f = np.array(pb.get('baseColorFactor', [1, 1, 1, 1])[:3], float)
                if mat.get('alphaMode') == 'BLEND': C = np.tile(GLASS, (len(P), 1))
                elif 'baseColorTexture' in pb and 'TEXCOORD_0' in a:
                    t = g['textures'][pb['baseColorTexture']['index']]['source']; C = H.s2l(H.tex_sample(img(t), glbkit.acc(g, B, a['TEXCOORD_0']).astype(float))) * f
                else: C = np.tile(f, (len(P), 1))   # faktor glTF sudah linear
                Ps.append(P); Ns.append(N); Cs.append(C); Is.append(glbkit.acc(g, B, pr['indices']).reshape(-1, 3).astype(np.int64) + base); base += len(P)
        for c in n.get('children', []): walk(c, M)
    for r in g['scenes'][0]['nodes']: walk(r, np.eye(4))
    P, N, C, I = np.vstack(Ps), np.vstack(Ns), np.vstack(Cs), np.vstack(Is); N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
    P = H.normalize(P, S)
    out = out or os.path.join(H.OUT, 'indomaret.glb')
    sz = H.write(out, P, N, I, C=np.clip(C, 0, 1), name='indomaret', rough=0.85)
    print(f'indomaret.glb: {len(I)} segitiga, {len(P)} vertex, {sz/1024:.0f} KB, ukuran (x,y,z) {np.ptp(P, axis=0).round(2)} m')

if __name__ == '__main__':
    main(sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else 0.38)
