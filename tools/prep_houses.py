#!/usr/bin/env python3
"""Iterasi 63: dua model rumah Sketchfab (CC BY 4.0) -> varian rumah kampung (assets/kenney/rumah/*.glb).
Pakai: python3 tools/prep_houses.py old_house_with_rusty_roof_3d_model_free.glb old_indonesian_simple_house.glb abadoned_building__lowpoly.glb
 rusty.glb: \"Old house with rusty roof 3d model free\" (iGauravRajput) 137 rb segitiga/11 MB -> ~3 rb segitiga (anggaran: puluhan instance terlihat sekaligus), tanpa tekstur (warna disimpan per-vertex, hasil sampling tekstur basecolor), skala x11, depan (tangga) = -Z
 indo.glb : \"[old] Indonesian Simple House\" (sakit.jawa) 268 segitiga, transform node dibake, putar 90 derajat (teras +X -> -Z), skala x1.5, tekstur 1024x512 PNG -> 512x256 JPEG
 abandoned.glb: \"Abadoned Building | Lowpoly\" (Frid.blend) 14,8 rb segitiga/3 tekstur -> ~3,5 rb, warna per-vertex, diputar 180 (sisi grafiti = -Z)
Keluaran: alas y=0, pusat x=z=0, satuan meter, depan (teras/tangga/pintu) = -Z (sama dengan modul retro-urban di buildings.js)."""
import sys, io, json, struct, os
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glbkit

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'kenney', 'rumah')
os.makedirs(OUT, exist_ok=True)
RUSTY_S, INDO_S, RUSTY_TRIS = 11.0, 1.5, 3000

def s2l(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def tex_sample(tex, U):
    a = np.asarray(tex, dtype=float) / 255; h, w, _ = a.shape
    return a[np.clip((U[:, 1] % 1) * (h - 1), 0, h - 1).astype(int), np.clip((U[:, 0] % 1) * (w - 1), 0, w - 1).astype(int)]

def cluster(P, N, C, I, cell):
    mn = P.min(0); q = np.floor((P - mn) / cell).astype(np.int64)
    key = q[:, 0] + q[:, 1] * 1000003 + q[:, 2] * 1000003 * 1000003
    _, inv = np.unique(key, return_inverse=True); k = inv.max() + 1; cnt = np.bincount(inv, minlength=k)[:, None]
    P2 = np.zeros((k, 3)); N2 = np.zeros((k, 3)); C2 = np.zeros((k, 3)); np.add.at(P2, inv, P); np.add.at(N2, inv, N); np.add.at(C2, inv, C); P2 /= cnt; C2 /= cnt
    N2 /= np.linalg.norm(N2, axis=1, keepdims=True) + 1e-12
    T = inv[I]; T = T[(T[:, 0] != T[:, 1]) & (T[:, 1] != T[:, 2]) & (T[:, 0] != T[:, 2])]
    T = np.unique(np.sort(T, axis=1), axis=0)   # buang duplikat; urutan sisi hilang -> arahkan ulang lewat normal rata-rata
    n = np.cross(P2[T[:, 1]] - P2[T[:, 0]], P2[T[:, 2]] - P2[T[:, 0]]); flip = (n * N2[T].sum(1)).sum(1) < 0; T[flip] = T[flip][:, [0, 2, 1]]
    used = np.unique(T); rm = -np.ones(k, int); rm[used] = np.arange(len(used))
    return P2[used], N2[used], C2[used], rm[T]

def write(path, P, N, I, UV=None, C=None, tex_jpg=None, name='house', rough=0.9):
    w = glbkit.Writer(); at = {'POSITION': w.accessor(P.astype(np.float32), 5126, 'VEC3', 34962, True), 'NORMAL': w.accessor(N.astype(np.float32), 5126, 'VEC3', 34962)}
    if UV is not None: at['TEXCOORD_0'] = w.accessor(UV.astype(np.float32), 5126, 'VEC2', 34962)
    if C is not None: at['COLOR_0'] = w.accessor(C.astype(np.float32), 5126, 'VEC3', 34962)
    big = len(P) > 65535; ii = w.accessor(I.reshape(-1, 1).astype(np.uint32 if big else np.uint16), 5125 if big else 5123, 'SCALAR', 34963); w.ac[ii]['count'] = int(I.size)
    mat = {'name': name, 'doubleSided': True, 'pbrMetallicRoughness': {'metallicFactor': 0.0, 'roughnessFactor': rough}}
    g = {'asset': {'version': '2.0', 'generator': 'tools/prep_houses.py (iter 63)'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'name': name, 'mesh': 0}],
         'meshes': [{'name': name, 'primitives': [{'attributes': at, 'indices': ii, 'material': 0}]}], 'materials': [mat]}
    if tex_jpg:
        bv = w.view(tex_jpg); g['images'] = [{'bufferView': bv, 'mimeType': 'image/jpeg'}]; g['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]
        g['textures'] = [{'sampler': 0, 'source': 0}]; mat['pbrMetallicRoughness']['baseColorTexture'] = {'index': 0}
    w.save(path, g); return os.path.getsize(path)

def normalize(P, S):   # skala, pusat x/z, alas y=0
    P = P * S; lo, hi = P.min(0), P.max(0); return P - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])

