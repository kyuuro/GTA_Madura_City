# Trace kasar layout KBS dari gambar TAMPAK ATAS (data/kbs_ref_topview.png) -> data/kbs_trace_draft.json (+ overlay).
# Pakai: python3 -I tools/kbs_trace.py data/kbs_ref_topview.png data/kbs_trace_draft.json data/kbs_trace_overlay.png
# Skala dugaan: 1 px gambar ~ 1 m asli ~ 1/3 unit game (KBS asli ~15 ha). KALIBRASI ulang kalau ada ukuran nyata. Orientasi: atas gambar = utara (BELUM diverifikasi).
import sys, json, numpy as np, cv2
src, out, ovp = sys.argv[1:4]; S = 1/3.0
bgr = cv2.imread(src); im = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(int); R, G, B = im[..., 0], im[..., 1], im[..., 2]
water = ((G-R > 46) & (B-R > 12) & (G > 190)).astype(np.uint8)   # air (teal)
bld = ((R >= G-12) & (R > 90)).astype(np.uint8)                   # atap cokelat / bangunan tan
lawn = ((abs(R-201) < 6) & (abs(G-236) < 6) & (abs(B-193) < 6)).astype(np.uint8)
def polys(m, minA, eps):
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    cs, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE); res = []
    if hier is None: return res
    for i, c in enumerate(cs):
        if hier[0][i][3] != -1 or cv2.contourArea(c) < minA: continue          # hanya kontur luar; lubang di bawah
        holes = [cv2.approxPolyDP(cs[j], eps, True)[:, 0, :] for j in range(len(cs)) if hier[0][j][3] == i and cv2.contourArea(cs[j]) >= minA]
        f = lambda p: [[round(float(x*S), 1), round(float(y*S), 1)] for x, y in p]
        res.append({'area_u2': round(cv2.contourArea(c)*S*S, 1), 'p': f(cv2.approxPolyDP(c, eps, True)[:, 0, :]), 'holes': [f(h) for h in holes]})
    return res
W = polys(water, 40, 1.6); Bd = polys(bld, 25, 1.2)
ov = bgr.copy()
for p in W:
    cv2.polylines(ov, [(np.array(p['p'])*3).astype(np.int32)], True, (255, 0, 0), 1)
    for h in p['holes']: cv2.polylines(ov, [(np.array(h)*3).astype(np.int32)], True, (0, 160, 255), 1)
for p in Bd: cv2.polylines(ov, [(np.array(p['p'])*3).astype(np.int32)], True, (0, 0, 255), 1)
cv2.imwrite(ovp, ov)
json.dump({'unit': 'unit game; 1 px gambar = 0.333; origin = pojok kiri-atas gambar', 'size_px': list(im.shape[1::-1]), 'water': W, 'buildings': Bd}, open(out, 'w'))
print('air', len(W), 'bangunan', len(Bd))
