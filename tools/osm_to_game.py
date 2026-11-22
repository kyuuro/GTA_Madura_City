#!/usr/bin/env python3
# Iterasi 86: export Overpass (GeoJSON jalan Darmo) -> src/darmo_data.js (DARMO_ROADS) untuk game skala 1:3.
# Pakai: python3 -I tools/osm_to_game.py data/darmo_osm_raw.geojson src/darmo_data.js
# Langkah: konversi lon/lat -> (x,z) game; sambung ruas se-nama/kelas; GABUNG dua jalur oneway berlawanan jadi 1 ribbon dua-arah;
# buang jalan layang (bridge) yang menumpuk jalan di bawahnya; sederhanakan (Douglas-Peucker); T-junction dipasang melewati jalan lain
# (supaya traffic.js trFindJunctions menemukan persimpangan). Jalan Darmo ditambah di AKHIR ROADS (zone:'darmo').
import json, math, sys, collections

LAT0, LON0 = -7.2115, 112.7795
KLAT = 110574.0; KLON = 111320.0 * math.cos(math.radians(7.25))
def g(lon, lat): return ((lon - LON0) * KLON / 3.0 + 340, -(lat - LAT0) * KLAT / 3.0 - 105)
WIDTH = {'trunk': 18, 'primary': 16, 'secondary': 13, 'tertiary': 10, 'residential': 7, 'unclassified': 6}
MAJOR = ('trunk', 'primary', 'secondary')
DUAL_MAX, DUAL_MIN = 46.0, 2.5   # jarak sumbu antar dua jalur yang dianggap satu jalan (unit game)

def L(p, q): return math.hypot(p[0] - q[0], p[1] - q[1])
def plen(P): return sum(L(a, b) for a, b in zip(P, P[1:]))
def seg_near(p, a, b):
    dx, dz = b[0] - a[0], b[1] - a[1]; d2 = dx * dx + dz * dz
    t = 0 if d2 == 0 else max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / d2))
    q = (a[0] + dx * t, a[1] + dz * t); return L(p, q), q, (dx, dz)
def near_poly(P, p):   # (jarak, titik, tangen, indeks segmen+fraksi)
    best = (1e18, None, None, 0)
    for i in range(len(P) - 1):
        d, q, t = seg_near(p, P[i], P[i + 1])
        if d < best[0]: best = (d, q, t, i + L(P[i], q) / max(1e-9, L(P[i], P[i + 1])))
    return best
def resample_abs(P, step):
    out = [P[0]]; s = 0.0; nxt = step
    for a, b in zip(P, P[1:]):
        seg = L(a, b)
        while s + seg >= nxt and seg > 0:
            t = (nxt - s) / seg; out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)); nxt += step
        s += seg
    if L(out[-1], P[-1]) > step * 0.3: out.append(P[-1])
    return out
def dp(P, eps):
    if len(P) < 3: return P
    a, b = P[0], P[-1]; dm, im = -1, 0
    for i in range(1, len(P) - 1):
        d = seg_near(P[i], a, b)[0]
        if d > dm: dm, im = d, i
    if dm <= eps: return [a, b]
    return dp(P[:im + 1], eps)[:-1] + dp(P[im:], eps)

def load(path):
    d = json.load(open(path)); ways = []
    for f in d['features']:
        if f['geometry']['type'] != 'LineString': continue
        p = f['properties']; h = p.get('highway')
        if h not in WIDTH: continue
        ways.append({'name': p.get('name') or '', 'hw': h, 'ow': p.get('oneway') == 'yes', 'br': p.get('bridge') == 'yes',
                     'pts': [g(*q) for q in f['geometry']['coordinates']]})
    return ways

