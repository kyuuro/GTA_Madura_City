"""Penyederhana mesh (quadric error metric, edge collapse) untuk mesh ber-skin. numpy + heapq, tanpa pustaka luar.
Simpul 'jahitan' (posisi sama dengan simpul lain = batas UV/normal, atau tepi terbuka) DIKUNCI supaya UV tidak retak;
simpul bebas boleh runtuh ke simpul terkunci. Atribut (uv, normal, bobot skin) ikut diinterpolasi."""
import heapq
import numpy as np

def _merge_skin(J, W, a, b, t):   # campur bobot skin dua simpul (t=0 -> a, t=1 -> b), simpan 4 terbesar
    d = {}
    for j, w in zip(J[a], W[a]): d[int(j)] = d.get(int(j), 0) + w * (1 - t)
    for j, w in zip(J[b], W[b]): d[int(j)] = d.get(int(j), 0) + w * t
    top = sorted(d.items(), key=lambda kv: -kv[1])[:4]; s = sum(w for _, w in top) or 1
    jj = [j for j, _ in top] + [0] * (4 - len(top)); ww = [w / s for _, w in top] + [0.0] * (4 - len(top)); return jj, ww

def decimate(P, UV, N, J, W, F, target_faces, lock_extra=None, seam_lock=True):
    P = P.astype(np.float64).copy(); UV = UV.astype(np.float64).copy(); N = N.astype(np.float64).copy(); J = J.astype(np.int64).copy(); W = W.astype(np.float64).copy()
    F = [list(map(int, f)) for f in F]; nv = len(P)
    # --- kunci simpul jahitan / tepi terbuka ---
    key = {}
    for i, p in enumerate(P): key.setdefault(tuple(np.round(p, 5)), []).append(i)
    locked = np.zeros(nv, bool)
    for ids in key.values():
        if len(ids) > 1 and seam_lock: locked[ids] = True
    ec = {}
    for f in F:
        for k in range(3):
            e = tuple(sorted((f[k], f[(k + 1) % 3]))); ec[e] = ec.get(e, 0) + 1
    for (a, b), c in ec.items():
        if c == 1 and seam_lock: locked[a] = locked[b] = True
    if lock_extra is not None: locked |= lock_extra
    # --- kuadrik ---
    Q = np.zeros((nv, 4, 4)); vf = [set() for _ in range(nv)]
    def plane(f):
        n = np.cross(P[f[1]] - P[f[0]], P[f[2]] - P[f[0]]); ar = np.linalg.norm(n)
        if ar < 1e-14: return None, 0
        n /= ar; d = -n @ P[f[0]]; p = np.array([n[0], n[1], n[2], d]); return np.outer(p, p) * ar, ar
    for fi, f in enumerate(F):
        q, _ = plane(f)
        for v in f:
            vf[v].add(fi)
            if q is not None: Q[v] += q
    alive = np.ones(nv, bool); ver = np.zeros(nv, int); nf = len(F); fal = [True] * len(F)
    def cost_of(a, b):
        if locked[a] and locked[b]: return None
        Qs = Q[a] + Q[b]
        def err(p): v = np.array([p[0], p[1], p[2], 1.0]); return v @ Qs @ v
        if locked[a]: return err(P[a]), 0
        if locked[b]: return err(P[b]), 1
        c = [(err(P[a]), 0), (err(P[b]), 1), (err((P[a] + P[b]) / 2), 0.5)]; return min(c)
    heap = []
    def push(a, b):
        r = cost_of(a, b)
        if r is not None: heapq.heappush(heap, (r[0], ver[a], ver[b], a, b, r[1]))
    for (a, b) in ec: push(a, b)
    def fnormal(pa, pb, pc):
        n = np.cross(pb - pa, pc - pa); l = np.linalg.norm(n); return n / l if l > 1e-14 else None
    while nf > target_faces and heap:
        c, va, vb, a, b, t = heapq.heappop(heap)
        if not (alive[a] and alive[b]) or ver[a] != va or ver[b] != vb: continue
        newp = P[a] * (1 - t) + P[b] * t
        # a dipertahankan di posisi baru; b dihapus. Cek balik normal pada sisi yang ikut berubah.
        ok = True; shared = vf[a] & vf[b]
        for vv, other in ((a, b), (b, a)):
            for fi in vf[vv] - shared:
                f = F[fi]; pts = [newp if x in (a, b) else P[x] for x in f]; n0 = fnormal(*[P[x] for x in f]); n1 = fnormal(*pts)
                if n1 is None or (n0 is not None and n0 @ n1 < 0.25): ok = False; break
            if not ok: break
        if not ok: continue
        # terapkan
        UV[a] = UV[a] * (1 - t) + UV[b] * t; n_ = N[a] * (1 - t) + N[b] * t; N[a] = n_ / (np.linalg.norm(n_) + 1e-12)
        jj, ww = _merge_skin(J, W, a, b, t); J[a] = jj; W[a] = ww
        P[a] = newp; Q[a] = Q[a] + Q[b]; alive[b] = False; locked[a] = locked[a] or locked[b]
        for fi in list(shared):
            fal[fi] = False; nf -= 1
            for v in F[fi]: vf[v].discard(fi)
        for fi in list(vf[b]):
            F[fi] = [a if x == b else x for x in F[fi]]; vf[a].add(fi)
        vf[b] = set(); ver[a] += 1
        nb = set()
        for fi in vf[a]:
            for x in F[fi]:
                if x != a: nb.add(x)
        for x in nb: push(min(a, x), max(a, x)) if True else None
    keep = [f for f, ok in zip(F, fal) if ok and len(set(f)) == 3]
    used = np.unique(np.array(keep).ravel()); remap = -np.ones(nv, int); remap[used] = np.arange(len(used))
    return P[used], UV[used], N[used], J[used], W[used], remap[np.array(keep)]
