#!/usr/bin/env python3
"""Iterasi 81: karakter 'ndas' = badan hasil scan (mesh.obj, kepala jelek) + kepala detail (ndas.obj), dua-duanya OBJ warna-per-simpul dari user.
  python3 tools/prep_ndas.py <mesh.obj badan> <ndas.obj kepala> assets/npc_ndas.glb [segitiga_badan=6000] [segitiga_kepala=11000]
Langkah: (1) badan dipotong di leher (z=CUT), cincin potongan diekstrusi ke atas = leher baru yang masuk ke kepala; (2) kepala baru diskala/ditaruh di leher;
(3) QEM (qem.py; warna ikut diinterpolasi lewat kanal 'UV') -> segitiga sedikit; (4) auto-rig 18 tulang (rigkit/prep_npc_chars2.auto_weights) + klip Idle/Run;
(5) GLB dengan COLOR_0 (tanpa tekstur). Sumbu OBJ asli: atas=+Z, depan=+X -> game: atas=+Y, depan=+Z, kiri=+X (permutasi siklik (x,y,z)->(y,z,x), tanpa cermin)."""
import sys, os, time
import numpy as np
from scipy.spatial import cKDTree
sys.path.insert(0, os.path.dirname(__file__))
from glbkit import *
from qem import decimate
from rigkit import *
from prep_npc_chars import T_RUN, T_IDLE
from prep_npc_chars2 import auto_weights

CUT = 0.262                       # tinggi potong leher pada badan (satuan OBJ; badan tinggi ~1.0)
HEAD_S, HEAD_ZMIN = 0.25, 0.272   # skala kepala baru (tinggi dagu-ubun ~0.97 -> 0.243) dan z dagu terendah

def load_obj(p):
    V, C, F = [], [], []
    for l in open(p):
        if l.startswith('v '):
            a = l.split(); V.append([float(x) for x in a[1:4]]); C.append([float(x) for x in a[4:7]] if len(a) >= 7 else [.5, .5, .5])
        elif l.startswith('f '):
            a = [int(t.split('/')[0]) - 1 for t in l.split()[1:]]
            for i in range(1, len(a) - 1): F.append([a[0], a[i], a[i + 1]])
    return np.array(V), np.array(C), np.array(F)

def compact(V, C, F):
    used = np.unique(F.ravel()); rm = -np.ones(len(V), int); rm[used] = np.arange(len(used)); return V[used], C[used], rm[F]

def cut_body(V, C, F, cut):
    """buang segitiga dengan simpul manapun di atas 'cut'; kembalikan juga cincin tepi (urut) di sekitar leher"""
    keep = (V[F][:, :, 2] < cut).all(1); F = F[keep]
    # tepi terbuka = tepi yang dipakai 1 segitiga; ambil yang z dekat cut (cincin leher), bukan lubang kecil lain
    E = np.r_[F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]; key = np.sort(E, axis=1); u, inv, cnt = np.unique(key, axis=0, return_inverse=True, return_counts=True)
    inv = inv.ravel(); once = cnt[inv] == 1; Eb = E[once]                      # tepi berarah (searah putaran segitiga)
    Eb = Eb[(V[Eb][:, :, 2] > cut - 0.045).all(1)]
    nxt = {int(a): int(b) for a, b in Eb}; loops = []; seen = set()
    for s in list(nxt):
        if s in seen: continue
        L = [s]; seen.add(s); c = nxt.get(s)
        while c is not None and c not in seen: L.append(c); seen.add(c); c = nxt.get(c)
        if c == s and len(L) > 20: loops.append(L)
    return F, loops

def skin_mask(C):   # 0..1: 'kulit' = hangat (merah >> biru) walau gelap (kerutan/bayangan terpanggang); rambut & kacamata abu-biru gelap ~0
    sat = (C[:, 0] - C[:, 2]) / (C[:, 0] + 0.02)
    return np.clip((sat - 0.16) / 0.14, 0, 1) * np.clip((C[:, 0] - 0.03) / 0.05, 0, 1)

def match_head(Ch, Cb, Vb):
    """kepala hasil scan lebih gelap & kemerahan dari kulit badan, bayangan kerutan sangat pekat -> (1) angkat bayangan kulit (gamma 0,72), (2) gain per kanal supaya median kulit = badan (maks x1,45). Hanya area kulit (rambut/kacamata tetap)."""
    m = skin_mask(Ch)[:, None]; lift = np.clip(Ch, 1e-4, 1) ** 0.72; out = Ch * (1 - m) + lift * m
    mb = (skin_mask(Cb) > 0.9) & (Vb[:, 2] > 0.0) & (Vb[:, 2] < 0.26); mh = skin_mask(out) > 0.9
    g = np.clip(np.median(Cb[mb], axis=0) / np.median(out[mh], axis=0), 0.9, 1.45); out = out * (1 + (g - 1) * m)
    return np.clip(out, 0, 1), g

