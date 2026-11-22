// Iterasi 73: SENJATA JARAK DEKAT (procedural, tanpa aset baru => tanpa kredit tambahan). 3 jenis: tongkat kayu, pentungan, sapu.
// Pungut/lepas: tombol G (PC) atau tombol GRAB/DROP di HP (muncul hanya saat dekat senjata atau sedang memegang). F tetap khusus kendaraan (tidak bentrok).
// Dipegang di tulang tangan kanan (RightHand karakter Kenney; fallback: ujung lengan 'armR' karakter procedural), ikut animasi pukulan. Posisi diam = ujung menunjuk ke bawah-belakang
//  sehingga pada puncak ayunan pukulan (lengan ke depan) ujungnya menunjuk ke depan-bawah.
// Efek tempur dibaca fight.js lewat stats(): dmg, range, kn (pengali dorongan), cdMul. Tiap pukulan yang KENA memanggil use(); durabilitas habis = senjata patah.
// Sumber senjata: titik tetap (WP_SPAWNS, muncul lagi 90 dtk setelah diambil), dijatuhkan petugas Satpol yang KO (pentungan), dijatuhkan pemain saat WASTED; BUSTED = disita.
// API: createWeapons(scene,{player,ground,blocked,collider,toast,sfx,canAct}) -> { held, uses, pickups, stats(), use() -> true kalau patah, dropAt(x,z,type), lose(sita), update(dt) }
import * as THREE from 'three';

const WP_DEFS = {
  kayu: { name: 'Wooden stick', dmg: 2, range: 2.2, kn: 1.3, cdMul: 1.0, uses: 10 },
  pentungan: { name: 'Baton', dmg: 2, range: 2.0, kn: 1.1, cdMul: 0.8, uses: 30 },
  sapu: { name: 'Broom', dmg: 1.5, range: 2.4, kn: 1.6, cdMul: 1.1, uses: 8 },
};
// titik pungut tetap: [tipe, x, z] relatif titik teleport (dicari petak bebas terdekat). Spawn (0,12), Perak, Kenjeran, kaki Suramadu
const WP_SPAWNS = [['kayu', 4, 14], ['pentungan', -8, 18], ['sapu', 13, 22], ['kayu', -14, 6], ['sapu', -1640 + 6, -565 + 5], ['kayu', 898 + 5, 1385 + 6], ['pentungan', 340 + 6, -60 + 4]];
const WP_RESPAWN = 90, WP_GRAB_R = 1.8, WP_MAX_DYN = 10, WP_DYN_LIFE = 180;
const WP_MAT = {}; const wpMat = (c) => WP_MAT[c] || (WP_MAT[c] = new THREE.MeshLambertMaterial({ color: c }));
function wpCyl(r0, r1, y0, y1, c) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, y1 - y0, 8), wpMat(c)); m.position.y = (y0 + y1) / 2; return m; }
function wpMesh(type) {   // sumbu +Y = arah batang, titik genggam di y=0
  const g = new THREE.Group();
  if (type === 'kayu') { g.add(wpCyl(0.032, 0.045, -0.12, 0.9, 0x7a4e2a)); g.add(wpCyl(0.05, 0.05, 0.84, 0.9, 0x5e3a1c)); }
  else if (type === 'pentungan') { g.add(wpCyl(0.03, 0.03, -0.1, 0.6, 0x202225)); g.add(wpCyl(0.034, 0.034, -0.1, 0.1, 0x555a60)); const h = wpCyl(0.018, 0.018, -0.04, 0.2, 0x202225); h.rotation.z = Math.PI / 2; h.position.set(0.1, 0.16, 0); g.add(h); }
  else { g.add(wpCyl(0.018, 0.018, -0.1, 0.7, 0xb08a52)); const hd = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.09), wpMat(0xc9a64a)); hd.position.y = 0.78; g.add(hd); const bn = wpCyl(0.03, 0.03, 0.66, 0.7, 0x333333); g.add(bn); }
  g.traverse(m => { if (m.isMesh) m.frustumCulled = false; });
  return g;
}

