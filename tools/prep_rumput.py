#!/usr/bin/env python3
"""Ekstrak 3 tuft rumput (r12_a/b/c) dari 'Simple grass chunks' (3dhdscan, CC BY 4.0) -> assets/kenney/rumput/tufts.glb.
Pakai: python3 tools/prep_rumput.py <simple_grass_chunks.glb> assets/kenney/rumput/tufts.glb [ukuran_tekstur=512]
Z-up (cm, FBX) -> Y-up (m): (x,y,z)->(x,z,-y)*0.01, alas y=0. Tekstur atlas RGBA: piksel transparan diisi hijau daun (hindari halo cokelat saat mipmap)."""
import json, struct, sys, io, numpy as np
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]; TS = int(sys.argv[3]) if len(sys.argv) > 3 else 512
d = open(src, 'rb').read(); L = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20+L]); o = 20 + L
bl = struct.unpack('<I', d[o:o+4])[0]; B = d[o+8:o+8+bl]
def acc(i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    nc = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]; ct = {5126: '<f4', 5123: '<u2', 5125: '<u4'}[a['componentType']]
    st = bv.get('byteStride')
    if st and st != nc * np.dtype(ct).itemsize:
        raw = np.frombuffer(B, dtype=np.uint8)[off:off + st * a['count']].reshape(a['count'], st)[:, :nc * np.dtype(ct).itemsize].copy()
        return raw.view(ct).reshape(a['count'], nc)
    return np.frombuffer(B, dtype=ct, count=a['count'] * nc, offset=off).reshape(a['count'], nc)
mat = j['materials'][3]; ti = mat['extensions']['KHR_materials_pbrSpecularGlossiness']['diffuseTexture']['index']
iv = j['bufferViews'][j['images'][j['textures'][ti]['source']]['bufferView']]
im = Image.open(io.BytesIO(B[iv['byteOffset']:iv['byteOffset'] + iv['byteLength']])).convert('RGBA')
a = np.array(im); m = a[..., 3] < 8; a[m, :3] = (96, 128, 52)   # latar transparan -> hijau daun
im = Image.fromarray(a).resize((TS, TS), Image.LANCZOS); buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True); png = buf.getvalue()
blob = bytearray(); views = []; accs = []; meshes = []; nodes = []
def addv(data, target=None):
    while len(blob) % 4: blob.append(0)
    views.append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(data), **({'target': target} if target else {})}); blob.extend(data); return len(views) - 1
def adda(arr, ct, typ, mn=None, mx=None):
    acc_ = {'bufferView': addv(arr.tobytes(), 34963 if typ == 'SCALAR' else 34962), 'componentType': ct, 'count': len(arr), 'type': typ}
    if mn is not None: acc_['min'] = mn; acc_['max'] = mx
    accs.append(acc_); return len(accs) - 1
for k, mi in enumerate((5, 4, 6)):   # a, b, c
    pr = j['meshes'][mi]['primitives'][0]; P = acc(pr['attributes']['POSITION']).astype('f4'); N = acc(pr['attributes']['NORMAL']).astype('f4')
    U = acc(pr['attributes']['TEXCOORD_0']).astype('f4'); I = acc(pr['indices']).astype('u2').reshape(-1)
    P = np.stack([P[:, 0], P[:, 2], -P[:, 1]], 1) * 0.01; N = np.stack([N[:, 0], N[:, 2], -N[:, 1]], 1)
    P[:, 1] -= P[:, 1].min(); P = P.astype('f4')
    meshes.append({'name': 'tuft_' + 'abc'[k], 'primitives': [{'attributes': {'POSITION': adda(P, 5126, 'VEC3', P.min(0).tolist(), P.max(0).tolist()), 'NORMAL': adda(N.astype('f4'), 5126, 'VEC3'), 'TEXCOORD_0': adda(U, 5126, 'VEC2')}, 'indices': adda(I, 5123, 'SCALAR'), 'material': 0}]})
    nodes.append({'name': 'tuft_' + 'abc'[k], 'mesh': k}); print('tuft', 'abc'[k], len(P), 'verts', len(I) // 3, 'tris', 'size', (P.max(0) - P.min(0)).round(2))
iv2 = addv(png)
g = {'asset': {'version': '2.0', 'generator': 'prep_rumput.py', 'extras': {'author': '3dhdscan (https://sketchfab.com/3dhdscan)', 'license': 'CC-BY-4.0', 'source': 'https://sketchfab.com/3d-models/simple-grass-chunks-eb4f6dc9d4e3455ea3435385faf58b60', 'title': 'Simple grass chunks (3 tuft diekstrak, tekstur diperkecil)'}},
     'scene': 0, 'scenes': [{'nodes': [0, 1, 2]}], 'nodes': nodes, 'meshes': meshes, 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(blob)}],
     'images': [{'bufferView': iv2, 'mimeType': 'image/png'}], 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}], 'textures': [{'sampler': 0, 'source': 0}],
     'materials': [{'name': 'rumput', 'doubleSided': True, 'alphaMode': 'MASK', 'alphaCutoff': 0.5, 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 1}}]}
g['buffers'][0]['byteLength'] = len(blob)
js = json.dumps(g, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
while len(blob) % 4: blob.append(0)
out = b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(blob)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(blob)) + b'BIN\0' + bytes(blob)
open(dst, 'wb').write(out); print('OK', dst, len(out) // 1024, 'KB')
