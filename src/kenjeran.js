// Pantai Kenjeran (iter 54: dipindah ke pantai TIMUR 1:3, game ~945,1407; sebelumnya di pantai utara dekat jembatan).
// Isi: pagoda + patung di Kenjeran Park, perahu nelayan, payung & meja warung pantai sepanjang pantai, Pasar Ikan Asap (kios), batu-batu (Pantai Batu-Batu).
import * as THREE from 'three';
import { seededRand } from './districts.js';
import { eastShore } from './world.js';

function knjPagoda(g, x, y, z) {
  const red = new THREE.MeshStandardMaterial({ color: 0xb02a20 }), gold = new THREE.MeshStandardMaterial({ color: 0xd9a21b, roughness: 0.5 });
  const add = (geo, m, py) => { const b = new THREE.Mesh(geo, m); b.position.set(x, y + py, z); b.castShadow = true; g.add(b); };
  add(new THREE.BoxGeometry(16, 1, 16), new THREE.MeshStandardMaterial({ color: 0xcfcab8 }), 0.5);
  for (let t = 0; t < 7; t++) { const r = 5.2 - t * 0.55, py = 1 + t * 3.6;
    add(new THREE.CylinderGeometry(r, r, 2, 8), red, py + 1); add(new THREE.CylinderGeometry(r * 0.35, r + 1.6, 1.6, 8), gold, py + 2.8); }
  add(new THREE.CylinderGeometry(0.1, 0.35, 5, 8), gold, 1 + 7 * 3.6 + 2.5);
}
function knjStatue(g, x, y, z) {
  const w = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.5 }), add = (geo, m, py, sy = 1) => { const b = new THREE.Mesh(geo, m); b.position.set(x, y + py, z); b.scale.y = sy; b.castShadow = true; g.add(b); return b; };
  add(new THREE.CylinderGeometry(4, 5, 2, 16), new THREE.MeshStandardMaterial({ color: 0x9a9488 }), 1);
  add(new THREE.ConeGeometry(3.4, 9, 16, 1, true), w, 6.5); add(new THREE.SphereGeometry(1.1, 20, 14), w, 12); add(new THREE.CapsuleGeometry(0.9, 3, 6, 12), w, 8.5);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.12, 8, 28), new THREE.MeshStandardMaterial({ color: 0xd9a21b })); halo.position.set(x, y + 12, z - 0.8); g.add(halo);
}
export function createKenjeran(scene, o) {
  const R = seededRand(23), group = new THREE.Group(), boxes = []; scene.add(group);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), E = new THREE.Euler(), C = new THREE.Color();
  // Kenjeran Park: pagoda + patung di jalur pantai, di sisi laut dari Jl. Raya Kenjeran
  const pz = 1392, px = eastShore(pz) - 25; knjPagoda(group, px, o.height(px, pz), pz); boxes.push([px, pz, 8, 8]);
  const tz = 1452, sx = eastShore(tz) - 28; knjStatue(group, sx, o.height(sx, tz), tz); boxes.push([sx, tz, 5, 5]);
  // perahu nelayan di laut timur
  const NB = 24, boats = [], hull = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 8).scale(3.2, 0.7, 0.9), new THREE.MeshStandardMaterial({ color: 0xffffff }), NB);
  const cab = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 1, 1), new THREE.MeshStandardMaterial({ color: 0xeeeeee }), NB);
  for (let i = 0; i < NB; i++) { const z = 470 + R() * 1030; boats.push([eastShore(z) + 14 + R() * 70, z, R() * 6.28, i]); hull.setColorAt(i, C.setHex([0x2e6da4, 0xc0392b, 0xf1c40f, 0xecf0f1, 0x27ae60][i % 5])); }
  hull.castShadow = true; group.add(hull, cab);
  // payung + meja warung pantai sepanjang pantai (z 470..1500)
  const spots = []; for (let z = 470; z < 1500; z += 9) { const x = eastShore(z) - 9 - (spots.length % 2) * 5; if (o.height(x, z) > 0.3 && o.roads.clearance(x, z) > 3) spots.push([x, z]); }
  const um = new THREE.InstancedMesh(new THREE.ConeGeometry(1.7, 0.7, 12), new THREE.MeshStandardMaterial({ color: 0xffffff }), spots.length);
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6).translate(0, 1.1, 0), new THREE.MeshStandardMaterial({ color: 0x777777 }), spots.length);
  const tab = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.1, 0.9).translate(0, 0.75, 0), new THREE.MeshStandardMaterial({ color: 0x9c6b3a }), spots.length);
  spots.forEach((s, i) => { const y = o.height(s[0], s[1]); P.set(s[0], y, s[1]);
    pole.setMatrixAt(i, M.compose(P, Q, S)); tab.setMatrixAt(i, M.compose(P, Q, S)); um.setMatrixAt(i, M.compose(P.set(s[0], y + 2.4, s[1]), Q, S));
    um.setColorAt(i, C.setHSL(R(), 0.75, 0.55)); boxes.push([s[0], s[1], 0.7, 0.5]); });
  group.add(um, pole, tab);
  // Pasar Ikan Asap (~z 678): deret kios dengan kanopi warna-warni
  const ST = 10, kb = new THREE.InstancedMesh(new THREE.BoxGeometry(3, 2.2, 2.4).translate(0, 1.1, 0), new THREE.MeshStandardMaterial({ color: 0xcdb892 }), ST);
  const ka = new THREE.InstancedMesh(new THREE.BoxGeometry(3.4, 0.15, 1.6).translate(0, 2.35, 1.6), new THREE.MeshStandardMaterial({ color: 0xffffff }), ST);
  for (let i = 0; i < ST; i++) { const z = 650 + i * 6.5, x = eastShore(z) - 15, y = o.height(x, z);
    Q.setFromEuler(E.set(0, Math.PI / 2, 0)); kb.setMatrixAt(i, M.compose(P.set(x, y, z), Q, S)); ka.setMatrixAt(i, M.compose(P, Q, S));
    ka.setColorAt(i, C.setHex([0xc0392b, 0x2e6da4, 0xf1c40f, 0x27ae60][i % 4])); boxes.push([x, z, 1.3, 1.6]); }
  kb.castShadow = true; group.add(kb, ka); Q.identity();
  // Pantai Batu-Batu (~z 485): batu-batu di tepi laut
  const NR = 36, rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x7d7a72, roughness: 1 }), NR);
  for (let i = 0; i < NR; i++) { const z = 462 + R() * 50, x = eastShore(z) - 3 + R() * 12, k = 0.7 + R() * 1.6;
    Q.setFromEuler(E.set(R() * 3, R() * 3, R() * 3)); rocks.setMatrixAt(i, M.compose(P.set(x, Math.max(0, o.height(x, z)) + k * 0.25, z), Q, S.set(k * 1.2, k * 0.8, k))); }
  rocks.castShadow = true; group.add(rocks); S.set(1, 1, 1); Q.identity();
  console.log(`[kenjeran] pantai timur: pagoda z${pz}, ${NB} perahu, ${spots.length} payung, ${ST} kios, ${NR} batu`);
  return {
    colliders(c) { boxes.forEach(b => c.add(b[0], b[1], b[2], b[3])); },
    update(t) {
      boats.forEach(b => { P.set(b[0], -0.12 + Math.sin(t * 1.3 + b[3]) * 0.1, b[1]); Q.setFromEuler(E.set(Math.sin(t + b[3]) * 0.05, b[2], 0));
        hull.setMatrixAt(b[3], M.compose(P, Q, S)); cab.setMatrixAt(b[3], M.compose(P.set(b[0] + Math.cos(b[2]) * 0.4, P.y + 0.7, b[1] - Math.sin(b[2]) * 0.4), Q, S)); });
      hull.instanceMatrix.needsUpdate = cab.instanceMatrix.needsUpdate = true;
    },
  };
}