def build(body, head, nb_target, nh_target, quiet=False):
    t0 = time.time(); Vb, Cb, Fb = load_obj(body); Vh, Ch, Fh = load_obj(head)
    Ch, gain = match_head(Ch, Cb, Vb)
    if not quiet: print(f'  koreksi warna kepala: gain kulit {gain.round(3)}')
    Fb, loops = cut_body(Vb, Cb, Fb, CUT); assert loops, 'cincin leher tidak ketemu'
    ring = max(loops, key=len); R = np.array(ring)
    if not quiet: print(f'  badan dipotong z<{CUT}: {len(Fb)} segitiga; cincin leher {len(R)} simpul, bbox {Vb[R].min(0).round(3)}..{Vb[R].max(0).round(3)}')
    Vb, Cb, Fb = compact(Vb, Cb, Fb); rm = {}  # indeks cincin setelah compact
    # compact mengubah indeks: hitung ulang cincin lewat posisi
    tree = cKDTree(Vb); _, R = tree.query(load_obj(body)[0][R]); R = list(map(int, R))
    # --- leher baru: cincin potongan (lebar, ikut lereng bahu) diekstrusi ke atas dan MENYEMPIT jadi leher (z, skala): trapezius -> leher -> masuk kepala; warna atas = kulit leher ---
    allC = load_obj(body); skinm = (allC[0][:, 2] > 0.26) & (allC[0][:, 2] < 0.34) & (allC[1][:, 0] > allC[1][:, 2] * 1.25) & (allC[1][:, 0] > 0.35)
    skin = np.median(allC[1][skinm], axis=0) if skinm.sum() > 20 else np.array([.62, .42, .32]); ctr = Vb[R].mean(0); ctr[0] = 0.0
    LV = [(0.0, 1.0, 0.0), (0.020, 0.62, 0.85), (0.060, 0.50, 1.0), (0.105, 0.48, 1.0)]   # (naik dari CUT, skala sekitar sumbu, campur ke warna kulit)
    n0 = len(Vb); rings = [np.array(R)]; Vn = [Vb]; Cn = [Cb]; nF = []
    for dz, sc, sk in LV[1:]:
        r = Vb[R].copy(); r[:, 2] = CUT + dz; r[:, :2] = ctr[:2] + (r[:, :2] - ctr[:2]) * sc
        c = Cb[R] * (1 - sk) + skin * sk; start = sum(len(x) for x in Vn); Vn.append(r); Cn.append(c); rings.append(np.arange(start, start + len(R)))
    Vn = np.vstack(Vn); Cn = np.vstack(Cn); m = len(R)
    for k in range(len(rings) - 1):
        for i in range(m):
            a, b2 = rings[k][i], rings[k][(i + 1) % m]; ta, tb = rings[k + 1][i], rings[k + 1][(i + 1) % m]; nF += [[a, b2, tb], [a, tb, ta]]
    Fn = np.r_[Fb, np.array(nF)]
    # arah putaran leher: normal harus keluar. Uji pada segitiga pertama ekstrusi.
    def out_ok(F):
        t = F[-2]; n = np.cross(Vn[t[1]] - Vn[t[0]], Vn[t[2]] - Vn[t[0]]); mid = Vn[t].mean(0); return n[:2] @ (mid[:2] - ctr[:2]) > 0
    if not out_ok(Fn): Fn = np.r_[Fb, np.array(nF)[:, ::-1]]
    # --- kepala baru ---
    Vh = Vh * HEAD_S; Vh[:, 2] += HEAD_ZMIN - Vh[:, 2].min()
    bb = Vb[Vb[:, 2] > 0.3]; Vh[:, 0] += 0.005 - (Vh[:, 0].min() + Vh[:, 0].max()) / 2; Vh[:, 1] += (ctr[1] - 0.005) - (Vh[:, 1].min() + Vh[:, 1].max()) / 2 * 0
    return (Vn, Cn, Fn), (Vh, Ch, Fh), ctr, time.time() - t0

