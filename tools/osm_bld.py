#!/usr/bin/env python3
# Iterasi 89: footprint bangunan + taman Darmo (OSM) -> src/darmo_bld_data.js. Pakai: python3 -I tools/osm_bld.py data/darmo_osm_raw.geojson src/darmo_bld_data.js
# Posisi dipetakan 1:3 (sama dgn osm_to_game.py), UKURAN bangunan tetap meter asli (x3 dari ukuran terproyeksi). Persegi terkecil (hull + sudut tiap sisi).
import json, math, sys
LAT0, LON0 = -7.2115, 112.7795
KLAT = 110574.0; KLON = 111320.0 * math.cos(math.radians(7.25))
def g(lon, lat): return ((lon - LON0) * KLON / 3.0 + 340, -(lat - LAT0) * KLAT / 3.0 - 105)
def hull(P):
    P = sorted(set(P))
    if len(P) < 3: return P
    cr = lambda o, a, b: (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lo = []; up = []
    for p in P:
        while len(lo) > 1 and cr(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(P):
        while len(up) > 1 and cr(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]
def minrect(P):
    H = hull(P); best = None
    for a, b in zip(H, H[1:] + H[:1]):
        t = math.atan2(b[1]-a[1], b[0]-a[0]); c, s = math.cos(t), math.sin(t)
        u = [(p[0]*c + p[1]*s, -p[0]*s + p[1]*c) for p in H]
        u0, u1, v0, v1 = min(q[0] for q in u), max(q[0] for q in u), min(q[1] for q in u), max(q[1] for q in u)
        A = (u1-u0)*(v1-v0)
        if best is None or A < best[0]:
            mu, mv = (u0+u1)/2, (v0+v1)/2
            best = (A, mu*c - mv*s, mu*s + mv*c, u1-u0, v1-v0, t)
    return best
def dp(P, eps):
    if len(P) < 3: return P
    a, b = P[0], P[-1]; dx, dz = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dz) or 1e-9
    i, m = max(((k, abs((P[k][0]-a[0])*dz - (P[k][1]-a[1])*dx)/L) for k in range(1, len(P)-1)), key=lambda q: q[1])
    return dp(P[:i+1], eps)[:-1] + dp(P[i:], eps) if m > eps else [a, b]
KIND = {'school': 1, 'kindergarten': 1, 'university': 1, 'college': 1, 'hospital': 2, 'clinic': 2, 'mosque': 3, 'bank': 4, 'government_office': 4, 'office': 4, 'commercial': 4, 'retail': 4, 'church': 5, 'apartments': 6, 'hotel': 6}
d = json.load(open(sys.argv[1])); B = []; PK = []
for f in d['features']:
    if f['geometry']['type'] != 'Polygon': continue
    p = f['properties']; ring = [g(*q) for q in f['geometry']['coordinates'][0]]
    if 'building' in p:
        A, cx, cz, w, h, t = minrect(ring)
        w, h = w*3, h*3                         # meter asli
        if w < h: w, h, t = h, w, t + math.pi/2
        if h < 3.0: continue
        w, h = min(w, 60), min(h, 40)
        try: lv = int(float(p.get('building:levels') or 0))
        except: lv = 0
        k = KIND.get(p.get('building'), 0) or (4 if p.get('shop') else 0)
        t = (t + math.pi/2) % math.pi - math.pi/2
        B.append([round(cx, 1), round(cz, 1), round(w, 1), round(h, 1), round(t, 2), lv, k])
    elif p.get('leisure') in ('park', 'garden'):
        q = dp(ring, 2.0); PK.append([round(v, 1) for pt in q for v in pt])
B.sort(key=lambda b: -(b[2]*b[3]))
with open(sys.argv[2], 'w') as o:
    o.write('// DIHASILKAN oleh tools/osm_bld.py dari data/darmo_osm_raw.geojson (data (c) kontributor OpenStreetMap, ODbL). JANGAN edit tangan.\n')
    o.write('// DARMO_BLD[i] = [x, z, lebar(m), dalam(m), sudut(rad, putar sumbu Y), lantai(0=tak ada data), jenis(0 umum,1 sekolah,2 RS/klinik,3 masjid,4 kantor/bank/toko,5 gereja,6 apartemen/hotel)]; urut luas turun.\n')
    o.write('export const DARMO_BLD = [\n' + ',\n'.join(json.dumps(b, separators=(',', ':')) for b in B) + '\n];\n')
    o.write('// DARMO_PARKS[i] = poligon datar [x0,z0,x1,z1,...] (taman: tanpa bangunan)\nexport const DARMO_PARKS = [\n' + ',\n'.join(json.dumps(q, separators=(',', ':')) for q in PK) + '\n];\n')
print(len(B), 'bangunan', len(PK), 'taman')
