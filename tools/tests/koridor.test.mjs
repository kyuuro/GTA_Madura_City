// Tes jalan KORIDOR (iter 87), tanpa three.js asli. Jalankan seperti darmo.test.mjs (salin src/, three_stub.js -> node_modules/three/index.js): node koridor.test.mjs
import * as THREE from 'three';
globalThis.window = globalThis; globalThis.location = { search: '' };
const log = console.log; let fails = 0; const ok = (c, m) => { if (!c) { fails++; log('GAGAL:', m); } else log('ok:', m); }; console.log = () => {};
const { ROADS } = await import('./src/roaddata.js'), { DARMO_ROADS } = await import('./src/darmo_data.js'), { KORIDOR_ROADS, KOR_A, KOR_B } = await import('./src/koridor_data.js');
const { terrainHeight } = await import('./src/world.js'), { trFindJunctions } = await import('./src/traffic.js');
console.log = log;
const N = KORIDOR_ROADS.length, OLD = ROADS.length - DARMO_ROADS.length - N;
ok(ROADS.slice(-N).every((r, i) => r === KORIDOR_ROADS[i]), 'koridor ada PALING AKHIR di ROADS (' + N + ' jalan); jalan lama ' + OLD + ' + Darmo tak bergeser');
ok(KORIDOR_ROADS.every(r => r.zone === 'koridor' && r.pts.length >= 2 && [7, 12, 16, 18].includes(r.width)), 'zone & lebar valid');
const D = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), ang = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI, dAng = (x, y) => Math.abs(((x - y + 540) % 360) - 180);
const dens = (pts, st = 4) => { const o = []; for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1], k = Math.max(1, Math.ceil(D(a, b) / st)); for (let j = 0; j < k; j++) o.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]); } o.push(pts.at(-1)); return o; };
// darat
let wet = 0, n = 0; for (const r of KORIDOR_ROADS) for (const p of dens(r.pts, 10)) { n++; if (terrainHeight(p[0], p[1]) < 0.25) wet++; }
ok(wet === 0, n + ' sampel jalan koridor semua di darat (tinggi >= 0,25); basah: ' + wet);
// sambungan persis
const rd = (name) => ROADS.find(r => r.name === name), find = (list, name, w) => list.find(r => r.name === name && (!w || r.width === w));
const oldDarmo = ROADS[2]; ok(oldDarmo.name === 'Jl. Raya Darmo', 'jalan lama indeks 2 = Jl. Raya Darmo');
ok(D(KOR_A[0], oldDarmo.pts.at(-1)) < 0.5, 'A mulai persis di ujung Jl. Raya Darmo lama'); ok(dAng(ang(KOR_A[0], KOR_A[1]), ang(...oldDarmo.pts.slice(-2))) < 12, 'arah A di sambungan lama: selisih ' + dAng(ang(KOR_A[0], KOR_A[1]), ang(...oldDarmo.pts.slice(-2))).toFixed(1) + ' derajat (< 12)');
const joint = (kor, osmName, osmEndIdx) => { const o = DARMO_ROADS.find(r => r.name === osmName && r.pts.some(p => D(p, kor.pts.at(-1)) < 0.5)); return o; };
const oRaya = DARMO_ROADS.find(r => r.name === 'Jalan Raya Darmo' && D(r.pts.at(-1), KOR_A.at(-1)) < 0.5);
ok(!!oRaya, 'A berakhir persis di ujung utara Jalan Raya Darmo OSM'); if (oRaya) { const dir = ang(oRaya.pts.at(-1), oRaya.pts.at(-2)), dk = ang(...KOR_A.slice(-2)); ok(dAng(dir, dk) < 12, 'arah A tiba selaras OSM: selisih ' + dAng(dir, dk).toFixed(1) + ' derajat'); }
const oDip = DARMO_ROADS.find(r => r.name === 'Jalan Raya Diponegoro' && D(r.pts.at(-1), KOR_B.at(-1)) < 0.5);
ok(!!oDip, 'B berakhir persis di ujung utara Jalan Raya Diponegoro OSM'); if (oDip) { const dir = ang(oDip.pts.at(-1), oDip.pts.at(-2)), dk = ang(...KOR_B.slice(-2)); ok(dAng(dir, dk) < 15, 'arah B tiba selaras OSM: selisih ' + dAng(dir, dk).toFixed(1) + ' derajat'); }
const c4 = find(KORIDOR_ROADS, 'Jl. Ngagel Lanjutan'), oNg = DARMO_ROADS.find(r => r.name === 'Jalan Ngagel' && D(r.pts.at(-1), c4.pts[0]) < 0.5);
ok(!!oNg, 'Ngagel Lanjutan mulai persis di ujung utara Jalan Ngagel OSM'); if (oNg) { const dir = ang(oNg.pts.at(-2), oNg.pts.at(-1)), dk = ang(c4.pts[0], c4.pts[1]); ok(dAng(dir, dk) < 15, 'arah Ngagel menerus: selisih ' + dAng(dir, dk).toFixed(1) + ' derajat'); }
ok(oRaya && oDip && oNg && KOR_A[0][1] < KOR_A.at(-1)[1], 'lebar di sambungan sama dgn OSM: A ' + KORIDOR_ROADS[0].width + '/' + (oRaya && oRaya.width) + ', B ' + KORIDOR_ROADS[1].width + '/' + (oDip && oDip.width) + ', Ngagel ' + c4.width + '/' + (oNg && oNg.width));
ok(oRaya && oDip && oNg && KORIDOR_ROADS[0].width === oRaya.width && KORIDOR_ROADS[1].width === oDip.width && c4.width === oNg.width, 'lebar sama dgn jalan OSM yang disambung');
// belok tajam di titik kontrol
for (const r of [KORIDOR_ROADS[0], KORIDOR_ROADS[1], c4]) { let mx = 0; for (let i = 1; i + 1 < r.pts.length; i++) mx = Math.max(mx, dAng(ang(r.pts[i - 1], r.pts[i]), ang(r.pts[i], r.pts[i + 1]))); ok(mx <= 26, r.name + ': belok maks ' + mx.toFixed(1) + ' derajat (<= 26)'); }
// konektivitas graf jalan (dua jalan tersambung kalau polyline rapat < 3 unit): jalan lama Raya Darmo -> Jalan Raya Darmo OSM
const polys = ROADS.map(r => dens(r.pts, 6)), H = 12, grid = new Map(), key = (a, b) => a + ',' + b;
polys.forEach((P, ri) => { for (const p of P) { const k = key(Math.floor(p[0] / H), Math.floor(p[1] / H)); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push([p[0], p[1], ri]); } });
const adj = ROADS.map(() => new Set());
polys.forEach((P, ri) => { for (const p of P) { const ix = Math.floor(p[0] / H), iz = Math.floor(p[1] / H); for (let a = ix - 1; a <= ix + 1; a++) for (let b = iz - 1; b <= iz + 1; b++) for (const q of grid.get(key(a, b)) || []) if (q[2] !== ri && Math.hypot(p[0] - q[0], p[1] - q[1]) < 3) adj[ri].add(q[2]); } });
const bfs = (s, skipKor) => { const seen = new Set([s]), q = [s]; while (q.length) { const u = q.shift(); for (const v of adj[u]) if (!seen.has(v) && !(skipKor && v >= ROADS.length - N)) { seen.add(v); q.push(v); } } return seen; };
const iOsm = OLD + DARMO_ROADS.indexOf(oRaya), iOsmDip = OLD + DARMO_ROADS.indexOf(oDip), iNg = OLD + DARMO_ROADS.indexOf(oNg);
ok(!bfs(2, true).has(iOsm), 'TANPA koridor: Jl. Raya Darmo lama TIDAK tersambung ke Jalan Raya Darmo OSM (celah nyata)');
const R = bfs(2, false); ok(R.has(iOsm), 'DENGAN koridor: Jl. Raya Darmo lama -> Jalan Raya Darmo OSM tersambung'); ok(R.has(iOsmDip) && R.has(iNg), 'Diponegoro OSM dan Ngagel OSM juga tersambung dari kota lama');
ok(KORIDOR_ROADS.every((r, i) => R.has(ROADS.length - N + i)), 'semua ' + N + ' jalan koridor tersambung ke jaringan kota lama');
// persimpangan & lampu
const lines = ROADS.map(r => ({ hw: r.width / 2, zone: r.zone, name: r.name, pts: dens(r.pts).map(p => ({ x: p[0], z: p[1] })) }));
const t0 = performance.now(); const J = trFindJunctions(lines), dt = performance.now() - t0; const first = ROADS.length - N;
const kj = J.filter(j => { const [a, b] = j.name.split('x').map(Number); return a >= first || b >= first; });
ok(kj.length >= 6 && kj.length <= 14, 'persimpangan berlampu koridor ' + kj.length + ' (target 6..14): ' + kj.map(j => Math.round(j.x) + ',' + Math.round(j.z)).join(' | '));
const base = trFindJunctions(lines.slice(0, first)).length; ok(J.length - kj.length === base, 'persimpangan jalan lama + Darmo tak berubah (' + base + ')'); ok(dt < 2000, 'trFindJunctions ' + dt.toFixed(0) + ' ms (< 2000)');
// A dan B tidak menumpuk: jarak terdekat > 150 unit, kecuali 300 unit pertama dari sambungan (z < 1300)
let mnAB = 1e9; for (const p of polys[first]) { if (p[1] < 1300) continue; for (const q of polys[first + 1]) mnAB = Math.min(mnAB, Math.hypot(p[0] - q[0], p[1] - q[1])); } ok(mnAB > 150, 'jarak terdekat A-B (z>=1300) ' + mnAB.toFixed(0) + ' unit (> 150)');
// tidak ada lampu merah palsu di sambungan lurus koridor-OSM
ok(!kj.some(j => Math.hypot(j.x + 1071.5, j.z - 2349.9) < 20), 'tidak ada lampu merah di sambungan lurus A-OSM (-1071,2350)');
const L = r => dens(r.pts).reduce((s, p, i, a) => i ? s + D(p, a[i - 1]) : 0, 0); log('panjang: A ' + L(KORIDOR_ROADS[0]).toFixed(0) + ' | B ' + L(KORIDOR_ROADS[1]).toFixed(0) + ' | total koridor ' + KORIDOR_ROADS.reduce((s, r) => s + L(r), 0).toFixed(0) + ' unit');
process.exit(fails ? 1 : 0);
