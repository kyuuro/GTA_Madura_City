// Iterasi 89: BANGUNAN DARMO. Footprint asli OSM (src/darmo_bld_data.js, 444 bangunan, dipetakan 1:3, ukuran meter asli) + isian prosedural di sela-selanya.
// planDarmoBld = penempatan murni (tanpa three; dites tools/tests/darmo_bld.test.mjs) + collider EAGER. createDarmoBld = mesh per chunk 160 m, LAZY (src/lazy.js).
// Taman OSM (DARMO_PARKS) bebas bangunan. Mesh: InstancedMesh kotak (+ limas utk <= 2 lantai), jendela shader bersama koridor (korWinMat).
import * as THREE from 'three';
import { createLazy } from './lazy.js';
import { korWinMat } from './koridor.js';
import { DARMO_BBOX } from './darmo_data.js';
import { DARMO_BLD, DARMO_PARKS } from './darmo_bld_data.js';

const DB_CELL = { Low: 44, High: 30, Ultra: 22 };            // sel isian prosedural (kota lama 30/20/14, koridor 60/40/28)
const DB_CHUNK = 160, DB_DRAW = { Low: 600, High: 850, Ultra: 1000 };
const DB_OSM_PROB = { Low: 0.55, High: 0.85, Ultra: 1 };     // sebagian footprint OSM dilewati di Low (ringan untuk HP)
function dbRng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---- taman: poligon [x,z,...] -> uji titik di dalam (+ pad m dari tepi)
const dbParks = DARMO_PARKS.map(f => { const P = []; for (let i = 0; i < f.length; i += 2) P.push([f[i], f[i + 1]]); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return { P, x0, x1, z0, z1 }; });
function dbSegD(x, z, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); }
export function dbInPark(x, z, pad = 0) {
  for (const k of dbParks) {
    if (x < k.x0 - pad || x > k.x1 + pad || z < k.z0 - pad || z > k.z1 + pad) continue;
    let in_ = false; const P = k.P;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > z) !== (P[j][1] > z) && x < (P[j][0] - P[i][0]) * (z - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) in_ = !in_;
    if (in_) return true;
    if (pad > 0) for (let i = 0, j = P.length - 1; i < P.length; j = i++) if (dbSegD(x, z, P[j], P[i]) < pad) return true;
  }
  return false;
}

