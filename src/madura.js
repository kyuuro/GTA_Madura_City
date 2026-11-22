// Iterasi 53: Madura (sisi utara Suramadu, z < -1930). SENGAJA lebih terbelakang dari Surabaya:
// rumah 1 lantai & jarang, tanpa lampu jalan / lampu lalu lintas / marka, jalan sempit, malam gelap (tanpa jendela menyala),
// ladang tembakau & tambak garam (warna terrain di world.js), pohon siwalan, masjid berkubah, warung, sapi, gerbang selamat datang.
// Nama top-level diawali "mad" karena build_test.py menggabung semua modul ke satu scope.
import * as THREE from 'three';
import { seededRand } from './districts.js';

export const MAD_VILLAGES = [[340, -2130, 230], [-330, -2262, 190], [800, -2330, 170], [330, -2700, 200], [-560, -2720, 150], [760, -2830, 140]]; // [x, z, radius]
export const MAD_GATE = { x: 340, z: -1950 };
const MAD_Z0 = -1935, MAD_Z1 = -3080, MAD_X = 980, MAD_CELL = { Low: 40, High: 32, Ultra: 27 };
const MAD_PAL = [0xe9e2d0, 0xcfd8c8, 0xb8d0d8, 0xd9b99a, 0xc2a58a, 0x9b8f80, 0xe3c8a0, 0x8fb09a];   // putih kapur, hijau/biru pudar, plester mentah
const MAD_ROOF = [0xb5532f, 0x7d7f80, 0x9a4b2c, 0x6f6a60, 0x8a8f90];                                 // genteng & seng

// Rencana penempatan: murni (tanpa three) supaya bisa dites di node.
// o: {quality, height(x,z), roads:{clearance(x,z), lines:[{hw, pts:[{x,z}], zone}]}}
export function planMadura(o) {
  const R = seededRand(53), cell = MAD_CELL[o.quality] || 40, houses = [], mosques = [], palms = [], cattle = [], warung = [];
  const dens = (x, z, cl) => {
    let p = 0.035;
    for (const [vx, vz, vr] of MAD_VILLAGES) { const d = Math.hypot(x - vx, z - vz) / vr; p += 0.85 * Math.exp(-d * d * 1.6); }
    if (cl < 30) p += 0.12;   // memanjang di tepi jalan
    return Math.min(p, 0.9);
  };
  const HC = 40, hgrid = new Map(), hk = (a, b) => a * 73856093 ^ b * 19349663;
  const nearHouse = (x, z, r) => { const ix = Math.floor(x / HC), iz = Math.floor(z / HC);
    for (let a = ix - 1; a <= ix + 1; a++) for (let b = iz - 1; b <= iz + 1; b++) { const l = hgrid.get(hk(a, b)); if (l) for (const h of l) if (Math.abs(x - h.x) < h.w / 2 + r && Math.abs(z - h.z) < h.d / 2 + r) return true; } return false; };
  const addH = (h) => { houses.push(h); const k = hk(Math.floor(h.x / HC), Math.floor(h.z / HC)); let l = hgrid.get(k); if (!l) hgrid.set(k, l = []); l.push(h); };
  for (let cx = -MAD_X; cx <= MAD_X; cx += cell) for (let cz = MAD_Z0; cz >= MAD_Z1; cz -= cell) {
    const x = cx + (R() - 0.5) * cell * 0.5, z = cz + (R() - 0.5) * cell * 0.5, w = 6 + R() * 5, d = 5.5 + R() * 4, r1 = R(), r2 = R(), r3 = R();
    const gy = o.height(x, z); if (gy < 0.45) continue;
    if (Math.abs(x - MAD_GATE.x) < 32 && z > -2010) continue;                 // area gerbang
    const cl = o.roads.clearance(x, z); if (cl < Math.hypot(w, d) / 2 + 1.5) continue;
    const p = dens(x, z, cl); if (r1 > p) continue;
    const fl = p > 0.6 && r2 < 0.12 ? 2 : 1;
    addH({ x, z, w, d, gy, fl, h: fl * 3.1 + 0.3, ci: (r3 * MAD_PAL.length) | 0, ri: ((r3 * 97) % 1 * MAD_ROOF.length) | 0 });
  }
  for (const [vx, vz] of MAD_VILLAGES) {   // 1 masjid per desa
    for (let k = 0; k < 24; k++) { const a = k * 0.83, rr = 22 + k * 2.5, x = vx + Math.cos(a) * rr, z = vz + Math.sin(a) * rr;
      if (o.height(x, z) < 0.5 || o.roads.clearance(x, z) < 10 || nearHouse(x, z, 9)) continue;
      mosques.push({ x, z, gy: o.height(x, z) }); break; }
  }
  for (let i = 0; i < 2600 && palms.length < 700; i++) {   // siwalan
    const x = (R() * 2 - 1) * MAD_X, z = MAD_Z0 - R() * (MAD_Z0 - MAD_Z1), keep = R(), gy = o.height(x, z);
    if (keep > 0.4 || gy < 0.5 || o.roads.clearance(x, z) < 3 || nearHouse(x, z, 2)) continue;
    palms.push({ x, z, gy, h: 9 + R() * 5, s: 0.85 + R() * 0.4 });
  }
  for (const [vx, vz] of MAD_VILLAGES) for (let k = 0; k < 6; k++) {   // sapi
    const a = R() * 6.28, rr = 45 + R() * 90, x = vx + Math.cos(a) * rr, z = vz + Math.sin(a) * rr, gy = o.height(x, z);
    if (gy < 0.5 || o.roads.clearance(x, z) < 3 || nearHouse(x, z, 4)) continue;
    cattle.push({ x, z, gy, yaw: R() * 6.28, ci: (R() * 3) | 0 });
  }
  const ml = (o.roads.lines || []).filter(L => L.zone === 'madura');
  for (const [vx, vz] of MAD_VILLAGES) {   // warung di tepi jalan terdekat
    let best = null, bd = 1e9;
    for (const L of ml) L.pts.forEach((p, i) => { const dd = Math.hypot(p.x - vx, p.z - vz); if (dd < bd) { bd = dd; best = { L, i }; } });
    if (!best || bd > 200) continue;
    for (let j = 0; j < 2; j++) { const P = best.L.pts, i = Math.min(P.length - 2, Math.max(1, best.i + j * 14)), a = P[i - 1], b = P[i + 1];
      let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const side = j ? -1 : 1, x = P[i].x - tz * (best.L.hw + 3.4) * side, z = P[i].z + tx * (best.L.hw + 3.4) * side;
      if (o.height(x, z) < 0.45 || o.roads.clearance(x, z) < 1 || nearHouse(x, z, 1)) continue;
      warung.push({ x, z, gy: o.height(x, z), yaw: Math.atan2(-tz * side, tx * side) + Math.PI / 2 * 0, ci: (R() * 4) | 0 });
    }
  }
  return { houses, mosques, palms, cattle, warung };
}

