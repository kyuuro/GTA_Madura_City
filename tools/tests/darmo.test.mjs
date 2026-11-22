// Tes data & jalan Darmo (iter 86), tanpa three.js asli. Jalankan: salin src/ dan tools/tests/three_stub.js ke folder kerja
// (node_modules/three/index.js + package.json {type:module}), lalu: node darmo.test.mjs
import * as THREE from 'three';
globalThis.window = globalThis; globalThis.location = { search: '' };
const log = console.log; let fails = 0; const ok = (c, m) => { if (!c) { fails++; log('GAGAL:', m); } else log('ok:', m); }; console.log = () => {};
const { ROADS } = await import('./src/roaddata.js'), { DARMO_ROADS, DARMO_BBOX } = await import('./src/darmo_data.js');
const { terrainHeight } = await import('./src/world.js'), { trFindJunctions } = await import('./src/traffic.js');
console.log = log;
const { KORIDOR_ROADS } = await import('./src/koridor_data.js');   // iter 87: koridor ditambah SESUDAH Darmo
const OLD = ROADS.length - DARMO_ROADS.length - KORIDOR_ROADS.length; ok(OLD === 27, 'jalan lama 27 (indeks 0..26) + Darmo ' + DARMO_ROADS.length + ' + koridor ' + KORIDOR_ROADS.length);
ok(ROADS.slice(OLD, OLD + DARMO_ROADS.length).every((r, i) => r === DARMO_ROADS[i]), 'jalan Darmo di indeks OLD.. (indeks lama tidak berubah)');
let bad = 0, low = 0, n = 0; for (const r of DARMO_ROADS) for (const p of r.pts) { n++; if (p[0] < DARMO_BBOX.x0 || p[0] > DARMO_BBOX.x1 || p[1] < DARMO_BBOX.z0 || p[1] > DARMO_BBOX.z1) bad++; if (terrainHeight(p[0], p[1]) < 0.25) low++; }
ok(bad === 0, 'semua ' + n + ' titik di dalam bbox'); ok(low === 0, 'semua titik jalan di darat (tinggi >= 0,25); di air: ' + low);
ok(DARMO_ROADS.every(r => r.zone === 'darmo' && r.pts.length >= 2 && r.width >= 6 && r.width <= 22), 'zone & lebar valid');
// seluruh kotak Darmo + koridor: terrain darat
let wet = 0; for (let x = -2000; x <= -210; x += 20) for (let z = 500; z <= 3940; z += 20) if (terrainHeight(x, z) < 0.25) wet++;
ok(wet === 0, 'terrain patch selatan (x -2000..-210, z 500..3940) semua darat; basah: ' + wet);
// lingkup patch: sama dengan grid utama
const CXs = 2400 / 267, CZs = 4900 / 545; ok(Math.abs((-3100 + 400 * CZs) - (-3100 + 322.5 * CZs + 77.5 * CZs)) < 1e-6, 'tepi atas patch barat = awal patch selatan (z)'); ok(Math.abs((-3100 + 545 * CZs) - 1800) < 1e-6, 'grid z=1800 sejajar patch S2');
// persimpangan
const dens = pts => { const o = []; for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L / 4)); for (let j = 0; j < k; j++) o.push({ x: a[0] + (b[0] - a[0]) * j / k, z: a[1] + (b[1] - a[1]) * j / k }); } o.push({ x: pts.at(-1)[0], z: pts.at(-1)[1] }); return o; };
const lines = ROADS.slice(0, OLD + DARMO_ROADS.length).map(r => ({ hw: r.width / 2, zone: r.zone, name: r.name, pts: dens(r.pts) }));   // iter 87: tes persimpangan iter 86 hanya jalan lama + Darmo (koridor dites di koridor.test.mjs)
const t0 = performance.now(); const J = trFindJunctions(lines); const dt = performance.now() - t0;
const jd = J.filter(j => { const [a, b] = j.name.split('x').map(Number); return lines[a].zone === 'darmo' || lines[b].zone === 'darmo'; });
const base = trFindJunctions(lines.slice(0, OLD)).length; ok(J.length - jd.length === base, 'persimpangan jalan lama tak berubah (' + base + ')'); ok(jd.length >= 3 && jd.length <= 40, 'persimpangan Darmo ' + jd.length + ' (target 3..40)'); ok(dt < 1500, 'trFindJunctions ' + dt.toFixed(0) + ' ms');
log('jalan hw>=6 di Darmo:', lines.filter(l => l.zone === 'darmo' && l.hw >= 6).length, '| total jalan', lines.length);
process.exit(fails ? 1 : 0);
