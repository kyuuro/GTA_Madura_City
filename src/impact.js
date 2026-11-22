import * as THREE from 'three';
// Iterasi 72b: percikan kecil di titik kena pukulan/tendangan (fight.js). Satu THREE.Points berisi kolam 72 partikel (tanpa tekstur, 1 draw call).
// Partikel: kotak kecil aditif, warna memudar ke hitam (= hilang) lewat vertex color, gravitasi ringan. Aman dipanggil tiap frame (tanpa alokasi).
// API: createImpact(scene) -> { burst(x, y, z, dx, dz, power), update(dt), live }   power 1 = pukulan, 1.6 = tendangan, 2.2 = finisher
const IM_N = 72;
export function createImpact(scene) {
  const pos = new Float32Array(IM_N * 3), col = new Float32Array(IM_N * 3), vel = new Float32Array(IM_N * 3), life = new Float32Array(IM_N), life0 = new Float32Array(IM_N), base = new Float32Array(IM_N * 3);
  for (let i = 0; i < IM_N; i++) pos[i * 3 + 1] = -999;
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
  const api = { live: 0 }; let head = 0;
  api.burst = (x, y, z, dx, dz, power = 1) => {   // (dx,dz) = arah pukulan (ke sasaran); percikan menyembur sebagian searah, sebagian acak
    const n = Math.min(IM_N, Math.round(8 + power * 6)), l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    for (let k = 0; k < n; k++) {
      const i = head, s = (2.2 + Math.random() * 3.2) * (0.7 + power * 0.3), a = Math.random() * 6.283, up = 0.6 + Math.random() * 2.2; head = (head + 1) % IM_N;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      vel[i * 3] = dx * s * 0.5 + Math.cos(a) * s * 0.6; vel[i * 3 + 1] = up * (0.7 + power * 0.3); vel[i * 3 + 2] = dz * s * 0.5 + Math.sin(a) * s * 0.6;
      life0[i] = life[i] = 0.22 + Math.random() * 0.2;
      const w = Math.random(); base[i * 3] = 1; base[i * 3 + 1] = 0.75 + w * 0.2; base[i * 3 + 2] = 0.3 + w * 0.4;   // kuning-putih hangat
    }
  };
  api.update = (dt) => {
    let alive = 0;
    for (let i = 0; i < IM_N; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt; const j = i * 3;
      if (life[i] <= 0) { pos[j + 1] = -999; col[j] = col[j + 1] = col[j + 2] = 0; continue; }
      alive++; vel[j + 1] -= 9 * dt; pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
      const f = life[i] / life0[i]; col[j] = base[j] * f; col[j + 1] = base[j + 1] * f; col[j + 2] = base[j + 2] * f;
    }
    if (alive || api.live) { geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; }
    api.live = alive; pts.visible = alive > 0;
  };
  pts.visible = false;
  return api;
}
