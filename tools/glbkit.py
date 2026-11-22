"""Perkakas kecil GLB (numpy) untuk tools/prep_npc_chars.py: baca accessor, matriks node, tulis GLB baru."""
import json, struct
import numpy as np

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def load(path):
    d = open(path, 'rb').read(); n = struct.unpack_from('<I', d, 12)[0]
    g = json.loads(d[20:20 + n]); return g, d[20 + n + 8:]

def acc(g, B, i):
    a = g['accessors'][i]; v = g['bufferViews'][a['bufferView']]; c = NC[a['type']]; dt = CT[a['componentType']]
    isz = np.dtype(dt).itemsize; st = v.get('byteStride', c * isz); off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    arr = np.ndarray((a['count'], c), dtype=dt, buffer=B, offset=off, strides=(st, isz)).copy()
    if a.get('normalized'): arr = arr.astype(np.float32) / (np.iinfo(dt).max if np.issubdtype(dt, np.integer) else 1)
    return arr

def image_bytes(g, B, i):
    v = g['bufferViews'][g['images'][i]['bufferView']]; o = v.get('byteOffset', 0); return B[o:o + v['byteLength']]

def qmat(q):
    x, y, z, w = q
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])

def mat_to_q(R):
    t = np.trace(R)
    if t > 0:
        s = np.sqrt(t + 1) * 2; q = [(R[2, 1]-R[1, 2])/s, (R[0, 2]-R[2, 0])/s, (R[1, 0]-R[0, 1])/s, s/4]
    elif R[0, 0] > R[1, 1] and R[0, 0] > R[2, 2]:
        s = np.sqrt(1 + R[0, 0] - R[1, 1] - R[2, 2]) * 2; q = [s/4, (R[0, 1]+R[1, 0])/s, (R[0, 2]+R[2, 0])/s, (R[2, 1]-R[1, 2])/s]
    elif R[1, 1] > R[2, 2]:
        s = np.sqrt(1 + R[1, 1] - R[0, 0] - R[2, 2]) * 2; q = [(R[0, 1]+R[1, 0])/s, s/4, (R[1, 2]+R[2, 1])/s, (R[0, 2]-R[2, 0])/s]
    else:
        s = np.sqrt(1 + R[2, 2] - R[0, 0] - R[1, 1]) * 2; q = [(R[0, 2]+R[2, 0])/s, (R[1, 2]+R[2, 1])/s, s/4, (R[1, 0]-R[0, 1])/s]
    q = np.array(q); return q / np.linalg.norm(q)

def qmul(a, b):   # (x,y,z,w) a*b
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return np.array([aw*bx+ax*bw+ay*bz-az*by, aw*by-ax*bz+ay*bw+az*bx, aw*bz+ax*by-ay*bx+az*bw, aw*bw-ax*bx-ay*by-az*bz])

def qaxis(axis, ang):
    a = np.asarray(axis, float); a = a / np.linalg.norm(a); s = np.sin(ang / 2); return np.array([a[0]*s, a[1]*s, a[2]*s, np.cos(ang / 2)])

def qinv(q): return np.array([-q[0], -q[1], -q[2], q[3]])

def qrot(q, v): return qmat(q) @ np.asarray(v, float)

def node_local(nd):
    return np.array(nd.get('translation', [0, 0, 0]), float), np.array(nd.get('rotation', [0, 0, 0, 1]), float), np.array(nd.get('scale', [1, 1, 1]), float)

def pad4(b, fill=b'\0'):
    return b + fill * (-len(b) % 4)

class Writer:
    """Penulis glTF minimal: tambah accessor/bufferView, lalu simpan .glb"""
    def __init__(self): self.bin = bytearray(); self.bv = []; self.ac = []
    def view(self, data, target=None):
        while len(self.bin) % 4: self.bin.append(0)
        o = len(self.bin); self.bin += data; v = {'buffer': 0, 'byteOffset': o, 'byteLength': len(data)}
        if target: v['target'] = target
        self.bv.append(v); return len(self.bv) - 1
    def accessor(self, arr, ctype, typ, target=None, minmax=False, normalized=False):
        arr = np.ascontiguousarray(arr); bvi = self.view(arr.tobytes(), target)
        a = {'bufferView': bvi, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': typ}
        if normalized: a['normalized'] = True
        if minmax: a['min'] = [float(x) for x in arr.min(0)]; a['max'] = [float(x) for x in arr.max(0)]
        self.ac.append(a); return len(self.ac) - 1
    def save(self, path, gltf):
        gltf['bufferViews'] = self.bv; gltf['accessors'] = self.ac; gltf['buffers'] = [{'byteLength': len(self.bin)}]
        js = pad4(json.dumps(gltf, separators=(',', ':')).encode(), b' '); bn = pad4(bytes(self.bin))
        open(path, 'wb').write(struct.pack('<4sII', b'glTF', 2, 28 + len(js) + len(bn)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(bn), b'BIN\0') + bn)
