#!/usr/bin/env python3
"""Iterasi 79: ubah beat.glb & mio.glb (diberikan user; export three.js, node bernama empty_N) menjadi assets/beat.glb & assets/mio.glb
yang cocok dengan adapter assets.js (sama seperti prep_scoopy.py): 4 node rigid body / fork_front / roda_F / roda_R, depan = +Z, atas = +Y,
alas y=0, tengah x=z=0, panjang 1.9 m (adapter menskalakan lagi ke MODEL_CFG.length).
Pakai: python3 tools/prep_motor2.py beat beat.glb assets/beat.glb
       python3 tools/prep_motor2.py mio  mio.glb  assets/mio.glb
Kelompok ditentukan dari INDEKS NODE (nama asli kosong): lihat CFG. Beat: depan = -X. Mio: depan = +X.
Sederhanakan geometri dengan vertex clustering (mio 68 rb -> ~9 rb segitiga), tekstur diperkecil -> JPEG."""
import json, struct, sys, io
import numpy as np
from PIL import Image

kind, src, dst = sys.argv[1], sys.argv[2], sys.argv[3]
d = open(src, 'rb').read(); jl = struct.unpack_from('<I', d, 12)[0]
g = json.loads(d[20:20 + jl]); B = d[20 + jl + 8:]

# ---- konfigurasi per model ----
CFG = {
    'beat': dict(yaw=90, wf={23, 24}, wr={25, 26},
                 fork={16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 40, 41, 42, 52, 53},
                 ratio=dict(body=1.0, fork_front=1.0, roda_F=0.45, roda_R=0.45)),
    'mio': dict(yaw=-90, wf={56, 57, 120, 121, 122, 123, 124, 125}, wr={8, 9, 42, 43, 44, 45, 46, 47},
                fork=lambda c: c[0] > 1.25 or c[1] > 1.0,          # pusat node (x,y) model asli: sekitar roda depan + kelompok stang/spidometer/spion
                ratio=dict(body=0.10, fork_front=0.12, roda_F=0.10, roda_R=0.10), keep=120, tex=dict(max=512)),
}[kind]

def qmat(nd):
    if 'matrix' in nd: return np.array(nd['matrix']).reshape(4, 4).T
    t = np.array(nd.get('translation', [0, 0, 0])); x, y, z, w = nd.get('rotation', [0, 0, 0, 1]); s = nd.get('scale', [1, 1, 1])
    R = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
    M = np.eye(4); M[:3, :3] = R * np.array(s); M[:3, 3] = t; return M

def acc(i):
    a = g['accessors'][i]; v = g['bufferViews'][a['bufferView']]
    cnt = {'VEC3': 3, 'VEC2': 2, 'SCALAR': 1}[a['type']]; off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}[a['componentType']]; isz = np.dtype(dt).itemsize
    st = v.get('byteStride', cnt * isz)
    return np.ndarray((a['count'], cnt), dtype=dt, buffer=B, offset=off, strides=(st, isz)).copy()

# ---- 1. kumpulkan primitif per node, ke frame game (putar yaw di sumbu Y) ----
th = np.radians(CFG['yaw']); ROT = np.array([[np.cos(th), 0, np.sin(th)], [0, 1, 0], [-np.sin(th), 0, np.cos(th)]])
prims = []
def walk(i, P):
    nd = g['nodes'][i]; M = P @ qmat(nd)
    if 'mesh' in nd:
        for pr in g['meshes'][nd['mesh']]['primitives']:
            p = acc(pr['attributes']['POSITION']).astype(float); Rm = M[:3, :3]; p = (Rm @ p.T).T + M[:3, 3]
            idx = acc(pr['indices']).reshape(-1, 3).astype(np.int64) if 'indices' in pr else np.arange(len(p)).reshape(-1, 3)
            if np.linalg.det(Rm) < 0: idx = idx[:, ::-1]                      # transform cermin -> balik urutan segitiga
            if 'NORMAL' in pr['attributes']:
                n = acc(pr['attributes']['NORMAL']).astype(float); n = (np.linalg.inv(Rm).T @ n.T).T; n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
            else:
                n = np.zeros_like(p); fn = np.cross(p[idx[:, 1]] - p[idx[:, 0]], p[idx[:, 2]] - p[idx[:, 0]])
                for k in range(3): np.add.at(n, idx[:, k], fn)
                n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
            uv = acc(pr['attributes']['TEXCOORD_0']).astype(float) if 'TEXCOORD_0' in pr['attributes'] else None
            prims.append(dict(node=i, mat=pr.get('material', 0), P=p, N=n, UV=uv, I=idx, c=p.mean(0)))
    for c in nd.get('children', []): walk(c, M)
for r in g['scenes'][g.get('scene', 0)]['nodes']: walk(r, np.eye(4))

def grp(p):
    i = p['node']
    if i in CFG['wf']: return 'roda_F'
    if i in CFG['wr']: return 'roda_R'
    f = CFG['fork']
    if (f(p['c']) if callable(f) else i in f): return 'fork_front'
    return 'body'
for p in prims: p['grp'] = grp(p)

