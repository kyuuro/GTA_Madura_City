// Jembatan Suramadu: dek bisa dilewati (heightAt), girder, rel, marka, lampu, 2 pylon H, 256 kabel (instanced), beacon merah.
import * as THREE from 'three';

// Iterasi 52: skala 1:3 -> panjang 5.438 m asli = ~1.813 unit (dulu 595). Kaki Surabaya z=-105, ujung Madura z=-1915.
const SMB_X = 340, SMB_HW = 10, SMB_TOP = 26, SMB_Z0 = -105, SMB_Z1 = -1915, SMB_FA = -840, SMB_FB = -1180, SMB_C = -1010; // FA..FB = bentang datar (cable-stayed), C = tengah
const smbStep = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
const SMB_BASE = 1.07;   // iter 68: = tanggul 1.0 + jalan 0.06~0.08 (sebelumnya 0.8 -> dek lebih rendah dari jalan & tanah)
const smbY = (z) => SMB_BASE + (SMB_TOP - SMB_BASE) * smbStep(SMB_Z0, SMB_FA, z) * (1 - smbStep(SMB_FB, SMB_Z1, z)); // tanjakan panjang - datar - turunan panjang
const smbOn = (x, z) => x > SMB_X - SMB_HW && x < SMB_X + SMB_HW && z < SMB_Z0 && z > SMB_Z1;

