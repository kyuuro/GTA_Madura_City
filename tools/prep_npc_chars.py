#!/usr/bin/env python3
"""Iterasi 50: siapkan 2 karakter NPC tambahan dari model luar jadi GLB ringan yang cocok dengan retro.js.
  python3 tools/prep_npc_chars.py hijab Muslim_Girl.glb assets/npc_hijab.glb
  python3 tools/prep_npc_chars.py sma   anak-sma-cewe.zip assets/npc_sma.glb      (zip berisi source/model.glb + textures/Image_0_0.jpeg)
Hasil: 1 SkinnedMesh + 1 material (atlas tekstur), rangka ~22 tulang bernama gaya Mixamo, klip 'Idle' & 'Run' sudah dipanggang
(durasi sama dengan klip Kenney: Run 0.667 dtk), tinggi 1.0 satuan, kaki di y=0, depan +Z. retro.js menskalakan ke tinggi akhir."""
import sys, io, json, zipfile
import numpy as np
from PIL import Image
sys.path.insert(0, __import__('os').path.dirname(__file__))
from glbkit import *
from qem import decimate
from rigkit import *

KEEP = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
        'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']
T_RUN, T_IDLE = 0.667, 1.042   # = klip Kenney (assets/char_retro.glb)

def atlas_tile(img, tile):
    return img.convert('RGB').resize((tile, tile), Image.LANCZOS)

def pad_texture(img, UV, F, grow=2):
    """Isi area tekstur yang TIDAK dipakai UV mesh asli dengan warna piksel terpakai terdekat. Segitiga besar hasil penyederhanaan bisa menyapu
    area kosong (tekstur atlas biasanya hitam di sana) -> tanpa padding muncul bercak hitam."""
    import cv2
    from scipy import ndimage
    a = np.array(img.convert('RGB')); h, w, _ = a.shape; m = np.zeros((h, w), np.uint8)
    for tri in UV[F]:
        cv2.fillPoly(m, [np.round(tri * [w, h]).astype(np.int32)], 255)
    m = cv2.dilate(m, np.ones((2 * grow + 1, 2 * grow + 1), np.uint8)) > 0
    idx = ndimage.distance_transform_edt(~m, return_distances=False, return_indices=True)
    return Image.fromarray(a[idx[0], idx[1]])

def remap_skin(J, W, jmap):
    J2 = np.zeros_like(J); W2 = np.zeros_like(W)
    for i in range(len(J)):
        d = {}
        for j, w in zip(J[i], W[i]):
            if w > 0: d[jmap[int(j)]] = d.get(jmap[int(j)], 0) + w
        top = sorted(d.items(), key=lambda kv: -kv[1])[:4]; s = sum(w for _, w in top) or 1
        for k, (j, w) in enumerate(top): J2[i, k] = j; W2[i, k] = w / s
    return J2, W2

