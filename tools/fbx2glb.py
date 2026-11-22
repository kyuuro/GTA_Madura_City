#!/usr/bin/env python3
"""FBX binary (Blender export, tanpa tekstur) -> GLB. Hanya numpy + stdlib. Pakai: fbx2glb.py in.fbx out.glb [--recolor nama=hex,...] [--yaw 180]"""
import sys, struct, json, math, numpy as np
sys.path.insert(0, __file__.rsplit('/',1)[0])
from fbxread import read_fbx

def props70(n):
    out = {}
    for c in n['children']:
        if c['name'] == 'Properties70':
            for p in c['children']: out[p['props'][0]] = p['props'][4:]
    return out

def convert(src, dst, recolor=None, yaw=0.0, verbose=True):
    ver, roots = read_fbx(src)
    R = {r['name']: r for r in roots}
    gs = props70(R['GlobalSettings']['children'][0]) if 'GlobalSettings' in R else {}
    up = gs.get('UpAxis', [1])[0]; front = gs.get('FrontAxis', [2])[0]; coord = gs.get('CoordAxis', [0])[0]
    unit = gs.get('UnitScaleFactor', [1.0])[0]
    objs = {}
    for o in R['Objects']['children']:
        objs[o['props'][0]] = o
    link = {}  # child -> [parents]
    for c in R['Connections']['children']:
        if c['props'][0] == 'OO': link.setdefault(c['props'][1], []).append(c['props'][2])
    def nm(o): return o['props'][1].split('\0')[0]
    models = [o for o in R['Objects']['children'] if o['name'] == 'Model']
    # kumpulkan material global -> index glTF
    mats, matidx = [], {}
    def getmat(mid):
        if mid in matidx: return matidx[mid]
        o = objs[mid]; p = props70(o); name = nm(o)
        col = p.get('DiffuseColor', p.get('Diffuse', [0.8, 0.8, 0.8]))[:3]
        if recolor and name in recolor: col = recolor[name]
        em = p.get('EmissiveColor', [0, 0, 0])[:3]
        m = {'name': name, 'pbrMetallicRoughness': {'baseColorFactor': [*[float(x) for x in col], 1.0], 'metallicFactor': 0.1, 'roughnessFactor': 0.6}}
        if any(x > 0.01 for x in em): m['emissiveFactor'] = [float(x) for x in em]
        if name in ('headlights', 'rear lights') and 'emissiveFactor' not in m: m['emissiveFactor'] = [float(x) * 0.5 for x in col]
        if name == 'windows': m['pbrMetallicRoughness'].update(metallicFactor=0.6, roughnessFactor=0.15)
        matidx[mid] = len(mats); mats.append(m); return matidx[mid]
    bin_chunks, views, accs, meshes, nodes = [], [], [], [], []
    off = [0]
    def add_buf(arr, target, typ, ctype, count, mn=None, mx=None):
        b = arr.tobytes(); pad = (-len(b)) % 4; bin_chunks.append(b + b'\0' * pad)
        views.append({'buffer': 0, 'byteOffset': off[0], 'byteLength': len(b), 'target': target}); off[0] += len(b) + pad
        a = {'bufferView': len(views) - 1, 'componentType': ctype, 'count': count, 'type': typ}
        if mn is not None: a['min'] = [float(x) for x in mn]; a['max'] = [float(x) for x in mx]
        accs.append(a); return len(accs) - 1
    root_children = []
    for mo in models:
        mid = mo['props'][0]; name = nm(mo); pr = props70(mo)
        geoms = [c for c in objs if mid in link.get(c, []) and objs[c]['name'] == 'Geometry']
        mlist = [c for c in objs if mid in link.get(c, []) and objs[c]['name'] == 'Material']
        # urutan material slot = urutan koneksi
        mlist = [c for c in link_order(R, mid, objs, 'Material')]
        node = {'name': name}
        t = pr.get('Lcl Translation'); r = pr.get('Lcl Rotation'); s = pr.get('Lcl Scaling')
        if t and any(abs(x) > 1e-9 for x in t): node['translation'] = [float(x) for x in t]
        if r and any(abs(x) > 1e-9 for x in r):  # XYZ euler derajat (RotationOrder default XYZ)
            rx, ry, rz = [math.radians(x) for x in r]
            def q(ax, a): h = a / 2; v = [0, 0, 0]; v[ax] = math.sin(h); return np.array([*v, math.cos(h)])
            def mul(a, b):
                x1, y1, z1, w1 = a; x2, y2, z2, w2 = b
                return np.array([w1*x2 + x1*w2 + y1*z2 - z1*y2, w1*y2 - x1*z2 + y1*w2 + z1*x2, w1*z2 + x1*y2 - y1*x2 + z1*w2, w1*w2 - x1*x2 - y1*y2 - z1*z2])
            qq = mul(mul(q(2, rz), q(1, ry)), q(0, rx)); node['rotation'] = [float(x) for x in qq]
        if s and any(abs(x - 1) > 1e-9 for x in s): node['scale'] = [float(x) for x in s]
        if geoms:
            g = objs[geoms[0]]
            ch = {c['name']: c for c in g['children']}
            V = np.array(ch['Vertices']['props'][0], dtype=np.float64).reshape(-1, 3)
            PI = np.array(ch['PolygonVertexIndex']['props'][0], dtype=np.int64)
            # poligon -> segitiga (fan), simpan indeks polygon-vertex untuk normal
            tris, pv, polyid = [], [], []
            start, pidx = 0, 0
            for i, v in enumerate(PI):
                if v < 0:
                    ids = list(range(start, i + 1)); vs = [PI[k] if PI[k] >= 0 else -PI[k] - 1 for k in ids]
                    for k in range(1, len(ids) - 1):
                        tris.append((vs[0], vs[k], vs[k + 1])); pv.append((ids[0], ids[k], ids[k + 1])); polyid.append(pidx)
                    start = i + 1; pidx += 1
            tris = np.array(tris); pv = np.array(pv); polyid = np.array(polyid)
            N = None
            if 'LayerElementNormal' in ch:
                le = {c['name']: c for c in ch['LayerElementNormal']['children']}
                N = np.array(le['Normals']['props'][0], dtype=np.float64).reshape(-1, 3)
                mapping = le['MappingInformationType']['props'][0]
                if 'NormalsIndex' in le: ni = np.array(le['NormalsIndex']['props'][0])
                else: ni = None
            mi = np.zeros(pidx, dtype=int)
            if 'LayerElementMaterial' in ch:
                le = {c['name']: c for c in ch['LayerElementMaterial']['children']}
                arr = np.array(le['Materials']['props'][0], dtype=int)
                mi = np.full(pidx, arr[0]) if le['MappingInformationType']['props'][0] == 'AllSame' else arr[:pidx]
            prims = []
            for slot in sorted(set(mi[polyid].tolist())):
                sel = np.where(mi[polyid] == slot)[0]
                pos = V[tris[sel].reshape(-1)]
                if N is not None:
                    idx = pv[sel].reshape(-1)
                    if mapping == 'ByPolygonVertex': nrm = N[idx if ni is None else ni[idx]]
                    else: nrm = N[tris[sel].reshape(-1)]
                else:
                    a, b, c = pos[0::3], pos[1::3], pos[2::3]; fn = np.cross(b - a, c - a); fn /= (np.linalg.norm(fn, axis=1, keepdims=True) + 1e-12); nrm = np.repeat(fn, 3, axis=0)
                posf = pos.astype(np.float32); nrmf = nrm.astype(np.float32)
                # winding: FBX fan + Blender = CCW, sama dengan glTF
                pa = add_buf(posf, 34962, 'VEC3', 5126, len(posf), posf.min(0), posf.max(0))
                na = add_buf(nrmf, 34962, 'VEC3', 5126, len(nrmf))
                p = {'attributes': {'POSITION': pa, 'NORMAL': na}}
                if slot < len(mlist): p['material'] = getmat(mlist[slot])
                prims.append(p)
            meshes.append({'name': name, 'primitives': prims}); node['mesh'] = len(meshes) - 1
        nodes.append(node)
        if not any(pid in objs and objs[pid]['name'] == 'Model' for pid in link.get(mid, [])): root_children.append(len(nodes) - 1)
    # sumbu: Blender FBX biasanya Y-up. Kalau Z-up (up=2) putar -90 di X
    top = {'name': 'root', 'children': root_children}
    rot = []
    if up == 2: rot.append([-math.sqrt(.5), 0, 0, math.sqrt(.5)])
    # Blender FBX: tiap Model punya Lcl Scaling 100 + translasi dalam cm -> skala akar 0.01 (jadi meter)
    sc = [nd.get('scale', [1, 1, 1])[0] for nd in nodes if 'mesh' in nd]
    if sc and all(abs(x - 100) < 1e-3 for x in sc): top['scale'] = [0.01] * 3
    if yaw:
        h = math.radians(yaw) / 2; top['rotation'] = [0, math.sin(h), 0, math.cos(h)]
    nodes.append(top)
    gltf = {'asset': {'version': '2.0', 'generator': 'fbx2glb.py'}, 'scene': 0, 'scenes': [{'nodes': [len(nodes) - 1]}],
            'nodes': nodes, 'meshes': meshes, 'materials': mats, 'accessors': accs, 'bufferViews': views,
            'buffers': [{'byteLength': off[0]}]}
    j = json.dumps(gltf, separators=(',', ':')).encode(); j += b' ' * ((-len(j)) % 4)
    b = b''.join(bin_chunks)
    glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(j) + 8 + len(b)) + struct.pack('<II', len(j), 0x4E4F534A) + j + struct.pack('<II', len(b), 0x004E4942) + b
    open(dst, 'wb').write(glb)
    if verbose: print(f'{src} -> {dst}: {len(glb)/1024:.1f} KB, {len(nodes)-1} node, {len(mats)} material, up={up} unit={unit}')
    return gltf

def link_order(R, mid, objs, kind):
    return [c['props'][1] for c in R['Connections']['children'] if c['props'][0] == 'OO' and c['props'][2] == mid and c['props'][1] in objs and objs[c['props'][1]]['name'] == kind]

if __name__ == '__main__':
    a = sys.argv[1:]; rec = None; yaw = 0
    if '--yaw' in a: yaw = float(a[a.index('--yaw') + 1])
    if '--recolor' in a:
        rec = {}
        for kv in a[a.index('--recolor') + 1].split(','):
            k, v = kv.split('='); rec[k] = [int(v[i:i+2], 16) / 255 for i in (0, 2, 4)]
    convert(a[0], a[1], rec, yaw)