function smbStrip(g, A, B, mat) { // A,B: titik [x,y,z] sepanjang jembatan (kiri/kanan)
  const pos = [], idx = [];
  A.forEach((a, i) => { pos.push(...a, ...B[i]); if (i < A.length - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; g.add(m);
}
function smbPylon(g, zc) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xc8c8c0, roughness: 0.8 }), add = (geo, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); };
  add(new THREE.BoxGeometry(34, 12, 14), SMB_X, -2, zc);
  for (const s of [-1, 1]) { add(new THREE.BoxGeometry(3.2, 104, 4), SMB_X + 13 * s, 44, zc); add(new THREE.ConeGeometry(2.6, 5, 4).rotateY(Math.PI / 4), SMB_X + 13 * s, 98.5, zc); }
  add(new THREE.BoxGeometry(29.2, 3, 3.4), SMB_X, 62, zc); add(new THREE.BoxGeometry(29.2, 3, 3.4), SMB_X, 90, zc);
}
export function createSuramadu(scene, o) {
  const g = new THREE.Group(); scene.add(g);
  const zs = []; for (let z = SMB_Z0; z > SMB_Z1; z -= 6) zs.push(z); zs.push(SMB_Z1);
  const pt = (dx, dy, z) => [SMB_X + dx, smbY(z) + dy, z], col = (dx, dy) => zs.map(z => pt(dx, dy, z));
  smbStrip(g, col(-10, 0), col(10, 0), new THREE.MeshStandardMaterial({ color: 0x2d2d30, roughness: 0.95, side: THREE.DoubleSide }));
  const conc = new THREE.MeshStandardMaterial({ color: 0xb9b6ac, roughness: 0.9, side: THREE.DoubleSide });
  smbStrip(g, col(-10, 0), col(-8, -2.4), conc); smbStrip(g, col(-8, -2.4), col(8, -2.4), conc); smbStrip(g, col(10, 0), col(8, -2.4), conc);
  const rail = new THREE.MeshStandardMaterial({ color: 0xd8d8d2, side: THREE.DoubleSide });
  smbStrip(g, col(-9.8, 0), col(-9.8, 1.1), rail); smbStrip(g, col(9.8, 0), col(9.8, 1.1), rail);
  const wl = new THREE.MeshBasicMaterial({ color: 0xe8e2c0, side: THREE.DoubleSide });
  for (const x of [-9, 9]) smbStrip(g, col(x - 0.1, 0.04), col(x + 0.1, 0.04), wl);
  const dp = [], di = [];
  for (let z = SMB_Z0 - 3; z > SMB_Z1 + 10; z -= 8) { const a = dp.length / 3, y = smbY(z) + 0.04, y2 = smbY(z - 3) + 0.04; dp.push(SMB_X - 0.12, y, z, SMB_X + 0.12, y, z, SMB_X - 0.12, y2, z - 3, SMB_X + 0.12, y2, z - 3); di.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3)); dg.setIndex(di); g.add(new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ color: 0xf0c020, side: THREE.DoubleSide })));
  // lampu dek
  const lp = []; for (let z = SMB_Z0 - 25; z > SMB_Z1 + 10; z -= 24) for (const s of [-1, 1]) lp.push([SMB_X + 9.2 * s, smbY(z), z]);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
  const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = true; g.add(m); return m; };
  const poles = inst(new THREE.CylinderGeometry(0.06, 0.09, 6, 6).translate(0, 3, 0), new THREE.MeshStandardMaterial({ color: 0x666a70 }), lp.length);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffd070, emissiveIntensity: 0 });
  const heads = inst(new THREE.SphereGeometry(0.3, 10, 8).translate(0, 6.1, 0), lampMat, lp.length);
  lp.forEach((p, i) => { M.compose(P.set(...p), Q, S); poles.setMatrixAt(i, M); heads.setMatrixAt(i, M); });
  // pilar penyangga di ramp
  const cz = []; for (let z = SMB_Z0 - 45; z > SMB_Z1 + 10; z -= 36) if (z > SMB_FA || z < SMB_FB) cz.push(z);
  const col1 = inst(new THREE.CylinderGeometry(1.5, 1.8, 1, 12).translate(0, 0.5, 0), conc, cz.length), cap = inst(new THREE.BoxGeometry(14, 1.2, 2.6).translate(0, 0.6, 0), conc, cz.length);
  cz.forEach((z, i) => { const gb = Math.max(-8, o.height(SMB_X, z)), top = smbY(z) - 2.4;
    col1.setMatrixAt(i, M.compose(P.set(SMB_X, gb, z), Q, S.set(1, Math.max(0.1, top - gb), 1)));
    cap.setMatrixAt(i, M.compose(P.set(SMB_X, top - 1.2, z), Q, S.set(1, 1, 1))); S.set(1, 1, 1); });
  // pylon + kabel
  const pyl = [[SMB_C + 85, -1], [SMB_C - 85, 1]], cabs = [];
  for (const [zc, inward] of pyl) { smbPylon(g, zc);
    for (const sx of [-1, 1]) for (const dir of [-1, 1]) { const N = dir === inward ? 10 : 22;
      for (let k = 0; k < N; k++) for (let j = 0; j < 2; j++) { const h = 52 + (k / (N - 1)) * 42 + j * 1.2, zk = zc + dir * (8 + k * 7) + (j ? 1.2 : -1.2);
        cabs.push([new THREE.Vector3(SMB_X + 13 * sx, h, zc + (j ? 0.8 : -0.8)), new THREE.Vector3(SMB_X + 9.5 * sx, smbY(zk) + 0.5, zk)]); } } }
  const cm = inst(new THREE.CylinderGeometry(0.1, 0.1, 1, 6), new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.6 }), cabs.length), d = new THREE.Vector3();
  cabs.forEach(([a, b], i) => { d.subVectors(b, a); const len = d.length(); Q.setFromUnitVectors(Y, d.normalize());
    cm.setMatrixAt(i, M.compose(P.copy(a).add(b).multiplyScalar(0.5), Q, S.set(1, len, 1))); }); S.set(1, 1, 1); Q.identity();
  const bm = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1 });
  const bc = inst(new THREE.SphereGeometry(0.7, 10, 8), bm, 4); let bi = 0;
  for (const [zc] of pyl) for (const s of [-1, 1]) bc.setMatrixAt(bi++, M.compose(P.set(SMB_X + 13 * s, 102, zc), Q, S));
  console.log(`[suramadu] ${cabs.length} kabel, ${lp.length} lampu, ${cz.length} pilar`);
  return {
    heightAt: (x, z) => (smbOn(x, z) ? smbY(z) : null),
    colliders(c) { const zm = (SMB_Z0 + SMB_Z1) / 2, hd = (SMB_Z0 - SMB_Z1) / 2; c.add(SMB_X - 10, zm, 0.5, hd); c.add(SMB_X + 10, zm, 0.5, hd); },
    update(t) { lampMat.emissiveIntensity = o.night.value * 3; bm.emissiveIntensity = Math.sin(t * 3) > 0 ? 3 : 0.2; },
  };
}