def prep_hijab(src, dst, quiet=False):
    g, B = load(src); sk = g['skins'][0]; names = [g['nodes'][j]['name'] for j in sk['joints']]
    par = {}
    for i, nd in enumerate(g['nodes']):
        for c in nd.get('children', []): par[c] = i
    jnode = {n: sk['joints'][k] for k, n in enumerate(names)}
    # --- rangka ringkas: hanya KEEP, joint lain -> leluhur terdekat yang dipertahankan ---
    keep_idx = {n: i for i, n in enumerate(KEEP)}
    def kept_anc(n):
        while n not in keep_idx:
            n = g['nodes'][par[jnode[n]]]['name']
        return n
    jmap = {k: keep_idx[kept_anc(n)] for k, n in enumerate(names)}
    # --- kumpulkan bagian ---
    PARTS = [('Wolf3D_Head', 1200), ('Wolf3D_Headwear', 620), ('Wolf3D_Body', 480), ('Wolf3D_Outfit_Top', 1050), ('Wolf3D_Outfit_Bottom', 560), ('Wolf3D_Outfit_Footwear', 340), ('EyeLeft', 36), ('EyeRight', 36)]
    TILE = {'Wolf3D_Head': 0, 'Wolf3D_Headwear': 1, 'Wolf3D_Outfit_Top': 2, 'Wolf3D_Outfit_Bottom': 3, 'Wolf3D_Outfit_Footwear': 4, 'Wolf3D_Body': 5, 'EyeLeft': 6, 'EyeRight': 6}
    DROP_BODY = {'Hips', 'Spine', 'Spine1', 'Spine2', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg'}
    out = []; tot_before = 0; padded = {}
    def img_of(mat): return Image.open(io.BytesIO(image_bytes(g, B, g['textures'][g['materials'][mat]['pbrMetallicRoughness']['baseColorTexture']['index']]['source'])))
    for m in g['meshes']:
        if m['name'] not in dict(PARTS): continue
        pr = m['primitives'][0]; a = pr['attributes']
        P = acc(g, B, a['POSITION']); N = acc(g, B, a['NORMAL']); UV = acc(g, B, a['TEXCOORD_0']); J = acc(g, B, a['JOINTS_0']).astype(int); Wt = acc(g, B, a['WEIGHTS_0']).astype(float)
        F = acc(g, B, pr['indices']).reshape(-1, 3).astype(int); tot_before += len(F)
        J, Wt = remap_skin(J, Wt, jmap)
        if m['name'] == 'Wolf3D_Body':   # badan yang tertutup baju/celana tidak perlu digambar (buang muka yang semua simpulnya dominan di bagian tertutup)
            dom = np.array([KEEP[J[i, np.argmax(Wt[i])]] for i in range(len(P))]); drop = np.array([d in DROP_BODY and not (d.endswith('Leg') and P[i, 1] < 0.32) for i, d in enumerate(dom)])
            F = F[~drop[F].all(1)]
            used = np.unique(F.ravel()); rm = -np.ones(len(P), int); rm[used] = np.arange(len(used)); P, N, UV, J, Wt, F = P[used], N[used], UV[used], J[used], Wt[used], rm[F]
        padded[m['name']] = pad_texture(img_of(m['primitives'][0]['material']), UV, F)
        P2, UV2, N2, J2, W2, F2 = decimate(P, UV, N, J, Wt, F, dict(PARTS)[m['name']])
        if not quiet: print(f"  {m['name']:24s} {len(F):5d} -> {len(F2):4d} segitiga")
        out.append((m['name'], P2, UV2, N2, J2, W2, F2))
    # --- atlas 1024x512 (8 petak 256) ---
    mat_of = {m['name']: m['primitives'][0]['material'] for m in g['meshes']}
    atlas = Image.new('RGB', (1024, 512), (128, 128, 128))
    for pname, t in TILE.items():
        tile = atlas_tile(padded[pname], 256); atlas.paste(tile, ((t % 4) * 256, (t // 4) * 256))
    Ps, UVs, Ns, Js, Ws, Fs = [], [], [], [], [], []; off = 0
    for pname, P2, UV2, N2, J2, W2, F2 in out:
        t = TILE[pname]; u = ((t % 4) * 256 + 1 + np.clip(UV2[:, 0], 0, 1) * 254) / 1024; v = ((t // 4) * 256 + 1 + np.clip(UV2[:, 1], 0, 1) * 254) / 512
        Ps.append(P2); UVs.append(np.c_[u, v]); Ns.append(N2); Js.append(J2); Ws.append(W2); Fs.append(F2 + off); off += len(P2)
    P = np.vstack(Ps); UV = np.vstack(UVs); N = np.vstack(Ns); J = np.vstack(Js); W = np.vstack(Ws); F = np.vstack(Fs)
    # --- normalisasi: tinggi 1.0, kaki y=0 ---
    y0 = P[:, 1].min(); H = P[:, 1].max() - y0; s = 1.0 / H
    P = (P - [0, y0, 0]) * s
    # --- rangka (translasi diskalakan; Hips digeser turun y0) ---
    joints = []
    for n in KEEP:
        nd = g['nodes'][jnode[n]]; p = par[jnode[n]]; pn = g['nodes'][p]['name']
        t, q, sc = node_local(nd)
        joints.append({'name': n, 'parent': keep_idx[pn] if pn in keep_idx else -1, 't': t * s, 'q': q / np.linalg.norm(q)})
    # joint akar: translasi dunia = (rest world Hips) -> geser
    joints[0]['t'] = (joints[0]['t'] / s - [0, y0, 0]) * s
    # cek konsistensi dgn IBM asli: simpul rest harus kembali ke dirinya
    IBM = [np.linalg.inv(m) for m in rest_mats(joints)]
    Mr = rest_mats(joints); chk = skin_points(P, J, W, Mr, IBM); err = np.abs(chk - P).max()
    if not quiet: print(f'  uji rest-pose skinning: galat maks {err:.2e}')
    clips = bake_clips(joints, T_RUN, T_IDLE, down_deg=10)
    buf = io.BytesIO(); atlas.save(buf, 'JPEG', quality=84, optimize=True)
    write_glb(dst, 'npc_hijab', P, UV, N, J, W, F, joints, clips, buf.getvalue())
    if not quiet: print(f'  total {tot_before} -> {len(F)} segitiga, {len(P)} simpul, {len(joints)} tulang; {__import__("os").path.getsize(dst)/1024:.0f} KB -> {dst}')
    return P, UV, N, J, W, F, joints, clips, atlas

def sm(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

SMA_JOINTS = [   # (nama, induk, posisi dunia saat T-pose, satuan model asli; Left = +X)
    ('Hips', None, (0, -0.05, -0.02)), ('Spine', 'Hips', (0, 0.10, -0.02)), ('Spine1', 'Spine', (0, 0.27, -0.02)), ('Spine2', 'Spine1', (0, 0.45, -0.03)),
    ('Neck', 'Spine2', (0, 0.64, -0.03)), ('Head', 'Neck', (0, 0.72, -0.02)),
    ('LeftArm', 'Spine2', (0.20, 0.535, -0.03)), ('LeftForeArm', 'LeftArm', (0.50, 0.535, -0.03)), ('LeftHand', 'LeftForeArm', (0.73, 0.535, -0.03)),
    ('RightArm', 'Spine2', (-0.20, 0.535, -0.03)), ('RightForeArm', 'RightArm', (-0.50, 0.535, -0.03)), ('RightHand', 'RightForeArm', (-0.73, 0.535, -0.03)),
    ('LeftUpLeg', 'Hips', (0.11, -0.10, -0.04)), ('LeftLeg', 'LeftUpLeg', (0.115, -0.64, -0.055)), ('LeftFoot', 'LeftLeg', (0.11, -0.865, -0.06)),
    ('RightUpLeg', 'Hips', (-0.11, -0.10, -0.04)), ('RightLeg', 'RightUpLeg', (-0.115, -0.64, -0.055)), ('RightFoot', 'RightLeg', (-0.11, -0.865, -0.06))]
SMA_DOWN = 14   # derajat dari vertikal untuk lengan setelah diturunkan dari T-pose

def sma_weights(P):
    n = len(P); x, y = P[:, 0], P[:, 1]; names = [j[0] for j in SMA_JOINTS]; ix = {k: i for i, k in enumerate(names)}; Wt = np.zeros((n, len(names)))
    # rantai badan: fungsi topi di sumbu y
    cn = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head']; cy = np.array([-0.05, 0.10, 0.27, 0.45, 0.64, 0.76]); chain = np.zeros((n, len(cn)))
    for k in range(len(cn) - 1):
        m = (y >= cy[k]) & (y < cy[k + 1]); t = (y[m] - cy[k]) / (cy[k + 1] - cy[k]); chain[m, k] = 1 - t; chain[m, k + 1] = t
    chain[y < cy[0], 0] = 1; chain[y >= cy[-1], -1] = 1
    # lengan
    ax_ = np.abs(x); band = sm(0.30, 0.40, y) * (1 - sm(0.66, 0.74, y)); aw = sm(0.17, 0.30, ax_) * band
    t1 = sm(0.44, 0.60, ax_); t2 = sm(0.70, 0.78, ax_); left = x > 0
    # kaki + rok (rok ikut kaki separuh supaya tidak robek)
    fl = 0.5 * sm(-0.03, -0.45, y) + 0.5 * sm(-0.45, -0.53, y); wd = 0.12 * (1 - sm(-0.45, -0.52, y)) + 0.005; sL = sm(-wd, wd, x)
    kt = sm(-0.58, -0.70, y); ft = sm(-0.84, -0.89, y)
    for k, nm in enumerate(cn): Wt[:, ix[nm]] += chain[:, k] * (1 - aw) * (1 - fl)
    for sd, mask_w in (('Left', np.where(left, 1.0, 0.0)), ('Right', np.where(left, 0.0, 1.0))):
        Wt[:, ix[sd + 'Arm']] += aw * (1 - t1) * mask_w; Wt[:, ix[sd + 'ForeArm']] += aw * t1 * (1 - t2) * mask_w; Wt[:, ix[sd + 'Hand']] += aw * t1 * t2 * mask_w
        sw = sL if sd == 'Left' else 1 - sL
        Wt[:, ix[sd + 'UpLeg']] += fl * sw * (1 - kt); Wt[:, ix[sd + 'Leg']] += fl * sw * kt * (1 - ft); Wt[:, ix[sd + 'Foot']] += fl * sw * kt * ft
    top = np.argsort(-Wt, axis=1)[:, :4]; J = top; W = np.take_along_axis(Wt, top, 1); W = W / W.sum(1, keepdims=True)
    return J, W

def prep_sma(src, dst, quiet=False):
    z = zipfile.ZipFile(src); gb = z.read('source/model.glb'); open('/tmp/_sma.glb', 'wb').write(gb); g, B = load('/tmp/_sma.glb')
    tex = Image.open(io.BytesIO(image_bytes(g, B, 0))).convert('RGB')   # tekstur TERTANAM di model.glb (cocok dgn UV glTF); textures/Image_0_0.jpeg di zip terbalik vertikal
    pr = g['meshes'][0]['primitives'][0]; a = pr['attributes']
    P = acc(g, B, a['POSITION']).astype(float); N = acc(g, B, a['NORMAL']).astype(float); UV = acc(g, B, a['TEXCOORD_0']).astype(float); F = acc(g, B, pr['indices']).reshape(-1, 3).astype(int)
    tri0 = len(F); J, W = sma_weights(P); tex = pad_texture(tex, UV, F, grow=3)
    # --- turunkan lengan dari T-pose (LBS satu kali, di data mesh) ---
    ix = {j[0]: i for i, j in enumerate(SMA_JOINTS)}; wp = {j[0]: np.array(j[2], float) for j in SMA_JOINTS}
    def rotz(a_): c, s_ = np.cos(a_), np.sin(a_); return np.array([[c, -s_, 0], [s_, c, 0], [0, 0, 1]])
    ang = {'Left': -np.radians(90 - SMA_DOWN), 'Right': np.radians(90 - SMA_DOWN)}
    Pn = np.zeros_like(P); Nn = np.zeros_like(N)
    for k in range(4):
        for ji in np.unique(J[:, k]):
            m = J[:, k] == ji; nm = SMA_JOINTS[ji][0]; side = 'Left' if nm.startswith('Left') else 'Right'
            if nm.endswith(('Arm', 'ForeArm', 'Hand')) and not nm.endswith('UpLeg'):
                R = rotz(ang[side]); piv = wp[side + 'Arm']; Pn[m] += W[m, k:k + 1] * ((P[m] - piv) @ R.T + piv); Nn[m] += W[m, k:k + 1] * (N[m] @ R.T)
            else: Pn[m] += W[m, k:k + 1] * P[m]; Nn[m] += W[m, k:k + 1] * N[m]
    P = Pn; N = Nn / (np.linalg.norm(Nn, axis=1, keepdims=True) + 1e-12)
    wp2 = dict(wp)
    for sd in ('Left', 'Right'):
        piv = wp[sd + 'Arm']; R = rotz(ang[sd])
        for b in ('ForeArm', 'Hand'): wp2[sd + b] = (wp[sd + b] - piv) @ R.T + piv
    # --- sederhanakan ---
    P2, UV2, N2, J2, W2, F2 = decimate(P, UV, N, J, W, F, 3000)
    if not quiet: print(f'  segitiga {tri0} -> {len(F2)}, simpul {len(P)} -> {len(P2)}')
    y0 = P2[:, 1].min(); H = P2[:, 1].max() - y0; s = 1.0 / H
    P2 = (P2 - [0, y0, 0]) * s
    joints = []
    for nm, par_, _ in SMA_JOINTS:
        wpos = (wp2[nm] - [0, y0, 0]) * s; ppos = (wp2[par_] - [0, y0, 0]) * s if par_ else np.zeros(3)
        joints.append({'name': nm, 'parent': ix[par_] if par_ else -1, 't': wpos - ppos, 'q': np.array([0, 0, 0, 1.0])})
    Mr = rest_mats(joints); IBM = [np.linalg.inv(m) for m in Mr]; err = np.abs(skin_points(P2, J2, W2, Mr, IBM) - P2).max()
    if not quiet: print(f'  uji rest-pose skinning: galat maks {err:.2e}')
    clips = bake_clips(joints, T_RUN, T_IDLE, down_deg=SMA_DOWN, cfg=dict(thigh=0.36, knee=0.70, arm=0.34))
    buf = io.BytesIO(); tex.resize((512, 512), Image.LANCZOS).save(buf, 'JPEG', quality=86, optimize=True)
    write_glb(dst, 'npc_sma', P2, UV2, N2, J2, W2, F2, joints, clips, buf.getvalue(), rough=0.95)
    if not quiet: print(f'  {len(P2)} simpul, {len(joints)} tulang; {__import__("os").path.getsize(dst)/1024:.0f} KB -> {dst}')

if __name__ == '__main__':
    kind, src, dst = sys.argv[1:4]
    if kind == 'hijab': prep_hijab(src, dst)
    elif kind == 'sma': prep_sma(src, dst)
    else: raise SystemExit('jenis: hijab | sma')
