// Pelabuhan Tanjung Perak: kontainer (instanced), dermaga, crane, kapal bersandar + kapal lewat.
import * as THREE from 'three';
import { ZONES, shoreZ, seededRand } from './districts.js';

const PRK_COL = [0xc0392b, 0x2e6da4, 0xe67e22, 0x27ae60, 0xecf0f1, 0x7f8c8d, 0xf1c40f, 0x8e44ad];

function prkCrane() {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x5b8fb9, roughness: 0.6 });
  const add = (w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); };
  for (const sx of [-7, 7]) for (const sz of [-5, 5]) add(0.9, 16, 0.9, sx, 8, sz);
  add(17, 1.6, 13, 0, 16.2, 0); add(1.4, 1.4, 58, 0, 18.5, 17); add(10, 1.4, 24, 0, 17.5, -14);
  add(1, 12, 1, -4, 23, 0); add(1, 12, 1, 4, 23, 0); add(10, 1, 1, 0, 29, 0);
  return g;
}
function prkShip(R, L, B, cols) {
  const g = new THREE.Group(), s = new THREE.Shape();
  s.moveTo(-B / 2, 0); s.lineTo(B / 2, 0); s.lineTo(B / 2, L * 0.75); s.quadraticCurveTo(B / 2, L * 0.92, 0, L);
  s.quadraticCurveTo(-B / 2, L * 0.92, -B / 2, L * 0.75); s.closePath();
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 7, bevelEnabled: false, curveSegments: 12 }).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7b1e1e, roughness: 0.7 }));
  hull.castShadow = true; g.add(hull);
  const wm = new THREE.MeshStandardMaterial({ color: 0xf2f2ee }), br = new THREE.Mesh(new THREE.BoxGeometry(B * 0.8, 10, 10), wm);
  br.position.set(0, 12, -8); const fn = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 5, 12), new THREE.MeshStandardMaterial({ color: 0xc0392b })); fn.position.set(0, 19.5, -8);
  g.add(br, fn);
  const items = [], rows = Math.floor(L * 0.6 / 13);
  for (let k = 0; k < rows; k++) for (let c = 0; c < 6; c++) for (let l = 0; l < 4; l++) if (R() > 0.12 * l + 0.1) items.push([(c - 2.5) * 2.5, 8.3 + l * 2.6, -24 - k * 13, R()]);
  const ci = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 2.6, 12.2), new THREE.MeshStandardMaterial({ color: 0xffffff }), items.length), M = new THREE.Matrix4(), C = new THREE.Color();
  items.forEach((t, i) => { ci.setMatrixAt(i, M.makeTranslation(t[0], t[1], t[2])); ci.setColorAt(i, C.setHex(PRK_COL[(t[3] * PRK_COL.length) | 0])); });
  g.add(ci); return g;
}
export function createPerak(scene, o) {
  const Z = ZONES.perak, R = seededRand(11), keep = { Low: 0.4, High: 1, Ultra: 1 }[o.quality], group = new THREE.Group(); scene.add(group);
  const stacks = [], boxes = [];
  for (let x = Z.x0 + 10, a = 0; x < Z.x1 - 10; x += 14, a++) for (let z = Z.z0, j = 0; z < Z.z1; z += 4.2, j++) {
    if (j % 6 === 5 || a % 9 === 8) continue;
    const gy = o.height(x, z); if (gy < 0.3 || o.roads.clearance(x, z) < 7.5 || R() > keep) continue;
    stacks.push([x, gy, z, 1 + Math.floor(R() * R() * 5), PRK_COL[(R() * PRK_COL.length) | 0]]); boxes.push([x, z]);
  }
  const total = stacks.reduce((n, s) => n + s[3], 0), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(12.2, 2.6, 2.4), C = new THREE.Color();
  const cont = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), total); cont.castShadow = cont.receiveShadow = true;
  let n = 0; for (const s of stacks) for (let l = 0; l < s[3]; l++) { cont.setMatrixAt(n, M.compose(P.set(s[0], s[1] + 1.3 + l * 2.6, s[2]), Q, S)); cont.setColorAt(n++, C.setHex(s[4])); }
  group.add(cont);
  // dermaga + kapal + crane
  const ships = [], pm = new THREE.MeshStandardMaterial({ color: 0x8c8c86, roughness: 1 });
  for (const px of [-1900, -1830, -1760, -1690, -1620, -1550]) {
    const zs = shoreZ(o.height, px), pier = new THREE.Mesh(new THREE.BoxGeometry(36, 5.2, 108), pm); pier.position.set(px, -1.4, zs - 44); pier.receiveShadow = true; group.add(pier);
    if (px < -1700 || px === -1620) {
      const sh = prkShip(R, 85, 20, 6); sh.position.set(px + 30, -3, zs - 25); group.add(sh); ships.push(sh);
      const cr = prkCrane(); cr.position.set(px + 13, 1.2, zs - 40); cr.rotation.y = Math.PI / 2; group.add(cr);
    }
  }
  const mover = prkShip(R, 120, 24, 6); mover.rotation.y = -Math.PI / 2; mover.position.set(-2300, -3, -760); group.add(mover);
  console.log(`[perak] ${total} kontainer, ${ships.length} kapal sandar`);
  return {
    colliders(c) { boxes.forEach(b => c.add(b[0], b[1], 6.1, 1.2)); },
    update(t, dt) {
      ships.forEach((s, i) => { s.position.y = -3 + Math.sin(t * 0.8 + i) * 0.12; s.rotation.z = Math.sin(t * 0.6 + i) * 0.01; });
      mover.position.x += 4 * dt; if (mover.position.x > 1000) mover.position.x = -2300; mover.position.y = -3 + Math.sin(t * 0.5) * 0.1;
    },
  };
}
