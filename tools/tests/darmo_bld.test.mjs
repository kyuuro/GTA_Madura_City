// Tes bangunan Darmo (iter 89). Lingkungan: sama dgn darmo.test.mjs (src/ + node_modules/three = three_stub.js).
import * as THREE from 'three';
globalThis.window = globalThis; globalThis.location = { search: '' };
const log = console.log; let fails = 0; const ok = (c, m) => { if (!c) { fails++; log('GAGAL:', m); } else log('ok:', m); }; console.log = () => {};
const { ROADS } = await import('./src/roaddata.js'), { terrainHeight } = await import('./src/world.js'), { planDarmoBld, dbInPark } = await import('./src/darmo_bld.js'), { DARMO_PARKS, DARMO_BLD } = await import('./src/darmo_bld_data.js'), { createLazy } = await import('./src/lazy.js'), { DARMO_BBOX } = await import('./src/darmo_data.js');
console.log = log;
// clearance palsu: jarak ke polyline jalan terdekat - setengah lebar (hanya jalan yang bisa dekat; grid sel 40 supaya cepat)
const segs = []; for (const r of ROADS) for (let i = 0; i + 1 < r.pts.length; i++) segs.push([r.pts[i], r.pts[i + 1], r.width / 2]);
const G = 60, grid = new Map(), key = (a, b) => a + ',' + b;
segs.forEach((s, i) => { const x0 = Math.min(s[0][0], s[1][0]) - 80, x1 = Math.max(s[0][0], s[1][0]) + 80, z0 = Math.min(s[0][1], s[1][1]) - 80, z1 = Math.max(s[0][1], s[1][1]) + 80; for (let a = Math.floor(x0 / G); a <= Math.floor(x1 / G); a++) for (let b = Math.floor(z0 / G); b <= Math.floor(z1 / G); b++) { const k = key(a, b); (grid.get(k) || grid.set(k, []).get(k)).push(i); } });
const dSeg = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
const clearance = (x, z) => { let m = 1e9; for (const i of grid.get(key(Math.floor(x / G), Math.floor(z / G))) || []) { const s = segs[i], d = dSeg(x, z, s[0], s[1]) - s[2]; if (d < m) m = d; } return m; };

const mk = (q, extra = {}) => { const hits = []; const t0 = performance.now(); const r = planDarmoBld({ quality: q, height: terrainHeight, roads: { clearance }, collider: { add: (...a) => hits.push(a) }, ...extra }); return { ...r, hits, dt: performance.now() - t0 }; };
const res = {}; for (const q of ['Low', 'High', 'Ultra']) { res[q] = mk(q); ok(res[q].B.length > 100 && res[q].B.length < 12000, q + ': ' + res[q].B.length + ' bangunan, ' + res[q].nOsm + ' OSM (' + res[q].dt.toFixed(0) + ' ms)'); }
ok(res.Low.B.length < res.High.B.length && res.High.B.length < res.Ultra.B.length, 'jumlah naik dgn kualitas');
ok(res.High.nOsm > 250, 'banyak footprint OSM dipakai (' + res.High.nOsm + ' dari ' + DARMO_BLD.length + ')');
const H = res.High, B = H.B;
ok(H.hits.length === B.length, 'tiap bangunan punya collider');
ok(B.every(b => b.gy >= 0.25), '0 bangunan di air');
ok(B.every(b => b.x >= DARMO_BBOX.x0 && b.x <= DARMO_BBOX.x1 && b.z >= DARMO_BBOX.z0 && b.z <= DARMO_BBOX.z1), 'semua dalam bbox Darmo');
const corners = (b) => { const c = Math.cos(b.a), s = Math.sin(b.a), hw = b.w / 2, hd = b.d / 2; return [[0, 0], [hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd]].map(([u, v]) => [b.x + u * c - v * s, b.z + u * s + v * c]); };
let onRoad = 0; for (const b of B) if (corners(b).some(([x, z]) => clearance(x, z) < 1.0)) onRoad++; ok(onRoad === 0, '0 bangunan di atas/menempel jalan (sudut + pusat clearance >= 1 m): ' + onRoad);
let inPk = 0; for (const b of B) if (dbInPark(b.x, b.z, 0)) inPk++; ok(inPk === 0, '0 bangunan di dalam taman: ' + inPk);
ok(dbInPark(-1100, 2600, 0) || DARMO_PARKS.length === 25, 'taman terbaca (' + DARMO_PARKS.length + ' poligon)');
let ov = 0; for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) { const a = B[i], b = B[j]; if (Math.hypot(a.x - b.x, a.z - b.z) < 0.5 * (Math.sqrt(a.w * a.d) / 2 + Math.sqrt(b.w * b.d) / 2)) ov++; } ok(ov === 0, 'pusat tidak saling menumpuk: ' + ov);
ok(B.every(b => b.floors >= 1 && b.floors <= 12 && b.h > 3), 'lantai 1..12'); const f = {}; B.forEach(b => f[b.floors] = (f[b.floors] || 0) + 1); log('sebaran lantai:', JSON.stringify(f));
ok(B.filter(b => b.floors === 1).length > B.length * 0.25, 'sekitar sepertiga+ bangunan 1 lantai');
ok(B.some(b => b.k === 3) && B.some(b => b.k === 2) && B.some(b => b.k === 1), 'ada masjid/RS/sekolah dari OSM');
const again = mk('High'); ok(again.B.length === B.length && again.B.every((b, i) => b.x === B[i].x && b.z === B[i].z), 'deterministik');
const ex = mk('High', { exclude: (x) => x > -1100 }); ok(ex.B.length < B.length && ex.B.every(b => b.x <= -1090), 'exclude() dihormati');
ok(B.every(b => b.z > 2200), 'tidak menyentuh koridor (z > 2200)');
ok(H.dt < 3000, 'waktu plan High < 3 dtk (' + H.dt.toFixed(0) + ' ms)');
process.exit(fails ? 1 : 0);
