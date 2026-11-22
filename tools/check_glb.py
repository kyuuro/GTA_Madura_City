#!/usr/bin/env python3
"""Uji hasil GLB karakter TANPA three.js: baca ulang file (parser mandiri), evaluasi animasi + skinning, render lembar kontak PNG.
  python3 tools/check_glb.py assets/npc_hijab.glb out.png"""
import sys, io, os
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image
from glbkit import *; from rview import *
import matplotlib.pyplot as plt

def read(path):
    g, B = load(path); pr = g['meshes'][0]['primitives'][0]; a = pr['attributes']
    d = dict(P=acc(g, B, a['POSITION']), UV=acc(g, B, a['TEXCOORD_0']), J=acc(g, B, a['JOINTS_0']).astype(int), W=acc(g, B, a['WEIGHTS_0']), F=acc(g, B, pr['indices']).reshape(-1, 3).astype(int))
    sk = g['skins'][0]; d['IBM'] = acc(g, B, sk['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    d['g'] = g; d['joints'] = sk['joints']; d['tex'] = Image.open(io.BytesIO(image_bytes(g, B, 0))).convert('RGB')
    d['anim'] = {}
    for an in g['animations']:
        ch = {}
        for c in an['channels']:
            s = an['samplers'][c['sampler']]; ch[(c['target']['node'], c['target']['path'])] = (acc(g, B, s['input'])[:, 0], acc(g, B, s['output']))
        d['anim'][an['name']] = ch
    return d

def world(d, clip, t):
    g = d['g']; n = len(g['nodes']); par = {}
    for i, nd in enumerate(g['nodes']):
        for c in nd.get('children', []): par[c] = i
    M = {}
    def get(i):
        if i in M: return M[i]
        tr, q, sc = node_local(g['nodes'][i])
        if clip:
            for path in ('rotation', 'translation'):
                if (i, path) in clip:
                    ts, v = clip[(i, path)]; tt = t % ts[-1]; k = min(np.searchsorted(ts, tt, side='right') - 1, len(ts) - 2); u = (tt - ts[k]) / (ts[k + 1] - ts[k]); val = v[k] * (1 - u) + v[k + 1] * u
                    if path == 'rotation': q = val / np.linalg.norm(val)
                    else: tr = val
        L = np.eye(4); L[:3, :3] = qmat(q); L[:3, 3] = tr
        M[i] = L if i not in par else get(par[i]) @ L; return M[i]
    return [get(j) for j in d['joints']]

def pose(d, clipname, t):
    M = world(d, d['anim'].get(clipname) if clipname else None, t); P = d['P']; out = np.zeros_like(P)
    Mk = np.array([M[j] @ d['IBM'][j] for j in range(len(M))])
    for k in range(4):
        m = Mk[d['J'][:, k]]; out += d['W'][:, k:k + 1] * (np.einsum('nij,nj->ni', m[:, :3, :3], P) + m[:, :3, 3])
    return out

def facecolors(d, P, view):
    tex = np.array(d['tex']); h, w, _ = tex.shape; F = d['F']; uv = d['UV'][F].mean(1)
    c = tex[np.clip((uv[:, 1] * h).astype(int), 0, h - 1), np.clip((uv[:, 0] * w).astype(int), 0, w - 1)] / 255.0
    return c * shade(P, F, view)[:, None]

def raster(d, P, view='front', W=300, H=540, bg=(0.86, 0.9, 0.95)):
    """rasterizer bertekstur kecil (z-buffer, UV per piksel, bilinear) -> gambar RGB; mendekati tampilan di game"""
    tex = np.array(d['tex']).astype(float) / 255; th, tw, _ = tex.shape; F = d['F']; UV = d['UV']
    if view == 'front': X, Z = P[:, 0], P[:, 2]
    else: X, Z = -P[:, 2], P[:, 0]
    Y = P[:, 1]; sx = H * 0.92 / 1.0; cx = W / 2; sy = sx; y0 = H * 0.96
    sxv = X * sx + cx; syv = y0 - Y * sy; img = np.ones((H, W, 3)) * np.array(bg); zb = np.full((H, W), -1e9)
    nrm = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]); nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12
    Ld = np.array([0.3, 0.5, 0.8]) if view == 'front' else np.array([0.8, 0.5, 0.3]); Ld /= np.linalg.norm(Ld)
    lit = 0.45 + 0.55 * np.abs(nrm @ Ld)
    for f in range(len(F)):
        a, b, c = F[f]; x0, x1 = int(max(0, min(sxv[[a, b, c]]))), int(min(W - 1, max(sxv[[a, b, c]]) + 1)); y0_, y1 = int(max(0, min(syv[[a, b, c]]))), int(min(H - 1, max(syv[[a, b, c]]) + 1))
        if x1 < x0 or y1 < y0_: continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + .5, np.arange(y0_, y1 + 1) + .5)
        A = np.array([[sxv[a], sxv[b], sxv[c]], [syv[a], syv[b], syv[c]], [1, 1, 1]])
        try: inv = np.linalg.inv(A)
        except np.linalg.LinAlgError: continue
        bc = np.tensordot(inv, np.stack([gx.ravel(), gy.ravel(), np.ones(gx.size)]), axes=(1, 0)); ok = (bc >= -1e-6).all(0)
        if not ok.any(): continue
        zz = bc[0] * Z[a] + bc[1] * Z[b] + bc[2] * Z[c]; px = gx.ravel()[ok].astype(int) - 0; py = gy.ravel()[ok].astype(int); zz = zz[ok]; bcc = bc[:, ok]
        win = zz > zb[py, px]
        if not win.any(): continue
        px, py, zz, bcc = px[win], py[win], zz[win], bcc[:, win]
        u = (bcc[0] * UV[a, 0] + bcc[1] * UV[b, 0] + bcc[2] * UV[c, 0]) * tw - .5; v = (bcc[0] * UV[a, 1] + bcc[1] * UV[b, 1] + bcc[2] * UV[c, 1]) * th - .5
        u0 = np.clip(np.floor(u).astype(int), 0, tw - 2); v0 = np.clip(np.floor(v).astype(int), 0, th - 2); fu = np.clip(u - u0, 0, 1)[:, None]; fv = np.clip(v - v0, 0, 1)[:, None]
        col = tex[v0, u0] * (1 - fu) * (1 - fv) + tex[v0, u0 + 1] * fu * (1 - fv) + tex[v0 + 1, u0] * (1 - fu) * fv + tex[v0 + 1, u0 + 1] * fu * fv
        img[py, px] = col * lit[f]; zb[py, px] = zz
    return img

if __name__ == '__main__':
    d = read(sys.argv[1]); out = sys.argv[2]; T = {'Idle': 1.042, 'Run': 0.667}
    shots = [('rest', None, 0), ('Idle t=0', 'Idle', 0), ('Run 0', 'Run', 0), ('Run 1/4', 'Run', T['Run'] * .25), ('Run 1/2', 'Run', T['Run'] * .5), ('Run 3/4', 'Run', T['Run'] * .75)]
    fig, ax = plt.subplots(2, len(shots), figsize=(3 * len(shots), 10))
    for i, (ttl, cl, t) in enumerate(shots):
        P = pose(d, cl, t)
        for r, vw in enumerate(('front', 'side')): ax[r, i].imshow(raster(d, P, vw)); ax[r, i].axis('off'); ax[r, i].set_title(ttl, fontsize=8)
    plt.tight_layout(); plt.savefig(out, dpi=75)
    print('tri', len(d['F']), 'verts', len(d['P']), 'anim', list(d['anim']), 'bounds', d['P'].min(0).round(3), d['P'].max(0).round(3))