# ---- 2. ke frame game: putar yaw, alas y=0, tengah x=z=0, panjang 1.9 m ----
for p in prims: p['P'] = p['P'] @ ROT.T; p['N'] = p['N'] @ ROT.T
allp = np.vstack([p['P'] for p in prims]); lo, hi = allp.min(0), allp.max(0)
S = 1.9 / (hi[2] - lo[2]); off = np.array([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])
for p in prims: p['P'] = (p['P'] + off) * S
print(f'{kind}: skala {S:.4f}, ukuran akhir (m): {((hi - lo) * S).round(3)}, segitiga awal {sum(len(p["I"]) for p in prims)}')

# ---- 3. sederhanakan (vertex clustering, sama dengan prep_scoopy.py) ----
def cluster(p, cell):
    mn = p['P'].min(0); q = np.floor((p['P'] - mn) / cell).astype(np.int64)
    key = q[:, 0] + q[:, 1] * 1000003 + q[:, 2] * 1000003 * 1000003
    _, first, inv = np.unique(key, return_index=True, return_inverse=True); k = len(first); cnt = np.bincount(inv, minlength=k)[:, None]
    P = np.zeros((k, 3)); N = np.zeros((k, 3)); np.add.at(P, inv, p['P']); np.add.at(N, inv, p['N']); P /= cnt
    nl = np.linalg.norm(N, axis=1, keepdims=True); N = np.where(nl > 1e-6, N / np.maximum(nl, 1e-12), [0, 1, 0])
    UV = None
    if p['UV'] is not None: UV = np.zeros((k, 2)); np.add.at(UV, inv, p['UV']); UV /= cnt
    T = inv[p['I']]; T = T[(T[:, 0] != T[:, 1]) & (T[:, 1] != T[:, 2]) & (T[:, 0] != T[:, 2])]
    if len(T):                                                                  # buang segitiga ganda (dua sisi panel tipis runtuh jadi satu)
        _, ui = np.unique(np.sort(T, axis=1), axis=0, return_index=True); T = T[np.sort(ui)]
    return P, N, UV, T
def decimate(p, ratio, keep=300):
    n = len(p['I'])
    if ratio >= 1 or n <= keep: return p
    target = max(keep // 3, int(n * ratio)); diag = np.linalg.norm(p['P'].max(0) - p['P'].min(0)); lo_, hi_ = diag / 4000, diag / 2; best = None
    for _ in range(22):
        mid = (lo_ * hi_) ** 0.5; r = cluster(p, mid)
        if len(r[3]) > target: lo_ = mid
        else: hi_ = mid; best = r
    if best is None: best = cluster(p, hi_)
    P, N, UV, T = best; return dict(p, P=P, N=N, UV=UV, I=T)
before = sum(len(p['I']) for p in prims)
prims = [decimate(p, CFG['ratio'][p['grp']], CFG.get('keep', 300)) for p in prims]
print(f'segitiga {before} -> {sum(len(p["I"]) for p in prims)}')

# ---- 4. tulis GLB: 1 node per kelompok, 1 primitif per material ----
mats0 = json.loads(json.dumps(g['materials']))
for m in mats0:
    m.pop('extras', None)
    if 'extensions' in m: m.pop('extensions')
# gabung material kembar (warna/tekstur sama, beda nama/doubleSided saja) -> jauh lebih sedikit draw call per motor; doubleSided kalau salah satu doubleSided
def mkey(m):
    pb = m.get('pbrMetallicRoughness', {}); return (tuple(round(x, 2) for x in pb.get('baseColorFactor', [1, 1, 1, 1])), pb.get('baseColorTexture', {}).get('index'), m.get('alphaMode', 'OPAQUE'))
remap, mats, seen = {}, [], {}
for i, m in enumerate(mats0):
    k = mkey(m)
    if k not in seen: seen[k] = len(mats); mats.append(json.loads(json.dumps(m)))
    elif m.get('doubleSided'): mats[seen[k]]['doubleSided'] = True
    remap[i] = seen[k]
for p in prims: p['mat'] = remap[p['mat']]
print(f'material {len(mats0)} -> {len(mats)}')
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
# ---- material: yang polos / bertekstur kecil (<=256 px, mis. logam) dipanggang jadi WARNA PER-VERTEX -> 1 primitif 'vcol' per kelompok (draw call jauh lebih sedikit);
#      hanya tekstur besar (cat/stiker badan) dan kaca transparan yang tetap jadi material sendiri ----
def srgb2lin(c): c = np.asarray(c, float); return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
IMG = {}
def pil(i):
    if i not in IMG:
        bv = g['bufferViews'][g['images'][i]['bufferView']]; IMG[i] = Image.open(io.BytesIO(B[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])).convert('RGB')
    return IMG[i]
flat = {}
for i, m in enumerate(mats):
    pb = m.get('pbrMetallicRoughness', {}); bc = np.array(pb.get('baseColorFactor', [1, 1, 1, 1]), float); t = pb.get('baseColorTexture', {}).get('index')
    if m.get('alphaMode') == 'BLEND': continue
    if t is None: flat[i] = bc[:3]; continue
    im = pil(g['textures'][t]['source'])
    if max(im.size) <= 256: flat[i] = bc[:3] * srgb2lin(np.asarray(im.resize((16, 16))).reshape(-1, 3).mean(0) / 255)
keep = sorted({p['mat'] for p in prims if len(p['I']) and p['mat'] not in flat})
newidx = {m: j + 1 for j, m in enumerate(keep)}                                  # 0 = 'vcol'
fmats = [{'name': 'vcol', 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0, 'roughnessFactor': 0.9}, 'doubleSided': True}]
used_t = sorted({mats[m].get('pbrMetallicRoughness', {}).get('baseColorTexture', {}).get('index') for m in keep} - {None}); tmap = {t: j for j, t in enumerate(used_t)}
for m in keep:
    mm = json.loads(json.dumps(mats[m])); pb = mm.get('pbrMetallicRoughness', {})
    if 'baseColorTexture' in pb: pb['baseColorTexture']['index'] = tmap[pb['baseColorTexture']['index']]
    fmats.append(mm)