def qem_color(V, C, F, target, quiet=False, tag=''):
    t0 = time.time(); Jd = np.zeros((len(V), 4), int); Wd = np.zeros((len(V), 4)); Wd[:, 0] = 1; N = np.zeros_like(V)
    P2, C2, N2, _, _, F2 = decimate(V, C, N, Jd, Wd, F, target)
    # warna: campur warna asli terdekat (k=5, bobot 1/jarak) supaya detail tidak lenyap di simpul baru
    tr = cKDTree(V); d, ix = tr.query(P2, k=5); w = 1 / (d + 1e-4); Cc = (C[ix] * w[..., None]).sum(1) / w.sum(1)[:, None]
    C2 = 0.5 * C2 + 0.5 * Cc if True else C2
    if not quiet: print(f'  QEM {tag}: {len(F)} -> {len(F2)} segitiga, {len(P2)} simpul ({time.time()-t0:.0f} dtk)')
    return P2, np.clip(C2, 0, 1), F2

def normals(P, F):
    n = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]); N = np.zeros_like(P)
    for k in range(3): np.add.at(N, F[:, k], n)
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)

# sendi (tinggi badan=1, kaki y=0, x=0 tengah, Left=+X, depan +Z), diukur dari siluet badan mesh.obj
SPEC = dict(name='npc_ndas', J=dict(Hips=(0, .48, 0), Spine=(0, .54, 0), Spine1=(0, .61, 0), Spine2=(0, .68, 0), Neck=(0, .745, 0), Head=(0, .79, 0),
            LeftArm=(.125, .70, 0), LeftForeArm=(.175, .47, 0), LeftHand=(.19, .38, 0), LeftUpLeg=(.065, .48, 0), LeftLeg=(.068, .26, 0), LeftFoot=(.068, .06, 0)),
            arm_r=.06, trunk_r=.14, skirt=None, wd=(.05, .012), cfg=dict(thigh=0.40, knee=0.75, arm=0.30, fore=0.30, fore0=0.20))

def jpeg_none(): return None

def write_glb_vc(path, name, P, C, N, J, W, F, joints, clips, rough=0.9):
    w = Writer(); IBM = [np.linalg.inv(m) for m in rest_mats(joints)]
    pos = w.accessor(P.astype(np.float32), 5126, 'VEC3', 34962, minmax=True); nor = w.accessor(N.astype(np.float32), 5126, 'VEC3', 34962)
    col = w.accessor(C.astype(np.float32), 5126, 'VEC3', 34962); jj = w.accessor(J.astype(np.uint8), 5121, 'VEC4', 34962)
    ww = w.accessor(W.astype(np.float32), 5126, 'VEC4', 34962); ix = w.accessor(F.astype(np.uint16).ravel().reshape(-1, 1), 5123, 'SCALAR', 34963)
    ibm = w.accessor(np.array([m.T for m in IBM], np.float32).reshape(-1, 16), 5126, 'MAT4')
    nodes = [{'name': j['name'], 'translation': [float(x) for x in j['t']], 'rotation': [float(x) for x in j['q']]} for j in joints]
    for i, j in enumerate(joints):
        if j['parent'] >= 0: nodes[j['parent']].setdefault('children', []).append(i)
    roots = [i for i, j in enumerate(joints) if j['parent'] < 0]; nj = len(joints)
    nodes.append({'name': 'Armature', 'children': roots}); arm_i = len(nodes) - 1; nodes.append({'name': name, 'mesh': 0, 'skin': 0}); mesh_i = len(nodes) - 1
    anims = []
    for cname, cl in clips.items():
        samp = []; chan = []; tin = w.accessor(cl['times'].astype(np.float32).reshape(-1, 1), 5126, 'SCALAR', minmax=True)
        for i, arr in cl['rot'].items():
            o = w.accessor(arr.astype(np.float32), 5126, 'VEC4'); samp.append({'input': tin, 'output': o, 'interpolation': 'LINEAR'}); chan.append({'sampler': len(samp) - 1, 'target': {'node': i, 'path': 'rotation'}})
        for i, arr in cl['trans'].items():
            o = w.accessor(arr.astype(np.float32), 5126, 'VEC3'); samp.append({'input': tin, 'output': o, 'interpolation': 'LINEAR'}); chan.append({'sampler': len(samp) - 1, 'target': {'node': i, 'path': 'translation'}})
        anims.append({'name': cname, 'samplers': samp, 'channels': chan})
    g = {'asset': {'version': '2.0', 'generator': 'gta-suramadu tools/prep_ndas.py'}, 'scene': 0, 'scenes': [{'nodes': [arm_i, mesh_i]}], 'nodes': nodes,
         'skins': [{'joints': list(range(nj)), 'inverseBindMatrices': ibm, 'skeleton': roots[0]}],
         'meshes': [{'name': name, 'primitives': [{'attributes': {'POSITION': pos, 'NORMAL': nor, 'COLOR_0': col, 'JOINTS_0': jj, 'WEIGHTS_0': ww}, 'indices': ix, 'material': 0, 'mode': 4}]}],
         'materials': [{'name': 'vcol', 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0.0, 'roughnessFactor': rough}}], 'animations': anims}
    w.save(path, g)

