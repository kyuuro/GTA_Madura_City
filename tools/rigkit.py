"""Rangka + animasi hasil panggang (Idle/Run) untuk karakter NPC tambahan, plus penulis GLB dan evaluator skinning (untuk render uji).
Konvensi game: depan = +Z, atas = +Y, kaki di y=0, tinggi 1.0 (retro.js menskalakan ke tinggi akhir)."""
import numpy as np
from glbkit import *

def world_rest(joints):
    n = len(joints); Wr = [None] * n; Wp = [None] * n   # rotasi (quat) & posisi dunia saat rest
    for i, j in enumerate(joints):
        if j['parent'] < 0: Wr[i] = np.array(j['q'], float); Wp[i] = np.array(j['t'], float)
        else:
            p = j['parent']; Wr[i] = qmul(Wr[p], j['q']); Wp[i] = Wp[p] + qrot(Wr[p], j['t'])
    return Wr, Wp

def rest_mats(joints):
    Wr, Wp = world_rest(joints); M = []
    for r, p in zip(Wr, Wp):
        m = np.eye(4); m[:3, :3] = qmat(r); m[:3, 3] = p; M.append(m)
    return M

def arm_down_angle(joints, side, target_deg):
    idx = {j['name']: i for i, j in enumerate(joints)}; _, Wp = world_rest(joints)
    a, f = Wp[idx[side + 'Arm']], Wp[idx[side + 'ForeArm']]; d = f - a
    cur = np.arctan2(d[1], d[0]); t = np.radians(target_deg)
    tgt = np.arctan2(-np.cos(t), np.sign(d[0]) * np.sin(t)); phi = tgt - cur
    return (phi + np.pi) % (2 * np.pi) - np.pi

def bake_clips(joints, T_run, T_idle, down_deg=10, cfg=None):
    """-> {'Idle': {'times','rot':{ji:[n,4]},'trans':{ji:[n,3]}}, 'Run': ...} (rotasi lokal)"""
    c = dict(thigh=0.42, knee=0.80, knee0=0.10, arm=0.38, fore=0.40, fore0=0.35, bob=0.010, lean=0.04)
    c.update(cfg or {})
    idx = {j['name']: i for i, j in enumerate(joints)}; Wr, Wp = world_rest(joints)
    X = [1, 0, 0]; Z = [0, 0, 1]
    phi = {s: (0.0 if c.get('noPhi') else arm_down_angle(joints, s, down_deg)) for s in ('Left', 'Right')}   # noPhi: lengan sudah turun di mesh asli (tanpa koreksi T-pose)
    def Rx(a): return qaxis(X, a)
    def Rz(a): return qaxis(Z, a)
    def pose(spec, hips_dy):
        Rinc = [None] * len(joints); loc = {}
        for i, j in enumerate(joints):
            Rinc[i] = spec.get(j['name'], Rinc[j['parent']] if j['parent'] >= 0 else np.array([0, 0, 0, 1.0]))
            cur = qmul(Rinc[i], Wr[i]); pc = qmul(Rinc[j['parent']], Wr[j['parent']]) if j['parent'] >= 0 else np.array([0, 0, 0, 1.0])
            q = qmul(qinv(pc), cur); loc[i] = q / np.linalg.norm(q)
        return loc
    def build(T, fn, n=16):
        times = np.linspace(0, T, n + 1); rot = {}; trans = {}
        for k, t in enumerate(times):
            spec, dy = fn(2 * np.pi * t / T); loc = pose(spec, dy)
            for i in range(len(joints)):
                # hanya simpan joint yang BERUBAH dari rest di sembarang frame
                rot.setdefault(i, []).append(loc[i])
            trans.setdefault(idx['Hips'], []).append(np.array(joints[idx['Hips']]['t']) + np.array([0, dy, 0]))
        keep = {}
        for i, arr in rot.items():
            arr = np.array(arr); rest = np.array(joints[i]['q'])
            # hindari lompatan tanda quaternion antar frame
            for k in range(1, len(arr)):
                if arr[k] @ arr[k - 1] < 0: arr[k] = -arr[k]
            if np.abs(np.abs(arr @ rest) - 1).max() > 1e-6: keep[i] = arr
        return {'times': times, 'rot': keep, 'trans': {k: np.array(v) for k, v in trans.items()}}
    def run(ph):
        s, co = np.sin(ph), np.cos(ph); out = {}
        for side, sg in (('Left', 1), ('Right', -1)):
            th = -c['thigh'] * sg * s                   # negatif = kaki ke depan
            flex = c['knee0'] + c['knee'] * max(0.0, sg * co)   # lutut menekuk saat kaki mengayun maju
            am = c.get('armLm', 1.0) if side == 'Left' else 1.0   # armLm: redam ayunan lengan kiri (mis. lengan pemegang perisai)
            ar = c['arm'] * sg * s * am                # lengan berlawanan dengan kaki
            out[side + 'UpLeg'] = Rx(th); out[side + 'Leg'] = Rx(th + flex); out[side + 'Foot'] = Rx(th + flex * 0.5 - 0.15 * sg * s)
            rz = Rz(phi[side]); out[side + 'Arm'] = qmul(Rx(ar), rz)
            out[side + 'ForeArm'] = qmul(Rx(ar - am * (c['fore0'] + c['fore'] * 0.3 * (1 + sg * s))), rz)
        out['Spine'] = qmul(Rx(-c['lean']), qaxis([0, 1, 0], 0.10 * s)); out['Spine2'] = qaxis([0, 1, 0], -0.12 * s)
        return out, c['bob'] * np.cos(2 * ph)
    def idle(ph):
        s = np.sin(ph); out = {}
        for side in ('Left', 'Right'):
            rz = Rz(phi[side]); out[side + 'Arm'] = qmul(Rx(0.03 * s), rz); out[side + 'ForeArm'] = qmul(Rx(-0.10 + 0.02 * s), rz)
        out['Spine'] = Rx(0.012 * s); out['Spine2'] = Rx(0.01 * s)
        return out, 0.003 * s
    return {'Idle': build(T_idle, idle, 12), 'Run': build(T_run, run, 16)}