export function createWeapons(scene, ctx) {
  const { player, ground, blocked, collider } = ctx, toast = ctx.toast || (() => {}), sfx = ctx.sfx, canAct = ctx.canAct || (() => true);
  const api = { held: null, uses: 0, pickups: [] }; let t = 0, want = false, lastNear = null, heldMesh = null, label = '';
  const ringGeo = new THREE.RingGeometry(0.5, 0.72, 24), ringMat = new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide });
  const free = (x, z) => !blocked(x, z) && !(collider && collider.hit && collider.hit(x, z, 0.5));
  function findFree(x, z) { if (free(x, z)) return [x, z]; for (let r = 1.5; r <= 12; r += 1.5) for (let k = 0; k < 8; k++) { const a = k * 0.785, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r; if (free(px, pz)) return [px, pz]; } return null; }
  function addPickup(type, x, z, uses, fixed) {
    const g = new THREE.Group(), w = wpMesh(type), ring = new THREE.Mesh(ringGeo, ringMat);
    w.rotation.z = Math.PI / 2; w.position.set(-0.3, 0.1, 0); g.add(w); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);   // senjata tergeletak
    g.position.set(x, Math.max(0, ground(x, z)), z); g.rotation.y = Math.random() * 6.28; scene.add(g);
    const p = { type, g, ring, x, z, uses: uses || WP_DEFS[type].uses, alive: true, fixed: !!fixed, rt: 0, life: WP_DYN_LIFE, ph: Math.random() * 6 }; api.pickups.push(p); return p;
  }
  function removePickup(p) { scene.remove(p.g); const i = api.pickups.indexOf(p); if (i >= 0) api.pickups.splice(i, 1); }
  for (const s of WP_SPAWNS) { const f = findFree(s[1], s[2]); if (f) addPickup(s[0], f[0], f[1], 0, true); }
  console.log(`[weapons] ${api.pickups.length} senjata di dunia`);

  const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _rest = new THREE.Vector3(0, -0.9, -0.39).normalize();
  function attach(type, uses) {
    heldMesh = wpMesh(type); api.held = type; api.uses = uses;
    const hand = player.getObjectByName('RightHand');
    if (hand) {   // karakter Kenney: hitung rotasi lokal tulang supaya batang menunjuk ke arah diam (bawah-belakang, di kerangka holder)
      player.updateMatrixWorld(true); hand.add(heldMesh); hand.getWorldScale(_v); heldMesh.scale.setScalar(1 / (_v.x || 1));
      player.getWorldQuaternion(_q1); hand.getWorldQuaternion(_q2); const dir = _rest.clone().applyQuaternion(_q1); const qd = new THREE.Quaternion().setFromUnitVectors(_up, dir);
      heldMesh.quaternion.copy(_q2.invert().multiply(qd));
    } else {      // karakter procedural: ujung lengan kanan
      const arm = player.getObjectByName('armR'); (arm || player).add(heldMesh); heldMesh.position.set(0, arm ? -0.55 : 0.9, 0.05); heldMesh.rotation.x = Math.PI + 0.4;
    }
    console.log(`[weapons] pegang ${type} (${uses}x)`);
  }
  function detach() { if (heldMesh && heldMesh.parent) heldMesh.parent.remove(heldMesh); heldMesh = null; api.held = null; api.uses = 0; }
  function dropHeld() {
    if (!api.held) return; const type = api.held, uses = api.uses, yaw = player.rotation.y, x = player.position.x + Math.sin(yaw) * 0.9, z = player.position.z + Math.cos(yaw) * 0.9, f = free(x, z) ? [x, z] : [player.position.x, player.position.z];
    detach(); dynAdd(type, f[0], f[1], uses);
  }
  function dynAdd(type, x, z, uses) { const dyn = api.pickups.filter(p => !p.fixed); if (dyn.length >= WP_MAX_DYN) removePickup(dyn[0]); return addPickup(type, x, z, uses, false); }
  api.dropAt = (x, z, type) => { if (api.pickups.some(p => p.alive && p.type === type && Math.hypot(p.x - x, p.z - z) < 3)) return; const f = findFree(x, z); if (f) dynAdd(type, f[0], f[1], 0); };
  api.lose = (confiscate) => { if (!api.held) return; if (confiscate) { detach(); toast('Weapon confiscated!'); } else { dropHeld(); } };
  api.stats = () => (api.held ? WP_DEFS[api.held] : null);
  api.use = () => { if (!api.held) return false; if (--api.uses > 0) return false; const n = WP_DEFS[api.held].name; detach(); toast(n + ' broke!'); if (sfx && sfx.crash) sfx.crash(0.4); console.log('[weapons] patah'); return true; };

  const touchy = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
  const btn = document.createElement('div'); btn.style.cssText = 'position:fixed;z-index:50;right:200px;bottom:104px;width:60px;height:60px;border-radius:50%;background:#d9a03acc;color:#fff;font:bold 12px sans-serif;display:none;align-items:center;justify-content:center;user-select:none;touch-action:none'; document.body.appendChild(btn);
  btn.addEventListener('touchstart', e => { want = true; e.preventDefault(); e.stopPropagation(); }, { passive: false }); btn.addEventListener('click', () => { want = true; });
  addEventListener('keydown', e => { if (e.code === 'KeyG' && !e.repeat) want = true; });

  api.update = (dt) => {
    t += dt; const px = player.position.x, pz = player.position.z, act = canAct(); let near = null, bd = WP_GRAB_R;
    for (let i = api.pickups.length - 1; i >= 0; i--) {
      const p = api.pickups[i];
      if (!p.alive) { if ((p.rt -= dt) <= 0) { p.alive = true; p.g.visible = true; } continue; }
      if (!p.fixed && (p.life -= dt) <= 0) { removePickup(p); continue; }
      p.ring.scale.setScalar(1 + 0.12 * Math.sin(t * 3 + p.ph));
      if (act) { const d = Math.hypot(p.x - px, p.z - pz); if (d < bd) { bd = d; near = p; } }
    }
    if (near !== lastNear) { lastNear = near; if (near) toast(`${WP_DEFS[near.type].name} - ${touchy ? 'tap GRAB' : 'press G'} to take`); }
    if (want) {
      want = false;
      if (act) { if (near) { if (api.held) dropHeld(); const type = near.type, uses = near.uses; if (near.fixed) { near.alive = false; near.rt = WP_RESPAWN; near.g.visible = false; } else removePickup(near); attach(type, uses); if (sfx && sfx.thud) sfx.thud(); } else if (api.held) { dropHeld(); } }
    }
    const lb = !act ? '' : near ? 'GRAB' : api.held ? 'DROP' : ''; if (lb !== label) { label = lb; btn.style.display = lb && touchy ? 'flex' : 'none'; btn.textContent = lb; }
  };
  return api;
}
