#!/usr/bin/env python3
"""Iterasi 65: 3 NPC pejalan baru dari model luar (Sketchfab, CC BY 4.0) -> GLB ringan yang cocok dengan retro.js (1 SkinnedMesh + 1 tekstur + klip Idle/Run).
  python3 tools/prep_npc_chars2.py ayah   ayah.glb                   assets/npc_ayah.glb      (Mixamo T-pose, 121 rb segitiga / 24 MB -> ~6 rb / ~0,3 MB)
  python3 tools/prep_npc_chars2.py malayu blue_man_baju_malayu.glb   assets/npc_malayu.glb    (statis, lengan sudah turun -> auto-rig)
  python3 tools/prep_npc_chars2.py melayu malay_lady_with_hijab.glb  assets/npc_melayu.glb    (statis, gamis panjang -> auto-rig)
Konvensi (sama dgn prep_npc_chars.py): tinggi 1.0, kaki y=0, depan +Z, Left = +X; klip Idle 1.042 dtk & Run 0.667 dtk dipanggang.
Kenapa ayah 24 MB: tiap segitiga punya 3 simpul sendiri (364.800 simpul tak ter-weld, 66 tulang Mixamo, animasi 14 dtk). Di sini: weld -> 70 rb simpul,
66 -> 22 tulang, QEM ke ~6 rb segitiga, tekstur 1024 PNG -> 512 JPEG, animasi asli dibuang diganti Idle/Run ringan."""
import sys, io, os, re, time
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from glbkit import *
from qem import decimate
from rigkit import *
from prep_npc_chars import pad_texture, remap_skin, KEEP, T_RUN, T_IDLE

KEEP_PARENT = {'Hips': None, 'Spine': 'Hips', 'Spine1': 'Spine', 'Spine2': 'Spine1', 'Neck': 'Spine2', 'Head': 'Neck',
               'LeftShoulder': 'Spine2', 'LeftArm': 'LeftShoulder', 'LeftForeArm': 'LeftArm', 'LeftHand': 'LeftForeArm',
               'RightShoulder': 'Spine2', 'RightArm': 'RightShoulder', 'RightForeArm': 'RightArm', 'RightHand': 'RightForeArm',
               'LeftUpLeg': 'Hips', 'LeftLeg': 'LeftUpLeg', 'LeftFoot': 'LeftLeg', 'LeftToeBase': 'LeftFoot',
               'RightUpLeg': 'Hips', 'RightLeg': 'RightUpLeg', 'RightFoot': 'RightLeg', 'RightToeBase': 'RightFoot'}

