// Rumput (iter 61): tuft rumput 3D dari "Simple grass chunks" (3dhdscan, CC BY 4.0) disebar di sekitar pemain.
// Jendela kotak (2R x 2R) berisi sel C m; tiap sel = 1 tuft (varian a/b/c acak, hash tetap). Pemain berpindah -> hanya sel BARU yang dihitung (slot toroidal).
// Tidak ditanam di: laut/pantai (h<0.5), dekat jalan, di dalam bangunan, jembatan, zona pelabuhan/Kenjeran. Ujung jendela mengecil halus (shader). Gagal muat = tanpa rumput.
import * as THREE from 'three';
import { loadKenney } from './assets.js';

const DENS = (() => { const v = parseFloat(new URLSearchParams(location.search).get('rumput_k')); return v >= 0 && v <= 1 ? v : 0.55; })();
const CFG = { Low: { R: 45, C: 2.4 }, High: { R: 65, C: 2.1 }, Ultra: { R: 85, C: 1.9 } };
const hash = (i, j, s) => { let h = (i * 374761393 + j * 668265263 + s * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// o: {quality, height(x,z), roads, collider, skip(x,z)->bool}
export function createRumput(scene, o) {
  const { R, C } = CFG[o.quality] || CFG.High, n = Math.ceil(2 * R / C), group = new THREE.Group(), uCenter = { value: new THREE.Vector2(1e9, 1e9) }, uR = { value: R };
  group.frustumCulled = false; scene.add(group);
  let ready = false, dead = false, meshes = [], keys = null, lastI = 1e9, lastJ = 1e9, scale0 = 0.5;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), Z0 = new THREE.Matrix4().makeScale(0, 0, 0), col = new THREE.Color();
  (async () => {
    const g = await loadKenney('rumput/tufts'); if (!g || dead) return;
    g.updateMatrixWorld(true); const parts = []; g.traverse(m => { if (m.isMesh) parts.push(m); }); if (!parts.length) return;
    const src = parts[0].material, mat = new THREE.MeshStandardMaterial({ map: src.map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, metalness: 0 });
    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
    mat.onBeforeCompile = (sh) => {   // ujung jendela: tuft mengecil ke tanah (tanpa pop-in)
      sh.uniforms.uCen = uCenter; sh.uniforms.uRad = uR;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec2 uCen; uniform float uRad;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec2 ow = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
        transformed *= 1.0 - smoothstep(uRad * 0.72, uRad * 0.98, distance(ow, uCen));
        #endif`);
    };
    meshes = parts.slice(0, 3).map(p => { const im = new THREE.InstancedMesh(p.geometry.clone().applyMatrix4(p.matrixWorld), mat, n * n); im.frustumCulled = false; im.castShadow = false; im.receiveShadow = false;
      for (let i = 0; i < n * n; i++) im.setMatrixAt(i, Z0); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * n * 3).fill(1), 3); group.add(im); return im; });
    keys = new Int32Array(n * n * 2).fill(-2147483648); ready = true;
    console.log(`[rumput] ${meshes.length} varian tuft, jendela ${n}x${n} sel (${o.quality}, R ${R} m)`);
  })();
  function fill(slot, ci, cj) {
    const h0 = hash(ci, cj, 1), x = (ci + 0.15 + 0.7 * hash(ci, cj, 2)) * C, z = (cj + 0.15 + 0.7 * hash(ci, cj, 3)) * C, v = Math.min(meshes.length - 1, Math.floor(h0 * meshes.length));
    let ok = true;
    const gy = o.height(x, z); const mad = z < -1940;
    if (gy < 0.5 || (mad && hash(ci, cj, 4) < 0.45)) ok = false;
    else if (!mad && hash(ci, cj, 9) > DENS) ok = false;   // iter 75: kota lebih jarang berumput (default 55%; ?rumput_k=1 = seperti dulu)
    else if (o.skip && o.skip(x, z)) ok = false;
    else if (o.roads.clearance(x, z) < 1.0) ok = false;
    else if (o.collider.hit && o.collider.hit(x, z, mad ? 1.0 : 1.7)) ok = false;   // iter 75: kota 1.7 m dari dinding (dulu 1.0)
    for (let k = 0; k < meshes.length; k++) {
      if (ok && k === v) { const s = scale0 * (0.65 + 0.7 * hash(ci, cj, 5)); Q.setFromAxisAngle(Y, hash(ci, cj, 6) * 6.2832); meshes[k].setMatrixAt(slot, M.compose(P.set(x, gy - 0.05, z), Q, S.set(s, s * (0.8 + 0.5 * hash(ci, cj, 7)), s)));
        const t = hash(ci, cj, 8); col.setRGB(0.78 + 0.3 * t, 0.85 + 0.2 * t, mad ? 0.5 : 0.62 + 0.2 * t); if (mad) col.r += 0.2; meshes[k].setColorAt(slot, col); }
      else meshes[k].setMatrixAt(slot, Z0);
    }
  }
  function update(px, pz) {
    if (!ready) return;
    const ci = Math.floor(px / C), cj = Math.floor(pz / C); uCenter.value.set(px, pz);
    if (ci === lastI && cj === lastJ) return; lastI = ci; lastJ = cj;
    const i0 = ci - (n >> 1), j0 = cj - (n >> 1); let fresh = 0;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const gi = i0 + a, gj = j0 + b, slot = (((gi % n) + n) % n) + n * (((gj % n) + n) % n);
      if (keys[slot * 2] === gi && keys[slot * 2 + 1] === gj) continue;
      keys[slot * 2] = gi; keys[slot * 2 + 1] = gj; fill(slot, gi, gj); fresh++;
    }
    if (fresh) meshes.forEach(m => { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; });
  }
  return { update, dispose() { dead = true; scene.remove(group); group.children.forEach(m => { m.geometry.dispose(); m.dispose(); }); } };
}
