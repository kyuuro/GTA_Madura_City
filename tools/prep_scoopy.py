#!/usr/bin/env python3
"""Iterasi 45: ubah HONDA_SCOOPY.glb (Sketchfab, 90k segitiga, 70 mesh, root miring) menjadi assets/motor.glb yang cocok dengan adapter assets.js.
Pakai: python3 tools/prep_scoopy.py HONDA_SCOOPY.glb assets/motor.glb
Yang dilakukan:
 1. Buang transform root miring ala Sketchfab, luruskan: atas = +Y, depan = +Z, panjang 1.9 m, alas di y=0, titik tengah di x=z=0.
 2. Pisah jadi 4 node rigid bernama: body, fork_front (stang, lampu depan, spakbor, garpu: ikut berbelok), roda_F, roda_R (berputar; sengaja BUKAN 'wheel_*' karena vehicles.js memutar semua node ^wheel -> putaran dobel).
 3. Sederhanakan geometri (vertex clustering) + gabung mesh per material -> belasan ribu segitiga, belasan draw call.
 4. Buang ekstensi clearcoat (shader lebih murah di HP), perkecil tekstur ke 256 px.
Nama node mengikuti WHEEL_RE / FORK_RE di src/assets.js, jadi roda otomatis dipasang pivot dan stang ikut belok."""
import json, struct, sys, io
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
d = open(src, 'rb').read()
jl = struct.unpack_from('<I', d, 12)[0]
g = json.loads(d[20:20 + jl]); B = d[20 + jl + 8:]

def qmat(nd):
    t = np.array(nd.get('translation', [0, 0, 0])); x, y, z, w = nd.get('rotation', [0, 0, 0, 1]); s = nd.get('scale', [1, 1, 1])
    R = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
    M = np.eye(4); M[:3, :3] = R * np.array(s); M[:3, 3] = t; return M

def acc(i):
    a = g['accessors'][i]; v = g['bufferViews'][a['bufferView']]
    cnt = {'VEC3': 3, 'VEC2': 2, 'SCALAR': 1}[a['type']]; off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}[a['componentType']]; isz = np.dtype(dt).itemsize
    st = v.get('byteStride', cnt * isz)
    return np.ndarray((a['count'], cnt), dtype=dt, buffer=B, offset=off, strides=(st, isz)).copy()

# ---- 1. kumpulkan primitif: (nama node puncak, material, P, N, UV, I) dalam frame node 1 (tanpa root miring) ----
FIX = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float)   # Rx(-90): frame model (atas=+Z, depan=-Y) -> game (atas=+Y, depan=+Z)
M1 = qmat(g['nodes'][1]); prims = []
def walk(i, P, top):
    nd = g['nodes'][i]; M = P @ qmat(nd)
    if 'mesh' in nd:
        for pr in g['meshes'][nd['mesh']]['primitives']:
            p = acc(pr['attributes']['POSITION']).astype(float); n = acc(pr['attributes']['NORMAL']).astype(float)
            uv = acc(pr['attributes']['TEXCOORD_0']).astype(float) if 'TEXCOORD_0' in pr['attributes'] else None
            idx = acc(pr['indices']).reshape(-1, 3).astype(np.int64)
            Rm = M[:3, :3]; p = (Rm @ p.T).T + M[:3, 3]
            n = (np.linalg.inv(Rm).T @ n.T).T; n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
            prims.append(dict(top=top, mat=pr.get('material', 0), P=p @ FIX.T, N=n @ FIX.T, UV=uv, I=idx))
    for c in nd.get('children', []): walk(c, M, top)
for c in g['nodes'][1]['children']: walk(c, M1, g['nodes'][c]['name'])

allp = np.vstack([p['P'] for p in prims]); lo, hi = allp.min(0), allp.max(0)
S = 1.9 / (hi[2] - lo[2]); off = np.array([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])
for p in prims: p['P'] = (p['P'] + off) * S
print(f'skala {S:.4f}, ukuran akhir (m): {((hi - lo) * S).round(3)}')

# ---- 2. kelompok rigid ----
WF = {'LIGD 1.000_51', 'DISC PLATE_12'}
WR = {'Circle.004_43', 'Circle.009_44'}
FK = {'tampaludo_6', 'telescopic right_11', 'Cylinder_14', 'Circle.005_13', 'manubela 1.002_17', 'manubela switch.002_18', 'manubela 1.000_19', 'manubela switch.000_20',
      'speedometer_29', 'fuel guage_30', 'manubela pink_54', 'headlight glass_5', 'headlight glass.001_9', 'Sphere_23', 'Sphere.001_24', 'Plane.001_4',
      'signal light.006_60', 'signal light front_61', 'Circle.006_55', 'Circle.007_56', 'Circle.010_57', 'Cylinder.001_62'}
def grp(t): return 'roda_F' if t in WF else 'roda_R' if t in WR else 'fork_front' if t in FK else 'body'

# ---- 3. sederhanakan (vertex clustering) ----
def cluster(p, cell):
    mn = p['P'].min(0); q = np.floor((p['P'] - mn) / cell).astype(np.int64)
    key = q[:, 0] + q[:, 1] * 1000003 + q[:, 2] * 1000003 * 1000003
    _, first, inv = np.unique(key, return_index=True, return_inverse=True); k = len(first); cnt = np.bincount(inv, minlength=k)[:, None]
    P = np.zeros((k, 3)); N = np.zeros((k, 3)); np.add.at(P, inv, p['P']); np.add.at(N, inv, p['N']); P /= cnt
    nl = np.linalg.norm(N, axis=1, keepdims=True); N = np.where(nl > 1e-6, N / np.maximum(nl, 1e-12), [0, 1, 0])
    UV = None
    if p['UV'] is not None: UV = np.zeros((k, 2)); np.add.at(UV, inv, p['UV']); UV /= cnt
    T = inv[p['I']]; T = T[(T[:, 0] != T[:, 1]) & (T[:, 1] != T[:, 2]) & (T[:, 0] != T[:, 2])]
    T = np.unique(np.sort(T, axis=1), axis=0) if len(T) else T   # buang segitiga ganda (dua sisi panel tipis runtuh jadi satu; material doubleSided)
    return P, N, UV, T
