// Tes logika paving (iter 75) dengan tata letak kota ASLI (planCity + ROADS), tanpa three.js.
// Jalankan: salin src/ dan tools/tests/three_stub.js ke folder kerja (node_modules/three/index.js + package.json {type:module}), lalu node paving.test.mjs [dump.json]
import * as THREE from 'three';
globalThis.window = globalThis; globalThis.location = { search: '' };
const log = console.log; let fails = 0; const ok = (c, m) => { if (!c) { fails++; log('GAGAL:', m); } else log('ok:', m); }; console.log = () => {};
const { planCity } = await import('./src/buildings.js'), { planPaving, pavingIndex } = await import('./src/paving.js'), { ROADS } = await import('./src/roaddata.js');
const { terrainHeight } = await import('./src/world.js'), { createCollider } = await import('./src/collide.js'), { inZone } = await import('./src/districts.js');
console.log = log;
// clearance dari polyline kontrol ROADS (aproksimasi spline) - sama semantiknya: jarak ke tepi jalan (negatif = di atas jalan)
const segs = []; ROADS.forEach(r => { for (let i = 0; i + 1 < r.pts.length; i++) segs.push([r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1], r.width / 2]); });
const clearance = (x, z) => { let m = 1e9; for (const s of segs) { const dx = s[2] - s[0], dz = s[3] - s[1], L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / L2)); const d = Math.hypot(x - s[0] - dx * t, z - s[1] - dz * t) - s[4]; if (d < m) m = d; } return m; };
const roads = { clearance };
const out = {}; const dump = process.argv[2];
for (const q of ['Low', 'High', 'Ultra']) {
  const collider = createCollider(), t0 = Date.now(), { B, cell } = planCity({ quality: q, height: terrainHeight, roads, collider, exclude: inZone }), t1 = Date.now();
  const plan = planPaving(B, { roads, collider, height: terrainHeight, cell }), t2 = Date.now(), S = plan.strips;
  const kinds = { front: 0, pad: 0, lane: 0 }; S.forEach(s => kinds[s.kind]++);
  log(`[${q}] ${B.length} bangunan, ${plan.houses} bangunan -> ${S.length} jalur (depan ${kinds.front}, halaman ${kinds.pad}, lorong ${kinds.lane}); planCity ${t1 - t0} ms, planPaving ${t2 - t1} ms`);
  ok(kinds.front > 0 && kinds.pad > 0 && kinds.lane > 0, `${q}: ketiga jenis jalur ada`);
  ok(plan.houses === 0 || kinds.pad / plan.houses > 0.5, `${q}: >50% bangunan punya halaman (${(100 * kinds.pad / plan.houses).toFixed(0)}%)`);
  // 1) tidak ada jalur yang menimpa bangunan lain (kotak sejajar sumbu); bangunan pemilik boleh tumpang <= 0,8 m (inset varian Sketchfab)
  let overlap = 0, onRoad = 0, tooLong = 0, frontEnd = 0, frontBad = 0;
  for (const s of S) {
    const hx = s.ax === s.bx ? s.w / 2 : 0, hz = s.az === s.bz ? s.w / 2 : 0, x0 = Math.min(s.ax, s.bx) - hx, x1 = Math.max(s.ax, s.bx) + hx, z0 = Math.min(s.az, s.bz) - hz, z1 = Math.max(s.az, s.bz) + hz;
    for (const b of B) { if (b === s.own) continue; if (b.x - b.w / 2 < x1 - 0.05 && b.x + b.w / 2 > x0 + 0.05 && b.z - b.d / 2 < z1 - 0.05 && b.z + b.d / 2 > z0 + 0.05) { overlap++; break; } }
    const L = Math.hypot(s.bx - s.ax, s.bz - s.az); if (L > 33) tooLong++;
    // 2) tidak menyentuh aspal: titik tengah + dua tepi tiap 1 m (ujung 'front' = jalan, dilewati 0,1 m terakhir)
    const tx = (s.bx - s.ax) / (L || 1), tz = (s.bz - s.az) / (L || 1);
    let bad = false; for (let t = 0; t <= L + 1e-6; t += 1) for (const l of [-s.w / 2, 0, s.w / 2]) { const x = s.ax + tx * t - tz * l, z = s.az + tz * t + tx * l; if (clearance(x, z) < 0.45) bad = true; }
    if (bad) onRoad++;
    if (s.kind === 'front') { frontEnd++; const e = clearance(s.bx, s.bz); if (e > 2.1 || e < 0.45) frontBad++; }
  }
  ok(overlap === 0, `${q}: 0 jalur menimpa bangunan lain (${overlap})`);
  ok(onRoad === 0, `${q}: 0 jalur menyentuh aspal (${onRoad})`);
  ok(tooLong === 0, `${q}: jalur depan <= 32 m`);
  ok(frontBad === 0, `${q}: semua jalur depan berujung di tepi jalan (clearance 0,45-2,1) (${frontBad}/${frontEnd} salah)`);
  // 3) near(): titik tengah jalur true; titik 6 m dari semua jalur false
  const near = pavingIndex(S); let miss = 0; for (const s of S) if (!near((s.ax + s.bx) / 2, (s.az + s.bz) / 2, 0.1)) miss++;
  ok(miss === 0, `${q}: near() true di tengah tiap jalur`);
  ok(!near(-5000, -5000, 3) && near(S[0].ax, S[0].az, 0.1), `${q}: near() false jauh dari jalur`);
  // 4) ukuran mesh: ~ segitiga
  let tris = 0; for (const s of S) tris += 2 * Math.max(1, Math.ceil(Math.hypot(s.bx - s.ax, s.bz - s.az) / 8)); log(`[${q}] perkiraan segitiga paving: ${tris}`);
  ok(tris < (q === 'Ultra' ? 300000 : 200000), `${q}: segitiga ${tris} masuk batas`);
  out[q] = { B: B.map(b => [b.x, b.z, b.w, b.d, b.floors, b.face ?? -1]), S: S.map(s => [s.ax, s.az, s.bx, s.bz, s.w, s.kind]) };
}
if (dump) { (await import('node:fs')).writeFileSync(dump, JSON.stringify({ roads: ROADS.map(r => ({ w: r.width, pts: r.pts })), ...out })); log('dump ->', dump); }
log(fails ? fails + ' GAGAL' : 'SEMUA TES LULUS'); process.exit(fails ? 1 : 0);