def rusty(src):
    g, B = glbkit.load(src); Ps, Ns, Us, Is, base = [], [], [], [], 0
    for m in g['meshes']:
        pr = m['primitives'][0]; a = pr['attributes']; P = glbkit.acc(g, B, a['POSITION']).astype(float)
        Ps.append(P); Ns.append(glbkit.acc(g, B, a['NORMAL']).astype(float)); Us.append(glbkit.acc(g, B, a['TEXCOORD_0']).astype(float)); Is.append(glbkit.acc(g, B, pr['indices']).reshape(-1, 3).astype(np.int64) + base); base += len(P)
    P, N, U, I = np.vstack(Ps), np.vstack(Ns), np.vstack(Us), np.vstack(Is)   # dua node induk saling meniadakan (rotX -90 / +90) -> identitas; depan (tangga) sudah di -Z
    tex = Image.open(io.BytesIO(glbkit.image_bytes(g, B, 0))).convert('RGB'); C = s2l(tex_sample(tex, U))   # warna per-vertex dalam ruang linear (COLOR_0 glTF = linear)
    P = normalize(P, RUSTY_S); print(f'rusty asli: {len(I)} segitiga, ukuran {np.ptp(P, axis=0).round(2)} m')
    lo_c, hi_c = 0.05, 2.0
    for _ in range(25):   # cari ukuran sel supaya segitiga ~ RUSTY_TRIS
        c = (lo_c + hi_c) / 2; r = cluster(P, N, C, I, c)
        if len(r[3]) > RUSTY_TRIS: lo_c = c
        else: hi_c = c
    P2, N2, C2, T = cluster(P, N, C, I, hi_c)
    sz = write(os.path.join(OUT, 'rusty.glb'), P2, N2, T, C=np.clip(C2 * 1.35, 0, 1), name='house_rusty', rough=0.92)   # x1.35 (linear): tekstur asli gelap, hasil rata-rata per-vertex lebih kusam
    print(f'rusty.glb: sel {hi_c:.3f} m, {len(T)} segitiga, {len(P2)} vertex, {sz/1024:.0f} KB, ukuran {np.ptp(P2, axis=0).round(2)} m')

def indo(src):
    sys.path.insert(0, '/tmp/h'); 
    g, B = glbkit.load(src)
    def nm(n):
        if 'matrix' in n: return np.array(n['matrix'], float).reshape(4, 4).T
        m = np.eye(4)
        if 'scale' in n: m = m @ np.diag(list(n['scale']) + [1])
        if 'rotation' in n: R = np.eye(4); R[:3, :3] = glbkit.qmat(n['rotation']); m = R @ m
        if 'translation' in n: T = np.eye(4); T[:3, 3] = n['translation']; m = T @ m
        return m
    out = []
    def walk(i, M):
        n = g['nodes'][i]; M = M @ nm(n)
        if 'mesh' in n:
            for pr in g['meshes'][n['mesh']]['primitives']:
                a = pr['attributes']; P = glbkit.acc(g, B, a['POSITION']).astype(float); N = glbkit.acc(g, B, a['NORMAL']).astype(float)
                out.append(((np.c_[P, np.ones(len(P))] @ M.T)[:, :3], N @ np.linalg.inv(M[:3, :3]), glbkit.acc(g, B, a['TEXCOORD_0']).astype(float), glbkit.acc(g, B, pr['indices']).reshape(-1, 3).astype(np.int64)))
        for c in n.get('children', []): walk(c, M)
    for r in g['scenes'][0]['nodes']: walk(r, np.eye(4))
    Ps, Ns, Us, Is, base = [], [], [], [], 0
    for P, N, U, I in out: Ps.append(P); Ns.append(N); Us.append(U); Is.append(I + base); base += len(P)
    P, N, U, I = np.vstack(Ps), np.vstack(Ns), np.vstack(Us), np.vstack(Is)
    N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
    R = np.array([[0, 0, 1], [0, 1, 0], [-1, 0, 0]], float)   # putar +90 deg sumbu Y: (x,z) -> (z,-x); teras/pintu di +X -> -Z
    P = normalize(P @ R.T, INDO_S); N = N @ R.T
    tex = Image.open(io.BytesIO(glbkit.image_bytes(g, B, 0))).convert('RGB').resize((512, 256), Image.LANCZOS); jb = io.BytesIO(); tex.save(jb, 'JPEG', quality=88)
    sz = write(os.path.join(OUT, 'indo.glb'), P, N, I, UV=U, tex_jpg=jb.getvalue(), name='house_indo', rough=0.8)
    print(f'indo.glb: {len(I)} segitiga, {sz/1024:.0f} KB, ukuran {np.ptp(P, axis=0).round(2)} m')

