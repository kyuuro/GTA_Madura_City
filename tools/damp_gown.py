#!/usr/bin/env python3
"""Iterasi 84: kecilkan ayunan kaki klip Run untuk model ber-gamis panjang (npc_melayu): hem gamis + kaki ikut ditarik penuh sehingga lembaran cokelat 'terseret' di belakang tumit.
Tiap keyframe rotasi (rest = identitas) di-slerp ke identitas dengan faktor k: paha UP, betis KNEE, kaki FOOT. Ubah in-place (ukuran berkas sama), idempoten TIDAK (jalankan dari berkas asli).
  python3 tools/damp_gown.py in.glb out.glb [up=0.45 knee=0.35 foot=0.4]"""
import sys, json, struct
import numpy as np
def slerp_id(q, k):                      # slerp(identitas, q, k), q (n,4) xyzw satuan
    q = q / np.linalg.norm(q, axis=1, keepdims=True); w = q[:, 3:4]; s = np.where(w < 0, -1, 1); q = q * s; w = np.clip(q[:, 3:4], -1, 1)
    th = np.arccos(w); sn = np.sin(th); ax = np.where(sn > 1e-6, q[:, :3] / np.maximum(sn, 1e-9), 0)
    t = th * k; out = np.concatenate([ax * np.sin(t), np.cos(t)], axis=1); return out / np.linalg.norm(out, axis=1, keepdims=True)
def main(src, dst, up=0.45, knee=0.35, foot=0.4):
    d = bytearray(open(src, 'rb').read()); n = struct.unpack_from('<I', d, 12)[0]; g = json.loads(bytes(d[20:20 + n])); bo = 20 + n + 8
    nodes = g['nodes']; fac = {'UpLeg': up, 'Leg': knee, 'Foot': foot}; done = 0
    for an in g['animations']:
        if an['name'] != 'Run': continue
        for c in an['channels']:
            nm = nodes[c['target']['node']]['name']; kind = 'UpLeg' if nm.endswith('UpLeg') else 'Foot' if nm.endswith('Foot') else 'Leg' if nm.endswith('Leg') else None
            if not kind or c['target']['path'] != 'rotation': continue
            o = g['accessors'][an['samplers'][c['sampler']]['output']]; bv = g['bufferViews'][o['bufferView']]; off = bo + bv.get('byteOffset', 0) + o.get('byteOffset', 0)
            assert o['componentType'] == 5126 and o['type'] == 'VEC4' and not bv.get('byteStride')
            arr = np.frombuffer(bytes(d[off:off + o['count'] * 16]), '<f4').reshape(-1, 4).astype(float)
            new = slerp_id(arr, fac[kind]).astype('<f4'); d[off:off + o['count'] * 16] = new.tobytes(); done += 1
    open(dst, 'wb').write(d); print('track diredam:', done)
if __name__ == '__main__':
    a = sys.argv; kw = dict(x.split('=') for x in a[3:]); main(a[1], a[2], **{k: float(v) for k, v in kw.items()})