def decimate(p, ratio, keep=300):
    n = len(p['I'])
    if n <= keep: return p
    target = max(keep // 3, int(n * ratio)); diag = np.linalg.norm(p['P'].max(0) - p['P'].min(0)); lo_, hi_ = diag / 4000, diag / 2; best = None
    for _ in range(22):
        mid = (lo_ * hi_) ** 0.5; r = cluster(p, mid)
        if len(r[3]) > target: lo_ = mid
        else: hi_ = mid; best = r
    if best is None: best = cluster(p, hi_)
    P, N, UV, T = best; return dict(p, P=P, N=N, UV=UV, I=T)
RATIO = {'body': 0.14, 'fork_front': 0.30, 'roda_F': 0.33, 'roda_R': 0.33}
before = sum(len(p['I']) for p in prims)
prims = [decimate(p, RATIO[grp(p['top'])]) for p in prims]
print(f'segitiga {before} -> {sum(len(p["I"]) for p in prims)}')

# ---- 4. tulis GLB: 1 node per kelompok, 1 primitif per material ----
mats = json.loads(json.dumps(g['materials']))
for m in mats:
    if 'extensions' in m: m['extensions'].pop('KHR_materials_clearcoat', None); m.pop('extensions') if not m['extensions'] else None
binc = bytearray(); bvs = []; accs = []
def pad(): 
    while len(binc) % 4: binc.append(0)
def add_bv(data, target=None):
    pad(); bv = {'buffer': 0, 'byteOffset': len(binc), 'byteLength': len(data)}
    if target: bv['target'] = target
    binc.extend(data); bvs.append(bv); return len(bvs) - 1
def add_acc(arr, ctype, typ, target, minmax=False):
    a = {'bufferView': add_bv(arr.tobytes(), target), 'componentType': ctype, 'count': len(arr), 'type': typ}
    if minmax: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
    accs.append(a); return len(accs) - 1
nodes = [{'name': 'motor_scoopy', 'children': [1, 2, 3, 4]}]; meshes = []; info = {}
for gi, gname in enumerate(['body', 'fork_front', 'roda_F', 'roda_R']):
    bymat = {}
    for p in prims:
        if grp(p['top']) == gname: bymat.setdefault(p['mat'], []).append(p)
    mprims = []
    for mi, lst in sorted(bymat.items()):
        useuv = any(x['UV'] is not None for x in lst); Pm, Nm, Um, Im = [], [], [], []; base = 0
        for x in lst:
            Pm.append(x['P']); Nm.append(x['N']); Im.append(x['I'] + base); base += len(x['P'])
            if useuv: Um.append(x['UV'] if x['UV'] is not None else np.zeros((len(x['P']), 2)))
        Pm = np.vstack(Pm).astype(np.float32); Nm = np.vstack(Nm).astype(np.float32); Im = np.vstack(Im)
        at = {'POSITION': add_acc(Pm, 5126, 'VEC3', 34962, True), 'NORMAL': add_acc(Nm, 5126, 'VEC3', 34962)}
        if useuv: at['TEXCOORD_0'] = add_acc(np.vstack(Um).astype(np.float32), 5126, 'VEC2', 34962)
        flat = Im.reshape(-1); ii = add_acc(flat.astype(np.uint16 if Pm.shape[0] < 65535 else np.uint32).reshape(-1, 1), 5123 if Pm.shape[0] < 65535 else 5125, 'SCALAR', 34963)
        accs[ii]['count'] = len(flat)
        mprims.append({'attributes': at, 'indices': ii, 'material': mi})
    meshes.append({'name': gname, 'primitives': mprims}); nodes.append({'name': gname, 'mesh': gi})
    pts = np.vstack([np.vstack([x['P'] for x in lst]) for lst in bymat.values()]); info[gname] = ((pts.min(0) + pts.max(0)) / 2, sum(len(x['I']) for l in bymat.values() for x in l), len(mprims))
images = []
for im in g['images']:
    bv = g['bufferViews'][im['bufferView']]; img = Image.open(io.BytesIO(B[bv['byteOffset']:bv['byteOffset'] + bv['byteLength']])).convert('RGB')
    if max(img.size) > 256: img = img.resize((256, 256), Image.LANCZOS)
    out = io.BytesIO(); img.save(out, 'JPEG', quality=82); images.append({'name': im.get('name', ''), 'bufferView': add_bv(out.getvalue()), 'mimeType': 'image/jpeg'})
pad()
out = {'asset': {'version': '2.0', 'generator': 'tools/prep_scoopy.py (iter 45)'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': nodes, 'meshes': meshes, 'materials': mats,
       'textures': g['textures'], 'samplers': g['samplers'], 'images': images, 'accessors': accs, 'bufferViews': bvs, 'buffers': [{'byteLength': len(binc)}]}
js = json.dumps(out, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
open(dst, 'wb').write(struct.pack('<4sII', b'glTF', 2, 28 + len(js) + len(binc)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(binc), b'BIN\0') + bytes(binc))
for k, (c, t, m) in info.items(): print(f'  {k:11s} pusat {c.round(3)}  {t} segitiga, {m} material')
print(f'ditulis {dst}: {(28 + len(js) + len(binc)) / 1024:.0f} KB')