def abandoned(src, tris=3500):
    g, B = glbkit.load(src); Ps, Ns, Cs, Is, base = [], [], [], [], 0
    def nm(n):
        if 'matrix' in n: return np.array(n['matrix'], float).reshape(4, 4).T
        m = np.eye(4)
        if 'scale' in n: m = m @ np.diag(list(n['scale']) + [1])
        if 'rotation' in n: R = np.eye(4); R[:3, :3] = glbkit.qmat(n['rotation']); m = R @ m
        if 'translation' in n: T = np.eye(4); T[:3, 3] = n['translation']; m = T @ m
        return m
    texs = [np.asarray(Image.open(io.BytesIO(glbkit.image_bytes(g, B, i))).convert('RGB'), float) / 255 for i in range(len(g['images']))]
    def walk(i, M):
        nonlocal base
        n = g['nodes'][i]; M = M @ nm(n)
        if 'mesh' in n:
            for pr in g['meshes'][n['mesh']]['primitives']:
                a = pr['attributes']; P = glbkit.acc(g, B, a['POSITION']).astype(float); N = glbkit.acc(g, B, a['NORMAL']).astype(float); U = glbkit.acc(g, B, a['TEXCOORD_0']).astype(float)
                t = texs[g['materials'][pr['material']]['pbrMetallicRoughness']['baseColorTexture']['index']]; h, w, _ = t.shape
                C = s2l(t[np.clip((U[:, 1] % 1) * (h - 1), 0, h - 1).astype(int), np.clip((U[:, 0] % 1) * (w - 1), 0, w - 1).astype(int)])
                Ps.append((np.c_[P, np.ones(len(P))] @ M.T)[:, :3]); Ns.append(N @ np.linalg.inv(M[:3, :3])); Cs.append(C); Is.append(glbkit.acc(g, B, pr['indices']).reshape(-1, 3).astype(np.int64) + base); base += len(P)
        for c in n.get('children', []): walk(c, M)
    for r in g['scenes'][0]['nodes']: walk(r, np.eye(4))
    P, N, C, I = np.vstack(Ps), np.vstack(Ns), np.vstack(Cs), np.vstack(Is); N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
    P = normalize(P * np.array([-1, 1, -1]), 1.0); N = N * np.array([-1, 1, -1])   # putar 180 derajat: sisi grafiti (+Z) -> depan -Z
    print(f'abandoned asli: {len(I)} segitiga, ukuran {np.ptp(P, axis=0).round(2)} m')
    lo_c, hi_c = 0.05, 3.0
    for _ in range(25):
        c = (lo_c + hi_c) / 2
        if len(cluster(P, N, C, I, c)[3]) > tris: lo_c = c
        else: hi_c = c
    P2, N2, C2, T = cluster(P, N, C, I, hi_c)
    sz = write(os.path.join(OUT, 'abandoned.glb'), P2, N2, T, C=np.clip(C2 * 1.35, 0, 1), name='house_abandoned', rough=0.9)
    print(f'abandoned.glb: sel {hi_c:.3f} m, {len(T)} segitiga, {sz/1024:.0f} KB, ukuran {np.ptp(P2, axis=0).round(2)} m')

if __name__ == '__main__':
    rusty(sys.argv[1]); indo(sys.argv[2])
    if len(sys.argv) > 3: abandoned(sys.argv[3])
