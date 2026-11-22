// Paving (iter 75): jalur paving block ANTAR RUMAH supaya tidak "rumput melulu". Jalan kota (aspal + trotoar, roads.js) TIDAK diubah.
// Tiga jenis jalur (semua = "strip": garis tengah A->B + lebar), tekstur herringbone assets/tex/paving.jpg (buatan sendiri, tools/gen_paving.py, tanpa kredit):
//  - 'front': dari pintu rumah lurus ke jalan terdekat (maks 32 m), berhenti di bawah trotoar. Dilewati kalau terhalang rumah lain.
//  - 'pad'  : halaman paving di depan tiap bangunan (lebar ~95% mukanya, maks 14 m, dalam 2,1-4,2 m).
//  - 'lane' : lorong antar dua bangunan bertetangga (sumbu X atau Z) di celah di antara dinding keduanya, lebar 4 m (90% celah dipaving).
// Semua bangunan (rumah, ruko, gedung); pintu rumah kampung = modul b.doorI, lainnya di tengah. planPaving() murni (tanpa three) -> dites node (tools/tests/paving.test.mjs).
// near(x,z,m) dipakai rumput.js supaya rumput tidak tumbuh di atas paving. ?paving=0 mematikan (main.js).
import * as THREE from 'three';

const PV_FAR = { Low: 520, High: 760, Ultra: 1000 }, PV_CHUNK = 200, PV_Y = 0.045, PV_TILE = 3.2, PV_MOD = 4.2, PV_LANE = 4.0, PV_FRONT = 3.2;   // PV_MOD = KR_CELL (buildings.js): lebar modul rumah kampung -> posisi pintu. PV_TILE = ukuran 1 gambar tekstur (m)
const pvHash = (a, b, s) => { let h = (Math.floor(a * 7.13) * 374761393 + Math.floor(b * 5.71) * 668265263 + s * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const pvKey = (i, j) => i * 73856093 ^ j * 19349663;

// houses: semua bangunan b {x,z,w,d,floors,face,nx?,doorI?,v?} dari planCity(); o: {roads:{clearance}, collider:{hit}, height(x,z), cell}
export function planPaving(houses, o) {
  const { roads, collider, height } = o, cell = o.cell || 20, strips = [], hs = houses.filter(b => b.face !== undefined);
  const free = (x, z, r) => !collider.hit(x, z, r) && roads.clearance(x, z) > 0.6 && height(x, z) > 0.25;
  const add = (ax, az, bx, bz, w, kind, own) => strips.push({ ax, az, bx, bz, w, kind, own });
  const G = cell * 2, grid = new Map();
  hs.forEach((b, i) => { const k = pvKey(Math.floor(b.x / G), Math.floor(b.z / G)); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(i); });
  // 1) jalur depan + halaman
  for (const b of hs) {
    const fx = Math.round(Math.sin(b.face)), fz = Math.round(Math.cos(b.face)), lx = -fz, lz = fx;   // depan (fx,fz), lateral (lx,lz) = arah +x lokal model
    const hf = fx ? b.w / 2 : b.d / 2, hl = fx ? b.d / 2 : b.w / 2, variant = b.v !== undefined, inset = variant ? 0.8 : 0;
    const off = variant || b.doorI === undefined ? 0 : (b.doorI - (b.nx - 1) / 2) * PV_MOD, dx0 = b.x + lx * off + fx * (hf - inset), dz0 = b.z + lz * off + fz * (hf - inset);
    const corr = (px, pz) => [-1.5, 0, 1.5].every(l => !collider.hit(px + lx * l, pz + lz * l, 0.25));
    for (let t = inset + 0.6; t <= 32; t += 1) {
      const px = dx0 + fx * t, pz = dz0 + fz * t;
      if (roads.clearance(px, pz) <= 2.0) { if ([-1.6, 1.6].every(l => roads.clearance(px + lx * l, pz + lz * l) > 0.45)) add(dx0, dz0, px, pz, PV_FRONT, 'front', b); break; }   // 2,0 m: tepi trotoar, tepi lateral (+-1,6 m) tidak menyentuh aspal
      if (height(px, pz) < 0.25 || !corr(px, pz)) break;
    }
    const lat = Math.min(hl * 0.95, 7), cx = b.x + fx * (hf - inset), cz = b.z + fz * (hf - inset);
    let dep = 4.2;
    for (; dep >= 2.1; dep -= 0.7) { const mx = cx + fx * dep, mz = cz + fz * dep; if ([-lat, -lat / 2, 0, lat / 2, lat].every(l => free(mx + lx * l, mz + lz * l, 0.25))) break; }
    if (dep >= 2.1) add(cx + fx * dep / 2 - lx * lat, cz + fz * dep / 2 - lz * lat, cx + fx * dep / 2 + lx * lat, cz + fz * dep / 2 + lz * lat, dep, 'pad', b);
  }
  // 2) lorong antar rumah bertetangga
  const laneOk = (ax, az, bx, bz, w) => {   // bx,bz sejajar sumbu; titik uji tiap 1,2 m di 3 garis (tengah, +-w/2-0.2), menjauhi dinding 0,4 m
    const L = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / L, tz = (bz - az) / L, nx = -tz, nz = tx, hw = w / 2 - 0.2;
    for (let t = 0.4; t <= L - 0.4 + 1e-6; t += 1.2) for (const l of [-hw, 0, hw]) { const x = ax + tx * t + nx * l, z = az + tz * t + nz * l; if (!free(x, z, 0.25)) return false; }
    return true;
  };
  hs.forEach((A, ia) => {
    const gi = Math.floor(A.x / G), gj = Math.floor(A.z / G);
    for (let i = gi - 1; i <= gi + 1; i++) for (let j = gj - 1; j <= gj + 1; j++) { const l = grid.get(pvKey(i, j)); if (!l) continue;
      for (const ib of l) { if (ib <= ia) continue; const B = hs[ib], dx = B.x - A.x, dz = B.z - A.z; if (Math.abs(dx) > cell * 1.8 || Math.abs(dz) > cell * 1.8) continue;
        if (pvHash(A.x, B.z, 11) > 0.9) continue;
        if (Math.abs(dx) >= Math.abs(dz)) {   // lorong sumbu X
          const P = dx > 0 ? A : B, Q = dx > 0 ? B : A, x0 = P.x + P.w / 2, x1 = Q.x - Q.w / 2, z0 = Math.max(P.z - P.d / 2, Q.z - Q.d / 2), z1 = Math.min(P.z + P.d / 2, Q.z + Q.d / 2), z = (z0 + z1) / 2;
          if (x1 - x0 >= 1.6 && x1 - x0 <= 18 && z1 - z0 >= PV_LANE + 0.2 && laneOk(x0, z, x1, z, PV_LANE)) add(x0, z, x1, z, PV_LANE, 'lane');
        } else {                              // lorong sumbu Z
          const P = dz > 0 ? A : B, Q = dz > 0 ? B : A, z0 = P.z + P.d / 2, z1 = Q.z - Q.d / 2, x0 = Math.max(P.x - P.w / 2, Q.x - Q.w / 2), x1 = Math.min(P.x + P.w / 2, Q.x + Q.w / 2), x = (x0 + x1) / 2;
          if (z1 - z0 >= 1.6 && z1 - z0 <= 18 && x1 - x0 >= PV_LANE + 0.2 && laneOk(x, z0, x, z1, PV_LANE)) add(x, z0, x, z1, PV_LANE, 'lane');
        }
      } }
  });
  return { strips, houses: hs.length };
}

// Indeks ruang (sel 12 m) untuk near(x,z,m): true kalau titik berada < m dari tepi salah satu jalur. Murni (tanpa three).
export function pavingIndex(strips) {
  const SC = 12, pg = new Map();
  for (const s of strips) { const m = s.w / 2 + 3, i0 = Math.floor((Math.min(s.ax, s.bx) - m) / SC), i1 = Math.floor((Math.max(s.ax, s.bx) + m) / SC), j0 = Math.floor((Math.min(s.az, s.bz) - m) / SC), j1 = Math.floor((Math.max(s.az, s.bz) + m) / SC);   // m <= 3 untuk query
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = pvKey(i, j); let l = pg.get(k); if (!l) pg.set(k, l = []); l.push(s); } }
  return function near(x, z, m) {
    const l = pg.get(pvKey(Math.floor(x / SC), Math.floor(z / SC))); if (!l) return false;
    for (const s of l) { const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2));
      if (Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t)) < s.w / 2 + m) return true; }
    return false;
  };
}