nodes = [{'name': 'motor_' + kind, 'children': [1, 2, 3, 4]}]; meshes = []; info = {}
for gi, gname in enumerate(['body', 'fork_front', 'roda_F', 'roda_R']):
    mprims = []; lst_g = [p for p in prims if p['grp'] == gname and len(p['I'])]
    def emit(lst, mat, vcol):
        useuv = (not vcol) and any(x['UV'] is not None for x in lst); Pm, Nm, Um, Cm, Im = [], [], [], [], []; base = 0
        for x in lst:
            Pm.append(x['P']); Nm.append(x['N']); Im.append(x['I'] + base); base += len(x['P'])
            if useuv: Um.append(x['UV'] if x['UV'] is not None else np.zeros((len(x['P']), 2)))
            if vcol: Cm.append(np.tile(flat[x['mat']], (len(x['P']), 1)))
        Pm = np.vstack(Pm).astype(np.float32); Nm = np.vstack(Nm).astype(np.float32); Im = np.vstack(Im)
        at = {'POSITION': add_acc(Pm, 5126, 'VEC3', 34962, True), 'NORMAL': add_acc(Nm, 5126, 'VEC3', 34962)}
        if useuv: at['TEXCOORD_0'] = add_acc(np.vstack(Um).astype(np.float32), 5126, 'VEC2', 34962)
        if vcol: at['COLOR_0'] = add_acc(np.vstack(Cm).astype(np.float32), 5126, 'VEC3', 34962)
        flatI = Im.reshape(-1); big = Pm.shape[0] >= 65535
        ii = add_acc(flatI.astype(np.uint32 if big else np.uint16).reshape(-1, 1), 5125 if big else 5123, 'SCALAR', 34963); accs[ii]['count'] = len(flatI)
        mprims.append({'attributes': at, 'indices': ii, 'material': mat})
    fl = [p for p in lst_g if p['mat'] in flat]
    if fl: emit(fl, 0, True)
    for m in keep:
        lm = [p for p in lst_g if p['mat'] == m]
        if lm: emit(lm, newidx[m], False)
    meshes.append({'name': gname, 'primitives': mprims}); nodes.append({'name': gname, 'mesh': gi})
    pts = np.vstack([x['P'] for x in lst_g]); info[gname] = ((pts.min(0) + pts.max(0)) / 2, sum(len(x['I']) for x in lst_g), len(mprims))
images = []
for t in used_t:
    ii = g['textures'][t]['source']; img = pil(ii); lim = CFG.get('tex', {}).get('max', 256)
    if max(img.size) > lim: img = img.resize((lim, max(1, round(lim * img.size[1] / img.size[0]))) if img.size[0] >= img.size[1] else (max(1, round(lim * img.size[0] / img.size[1])), lim), Image.LANCZOS)
    out = io.BytesIO(); img.save(out, 'JPEG', quality=84); images.append({'name': g['images'][ii].get('name', ''), 'bufferView': add_bv(out.getvalue()), 'mimeType': 'image/jpeg'})
pad()
out = {'asset': {'version': '2.0', 'generator': 'tools/prep_motor2.py (iter 79)'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': nodes, 'meshes': meshes, 'materials': fmats,
       'accessors': accs, 'bufferViews': bvs, 'buffers': [{'byteLength': len(binc)}]}
if images:
    out['images'] = images; out['textures'] = [dict({'source': j}, **({'sampler': g['textures'][t]['sampler']} if 'sampler' in g['textures'][t] else {})) for j, t in enumerate(used_t)]
    if g.get('samplers'): out['samplers'] = g['samplers']
js = json.dumps(out, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
open(dst, 'wb').write(struct.pack('<4sII', b'glTF', 2, 28 + len(js) + len(binc)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(binc), b'BIN\0') + bytes(binc))
for k, (c, t, m) in info.items(): print(f'  {k:11s} pusat {c.round(3)}  {t} segitiga, {m} material')
print(f'ditulis {dst}: {(28 + len(js) + len(binc)) / 1024:.0f} KB')