// o: {quality, height(x,z), roads:{clearance(x,z)}, collider?:{add}, exclude?(x,z,r)}. Mengembalikan {B, nOsm, cell}.
// B[i] = {x,z,w,d,a (sudut rad),gy,floors,h,k (jenis),c,rc,osm}
export function planDarmoBld(o) {
  const cell = DB_CELL[o.quality], R = dbRng(8902), B = [], G = new Map(), GS = 48;
  const gk = (x, z) => Math.floor(x / GS) + ',' + Math.floor(z / GS);
  const rq = (b) => Math.sqrt(b.w * b.d) / 2;                            // jari-jari setara
  const near = (x, z, r) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const b of G.get(Math.floor(x / GS) + i + ',' + (Math.floor(z / GS) + j)) || []) if (Math.hypot(b.x - x, b.z - z) < (rq(b) + r) * 0.95) return true; return false; };
  const corners = (b) => { const c = Math.cos(b.a), s = Math.sin(b.a), hw = b.w / 2, hd = b.d / 2; return [[0, 0], [hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd]].map(([u, v]) => [b.x + u * c - v * s, b.z + u * s + v * c]); };
  const push = (b) => {
    B.push(b); const k = gk(b.x, b.z); (G.get(k) || G.set(k, []).get(k)).push(b);
    if (o.collider) { const c = Math.abs(Math.cos(b.a)), s = Math.abs(Math.sin(b.a)); o.collider.add(b.x, b.z, (c * b.w + s * b.d) / 2 * 0.82, (s * b.w + c * b.d) / 2 * 0.82); }
  };
  const inBox = (x, z) => x >= DARMO_BBOX.x0 && x <= DARMO_BBOX.x1 && z >= DARMO_BBOX.z0 && z <= DARMO_BBOX.z1;
  // 1) footprint OSM (terbesar dulu; lolos hanya kalau tidak menempel jalan / taman / bangunan lain)
  let nOsm = 0;
  for (let i = 0; i < DARMO_BLD.length; i++) {
    const [x, z, w, d, a, lv, k] = DARMO_BLD[i], rr = R();
    if (!inBox(x, z) || (k === 0 && rr > DB_OSM_PROB[o.quality])) continue;
    const gy = o.height(x, z); if (gy < 0.25) continue;
    if (dbInPark(x, z, 1) || (o.exclude && o.exclude(x, z, Math.hypot(w, d) / 2))) continue;
    // posisi OSM dikompres 1:3 tapi ukuran tetap asli -> banyak yang menimpa jalan: coba skala 1 -> 0,5 dan geser (<= 18 m) sampai bebas jalan/air/taman/bangunan lain
    const b = { x, z, w, d, a, gy, k, osm: true, c: R(), rc: R(), floors: 1, h: 4 }; let fit = false;
    const clear = () => !dbInPark(b.x, b.z, 1) && corners(b).every(([cx, cz]) => o.roads.clearance(cx, cz) >= 1.2 && o.height(cx, cz) >= 0.25) && !near(b.x, b.z, rq(b) * 0.9);
    search: for (const sc of [1, 0.75, 0.55, 0.4]) for (const dist of [0, 6, 12, 18]) for (let q = 0; q < (dist ? 8 : 1); q++) {
      b.w = Math.max(4, w * sc); b.d = Math.max(4, d * sc); const t = q * Math.PI / 4; b.x = x + Math.cos(t) * dist; b.z = z + Math.sin(t) * dist; b.gy = o.height(b.x, b.z);
      if (b.gy >= 0.25 && inBox(b.x, b.z) && !(o.exclude && o.exclude(b.x, b.z, Math.hypot(b.w, b.d) / 2)) && clear()) { fit = true; break search; }
    }
    if (!fit) continue;
    b.floors = Math.max(1, Math.min(12, lv || ({ 1: 2, 2: 3, 4: 3, 6: 5 }[k] || (1 + Math.floor(R() * R() * 3)))));
    b.h = b.floors * 3.2 + 0.4 + (k === 3 ? 3 : 0); push(b); nOsm++;
  }
  // 2) isian prosedural di sela-sela (kota padat: tepi jalan, 15% petak kosong)
  for (let cx = DARMO_BBOX.x0; cx <= DARMO_BBOX.x1; cx += cell) for (let cz = DARMO_BBOX.z0; cz <= DARMO_BBOX.z1; cz += cell) {
    const x = cx + (R() - 0.5) * cell * 0.25, z = cz + (R() - 0.5) * cell * 0.25;
    const w = cell * (0.42 + R() * 0.3), d = cell * (0.42 + R() * 0.3), pick = R(), lim = 28 + R() * 34, fl = R() * R(), c = R(), rc = R();
    const gy = o.height(x, z), r = Math.hypot(w, d) / 2;
    if (gy < 0.25 || pick < 0.15 || !inBox(x, z)) continue;
    if (dbInPark(x, z, r + 2) || (o.exclude && o.exclude(x, z, r))) continue;
    const cl = o.roads.clearance(x, z); if (cl < r + 1.5 || cl > lim) continue;
    if (near(x, z, Math.sqrt(w * d) / 2)) continue;
    const floors = 1 + Math.floor(fl * (cl < r + 9 ? 5 : 2.2));
    push({ x, z, w, d, a: 0, gy, k: 0, osm: false, c, rc, floors, h: floors * 3.2 + 0.4 });
  }
  return { B, nOsm, cell };
}

