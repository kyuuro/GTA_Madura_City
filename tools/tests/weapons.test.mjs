import * as THREE from 'three';
globalThis.window = globalThis; globalThis.matchMedia = () => ({ matches: false }); globalThis.addEventListener = (t, f) => { (globalThis.__ev ||= []).push([t, f]); };
const mkEl = () => ({ style: {}, addEventListener() {}, textContent: '' }); globalThis.document = { createElement: mkEl, body: { appendChild() {} } };
const { createWeapons } = await import('./src/weapons.js');
const log = console.log; let fails = 0; const ok = (c, m) => { if (!c) { fails++; log('GAGAL:', m); } else log('ok:', m); };
console.log = () => {};
const scene = new THREE.Group();
// player = holder dengan tangan; rotasi dunia holder (yaw 70 derajat) dan tangan (acak) -> uji matematika orientasi
const player = new THREE.Group(); player.position.set(0, 0, 0); player.rotation.y = 1.2;
const yaw = (a) => new THREE.Quaternion().setFromAxisAngle({ x: 0, y: 1, z: 0 }, a);
player.wq = yaw(1.2); const hand = new THREE.Group(); hand.name = 'RightHand'; hand.ws = 0.012; hand.wq = yaw(1.2).multiply(new THREE.Quaternion().setFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.4)).multiply(new THREE.Quaternion().setFromAxisAngle({ x: 0, y: 0, z: 1 }, 2.1)); player.add(hand);
let toasts = [], held = false, canAct = true; const sfx = { thud() {}, crash() {} };
const w = createWeapons(scene, { player, ground: () => 0, blocked: (x, z) => x > 5000, collider: { hit: (x, z) => Math.hypot(x - 4, z - 14) < 1 }, toast: m => toasts.push(m), sfx, canAct: () => canAct });
const fix = w.pickups.filter(p => p.fixed); ok(fix.length === 7, '7 titik senjata tetap (ada ' + fix.length + ')');
ok(fix.every(p => !(Math.hypot(p.x - 4, p.z - 14) < 1)), 'senjata tidak muncul di dalam collider');
// dekati pickup pertama lalu tekan G
player.position.set(fix[0].x + 0.5, 0, fix[0].z); w.update(0.016); ok(toasts.some(t => /take/.test(t)), 'toast "take" muncul saat dekat: ' + toasts[0]);
globalThis.__ev.find(e => e[0] === 'keydown')[1]({ code: 'KeyG', repeat: false }); w.update(0.016);
ok(w.held === fix[0].type && w.uses > 0 && !fix[0].alive, 'G memungut ' + w.held + ' (' + w.uses + 'x), titik tetap kosong');
// orientasi: sumbu +Y mesh di dunia = arah diam di kerangka holder
const mesh = hand.children[0]; const qWorld = hand.wq.clone().multiply(mesh.quaternion); const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(qWorld);
const want = new THREE.Vector3(0, -0.9, -0.39).normalize().applyQuaternion(player.wq); ok(dir.dot(want) > 0.9999, 'orientasi batang di tangan = arah diam (dot ' + dir.dot(want).toFixed(5) + ')');
ok(Math.abs(mesh.scale.x - 1 / 0.012) < 1e-6, 'skala mesh mengkompensasi skala tulang');
// stats & durabilitas
const st = w.stats(); ok(st && st.dmg >= 1.5, 'stats() -> ' + st.name); const n0 = w.uses; let broke = false; for (let i = 0; i < n0; i++) broke = w.use();
ok(broke && w.held === null && toasts.some(t => /broke/.test(t)), 'senjata patah setelah ' + n0 + ' pukulan'); ok(hand.children.length === 0, 'mesh dilepas dari tangan');
// respawn titik tetap
for (let i = 0; i < 100; i++) w.update(1); ok(fix[0].alive, 'titik tetap muncul lagi setelah 90 dtk');
// tukar senjata + drop + lose
player.position.set(fix[1].x + 0.3, 0, fix[1].z); w.update(0.016); globalThis.__ev.find(e => e[0] === 'keydown')[1]({ code: 'KeyG' }); w.update(0.016); const t1 = w.held; ok(!!t1, 'pungut senjata kedua ' + t1);
globalThis.__ev.find(e => e[0] === 'keydown')[1]({ code: 'KeyG' }); w.update(0.016);
// setelah drop di depan kaki, titik tetap fix[1] masih kosong => G kedua dekat pickup dinamis akan memungut lagi (near). Uji lose():
const dyn0 = w.pickups.filter(p => !p.fixed).length; 
if (!w.held) { globalThis.__ev.find(e => e[0] === 'keydown')[1]({ code: 'KeyG' }); w.update(0.016); }
ok(!!w.held, 'memegang senjata sebelum lose'); const dynB = w.pickups.filter(p => !p.fixed).length; w.lose(false); w.update(0.016); ok(w.held === null && w.pickups.filter(p => !p.fixed).length === dynB + 1, 'WASTED: senjata jatuh jadi pickup dinamis');
globalThis.__ev.find(e => e[0] === 'keydown')[1]({ code: 'KeyG' }); w.update(0.016); ok(!!w.held, 'senjata jatuh bisa dipungut lagi'); w.lose(true); ok(w.held === null && toasts.includes('Weapon confiscated!'), 'BUSTED: senjata disita');
// dropAt (petugas KO) + batas dinamis + tidak dobel
const before = w.pickups.length; w.dropAt(20, 20, 'pentungan'); w.dropAt(20.5, 20, 'pentungan'); ok(w.pickups.length === before + 1, 'dropAt tidak menduplikasi dalam 3 m');
for (let i = 0; i < 15; i++) w.dropAt(30 + i * 5, -20, 'kayu'); ok(w.pickups.filter(p => !p.fixed).length <= 10, 'pickup dinamis dibatasi 10');
// tidak bisa memungut saat naik kendaraan
canAct = false; player.position.set(fix[2].x, 0, fix[2].z); w.update(0.016); globalThis.__ev.find(e => e[0] === 'keydown')[1]({ code: 'KeyG' }); w.update(0.016); ok(w.held === null, 'canAct=false memblok pungut');
console.log = log; log(fails ? fails + ' GAGAL' : 'SEMUA TES LULUS'); process.exit(fails ? 1 : 0);