def join(ways, tol=2.0):   # sambung ruas se-(nama, kelas, oneway, bridge)
    groups = collections.defaultdict(list)
    for w in ways: groups[(w['name'], w['hw'], w['ow'], w['br'])].append(w)
    out = []
    for k, ws in groups.items():
        chains = [dict(w, pts=list(w['pts'])) for w in ws]; changed = True
        while changed:
            changed = False
            for i in range(len(chains)):
                a = chains[i]
                if a is None: continue
                for j in range(len(chains)):
                    b = chains[j]
                    if j == i or b is None: continue
                    if L(a['pts'][-1], b['pts'][0]) < tol: a['pts'] = a['pts'] + b['pts'][1:]; chains[j] = None; changed = True
                    elif not a['ow'] and L(a['pts'][-1], b['pts'][-1]) < tol: a['pts'] = a['pts'] + b['pts'][::-1][1:]; chains[j] = None; changed = True
                    elif not a['ow'] and L(a['pts'][0], b['pts'][0]) < tol: a['pts'] = b['pts'][::-1] + a['pts'][1:]; chains[j] = None; changed = True
                    elif L(b['pts'][-1], a['pts'][0]) < tol: a['pts'] = b['pts'] + a['pts'][1:]; chains[j] = None; changed = True
        out += [c for c in chains if c]
    return out

def merge_dual(chains, step=5.0):
    """Gabung pasangan jalur oneway berlawanan (se-nama, se-kelas) jadi satu garis tengah; sisanya tetap oneway."""
    res = []; used = set(); consumed = {}
    cand = [i for i, c in enumerate(chains) if c['ow'] and c['hw'] in WIDTH and c['hw'] != 'residential' and c['name']]
    smp = {i: resample_abs(chains[i]['pts'], step) for i in cand}
    consumed = {i: [False] * len(smp[i]) for i in cand}
    merged = []
    for ai in cand:
        A = chains[ai]; best = None
        for bi in cand:
            if bi == ai or chains[bi]['name'] != A['name'] or chains[bi]['hw'] != A['hw'] or chains[bi]['br'] != A['br']: continue
            m = []
            for k, p in enumerate(smp[ai]):
                if consumed[ai][k]: m.append(None); continue
                d, q, t, pos = near_poly(chains[bi]['pts'], p)
                if not (DUAL_MIN <= d <= DUAL_MAX): m.append(None); continue
                k2 = min(k + 1, len(smp[ai]) - 1); ta = (smp[ai][k2][0] - smp[ai][max(0, k2 - 1)][0], smp[ai][k2][1] - smp[ai][max(0, k2 - 1)][1])
                na, nb = math.hypot(*ta), math.hypot(*t)
                if na < 1e-6 or nb < 1e-6 or (ta[0] * t[0] + ta[1] * t[1]) / (na * nb) > -0.6: m.append(None); continue
                m.append((q, d))
            cnt = sum(1 for x in m if x)
            if cnt >= 3 and (best is None or cnt > best[0]): best = (cnt, bi, m)
        if not best: continue
        _, bi, m = best
        run = []
        def flush():
            if len(run) >= 3:
                P = [((p[0] + q[0]) / 2, (p[1] + q[1]) / 2) for p, q, d in run]; dd = sum(d for _, _, d in run) / len(run)
                merged.append({'name': A['name'], 'hw': A['hw'], 'ow': False, 'br': A['br'], 'pts': P, 'gap': dd})
            run.clear()
        for k, x in enumerate(m):
            if x: run.append((smp[ai][k], x[0], x[1])); consumed[ai][k] = True
            else: flush()
        flush()
        # tandai sampel B yang terpakai (terdekat ke titik cocok)
        Bs = smp[bi]
        for x in m:
            if not x: continue
            j = min(range(len(Bs)), key=lambda j: L(Bs[j], x[0])); consumed[bi][j] = True
    for i, c in enumerate(chains):
        if i not in smp: res.append(c); continue
        S, cs = smp[i], consumed[i]; run = []
        def fl():
            if len(run) >= 3: res.append(dict(c, pts=list(run)))
            run.clear()
        for k, p in enumerate(S):
            if cs[k]: fl()
            else: run.append(p)
        fl()
    return res + merged

