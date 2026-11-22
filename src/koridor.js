// Iterasi 88: ISI koridor (rumah/ruko low-detail) antara kota lama dan Darmo. zone:'koridor' (jalan: src/koridor_data.js).
// planKoridor = penempatan murni (tanpa three; dites di tools/tests/koridor_plan.test.mjs) + collider. createKoridor = mesh per chunk 160 m, LAZY (src/lazy.js).
// Sengaja tidak memakai model Kenney/upgrade(): satu InstancedMesh kotak + atap limas per chunk, jendela lewat shader (menyala malam) -> murah di HP.
import * as THREE from 'three';
import { createLazy } from './lazy.js';

const KOR_CELL = { Low: 60, High: 40, Ultra: 28 };            // sel 2x kota lama (30/20/14)
const KOR_BOX = { x0: -1950, x1: -380, z0: 905, z1: 2240 };   // z1 < 2255 = awal bbox Darmo (rumah Darmo = iter 89); z0 > 890 = batas kota lama
const KOR_CHUNK = 160, KOR_DRAW = { Low: 600, High: 850, Ultra: 1000 };   // sama dgn buildings.js
function korRng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// o: {quality, height(x,z), roads:{clearance(x,z)}, collider?:{add}, exclude?(x,z,r)}. Mengembalikan {B, cell}; B[i] = {x,z,w,d,gy,floors,h,c (warna dinding 0..1), rc (warna atap)}.
export function planKoridor(o) {
  const cell = KOR_CELL[o.quality], R = korRng(8801), B = [];
  for (let cx = KOR_BOX.x0; cx <= KOR_BOX.x1; cx += cell) for (let cz = KOR_BOX.z0; cz <= KOR_BOX.z1; cz += cell) {
    const x = cx + (R() - 0.5) * cell * 0.25, z = cz + (R() - 0.5) * cell * 0.25;
    const w = cell * (0.42 + R() * 0.3), d = cell * (0.42 + R() * 0.3), gy = o.height(x, z), pick = R(), lim = 40 + R() * 36, fl = R() * R(), c = R(), rc = R();
    if (gy < 0.25 || pick < 0.12) continue;                     // air / 12% petak kosong (sawah, lahan)
    if (o.exclude && o.exclude(x, z, Math.hypot(w, d) / 2)) continue;
    const cl = o.roads.clearance(x, z); if (cl < Math.hypot(w, d) / 2 + 1.5 || cl > lim) continue;   // hanya di tepi jalan (<= 40..76 m): ruang antar jalan tetap lapang
    const floors = 1 + Math.floor(fl * (cl < Math.hypot(w, d) / 2 + 9 ? 4 : 2.2));    // muka jalan (<= 9 m dari jalan): 1-4 lantai (ruko); lebih dalam: 1-2 (kampung)
    const b = { x, z, w, d, gy, floors, h: floors * 3.2 + 0.4, c, rc }; B.push(b);
    if (o.collider) o.collider.add(x, z, w / 2, d / 2);
  }
  return { B, cell };
}

// iter 89: material jendela dipakai bersama koridor.js dan darmo_bld.js
export function korWinMat(night) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  mat.onBeforeCompile = (sh) => {   // jendela gelap siang / menyala malam (varian ringan shader buildings.js)
    sh.uniforms.uNight = night;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vec4 wp4 = vec4(transformed, 1.0);\n #ifdef USE_INSTANCING\n wp4 = instanceMatrix * wp4;\n #endif\n vWP = (modelMatrix * wp4).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform float uNight;\nfloat hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 wn = normalize(cross(dFdx(vWP), dFdy(vWP)));
        float a = abs(wn.x) > abs(wn.z) ? vWP.z : vWP.x;
        vec2 cl = vec2(a / 3.0, vWP.y / 3.2), fr = fract(cl);
        float win = step(abs(wn.y), 0.3) * step(0.22, fr.x) * step(fr.x, 0.78) * step(0.3, fr.y) * step(fr.y, 0.8) * step(1.0, cl.y);
        float winLit = win * step(0.6, hh(floor(cl))) * uNight;
        diffuseColor.rgb *= mix(1.0, 0.3, win * (1.0 - winLit));`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1.0, 0.82, 0.45) * winLit * 1.2;');
  };
  return mat;
}

export function createKoridor(scene, o) {
  const { B, cell } = planKoridor(o), group = new THREE.Group(); scene.add(group);
  const mat = korWinMat(o.night);
  const bodyG = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), roofG = new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color();
  const chunks = new Map(), lazy = createLazy(), dmax = KOR_DRAW[o.quality] + KOR_CHUNK * 0.75; let nBuilt = 0;
  for (const b of B) { const kx = Math.floor(b.x / KOR_CHUNK), kz = Math.floor(b.z / KOR_CHUNK), k = kx + ',' + kz; let c = chunks.get(k); if (!c) chunks.set(k, c = { cx: (kx + 0.5) * KOR_CHUNK, cz: (kz + 0.5) * KOR_CHUNK, list: [], ms: [], on: true }); c.list.push(b); }
  const build = (c) => {
    const L = c.list, roofs = L.filter(b => b.floors <= 2);
    const body = new THREE.InstancedMesh(bodyG, mat, L.length); body.receiveShadow = true;
    L.forEach((b, i) => { M.compose(P.set(b.x, b.gy - 0.05, b.z), Q, S.set(b.w, b.h, b.d)); body.setMatrixAt(i, M);
      body.setColorAt(i, C.setHSL(b.floors > 2 ? 0.08 + b.c * 0.12 : [0.1, 0.13, 0.55, 0.33, 0.06][Math.floor(b.c * 5)], 0.18 + b.c * 0.3, 0.62 + (b.c * 7 % 1) * 0.2)); });
    group.add(body); c.ms.push(body);
    if (roofs.length) {
      const roof = new THREE.InstancedMesh(roofG, mat, roofs.length); roof.receiveShadow = true;
      roofs.forEach((b, i) => { const rh = 1.4 + (b.rc * 5 % 1) * 1.2; M.compose(P.set(b.x, b.gy - 0.05 + b.h, b.z), Q, S.set((b.w / 2 + 0.35) / 0.7071, rh, (b.d / 2 + 0.35) / 0.7071)); roof.setMatrixAt(i, M);
        roof.setColorAt(i, C.setHSL(b.rc < 0.6 ? 0.04 : 0.58, b.rc < 0.6 ? 0.45 : 0.08, b.rc < 0.6 ? 0.34 : 0.45)); });
      group.add(roof); c.ms.push(roof);
    }
    nBuilt++; if (nBuilt <= 3) console.log(`[koridor] chunk ${Math.round(c.cx)},${Math.round(c.cz)} dibangun: ${L.length} rumah`);
  };
  for (const [k, c] of chunks) lazy.add({ id: k, x: c.cx, z: c.cz, r: dmax, build: () => build(c) });
  console.log(`[koridor] ${o.quality}: ${B.length} rumah, ${chunks.size} chunk (lazy, jarak ${dmax} m)`);
  function update(px, pz) {
    lazy.tick(px, pz, 4);
    for (const c of chunks.values()) { if (!c.ms.length) continue; const on = Math.hypot(c.cx - px, c.cz - pz) < dmax; if (on !== c.on) { c.on = on; c.ms.forEach(m => { m.visible = on; }); } }
  }
  return { group, count: B.length, list: B, cell, update, flush: (x, z) => lazy.flush(x, z), stats: () => lazy.stats(),
    dispose() { scene.remove(group); group.children.forEach(m => m.dispose()); bodyG.dispose(); roofG.dispose(); mat.dispose(); } };
}
