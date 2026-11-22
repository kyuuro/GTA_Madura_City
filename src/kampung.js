// Kampung: tiang listrik, kabel semrawut (sag acak, bersilangan, kabel nyasar), warung kios di gang.
import * as THREE from 'three';
import { seededRand } from './districts.js';
import { loadKenney } from './assets.js';

export function createKampung(scene, o) {
  const R = seededRand(5), poles = [], cab = [], kiosks = [], group = new THREE.Group(); scene.add(group);
  const span = (a, b, n, sagMax) => {
    for (let k = 0; k < n; k++) {
      const sa = ((k % 3) - 1) * 0.9, sb = (((k + (R() < 0.5 ? 1 : 0)) % 3) - 1) * 0.9, ya = (k < 3 ? 8.5 : 7.4) + R() * 0.2, yb = (k < 3 ? 8.5 : 7.4) + R() * 0.2, sag = 0.4 + R() * sagMax;
      seg([a.x + a.nx * sa, a.gy + ya, a.z + a.nz * sa], [b.x + b.nx * sb, b.gy + yb, b.z + b.nz * sb], sag, 10);
    }
  };
  const seg = (A, B, sag, n) => { let p = A; for (let s = 1; s <= n; s++) { const t = s / n, q = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t - 4 * sag * t * (1 - t), A[2] + (B[2] - A[2]) * t]; cab.push(...p, ...q); p = q; } };
  for (const L of o.roads.lines) {
    if ((L.zone === 'madura' || L.zone === 'koridor') && L.hw < 4) continue;   // iter 53: gang desa Madura tanpa kabel semrawut / kios (belum ada listrik desa); iter 87: gang koridor juga (tiang hanya di jalan utama koridor)
    const kamp = L.hw < 4, P = L.pts; let prev = null;
    for (let i = 3; i < P.length - 3; i += (L.zone === 'madura' || L.zone === 'darmo' || L.zone === 'koridor' ? 14 : 7)) {   // iter 86: Darmo tiang tiap ~56 m (jalan ~49 rb unit); iter 87: koridor sama
      const a = P[i - 1], b = P[i + 1]; let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const nx = -tz, nz = tx, side = (i / 7 | 0) % 2 ? 1 : -1, x = P[i].x + nx * (L.hw + 0.9) * side, z = P[i].z + nz * (L.hw + 0.9) * side;
      if (o.roads.clearance(x, z) < 0.2) { prev = null; continue; }
      const pl = { x, z, gy: o.height(x, z), nx, nz, side }; poles.push(pl);
      if (prev) span(prev, pl, kamp ? 7 : 3, kamp ? 2.2 : 1.0);
      if (kamp && R() < 0.7) seg([x, pl.gy + 8.4, z], [x + nx * side * (5 + R() * 8) + tx * (R() * 10 - 5), pl.gy + 3 + R() * 2, z + nz * side * (5 + R() * 8) + tz * (R() * 10 - 5)], 1.5, 8);
      prev = pl;
      if (kamp && i % 14 === 3) { const kx = P[i].x - nx * (L.hw + 1.4) * side, kz = P[i].z - nz * (L.hw + 1.4) * side;
        if (o.roads.clearance(kx, kz) > 0.4) kiosks.push({ x: kx, z: kz, gy: o.height(kx, kz), yaw: Math.atan2(nx * side, nz * side), c: R() }); }
    }
  }
  const M = new THREE.Matrix4(), M2 = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0), C = new THREE.Color();
  const mk = (geo, color, n) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.9 }), n); m.castShadow = true; group.add(m); return m; };
  const pole = mk(new THREE.CylinderGeometry(0.1, 0.16, 9, 8).translate(0, 4.5, 0), 0x8a8a84, poles.length);
  const arm1 = mk(new THREE.BoxGeometry(2.2, 0.12, 0.12).translate(0, 8.5, 0), 0x4a4a46, poles.length), arm2 = mk(new THREE.BoxGeometry(1.8, 0.1, 0.1).translate(0, 7.4, 0), 0x4a4a46, poles.length);
  const trf = mk(new THREE.BoxGeometry(0.5, 0.8, 0.5).translate(0.5, 6.5, 0), 0x5d6b5a, Math.ceil(poles.length / 3));
  poles.forEach((p, i) => { Q.setFromAxisAngle(Y, Math.atan2(-p.nz, p.nx)); M.compose(P.set(p.x, p.gy, p.z), Q, S);
    pole.setMatrixAt(i, M); arm1.setMatrixAt(i, M); arm2.setMatrixAt(i, M); if (i % 3 === 0) trf.setMatrixAt(i / 3, M); });
  const body = mk(new THREE.BoxGeometry(2.6, 2, 1.8).translate(0, 1, 0), 0xffffff, kiosks.length), awn = mk(new THREE.BoxGeometry(3, 0.08, 1.6), 0xffffff, kiosks.length);
  const bc = [0xc9a36b, 0xeeeeee, 0x7ea6c7, 0xd98c6a], ac = [0xd03a2f, 0x2e6da4, 0x2f9e5a, 0xf0b429, 0xe07b24];
  kiosks.forEach((k, i) => { Q.setFromAxisAngle(Y, k.yaw); M.compose(P.set(k.x, k.gy, k.z), Q, S); body.setMatrixAt(i, M);
    awn.setMatrixAt(i, M2.multiplyMatrices(M, new THREE.Matrix4().compose(new THREE.Vector3(0, 2.1, 1.5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.3), S)));
    body.setColorAt(i, C.setHex(bc[(k.c * 4) | 0])); awn.setColorAt(i, C.setHex(ac[(k.c * 997 % 5) | 0])); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(cab, 3));
  const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x151515 })); lines.frustumCulled = false; group.add(lines);
  // Iterasi 66: warung MENYALA MALAM. Bohlam kuning di bawah kanopi (bola emissive) + kolam cahaya hangat di tanah depan warung (kuad aditif, tekstur radial dari canvas).
  // Tanpa PointLight (murah di HP). Intensitas = world.nightU (o.night.value); siang disembunyikan. ?warung_lamp=0 mematikan. Posisi bohlam: lokal (0, 2.0, 1.2), kolam: lokal (0, 0.05, 2.4) radius 2.6 m.
  let glowOn = null, glowMat = null, bulbMat = null;
  if (kiosks.length && o.night && new URLSearchParams(location.search).get('warung_lamp') !== '0') {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,200,110,0.85)'); gr.addColorStop(0.45, 'rgba(255,170,70,0.35)'); gr.addColorStop(1, 'rgba(255,150,50,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    glowMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
    bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd98a }); 
    const pool = new THREE.InstancedMesh(new THREE.PlaneGeometry(5.2, 5.2).rotateX(-Math.PI / 2), glowMat, kiosks.length), bulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), bulbMat, kiosks.length);
    pool.frustumCulled = bulb.frustumCulled = false; pool.renderOrder = 5;
    kiosks.forEach((k, i) => { Q.setFromAxisAngle(Y, k.yaw); const ca = Math.cos(k.yaw), sa = Math.sin(k.yaw);   // lokal +Z -> dunia (sin yaw, cos yaw)
      const lp = (lx, ly, lz) => P.set(k.x + ca * lx + sa * lz, k.gy + ly, k.z - sa * lx + ca * lz);
      pool.setMatrixAt(i, M.compose(lp(0, 0.06, 2.4), Q, S)); bulb.setMatrixAt(i, M.compose(lp(0, 2.0, 1.2), Q, S)); });
    group.add(pool, bulb); glowOn = [pool, bulb]; glowOn.forEach(m => m.visible = false);
  }
  console.log(`[kampung] ${poles.length} tiang, ${cab.length / 6} segmen kabel, ${kiosks.length} warung`);
  // Iterasi 16b: warung kios -> Kenney retro-urban (wall-a-door = tembok+pintu, roof-metal-type-a = atap seng). Colormap retro BERBEDA dari kit lain. Gagal muat -> kotak procedural.
  async function upgradeKiosks() {
    if (!kiosks.length) return false;
    const [w, r] = await Promise.all([loadKenney('retro-urban/wall-a-door'), loadKenney('retro-urban/roof-metal-type-a')]); if (!w || !r) return false;
    const mi = (g, sx, sy, sz, dy, jit) => { g.updateMatrixWorld(true); const out = [];
      g.traverse(m => { if (!m.isMesh) return; const im = new THREE.InstancedMesh(m.geometry.clone().applyMatrix4(m.matrixWorld), m.material, kiosks.length); im.castShadow = im.receiveShadow = true;
        kiosks.forEach((k, i) => { Q.setFromAxisAngle(Y, k.yaw); const j = jit ? 0.9 + k.c * 0.25 : 1; im.setMatrixAt(i, M.compose(P.set(k.x, k.gy + dy, k.z), Q, S.set(sx * j, sy, sz))); }); group.add(im); out.push(im); }); return out; };
    mi(w, 2.8, 2.3, 2.0, 0, true); mi(r, 3.2, 2.2, 2.6, 2.3, true);
    body.visible = false; console.log(`[kampung] ${kiosks.length} warung -> Kenney retro-urban`);
    // Iterasi 16c: tong sampah Kenney retro-urban di samping sebagian warung (di sisi lokal +X, jauh dari jalan; dilewati kalau menutup jalan)
    const d = await loadKenney('retro-urban/detail-dumpster-closed');
    if (d) { const ds = []; kiosks.forEach(k => { if (k.c > 0.6) return; const ca = Math.cos(k.yaw), sa = Math.sin(k.yaw), x = k.x + ca * 2.4, z = k.z - sa * 2.4;
        if (o.roads.clearance(x, z) > 0.8) ds.push({ x, z, gy: o.height(x, z), yaw: k.yaw + (k.c - 0.3) * 0.6 }); });
      d.updateMatrixWorld(true); d.traverse(m => { if (!m.isMesh || !ds.length) return; const im = new THREE.InstancedMesh(m.geometry.clone().applyMatrix4(m.matrixWorld), m.material, ds.length); im.castShadow = true;
        ds.forEach((u, i) => { Q.setFromAxisAngle(Y, u.yaw); im.setMatrixAt(i, M.compose(P.set(u.x, u.gy, u.z), Q, S.set(3, 3, 3))); }); group.add(im); });
      console.log(`[kampung] ${ds.length} tong sampah -> Kenney retro-urban`); }
    return true;
  }
  // Iterasi 15: tiang listrik -> Kenney roads/electricity-pole (tiang + lengan atas). Skala tak seragam (6,17,6): tinggi ~8,8 m, lengan ~3,5 m.
  // Lengan model sepanjang X lokal = normal jalan (sama dengan arm1 procedural). arm2 (y 7,4) tetap procedural untuk dudukan kabel bawah.
  async function upgradePoles() {
    const g = await loadKenney('roads/electricity-pole'); if (!g || !poles.length) return false;
    g.updateMatrixWorld(true); const parts = []; g.traverse(o => { if (o.isMesh) parts.push(o); });
    const KS = new THREE.Vector3(6, 17, 6);
    for (const o of parts) {
      const im = new THREE.InstancedMesh(o.geometry.clone().applyMatrix4(o.matrixWorld), o.material, poles.length); im.castShadow = true;
      poles.forEach((p, i) => { Q.setFromAxisAngle(Y, Math.atan2(-p.nz, p.nx)); M.compose(P.set(p.x, p.gy, p.z), Q, KS); im.setMatrixAt(i, M); });
      group.add(im);
    }
    pole.visible = false; arm1.visible = false;
    console.log(`[kampung] ${poles.length} tiang -> Kenney electricity-pole`); return true;
  }
  return { upgradePoles, upgradeKiosks, colliders(c) { poles.forEach(p => c.add(p.x, p.z, 0.2, 0.2)); kiosks.forEach(k => c.add(k.x, k.z, 1.6, 1.6)); },
    update() { if (!glowOn) return; const n = o.night.value, on = n > 0.05; glowOn.forEach(m => m.visible = on); if (on) { glowMat.opacity = Math.min(1, n * 1.2); bulbMat.color.setRGB(1, 0.85, 0.54).multiplyScalar(0.4 + 0.6 * n); } } };
}