function madSignTex(text, bg) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 128); g.strokeStyle = '#f2e8c8'; g.lineWidth = 6; g.strokeRect(6, 6, 1012, 116);
  g.fillStyle = '#fff6dc'; g.font = 'bold 66px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 512, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createMadura(scene, o) {
  const plan = planMadura(o), group = new THREE.Group(); scene.add(group);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), C = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
  const std = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.92 }, extra || {}));
  const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = true; m.receiveShadow = true; return m; };
  // rumah: dipecah per chunk 320 m supaya frustum culling bekerja
  const bodyG = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), roofG = new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0);
  const bodyM = std(0xffffff), roofM = std(0xffffff, { roughness: 0.8 }), chunks = new Map();
  plan.houses.forEach(h => { const k = Math.floor(h.x / 320) + ',' + Math.floor(h.z / 320); let l = chunks.get(k); if (!l) chunks.set(k, l = []); l.push(h); });
  for (const l of chunks.values()) {
    const body = inst(bodyG, bodyM, l.length), roof = inst(roofG, roofM, l.length);
    l.forEach((h, i) => {
      body.setMatrixAt(i, M.compose(P.set(h.x, h.gy - 0.3, h.z), Q, S.set(h.w, h.h + 0.3, h.d)));
      body.setColorAt(i, C.setHex(MAD_PAL[h.ci]).offsetHSL(0, 0, (h.ri % 3 - 1) * 0.02));
      roof.setMatrixAt(i, M.compose(P.set(h.x, h.gy + h.h, h.z), Q, S.set(h.w * 0.7637 * 1.05, 1.0 + (h.ci % 3) * 0.35, h.d * 0.7637 * 1.05)));
      roof.setColorAt(i, C.setHex(MAD_ROOF[h.ri]));
    });
    body.computeBoundingSphere(); roof.computeBoundingSphere(); group.add(body, roof);
  }
  // siwalan
  if (plan.palms.length) {
    const n = plan.palms.length, trunk = inst(new THREE.CylinderGeometry(0.26, 0.4, 1, 6).translate(0, 0.5, 0), std(0x6b5a45), n),
      crown = inst(new THREE.IcosahedronGeometry(1, 0), std(0xffffff, { roughness: 1 }), n);
    plan.palms.forEach((p, i) => { trunk.setMatrixAt(i, M.compose(P.set(p.x, p.gy, p.z), Q, S.set(p.s, p.h, p.s)));
      crown.setMatrixAt(i, M.compose(P.set(p.x, p.gy + p.h, p.z), Q.setFromAxisAngle(Y, i * 1.7), S.set(3.4 * p.s, 1.15, 3.4 * p.s))); Q.identity();
      crown.setColorAt(i, C.setHSL(0.24 + (i % 5) * 0.01, 0.4, 0.26 + (i % 4) * 0.025)); });
    trunk.computeBoundingSphere(); crown.computeBoundingSphere(); group.add(trunk, crown);
  }
  // sapi (badan + kepala)
  if (plan.cattle.length) {
    const n = plan.cattle.length, body = inst(new THREE.BoxGeometry(1.9, 1.05, 0.85).translate(0, 1.15, 0), std(0xffffff), n), head = inst(new THREE.BoxGeometry(0.6, 0.55, 0.5).translate(1.15, 1.35, 0), std(0xffffff), n),
      legs = inst(new THREE.BoxGeometry(1.5, 0.7, 0.55).translate(0, 0.35, 0), std(0x3a2e26), n), COL = [0x8a5a2b, 0xd8cdb8, 0x5a4030];
    plan.cattle.forEach((c, i) => { M.compose(P.set(c.x, c.gy, c.z), Q.setFromAxisAngle(Y, c.yaw), S); Q.identity(); body.setMatrixAt(i, M); head.setMatrixAt(i, M); legs.setMatrixAt(i, M);
      body.setColorAt(i, C.setHex(COL[c.ci])); head.setColorAt(i, C.setHex(COL[c.ci])); });
    [body, head, legs].forEach(m => { m.computeBoundingSphere(); group.add(m); });
  }
  // masjid (kubah + menara) & warung (lampu kecil menyala malam)
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffc860, emissiveIntensity: 0 });
  const white = std(0xf4f1e8), green = std(0x2f8f5b), mosqueBoxes = [];
  plan.mosques.forEach(m => {
    const g = new THREE.Group(); g.position.set(m.x, m.gy, m.z);
    const b = new THREE.Mesh(new THREE.BoxGeometry(12, 6.4, 12).translate(0, 3.2, 0), white), dome = new THREE.Mesh(new THREE.SphereGeometry(4.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 6.4, 0), green),
      min = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 16, 8).translate(8, 8, 8), white), cap = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(8, 16, 8), green);
    [b, dome, min, cap].forEach(x => { x.castShadow = true; g.add(x); }); group.add(g); mosqueBoxes.push([m.x, m.z, 6, 6]);
  });
  const wBody = new THREE.BoxGeometry(4.2, 2.6, 3.2).translate(0, 1.3, 0), wRoof = new THREE.BoxGeometry(5.4, 0.2, 4.4).translate(0, 2.7, 0), bulb = new THREE.SphereGeometry(0.22, 8, 6).translate(0, 2.3, 1.9), WC = [0x7ea36b, 0xc2653c, 0x5f8fb0, 0xd1b45a], warungBoxes = [];
  plan.warung.forEach(w => { const g = new THREE.Group(); g.position.set(w.x, w.gy, w.z); g.rotation.y = w.yaw;
    const a = new THREE.Mesh(wBody, std(WC[w.ci])), r = new THREE.Mesh(wRoof, std(0x777b7c)), l = new THREE.Mesh(bulb, lampMat); a.castShadow = r.castShadow = true; g.add(a, r, l); group.add(g); warungBoxes.push([w.x, w.z, 2.6, 2.6]); });
  // gerbang selamat datang di ujung jembatan
  const gate = new THREE.Group(); gate.position.set(MAD_GATE.x, o.height(MAD_GATE.x, MAD_GATE.z), MAD_GATE.z); group.add(gate);
  const pm = std(0xb9ae92); [-10.5, 10.5].forEach(dx => { const p = new THREE.Mesh(new THREE.BoxGeometry(2.2, 10, 2.2).translate(dx, 5, 0), pm); p.castShadow = true; gate.add(p); });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(24, 3, 1.4).translate(0, 9.6, 0), pm); beam.castShadow = true; gate.add(beam);
  const sS = new THREE.Mesh(new THREE.PlaneGeometry(21, 2.6).translate(0, 9.6, 0.75), new THREE.MeshBasicMaterial({ map: madSignTex('SELAMAT DATANG DI MADURA', '#8c1f1f') })),
    sN = new THREE.Mesh(new THREE.PlaneGeometry(21, 2.6).rotateY(Math.PI).translate(0, 9.6, -0.75), new THREE.MeshBasicMaterial({ map: madSignTex('SAMPAI JUMPA DI SURABAYA', '#1f4f8c') }));
  gate.add(sS, sN);
  console.log(`[madura] ${plan.houses.length} rumah, ${plan.mosques.length} masjid, ${plan.palms.length} siwalan, ${plan.cattle.length} sapi, ${plan.warung.length} warung`);
  return {
    colliders(c) { plan.houses.forEach(h => c.add(h.x, h.z, h.w / 2, h.d / 2)); mosqueBoxes.concat(warungBoxes).forEach(b => c.add(b[0], b[1], b[2], b[3]));
      c.add(MAD_GATE.x - 10.5, MAD_GATE.z, 1.1, 1.1); c.add(MAD_GATE.x + 10.5, MAD_GATE.z, 1.1, 1.1); },
    update() { lampMat.emissiveIntensity = o.night.value * 3; },
    plan,
  };
}