def pose_at(joints, clip, t):
    """lokal TRS per joint pada waktu t (loop) -> matriks dunia 4x4 per joint"""
    n = len(joints); tt = t % clip['times'][-1]; ts = clip['times']; k = min(np.searchsorted(ts, tt, side='right') - 1, len(ts) - 2); u = (tt - ts[k]) / (ts[k + 1] - ts[k])
    M = [None] * n
    for i, j in enumerate(joints):
        q = np.array(j['q']); tr = np.array(j['t'])
        if i in clip['rot']: a, b = clip['rot'][i][k], clip['rot'][i][k + 1]; q = a * (1 - u) + b * u; q = q / np.linalg.norm(q)
        if i in clip['trans']: tr = clip['trans'][i][k] * (1 - u) + clip['trans'][i][k + 1] * u
        L = np.eye(4); L[:3, :3] = qmat(q); L[:3, 3] = tr
        M[i] = L if j['parent'] < 0 else M[j['parent']] @ L
    return M

def skin_points(P, J, W, M, IBM):
    out = np.zeros_like(P)
    for k in range(4):
        Mk = np.array([M[j] @ IBM[j] for j in range(len(M))])[J[:, k]]
        out += W[:, k:k + 1] * (np.einsum('nij,nj->ni', Mk[:, :3, :3], P) + Mk[:, :3, 3])
    return out

def write_glb(path, name, P, UV, N, J, W, F, joints, clips, image_bytes_, mime='image/jpeg', rough=0.9):
    w = Writer(); IBM = [np.linalg.inv(m) for m in rest_mats(joints)]
    pos = w.accessor(P.astype(np.float32), 5126, 'VEC3', 34962, minmax=True); nor = w.accessor(N.astype(np.float32), 5126, 'VEC3', 34962)
    uv = w.accessor(UV.astype(np.float32), 5126, 'VEC2', 34962); jj = w.accessor(J.astype(np.uint8), 5121, 'VEC4', 34962)
    ww = w.accessor(W.astype(np.float32), 5126, 'VEC4', 34962); ix = w.accessor(F.astype(np.uint16).ravel().reshape(-1, 1), 5123, 'SCALAR', 34963)
    ibm = w.accessor(np.array([m.T for m in IBM], np.float32).reshape(-1, 16), 5126, 'MAT4')
    img = w.view(image_bytes_)
    nodes = []; nj = len(joints)
    for j in joints:
        nd = {'name': j['name'], 'translation': [float(x) for x in j['t']], 'rotation': [float(x) for x in j['q']]}
        nodes.append(nd)
    for i, j in enumerate(joints):
        if j['parent'] >= 0: nodes[j['parent']].setdefault('children', []).append(i)
    roots = [i for i, j in enumerate(joints) if j['parent'] < 0]
    nodes.append({'name': 'Armature', 'children': roots}); arm_i = len(nodes) - 1
    nodes.append({'name': name, 'mesh': 0, 'skin': 0}); mesh_i = len(nodes) - 1
    anims = []
    for cname, cl in clips.items():
        samp = []; chan = []; tin = w.accessor(cl['times'].astype(np.float32).reshape(-1, 1), 5126, 'SCALAR', minmax=True)
        for i, arr in cl['rot'].items():
            o = w.accessor(arr.astype(np.float32), 5126, 'VEC4'); samp.append({'input': tin, 'output': o, 'interpolation': 'LINEAR'}); chan.append({'sampler': len(samp) - 1, 'target': {'node': i, 'path': 'rotation'}})
        for i, arr in cl['trans'].items():
            o = w.accessor(arr.astype(np.float32), 5126, 'VEC3'); samp.append({'input': tin, 'output': o, 'interpolation': 'LINEAR'}); chan.append({'sampler': len(samp) - 1, 'target': {'node': i, 'path': 'translation'}})
        anims.append({'name': cname, 'samplers': samp, 'channels': chan})
    g = {'asset': {'version': '2.0', 'generator': 'gta-suramadu tools/prep_npc_chars.py'}, 'scene': 0, 'scenes': [{'nodes': [arm_i, mesh_i]}], 'nodes': nodes,
         'skins': [{'joints': list(range(nj)), 'inverseBindMatrices': ibm, 'skeleton': roots[0]}],
         'meshes': [{'name': name, 'primitives': [{'attributes': {'POSITION': pos, 'NORMAL': nor, 'TEXCOORD_0': uv, 'JOINTS_0': jj, 'WEIGHTS_0': ww}, 'indices': ix, 'material': 0, 'mode': 4}]}],
         'materials': [{'name': 'atlas', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0.0, 'roughnessFactor': rough}}],
         'textures': [{'source': 0, 'sampler': 0}], 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}], 'images': [{'bufferView': img, 'mimeType': mime}], 'animations': anims}
    w.save(path, g); return IBM