def drop_flyovers(chains):
    base = [c for c in chains if not c['br'] and c['hw'] in WIDTH and c['hw'] != 'residential']; kept = []; dropped = []
    for c in chains:
        if c['br'] and c['hw'] in MAJOR:
            S = resample_abs(c['pts'], 10.0); near = sum(1 for p in S if any(near_poly(b['pts'], p)[0] < 28 for b in base if b is not c))
            if near >= 0.6 * len(S): dropped.append((c['name'], c['hw'], round(plen(c['pts'])))); continue
        kept.append(c)
    return kept, dropped

def snap_tjunctions(chains):
    """Ujung jalan lebar (>=10) yang berhenti dekat jalan lebar lain: pasang ke jalan itu dan perpanjang 1,6 unit melewatinya."""
    big = [c for c in chains if WIDTH[c['hw']] >= 10]; n = 0
    for c in big:
        for end in (0, -1):
            P = c['pts']; e = P[end]; o = P[1] if end == 0 else P[-2]
            best = None
            for b in big:
                if b is c: continue
                d, q, t, _ = near_poly(b['pts'], e)
                if d < 5.0 and (best is None or d < best[0]): best = (d, q)
            if not best or best[0] < 0.2: continue
            q = best[1]; dx, dz = q[0] - o[0], q[1] - o[1]; dl = math.hypot(dx, dz) or 1
            P[end] = (q[0] + dx / dl * 1.6, q[1] + dz / dl * 1.6); n += 1
    return n

def main():
    src, out = sys.argv[1], sys.argv[2]
    ways = load(src); print('ruas OSM', len(ways))
    chains = join(ways); print('setelah sambung', len(chains))
    chains = merge_dual(chains); print('setelah gabung dua jalur', len(chains), '(dual:', sum(1 for c in chains if 'gap' in c), ')')
    chains = join(chains, tol=14.0); print('sambung ulang celah (<14)', len(chains))
    chains, dropped = drop_flyovers(chains); print('layang dibuang', len(dropped), dropped[:8])
    for c in chains:
        c['pts'] = dp(c['pts'], 1.5)
    chains = [c for c in chains if len(c['pts']) >= 2 and plen(c['pts']) >= 10]
    ns = snap_tjunctions(chains); print('T-junction dipasang', ns)
    order = {h: i for i, h in enumerate(['trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential'])}
    chains.sort(key=lambda c: (order[c['hw']], c['name']))
    roads = []
    for c in chains:
        w = WIDTH[c['hw']]
        if 'gap' in c: w = max(w, min(22, round(c['gap'] + 9)))
        nm = c['name'] or ('Gang ' + c['hw'])
        roads.append({'name': nm, 'width': w, 'zone': 'darmo', 'pts': [[round(p[0], 1), round(p[1], 1)] for p in c['pts']]})
    xs = [p[0] for r in roads for p in r['pts']]; zs = [p[1] for r in roads for p in r['pts']]
    tot = sum(plen(r['pts']) for r in roads); print('jalan keluaran', len(roads), 'panjang', round(tot), 'bbox', round(min(xs)), round(max(xs)), round(min(zs)), round(max(zs)))
    for h in order: print(' ', h, sum(1 for c in chains if c['hw'] == h), round(sum(plen(c['pts']) for c in chains if c['hw'] == h)))
    with open(out, 'w') as f:
        f.write("// DIHASILKAN oleh tools/osm_to_game.py dari data/darmo_osm_raw.geojson (data (c) kontributor OpenStreetMap, ODbL). JANGAN edit tangan; ulangi skrip.\n")
        f.write("// Koordinat game 1:3 (x timur, z selatan). Dipakai roaddata.js: ROADS.push(...DARMO_ROADS) di AKHIR (indeks perpotongan lalu lintas aman).\n")
        f.write("export const DARMO_BBOX = { x0: %d, x1: %d, z0: %d, z1: %d };\n" % (min(xs) - 20, max(xs) + 20, min(zs) - 20, max(zs) + 20))
        f.write("export const DARMO_ROADS = [\n" + ",\n".join(json.dumps(r, separators=(',', ':'), ensure_ascii=False) for r in roads) + "\n];\n")

if __name__ == '__main__': main()