def sm(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def weld(P, N, UV, J, W, F):
    """Gabung simpul kembar (posisi+normal+UV sama). Model FBX/Sketchfab sering tak ter-weld (3 simpul per segitiga)."""
    key = np.c_[np.round(P, 5), np.round(UV, 5)]   # normal TIDAK ikut kunci (beda normal per segitiga membuat weld gagal & QEM macet)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.ravel()
    F2 = inv[F]; F2 = F2[(F2[:, 0] != F2[:, 1]) & (F2[:, 1] != F2[:, 2]) & (F2[:, 0] != F2[:, 2])]
    used = np.unique(F2.ravel()); rm = -np.ones(len(first), int); rm[used] = np.arange(len(used))
    return P[first][used], N[first][used], UV[first][used], J[first][used], W[first][used], rm[F2]

def jpeg(img, size, q):
    b = io.BytesIO(); img.convert('RGB').resize((size, size), Image.LANCZOS).save(b, 'JPEG', quality=q, optimize=True); return b.getvalue()

# ------------------------------------------------------------------ ayah (Mixamo, T-pose)
def prep_ayah(src, dst, target=6000, quiet=False):
    t0 = time.time(); g, B = load(src); sk = g['skins'][0]; jn = sk['joints']
    strip = lambda s: re.sub(r'_0?\d+$', '', s.replace('mixamorig:', ''))
    names = [strip(g['nodes'][j]['name']) for j in jn]; keep_idx = {n: i for i, n in enumerate(KEEP)}
    par = {c: i for i, nd in enumerate(g['nodes']) for c in nd.get('children', [])}; node2name = {j: n for j, n in zip(jn, names)}
    def kept_anc(node):
        while node is not None:
            n = node2name.get(node)
            if n in keep_idx: return n
            node = par.get(node)
        return 'Hips'
    jmap = {k: keep_idx[kept_anc(jn[k])] for k in range(len(jn))}
    # --- gabung 6 potongan (batas 65532 simpul) jadi satu, lalu weld ---
    Ps, Ns, UVs, Js, Ws, Fs = [], [], [], [], [], []; off = 0
    for m in g['meshes']:
        p = m['primitives'][0]; a = p['attributes']; P = acc(g, B, a['POSITION']).astype(float)
        Ps.append(P); Ns.append(acc(g, B, a['NORMAL']).astype(float)); UVs.append(acc(g, B, a['TEXCOORD_0']).astype(float))
        Js.append(acc(g, B, a['JOINTS_0']).astype(int)); Ws.append(acc(g, B, a['WEIGHTS_0']).astype(float))
        Fs.append(acc(g, B, p['indices']).reshape(-1, 3).astype(int) + off); off += len(P)
    P, N, UV, J, Wt, F = [np.vstack(x) for x in (Ps, Ns, UVs, Js, Ws, Fs)]; tri0 = len(F); nv0 = len(P)
    P, N, UV, J, Wt, F = weld(P, N, UV, J, Wt, F)
    if not quiet: print(f'  weld: {nv0} -> {len(P)} simpul, {tri0} -> {len(F)} segitiga ({time.time()-t0:.0f} dtk)')
    J, Wt = remap_skin(J, Wt, jmap)
    img = Image.open(io.BytesIO(image_bytes(g, B, 0))).convert('RGB'); img = pad_texture(img, UV, F, grow=3)
    P2, UV2, N2, J2, W2, F2 = decimate(P, UV, N, J, Wt, F, target)
    if len(F2) > target * 1.1: P2, UV2, N2, J2, W2, F2 = decimate(P2, UV2, N2, J2, W2, F2, target, seam_lock=False)   # jahitan UV mengunci QEM di ~18 rb; putaran 2 melepas kunci jahitan (hanya tepi terbuka dikunci)
    if not quiet: print(f'  QEM: {len(F)} -> {len(F2)} segitiga, {len(P2)} simpul ({time.time()-t0:.0f} dtk)')
    y0 = P2[:, 1].min(); H = P2[:, 1].max() - y0; s = 1.0 / H
    P2 = (P2 - [0, y0, 0]) * s
    # --- rangka: posisi & orientasi dunia dari inverse IBM (ruang simpul), lalu lokal terhadap induk KEEP ---
    IBMa = acc(g, B, sk['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1); Wb = [np.linalg.inv(m) for m in IBMa]
    Wp, Wq = {}, {}
    for n in KEEP:
        k = names.index(n); M = Wb[k]; R = M[:3, :3]; sc = np.cbrt(abs(np.linalg.det(R))); R = R / sc
        assert np.linalg.det(R) > 0, f'tulang {n} cermin (det<0)'
        Wp[n] = (M[:3, 3] - [0, y0, 0]) * s; Wq[n] = mat_to_q(R)
    joints = []
    for n in KEEP:
        p = KEEP_PARENT[n]
        if p is None: joints.append({'name': n, 'parent': -1, 't': Wp[n], 'q': Wq[n]})
        else: qp = Wq[p]; joints.append({'name': n, 'parent': keep_idx[p], 't': qrot(qinv(qp), Wp[n] - Wp[p]), 'q': qmul(qinv(qp), Wq[n])})
    Mr = rest_mats(joints); IBM = [np.linalg.inv(m) for m in Mr]; err = np.abs(skin_points(P2, J2, W2, Mr, IBM) - P2).max()
    if not quiet: print(f'  uji rest-pose skinning: galat maks {err:.2e}')
    clips = bake_clips(joints, T_RUN, T_IDLE, down_deg=10, cfg=dict(thigh=0.40, knee=0.75, arm=0.34))
    write_glb(dst, 'npc_ayah', P2, UV2, N2, J2, W2, F2, joints, clips, jpeg(img, 512, 84))
    if not quiet: print(f'  {len(P2)} simpul, {len(joints)} tulang; {os.path.getsize(dst)/1024:.0f} KB -> {dst} ({time.time()-t0:.0f} dtk)')

# ------------------------------------------------------------------ model statis (auto-rig)
def load_static(path):
    g, B = load(path); par = {c: i for i, nd in enumerate(g['nodes']) for c in nd.get('children', [])}
    ni = [i for i, nd in enumerate(g['nodes']) if 'mesh' in nd][0]
    chain = []; i = ni
    while i is not None: chain.append(i); i = par.get(i)
    M = np.eye(4)
    for k in reversed(chain):
        nd = g['nodes'][k]
        if 'matrix' in nd: L = np.array(nd['matrix']).reshape(4, 4).T
        else: t, q, sc = node_local(nd); L = np.eye(4); L[:3, :3] = qmat(q) * sc; L[:3, 3] = t
        M = M @ L
    pr = g['meshes'][g['nodes'][ni]['mesh']]['primitives'][0]; a = pr['attributes']
    P = acc(g, B, a['POSITION']).astype(float) @ M[:3, :3].T + M[:3, 3]
    N = acc(g, B, a['NORMAL']).astype(float) @ np.linalg.inv(M[:3, :3]); N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
    UV = acc(g, B, a['TEXCOORD_0']).astype(float); F = acc(g, B, pr['indices']).reshape(-1, 3).astype(int)
    return P, N, UV, F, Image.open(io.BytesIO(image_bytes(g, B, 0))).convert('RGB')

def seg_dist(P, a, b):
    ab = b - a; t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1); return np.linalg.norm(P - (a + t[:, None] * ab), axis=1), t

# Posisi sendi (satuan: tinggi badan = 1, kaki y=0, x=0 di tengah, sisi Left = +X, depan +Z). Diukur dari siluet (profil lebar per tinggi).
SPECS = {
  'malayu': dict(name='npc_malayu', target=3800, down=0, cfg=dict(thigh=0.40, knee=0.75, arm=0.28, fore=0.30, fore0=0.20),
    J=dict(Hips=(0, .50, 0), Spine=(0, .56, 0), Spine1=(0, .64, 0), Spine2=(0, .72, 0), Neck=(0, .82, 0), Head=(0, .87, 0),
           LeftArm=(.125, .795, 0), LeftForeArm=(.145, .630, 0), LeftHand=(.140, .470, .01), LeftUpLeg=(.05, .50, 0), LeftLeg=(.055, .27, 0), LeftFoot=(.055, .06, 0)),
    arm_r=.055, trunk_r=.13, skirt=(.22, .16), skirt_share=.5, wd=(.06, .015)),     # sampin (kain lilit) sampai y=.22: kaki separuh ikut pinggul
  'melayu': dict(name='npc_melayu', target=4200, down=0, cfg=dict(thigh=0.22, knee=0.36, arm=0.26, fore=0.28, fore0=0.20),
    J=dict(Hips=(0, .50, 0), Spine=(0, .56, 0), Spine1=(0, .64, 0), Spine2=(0, .72, 0), Neck=(0, .82, 0), Head=(0, .87, 0),
           LeftArm=(.115, .800, 0), LeftForeArm=(.145, .620, 0), LeftHand=(.150, .475, 0), LeftUpLeg=(.05, .50, 0), LeftLeg=(.055, .28, 0), LeftFoot=(.055, .06, 0)),
    arm_r=.05, trunk_r=.125, skirt=(.075, .045), skirt_share=.42, wd=(.09, .02)),     # gamis panjang sampai y=.10: ayunan kaki diredam
}

def auto_weights(P, sp):
    jn = sp['J']; V = {k: np.array(v, float) for k, v in jn.items()}
    for k in list(V):
        if k.startswith('Left'): V['Right' + k[4:]] = V[k] * [-1, 1, 1]
    names = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand',
             'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot']; ix = {k: i for i, k in enumerate(names)}
    n = len(P); x, y = P[:, 0], P[:, 1]; Wt = np.zeros((n, len(names)))
    # rantai badan (topi di sumbu y)
    cn = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head']; cy = np.array([V[k][1] for k in cn]); chain = np.zeros((n, len(cn)))
    for k in range(len(cn) - 1):
        m = (y >= cy[k]) & (y < cy[k + 1]); t = (y[m] - cy[k]) / (cy[k + 1] - cy[k]); chain[m, k] = 1 - t; chain[m, k + 1] = t
    chain[y < cy[0], 0] = 1; chain[y >= cy[-1], -1] = 1
    # lengan: selubung kapsul (jarak ke sumbu lengan / radius) lawan selubung badan
    aw = np.zeros(n); arm_part = np.zeros((n, len(names)))
    for sd in ('Left', 'Right'):
        sh, el, wr = V[sd + 'Arm'], V[sd + 'ForeArm'], V[sd + 'Hand']; tip = wr + (wr - el) / np.linalg.norm(wr - el) * 0.06
        segs = [(sh, el), (el, wr), (wr, tip)]; L = [np.linalg.norm(b - a) for a, b in segs]; cum = np.cumsum([0] + L)
        D = []; S = []
        for k, (a, b) in enumerate(segs):
            d, t = seg_dist(P, a, b); D.append(d); S.append(cum[k] + t * L[k])
        D = np.array(D); best = D.argmin(0); d = D.min(0); s_arc = np.array(S)[best, np.arange(n)]
        A = np.exp(-3 * (d / sp['arm_r']) ** 2); T = np.exp(-3 * (np.abs(x) / sp['trunk_r']) ** 2)
        a_w = A / (A + T + 1e-9) * (np.sign(x) == (1 if sd == 'Left' else -1)); dl = 0.03
        w_hand = sm(cum[2] - dl, cum[2] + dl, s_arc); w_arm = 1 - sm(cum[1] - dl, cum[1] + dl, s_arc); w_fore = np.clip(1 - w_hand - w_arm, 0, 1)
        arm_part[:, ix[sd + 'Arm']] = a_w * w_arm; arm_part[:, ix[sd + 'ForeArm']] = a_w * w_fore; arm_part[:, ix[sd + 'Hand']] = a_w * w_hand; aw += a_w
    aw = np.clip(aw, 0, 1)
    # kaki: bagian pangkal ikut pinggul (kain/rok), makin ke bawah makin penuh
    hip = V['Hips'][1]; kn = V['LeftLeg'][1]; an = V['LeftFoot'][1]
    lw = sm(hip + 0.03, hip - 0.08, y); hemr = np.zeros(n)
    if sp.get('skirt'):   # rok/kain: di daerah kain kaki hanya ikut sebagian (skirt_share), di bawah hem penuh
        hemr = sm(sp['skirt'][0], sp['skirt'][1], y); base = sp['skirt_share'] * lw; lw = base + (1 - base) * hemr
    wd = np.full(n, sp['wd'][1])
    if sp.get('skirt'): wd = sp['wd'][1] + (sp['wd'][0] - sp['wd'][1]) * (1 - hemr)
    sL = sm(-wd, wd, x); kt = sm(kn + .06, kn - .06, y); ft = sm(an + .05, an - .01, y); free = (1 - aw)
    for k, nm in enumerate(cn): Wt[:, ix[nm]] += chain[:, k] * free * (1 - lw)
    Wt += arm_part
    for sd, sw in (('Left', sL), ('Right', 1 - sL)):
        c = free * lw * sw; Wt[:, ix[sd + 'UpLeg']] += c * (1 - kt); Wt[:, ix[sd + 'Leg']] += c * kt * (1 - ft); Wt[:, ix[sd + 'Foot']] += c * kt * ft
    top = np.argsort(-Wt, axis=1)[:, :4]; W = np.take_along_axis(Wt, top, 1); W = W / W.sum(1, keepdims=True)
    return names, V, top, W

def prep_static(kind, src, dst, quiet=False):
    sp = SPECS[kind]; t0 = time.time(); P, N, UV, F, tex = load_static(src); tri0 = len(F)
    y0 = P[:, 1].min(); H = P[:, 1].max() - y0; s = 1.0 / H; P = (P - [(P[:, 0].min() + P[:, 0].max()) / 2, y0, 0]) * s
    tex = pad_texture(tex, UV, F, grow=3)
    Jd = np.zeros((len(P), 4), int); Wd = np.zeros((len(P), 4)); Wd[:, 0] = 1
    P2, UV2, N2, _, _, F2 = decimate(P, UV, N, Jd, Wd, F, sp['target'])
    if not quiet: print(f'  segitiga {tri0} -> {len(F2)}, simpul {len(P)} -> {len(P2)} ({time.time()-t0:.0f} dtk)')
    names, V, J2, W2 = auto_weights(P2, sp)
    par = {'Hips': None, 'Spine': 'Hips', 'Spine1': 'Spine', 'Spine2': 'Spine1', 'Neck': 'Spine2', 'Head': 'Neck', 'LeftArm': 'Spine2', 'LeftForeArm': 'LeftArm', 'LeftHand': 'LeftForeArm',
           'RightArm': 'Spine2', 'RightForeArm': 'RightArm', 'RightHand': 'RightForeArm', 'LeftUpLeg': 'Hips', 'LeftLeg': 'LeftUpLeg', 'LeftFoot': 'LeftLeg', 'RightUpLeg': 'Hips', 'RightLeg': 'RightUpLeg', 'RightFoot': 'RightLeg'}
    ix = {k: i for i, k in enumerate(names)}
    joints = [{'name': nm, 'parent': ix[par[nm]] if par[nm] else -1, 't': V[nm] - (V[par[nm]] if par[nm] else 0), 'q': np.array([0, 0, 0, 1.0])} for nm in names]
    Mr = rest_mats(joints); IBM = [np.linalg.inv(m) for m in Mr]; err = np.abs(skin_points(P2, J2, W2, Mr, IBM) - P2).max()
    if not quiet: print(f'  uji rest-pose skinning: galat maks {err:.2e}')
    cfg = dict(sp['cfg']); cfg['noPhi'] = True   # lengan sudah turun di mesh asli
    clips = bake_clips(joints, T_RUN, T_IDLE, down_deg=0, cfg=cfg)
    write_glb(dst, sp['name'], P2, UV2, N2, J2, W2, F2, joints, clips, jpeg(tex, 512, 86), rough=0.95)
    if not quiet: print(f'  {len(P2)} simpul, {len(joints)} tulang; {os.path.getsize(dst)/1024:.0f} KB -> {dst} ({time.time()-t0:.0f} dtk)')

if __name__ == '__main__':
    kind, src, dst = sys.argv[1:4]
    if kind == 'ayah': prep_ayah(src, dst)
    elif kind in SPECS: prep_static(kind, src, dst)
    else: raise SystemExit('jenis: ayah | malayu | melayu')
