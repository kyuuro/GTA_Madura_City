// Iterasi 40: lampu kendaraan malam hari.
// (1) SpotLight asli di kendaraan yang DIKENDARAI pemain (menerangi jalan; intensitas 0 di siang supaya shader tidak dikompilasi ulang).
// (2) Untuk kendaraan terdekat (maks LT_SLOTS): kerucut cahaya aditif (tanpa PointLight, murah untuk HP) + glow lampu depan putih + glow lampu belakang merah (lebih besar saat mengerem).
// Konvensi kendaraan: depan = +Z lokal. Tidak ada kontrol khusus (otomatis menyala saat malam).
import * as THREE from 'three';

const LT_SLOTS = 8, LT_RANGE = 120, LT_ON = 0.25;   // jarak pilih (m), ambang malam (0..1)

function ltGlowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function ltBeamGeo(len, rad) {   // kerucut terbuka: puncak di lampu (0,0,0), alas di +Z; warna vertex memudar ke hitam (aditif -> tembus pandang)
  const g = new THREE.ConeGeometry(rad, len, 14, 1, true); g.translate(0, -len / 2, 0); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const k = 1 - Math.min(1, p.getZ(i) / len); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k * k; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}

export function createLights(scene, ctx) {
  const { veh, night } = ctx;   // night = world.nightU (uniform {value 0..1})
  const tex = ltGlowTex(), beamGeo = ltBeamGeo(11, 2.4);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1c4, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const headMat = new THREE.SpriteMaterial({ map: tex, color: 0xfff4d0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const tailMat = new THREE.SpriteMaterial({ map: tex, color: 0xff2a1a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });

  const spot = new THREE.SpotLight(0xfff0c8, 0, 75, 0.55, 0.6, 1.2);   // intensitas diatur tiap frame; WAJIB ditambah sekali di awal
  spot.castShadow = false; scene.add(spot, spot.target);

  const slots = [];
  for (let i = 0; i < LT_SLOTS; i++) {
    const g = new THREE.Group(); g.visible = false;
    const b = [new THREE.Mesh(beamGeo, beamMat), new THREE.Mesh(beamGeo, beamMat)], h = [new THREE.Sprite(headMat), new THREE.Sprite(headMat)], t = [new THREE.Sprite(tailMat), new THREE.Sprite(tailMat)];
    b.forEach(m => { m.frustumCulled = false; m.renderOrder = 5; }); [...h, ...t].forEach(s => { s.renderOrder = 6; });
    g.add(...b, ...h, ...t); slots.push({ g, b, h, t, v: null, last: 0 });
  }
  function attach(s, v) {   // pasang ke kendaraan v, posisi sesuai ukuran (T.r)
    s.v = v; s.last = v.sp; v.obj.add(s.g); s.g.visible = true;
    const r = v.T.r, two = !v.T.rider, fx = two ? r * 0.38 : 0, fz = r * 1.12, y = v.T.rider ? 0.9 : Math.max(0.65, r * 0.42), gs = Math.max(0.5, r * 0.45);
    [0, 1].forEach(k => {
      const sx = two ? (k ? 1 : -1) * fx : 0, on = two || k === 0;
      s.b[k].visible = s.h[k].visible = s.t[k].visible = on;
      s.b[k].position.set(sx, y, fz); s.b[k].scale.setScalar(Math.max(0.6, r * 0.5)); s.b[k].rotation.x = 0.08;
      s.h[k].position.set(sx, y, fz + 0.05); s.h[k].scale.setScalar(gs);
      s.t[k].position.set(sx, y, -fz); s.t[k].scale.setScalar(gs * 0.8); s.t[k].userData.base = gs * 0.8;
    });
  }
  function detach(s) { if (s.v) s.v.obj.remove(s.g); s.v = null; s.g.visible = false; }

  let pickT = 0, onCount = 0, lastOn = false;
  const api = { active: 0 };
  api.update = (dt, focus) => {
    const n = night.value, on = n > LT_ON, k = Math.max(0, Math.min(1, (n - LT_ON) / 0.4));
    beamMat.opacity = 0.34 * k; headMat.opacity = 0.9 * k; tailMat.opacity = 0.8 * k;
    if (on !== lastOn) { lastOn = on; console.log(`[lights] lampu kendaraan ${on ? 'menyala' : 'padam'} (malam ${n.toFixed(2)})`); }
    // SpotLight di kendaraan pemain
    const d = veh.driving;
    if (d && on && !d.dead && d.type !== 'becak') {
      const o = d.obj.position, fx = Math.sin(d.h), fz = Math.cos(d.h), r = d.T.r;
      spot.position.set(o.x + fx * r, o.y + Math.max(0.8, r * 0.45), o.z + fz * r);
      spot.target.position.set(o.x + fx * 30, o.y - 0.5, o.z + fz * 30); spot.target.updateMatrixWorld();
      spot.intensity = 90 * k;
    } else spot.intensity = 0;
    // pilih kendaraan terdekat (tiap 0.4 dtk)
    pickT -= dt;
    if (pickT <= 0) {
      pickT = 0.4;
      if (!on) { slots.forEach(detach); onCount = 0; }
      else {
        const cand = [];
        for (const v of veh.list) { if (!v.obj.visible || v.dead || v.type === 'becak') continue; const dd = Math.hypot(v.obj.position.x - focus.x, v.obj.position.z - focus.z); if (dd < LT_RANGE) cand.push([dd, v]); }
        cand.sort((a, b) => a[0] - b[0]);
        const want = new Set(cand.slice(0, LT_SLOTS).map(c => c[1]));
        for (const s of slots) if (s.v && !want.has(s.v)) detach(s);
        for (const v of want) if (!slots.some(s => s.v === v)) { const f = slots.find(s => !s.v); if (f) attach(f, v); }
        onCount = slots.filter(s => s.v).length;
      }
    }
    api.active = onCount;
    // lampu rem: glow belakang membesar kalau kecepatan turun cepat
    if (on) for (const s of slots) if (s.v) {
      const a = (s.v.sp - s.last) / Math.max(dt, 1e-3) * Math.sign(s.v.sp || 1); s.last = s.v.sp;
      const brake = a < -3 ? 1.9 : 1;
      s.t.forEach(t => { const b = t.userData.base || 1, cur = t.scale.x; t.scale.setScalar(cur + (b * brake - cur) * Math.min(1, dt * 12)); });
    }
  };
  return api;
}