// o: {quality, height, roads, collider, houses, cell}
export function createPaving(scene, o) {
  const plan = planPaving(o.houses, o), strips = plan.strips, group = new THREE.Group(); scene.add(group);
  const hy = (x, z) => Math.max(0, o.height(x, z)) + PV_Y;
  const near = pavingIndex(strips);
  // mesh per chunk 200 m (culling kamera + jarak gambar)
  const cks = new Map(); let tris = 0;
  for (const s of strips) {
    const dx = s.bx - s.ax, dz = s.bz - s.az, len = Math.hypot(dx, dz); if (len < 0.2) continue;
    const ck = Math.floor((s.ax + s.bx) / 2 / PV_CHUNK) + ',' + Math.floor((s.az + s.bz) / 2 / PV_CHUNK); let c = cks.get(ck); if (!c) cks.set(ck, c = { P: [], U: [], I: [], sx: 0, sz: 0, n: 0 });
    const tx = dx / len, tz = dz / len, nx = -tz * s.w / 2, nz = tx * s.w / 2, n = Math.max(1, Math.ceil(len / 8)), rows = [];
    for (let i = 0; i <= n; i++) { const px = s.ax + dx * i / n, pz = s.az + dz * i / n, lx = px + nx, lz = pz + nz, rx = px - nx, rz = pz - nz; rows.push([lx, hy(lx, lz), lz, rx, hy(rx, rz), rz]); }
    for (let i = 0; i < n; i++) {
      const a = rows[i], b = rows[i + 1]; if (Math.min(a[1], a[4], b[1], b[4]) < 0.2 + PV_Y) continue;   // tepi pantai/laut: potong
      const base = c.P.length / 3;
      for (const r of [a, b]) { c.P.push(r[0], r[1], r[2], r[3], r[4], r[5]); c.U.push(r[0] / PV_TILE, r[2] / PV_TILE, r[3] / PV_TILE, r[5] / PV_TILE); }
      c.I.push(base, base + 2, base + 1, base + 1, base + 2, base + 3); tris += 2;   // urutan simpul [L0,R0,L1,R1]; (L0,L1,R0) & (R0,L1,R1) = menghadap atas
    }
    c.sx += (s.ax + s.bx) / 2; c.sz += (s.az + s.bz) / 2; c.n++;
  }
  const mat = new THREE.MeshStandardMaterial({ color: 0x9a968f, roughness: 0.92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  mat.customProgramCacheKey = () => 'paving-iter75';
  mat.onBeforeCompile = (sh) => {   // variasi warna paving per kotak 45 m (abu / sebagian terakota) dari posisi dunia -> tidak berkedip di sambungan jalur
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPv;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvPv = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPv;\nfloat pvh_(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 pc_ = floor(vPv.xz / 45.0);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(1.30, 0.82, 0.70), step(0.7, pvh_(pc_))) * (0.9 + 0.2 * pvh_(pc_ + 3.7));`);
  };
  const url = (typeof window !== 'undefined' && window.__TEX && window.__TEX.paving) || 'assets/tex/paving.jpg';
  new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; mat.map = t; mat.color.set(0xffffff); mat.needsUpdate = true; console.log('[paving] tekstur paving dimuat'); }, undefined, () => console.log('[paving] tekstur gagal, abu polos'));
  const chunks = [];
  for (const c of cks.values()) {
    if (!c.I.length) continue;
    const g = new THREE.BufferGeometry(), nv = c.P.length / 3, nrm = new Float32Array(nv * 3); for (let i = 0; i < nv; i++) nrm[i * 3 + 1] = 1;
    g.setAttribute('position', new THREE.Float32BufferAttribute(c.P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(c.U, 2));
    g.setIndex(new THREE.BufferAttribute(nv > 65535 ? new Uint32Array(c.I) : new Uint16Array(c.I), 1)); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = false; group.add(m); chunks.push({ m, cx: c.sx / c.n, cz: c.sz / c.n });
  }
  const far = (PV_FAR[o.quality] || PV_FAR.High) + PV_CHUNK * 0.75, kinds = { front: 0, pad: 0, lane: 0 }; for (const s of strips) kinds[s.kind]++;
  console.log(`[paving] ${o.quality}: ${plan.houses} bangunan -> ${strips.length} jalur (depan ${kinds.front}, halaman ${kinds.pad}, lorong ${kinds.lane}), ${tris} segitiga, ${chunks.length} chunk`);
  return { group, near, count: strips.length, strips, tris,
    update(px, pz) { for (const c of chunks) { const on = Math.hypot(c.cx - px, c.cz - pz) < far; if (c.m.visible !== on) c.m.visible = on; } },
    dispose() { scene.remove(group); chunks.forEach(c => c.m.geometry.dispose()); mat.dispose(); if (mat.map) mat.map.dispose(); } };
}
