// Iterasi 2: karakter procedural (low-poly, bisa dianimasikan). Dipakai ulang untuk player & NPC.
import * as THREE from 'three';

const M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
export const SKINS = [0xf1c9a0, 0xe0b48a, 0xc68e5e, 0x9a6a42, 0x6b4428];

function limb(len, r, color, name, x, y) { // pivot di ujung atas, supaya ayunan wajar
  const g = new THREE.Group(); g.name = name; g.position.set(x, y, 0);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len - r * 2, 4, 12), M(color));
  m.position.y = -len / 2; m.castShadow = true; g.add(m);
  return g;
}
export let retroMake = null; export function setRetro(fn) { retroMake = fn; }   // iter 26: retro.js memasang pabrik karakter Kenney
export function makeHat(kind, color) {   // iter 79: color = warna helm (opsional)
  const g = new THREE.Group(); g.position.y = 1.95;
  if (kind === 'peci') { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.2, 20), M(0x111111)); h.position.y = 0.1; g.add(h); }
  else if (kind === 'helm') { const h = new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 12, 0, 6.283, 0, 1.5), M(color ?? 0x1faa59)); h.position.y = 0.0; g.add(h); }
  else if (kind === 'satpol') {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.18, 20), M(0xb59a5b)); h.position.y = 0.12;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 20), M(0x2a2a2a)); b.position.set(0, 0.04, 0.1); g.add(h, b);
  }
  else return null;
  return g;
}
// opts: {skin, shirt, pants, hat:'peci'|'helm'|'satpol'|'none', sarung:bool, scale}
export function makeCharacter(o = {}) {
  if (retroMake && !o.proc) return retroMake(o);
  const root = new THREE.Group(), s = o.scale || 1;
  const body = new THREE.Group(); body.name = 'body'; root.add(body);
  const skin = o.skin ?? SKINS[1], shirt = o.shirt ?? 0xd9423a, pants = o.pants ?? 0x2b3a67;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.45, 6, 16), M(shirt));
  torso.position.y = 1.3; torso.scale.z = 0.7; torso.castShadow = true; body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), M(skin));
  head.position.y = 1.9; head.castShadow = true; body.add(head);
  for (const x of [-0.08, 0.08]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), M(0x111111)); e.position.set(x, 1.93, 0.2); body.add(e); }
  const hat = makeHat(o.hat === undefined ? 'peci' : o.hat, o.hatColor); if (hat) body.add(hat);
  body.add(limb(0.75, 0.08, shirt, 'armL', -0.36, 1.58), limb(0.75, 0.08, shirt, 'armR', 0.36, 1.58));
  root.add(limb(0.85, 0.1, pants, 'legL', -0.14, 0.88), limb(0.85, 0.1, pants, 'legR', 0.14, 0.88));
  if (o.sarung) { const sg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.7, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x7a3b2e, side: THREE.DoubleSide })); sg.position.y = 0.6; sg.castShadow = true; root.add(sg); }
  root.scale.setScalar(s); root.userData.phase = 0; root.userData.amp = 0;
  return root;
}
// Panggil tiap frame. moveSpeed = m/s. Mencari bagian lewat nama (aman setelah clone / glb tanpa bagian).
export const PUNCH_T = 0.38;   // iter 69: durasi satu pukulan (dtk)
export const KICK_T = 0.45;   // iter 72b: durasi tendangan (dtk)
export function punchCharacter(c, side) { if (c.userData.punch) c.userData.punch(side); else { c.userData.punchT = PUNCH_T; c.userData.punchL = side === 'L'; } }   // side: 'L' = tangan kiri (kombo ke-2), selain itu kanan
export function kickCharacter(c) { if (c.userData.kick) c.userData.kick(); else c.userData.kickT = KICK_T; }   // retro.js memasang userData.punch; karakter procedural memakai punchT di animateCharacter
export function animateCharacter(c, dt, moveSpeed) {
  if (c.userData.retroAnim) { c.userData.retroAnim(dt, moveSpeed); return; }
  const u = c.userData, aL = c.getObjectByName('armL'), aR = c.getObjectByName('armR'),
    lL = c.getObjectByName('legL'), lR = c.getObjectByName('legR'), b = c.getObjectByName('body');
  u.phase = (u.phase || 0) + dt * (2 + moveSpeed * 1.3);
  const target = Math.min(moveSpeed / 6, 1.4) * 0.8;
  u.amp = (u.amp || 0) + (target - (u.amp || 0)) * Math.min(1, dt * 10);
  const sw = Math.sin(u.phase) * u.amp;
  if (lL) { lL.rotation.x = sw; lR.rotation.x = -sw; }
  if (aL) { aL.rotation.x = -sw * 0.9; aR.rotation.x = sw * 0.9; }
  if (u.punchT > 0 && aR) { u.punchT -= dt; (u.punchL && aL ? aL : aR).rotation.x = -1.5 * Math.sin(Math.PI * (1 - Math.max(0, u.punchT) / PUNCH_T)); }   // iter 69: lengan menonjok ke depan (iter 72b: kiri/kanan)
  if (u.kickT > 0 && lR) { u.kickT -= dt; lR.rotation.x = -1.3 * Math.sin(Math.PI * (1 - Math.max(0, u.kickT) / KICK_T)); }   // iter 72b: tendangan kaki kanan
  if (b) b.position.y = Math.abs(Math.cos(u.phase)) * 0.05 * u.amp + Math.sin(u.phase * 0.5) * 0.008 * (1 - u.amp);
}