export function createDarmoBld(scene, o) {
  const { B, nOsm, cell } = planDarmoBld(o), group = new THREE.Group(); scene.add(group);
  const mat = korWinMat(o.night);
  const bodyG = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), roofG = new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0);
  const chunks = new Map(), lazy = createLazy(), dmax = DB_DRAW[o.quality] + DB_CHUNK * 0.75; let nBuilt = 0;
  for (const b of B) { const kx = Math.floor(b.x / DB_CHUNK), kz = Math.floor(b.z / DB_CHUNK), k = kx + ',' + kz; let c = chunks.get(k); if (!c) chunks.set(k, c = { cx: (kx + 0.5) * DB_CHUNK, cz: (kz + 0.5) * DB_CHUNK, list: [], ms: [], on: true }); c.list.push(b); }
  const wall = (b) => { const u = b.c, k = b.k; if (k === 1) return C.setHSL(0.12, 0.35, 0.78); if (k === 2) return C.setHSL(0.55, 0.06, 0.88); if (k === 3) return C.setHSL(0.33, 0.12, 0.86); if (k === 4 || k === 6) return C.setHSL(0.58, 0.1 + u * 0.15, 0.6 + (u * 7 % 1) * 0.2); return C.setHSL(b.floors > 2 ? 0.08 + u * 0.12 : [0.1, 0.13, 0.55, 0.33, 0.06][Math.floor(u * 5)], 0.18 + u * 0.3, 0.62 + (u * 7 % 1) * 0.2); };
  const build = (c) => {
    const L = c.list, roofs = L.filter(b => b.floors <= 2 || b.k === 3);
    const body = new THREE.InstancedMesh(bodyG, mat, L.length); body.receiveShadow = true;
    L.forEach((b, i) => { Q.setFromAxisAngle(UP, -b.a); M.compose(P.set(b.x, b.gy - 0.05, b.z), Q, S.set(b.w, b.h, b.d)); body.setMatrixAt(i, M); body.setColorAt(i, wall(b)); });
    group.add(body); c.ms.push(body);
    if (roofs.length) {
      const roof = new THREE.InstancedMesh(roofG, mat, roofs.length); roof.receiveShadow = true;
      roofs.forEach((b, i) => { const rh = (b.k === 3 ? 3.2 : 1.4 + (b.rc * 5 % 1) * 1.2); Q.setFromAxisAngle(UP, -b.a); M.compose(P.set(b.x, b.gy - 0.05 + b.h, b.z), Q, S.set((b.w / 2 + 0.35) / 0.7071, rh, (b.d / 2 + 0.35) / 0.7071)); roof.setMatrixAt(i, M);
        roof.setColorAt(i, b.k === 3 ? C.setHSL(0.38, 0.45, 0.3) : C.setHSL(b.rc < 0.6 ? 0.04 : 0.58, b.rc < 0.6 ? 0.45 : 0.08, b.rc < 0.6 ? 0.34 : 0.45)); });
      group.add(roof); c.ms.push(roof);
    }
    nBuilt++; if (nBuilt <= 3) console.log(`[darmo_bld] chunk ${Math.round(c.cx)},${Math.round(c.cz)} dibangun: ${L.length} bangunan`);
  };
  for (const [k, c] of chunks) lazy.add({ id: k, x: c.cx, z: c.cz, r: dmax, build: () => build(c) });
  console.log(`[darmo_bld] ${o.quality}: ${B.length} bangunan (${nOsm} dari OSM), ${chunks.size} chunk (lazy, jarak ${dmax} m)`);
  function update(px, pz) {
    lazy.tick(px, pz, 4);
    for (const c of chunks.values()) { if (!c.ms.length) continue; const on = Math.hypot(c.cx - px, c.cz - pz) < dmax; if (on !== c.on) { c.on = on; c.ms.forEach(m => { m.visible = on; }); } }
  }
  return { group, count: B.length, nOsm, list: B, cell, update, flush: (x, z) => lazy.flush(x, z), stats: () => lazy.stats(),
    dispose() { scene.remove(group); group.children.forEach(m => m.dispose()); bodyG.dispose(); roofG.dispose(); mat.dispose(); } };
}