def finish(stage, dst, nb, nh, quiet=False):
    t0 = time.time(); d = np.load(stage)
    Pb, Cb, Fb = qem_color(d['Vb'], d['Cb'], d['Fb'], nb, quiet, 'badan'); Ph, Ch, Fh = qem_color(d['Vh'], d['Ch'], d['Fh'], nh, quiet, 'kepala')
    P = np.r_[Pb, Ph]; C = np.r_[Cb, Ch]; F = np.r_[Fb, Fh + len(Pb)]
    # sumbu: (x,y,z)obj -> (X=y, Y=z, Z=x); tinggi 1, kaki y=0, tengah badan x=0
    P = P[:, [1, 2, 0]]; y0 = P[:, 1].min(); H = P[:, 1].max() - y0; P = (P - [0, y0, 0]) / H; P[:, 0] -= np.median(P[P[:, 1] < 0.4][:, 0]) * 0 + (P[P[:, 1] < 0.1][:, 0].min() + P[P[:, 1] < 0.1][:, 0].max()) / 2
    if not quiet: print(f'  tinggi OBJ {H:.3f}; lebar kaki tengah x {P[P[:,1]<0.1][:,0].min():.3f}..{P[P[:,1]<0.1][:,0].max():.3f}')
    N = normals(P, F); names, V, J, W = auto_weights(P, SPEC)
    par = {'Hips': None, 'Spine': 'Hips', 'Spine1': 'Spine', 'Spine2': 'Spine1', 'Neck': 'Spine2', 'Head': 'Neck', 'LeftArm': 'Spine2', 'LeftForeArm': 'LeftArm', 'LeftHand': 'LeftForeArm',
           'RightArm': 'Spine2', 'RightForeArm': 'RightArm', 'RightHand': 'RightForeArm', 'LeftUpLeg': 'Hips', 'LeftLeg': 'LeftUpLeg', 'LeftFoot': 'LeftLeg', 'RightUpLeg': 'Hips', 'RightLeg': 'RightUpLeg', 'RightFoot': 'RightLeg'}
    ix = {k: i for i, k in enumerate(names)}
    joints = [{'name': nm, 'parent': ix[par[nm]] if par[nm] else -1, 't': V[nm] - (V[par[nm]] if par[nm] else 0), 'q': np.array([0, 0, 0, 1.0])} for nm in names]
    Mr = rest_mats(joints); IBM = [np.linalg.inv(m) for m in Mr]; err = np.abs(skin_points(P, J, W, Mr, IBM) - P).max()
    if not quiet: print(f'  uji rest-pose skinning: galat maks {err:.2e}')
    cfg = dict(SPEC['cfg']); cfg['noPhi'] = True; clips = bake_clips(joints, T_RUN, T_IDLE, down_deg=0, cfg=cfg)
    write_glb_vc(dst, SPEC['name'], P, np.clip(C, 0, 1) ** 2.2, N, J, W, F, joints, clips)   # COLOR_0 glTF = linear; warna OBJ = sRGB
    np.savez(stage.replace('.npz', '_final.npz'), P=P, C=C, F=F, J=J, W=W)
    print(f'  {len(P)} simpul, {len(F)} segitiga, {len(joints)} tulang; {os.path.getsize(dst)/1024:.0f} KB -> {dst} ({time.time()-t0:.0f} dtk)')

if __name__ == '__main__':
    body, head, dst = sys.argv[1:4]; nb = int(sys.argv[4]) if len(sys.argv) > 4 else 6000; nh = int(sys.argv[5]) if len(sys.argv) > 5 else 11000
    stage = os.environ.get('NDAS_STAGE', '/tmp/ndas_stage.npz')
    (Vb, Cb, Fb), (Vh, Ch, Fh), ctr, dt = build(body, head, nb, nh)
    np.savez(stage, Vb=Vb, Cb=Cb, Fb=Fb, Vh=Vh, Ch=Ch, Fh=Fh, ctr=ctr); print('tahap 1 selesai', round(dt, 1), 's')
    finish(stage, dst, nb, nh)
