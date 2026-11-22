// Tes penempatan rumah koridor (iter 88) + penjadwal lazy. Lingkungan: sama dgn darmo.test.mjs (src/ + node_modules/three = three_stub.js).
import * as THREE from 'three';
globalThis.window = globalThis; globalThis.location = { search: '' };
const log = console.log; let fails = 0; const ok = (c, m) => { if (!c) { fails++; log('GAGAL:', m); } else log('ok:', m); }; console.log = () => {};
const { ROADS } = await import('./src/roaddata.js'), { terrainHeight } = await import('./src/world.js'), { planKoridor } = await import('./src/koridor.js'), { createLazy } = await import('./src/lazy.js'), { DARMO_BBOX } = await import('./src/darmo_data.js');
console.log = log;
// clearance palsu: jarak ke polyline jalan terdekat - setengah lebar (hanya jalan yang bisa dekat; grid sel 40 supaya cepat)
const segs = []; for (const r of ROADS) for (let i = 0; i + 1 < r.pts.length; i++) segs.push([r.pts[i], r.pts[i + 1], r.width / 2]);
const G = 60, grid = new Map(), key = (a, b) => a + ',' + b;
segs.forEach((s, i) => { const x0 = Math.min(s[0][0], s[1][0]) - 80, x1 = Math.max(s[0][0], s[1][0]) + 80, z0 = Math.min(s[0][1], s[1][1]) - 80, z1 = Math.max(s[0][1], s[1][1]) + 80; for (let a = Math.floor(x0 / G); a <= Math.floor(x1 / G); a++) for (let b = Math.floor(z0 / G); b <= Math.floor(z1 / G); b++) { const k = key(a, b); (grid.get(k) || grid.set(k, []).get(k)).push(i); } });
const dSeg = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
const clearance = (x, z) => { let m = 1e9; for (const i of grid.get(key(Math.floor(x / G), Math.floor(z / G))) || []) { const s = segs[i], d = dSeg(x, z, s[0], s[1]) - s[2]; if (d < m) m = d; } return m; };
const mk = (q) => { const hits = []; const t0 = performance.now(); const r = planKoridor({ quality: q, height: terrainHeight, roads: { clearance }, collider: { add: (...a) => hits.push(a) } }); return { ...r, hits, dt: performance.now() - t0 }; };
const res = {}; for (const q of ['Low', 'High', 'Ultra']) { res[q] = mk(q); ok(res[q].B.length > 20 && res[q].B.length < 4000, q + ': ' + res[q].B.length + ' rumah (' + res[q].dt.toFixed(0) + ' ms)'); }
ok(res.Low.B.length < res.High.B.length && res.High.B.length < res.Ultra.B.length, 'jumlah naik dgn kualitas');
const H = res.High, B = H.B;
ok(H.hits.length === B.length, 'tiap rumah punya collider (' + H.hits.length + ')');
ok(B.every(b => b.gy >= 0.25), 'tidak ada rumah di air');
ok(B.every(b => clearance(b.x, b.z) >= Math.hypot(b.w, b.d) / 2 + 1.5), '0 rumah di atas/menempel jalan (clearance >= setengah diagonal + 1,5)');
ok(B.every(b => b.x >= -1960 && b.x <= -370 && b.z >= 895 && b.z <= 2250), 'semua dalam kotak koridor');
ok(B.every(b => b.z + b.d / 2 < DARMO_BBOX.z0), 'tidak ada rumah masuk bbox Darmo (z < ' + DARMO_BBOX.z0 + ')');
let ov = 0; for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) { const a = B[i], b = B[j]; if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2) ov++; } ok(ov === 0, 'tidak ada rumah saling tumpang tindih; tumpang: ' + ov);
ok(B.every(b => b.floors >= 1 && b.floors <= 4), 'lantai 1..4'); const f = [0, 0, 0, 0, 0]; B.forEach(b => f[b.floors]++); log('sebaran lantai 1..4:', f.slice(1).join('/'));
ok(f[1] > f[3] + f[4] && f[3] + f[4] > 0, 'mayoritas rumah 1 lantai, tetap ada ruko 3-4 lantai');
ok(B.every(b => clearance(b.x, b.z) <= 78), 'semua rumah di tepi jalan (<= 78 m dari jalan)');
const again = mk('High'); ok(again.B.length === B.length && again.B.every((b, i) => b.x === B[i].x && b.z === B[i].z), 'deterministik (seed tetap)');
const ex = planKoridor({ quality: 'High', height: terrainHeight, roads: { clearance }, exclude: (x, z) => x > -1000 }); ok(ex.B.length < B.length && ex.B.every(b => b.x <= -1000), 'exclude() dihormati');
// koridor tidak menyentuh zona kota lama (z < 890)
ok(B.every(b => b.z > 890), 'tidak menumpuk kota lama (z > 890)');
// ---- lazy
let t = 0; const lz = createLazy(() => t), built = []; const mkR = (id, x) => ({ id, x, z: 0, r: 100, build: () => { built.push(id); t += 3; } });
['a', 'b', 'c', 'd'].forEach((id, i) => lz.add(mkR(id, i * 40)));   // x = 0,40,80,120
ok(lz.tick(1000, 0) === 0 && lz.stats().built === 0, 'jauh: tidak ada yang dibangun');
ok(lz.tick(0, 0, 5) === 2 && built.join() === 'a,b', 'terdekat dulu + jatah 5 ms (tiap bangun 3 ms): 2 region (' + built + ')');
ok(lz.tick(0, 0, 0) === 1 && built.join() === 'a,b,c', 'jatah 0 tetap membangun 1 (tidak macet)');
ok(lz.tick(0, 0, 100) === 0, 'd di x=120 > r=100: belum jatuh tempo'); ok(lz.flush(60, 0) === 1 && built.at(-1) === 'd', 'flush membangun sinkron yang jatuh tempo');
ok(lz.flush(60, 0) === 0 && lz.stats().pending === 0, 'tidak pernah membangun dua kali; pending 0');
const lz2 = createLazy(() => 0); lz2.add({ id: 'x', x: 0, z: 0, r: 10, build() { throw new Error('boom'); } }); lz2.add({ id: 'y', x: 1, z: 0, r: 10, build() {} }); ok(lz2.flush(0, 0) === 2 && lz2.stats().built === 2, 'build yang melempar error tidak menjatuhkan penjadwal');
process.exit(fails ? 1 : 0);
