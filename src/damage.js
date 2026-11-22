// Iterasi 13: HP 0 -> terbakar; 10 dtk kemudian meledak (pemain dipaksa keluar, kendaraan non-AI hilang lalu respawn di titik asal 30 dtk). Peringatan di 5 dtk.
// Iterasi 12: kerusakan kendaraan (HP), asap/api, AI terkejut (berhenti + klakson), mesin mati di HP 0.
// createDamage(scene,{veh,sfx,onWreck(v)}) -> {hit(v, impact), update(dt, focus)}. v.hp default 100, v.stun (detik) dibaca npcs.js.
import * as THREE from 'three';
export function createDamage(scene, ctx) {
  const { veh, sfx, onWreck, onExplode, onWarn, ground } = ctx, N = 48, api = {};
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(cv), P = [];
  for (let i = 0; i < N; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false; scene.add(s); P.push({ s, life: 0, max: 1, size: 1 });
  }
  let pi = 0, honkT = 0;
  const emit = (x, y, z, hp) => {
    const p = P[pi++ % N], fire = hp <= 0 && Math.random() < 0.5;
    p.life = p.max = fire ? 0.6 : 1.6; p.size = fire ? 0.9 : 1.1;
    p.s.position.set(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4);
    p.s.material.color.set(fire ? 0xff6a1a : hp <= 0 ? 0x2a2a2a : 0x666666); p.s.visible = true;
  };
  api.hit = (v, imp) => {
    if (!v || imp < 3) return;
    const old = v.hp ?? 100;
    v.hp = Math.max(0, old - imp * (v.T.r < 1 ? 1.6 : 1.1));
    if (v.ai && !v.satpol) { v.stun = 2.2; if (honkT <= 0) { honkT = 1.2; if (sfx) sfx.horn(); } }   // AI terkejut: berhenti + klakson
    if (old > 0 && v.hp <= 0) { console.log('[damage] kendaraan rusak total: ' + v.type); if (onWreck) onWreck(v); }
  };
  const boom = (o) => { for (let i = 0; i < 16; i++) { const p = P[pi++ % N]; p.life = p.max = 0.9; p.size = 3.2; p.s.position.set(o.x + (Math.random() - 0.5) * 3, o.y + 0.8 + Math.random() * 1.5, o.z + (Math.random() - 0.5) * 3); p.s.material.color.set(Math.random() < 0.6 ? 0xff7a1a : 0xffd23a); p.s.visible = true; } };
  const explode = (v) => {
    const o = v.obj.position; boom(o); if (sfx) { sfx.crash(1); sfx.thud(); }
    for (const u of veh.list) if (u !== v && u.obj.visible && Math.hypot(u.obj.position.x - o.x, u.obj.position.z - o.z) < 9) api.hit(u, 14);
    console.log('[damage] ledakan: ' + v.type);
    if (onExplode) onExplode(v);
    if (v.ai) { v.burn = -1e3; return; }                       // AI: efek saja, npcs.js yang mendaur ulang bangkai
    v.obj.visible = false; v.sp = 0; v.dead = 30; v.warned = false; if (v.rider) v.rider.visible = false; if (v.pRider) v.pRider.visible = false;
  };
  const respawn = (v) => {
    const h = v.home || [v.obj.position.x, v.obj.position.z, v.h]; v.h = h[2]; v.obj.position.set(h[0], ground ? ground(h[0], h[1]) : 0, h[1]);
    v.obj.rotation.set(0, v.h, 0); v.hp = 100; v.sp = 0; v.burn = 0; v.dead = 0; v.obj.visible = true; console.log('[damage] respawn ' + v.type);
  };
  api.update = (dt, focus) => {
    honkT -= dt;
    for (const v of veh.list) {
      if (!v.obj.visible) { if (v.dead > 0 && (v.dead -= dt) <= 0) respawn(v); continue; }
      if (v.hp === undefined || v.hp > 0) { v.burn = 0; continue; }
      v.burn = (v.burn || 0) + dt;
      if (v === veh.driving && !v.warned && v.burn > 5) { v.warned = true; if (onWarn) onWarn('Vehicle on fire! Get out!'); }
      if (v.burn > 10) explode(v);
    }
    for (const v of veh.list) {
      if (v.hp === undefined || v.hp >= 50 || !v.obj.visible) continue;
      const o = v.obj.position;
      if (focus && Math.hypot(o.x - focus.x, o.z - focus.z) > 150) continue;
      if (v.hp <= 0 && v === veh.driving) v.sp = Math.max(-3, Math.min(3, v.sp));   // mesin mati: merayap
      v.em = (v.em || 0) + dt * (v.hp <= 0 ? 12 : 6 * (1 - v.hp / 50));
      while (v.em >= 1) { v.em -= 1; emit(o.x + Math.sin(v.h) * v.T.r * 0.6, o.y + 0.9, o.z + Math.cos(v.h) * v.T.r * 0.6, v.hp); }
    }
    for (const p of P) {
      if (!p.s.visible) continue;
      p.life -= dt; if (p.life <= 0) { p.s.visible = false; continue; }
      const k = 1 - p.life / p.max;
      p.s.position.y += 2 * dt; p.s.scale.setScalar(p.size * (1 + k * 2.2)); p.s.material.opacity = 0.55 * (1 - k);
    }
  };
  return api;
}
