// Iterasi 6: kendaraan (motor, mobil, angkot). Model procedural (fallback) + loadModel('motor'|'car'|'angkot') kalau ada assets/<n>.glb.
// Fisika arcade 2D + pitch mengikuti tanah. Masuk/keluar: tombol F (PC) atau tombol ENTER/EXIT di layar (HP).
// Konvensi: depan model = +Z, arah maju = (sin h, cos h). Roda diberi nama wheel*, garpu motor bernama 'fork'.
import * as THREE from 'three';
import { loadModel } from './assets.js';
import { makeCharacter, SKINS } from './character.js';

const vMat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6, metalness: 0.2 }, o));
const vBox = (w, h, d, c, x, y, z, o) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), vMat(c, o)); m.position.set(x, y, z); m.castShadow = true; return m; };
const vLamp = (w, h, c, x, y, z) => vBox(w, h, 0.06, c, x, y, z, { emissive: c, emissiveIntensity: 0.9 });
function vWheel(name, r, w, x, y, z) {
  const g = new THREE.CylinderGeometry(r, r, w, 14); g.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(g, vMat(0x1a1a1a, { roughness: 0.9, metalness: 0 })); m.name = name; m.position.set(x, y, z); m.castShadow = true;
  m.add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, r * 0.55, r * 0.3), vMat(0x9a9a9a))); // "pelek" supaya putaran terlihat
  return m;
}

export function makeMotor() { // skuter matic ala Beat/Vario
  const g = new THREE.Group();
  g.add(vBox(0.34, 0.1, 0.7, 0x222222, 0, 0.32, 0.05));
  g.add(vBox(0.4, 0.42, 0.75, 0xd32f2f, 0, 0.58, -0.55));
  g.add(vBox(0.3, 0.1, 0.55, 0x111111, 0, 0.82, -0.35));
  const cowl = vBox(0.4, 0.6, 0.22, 0xd32f2f, 0, 0.68, 0.55); cowl.rotation.x = -0.25; g.add(cowl);
  g.add(vLamp(0.2, 0.08, 0xff2222, 0, 0.7, -0.93));
  const fork = new THREE.Group(); fork.name = 'fork'; fork.position.set(0, 0, 0.85);
  const bar = vBox(0.06, 0.8, 0.06, 0x888888, 0, 0.62, -0.08); bar.rotation.x = 0.2;
  fork.add(vWheel('wheelF', 0.28, 0.12, 0, 0.28, 0), bar, vBox(0.72, 0.05, 0.06, 0x111111, 0, 1.0, -0.14), vLamp(0.18, 0.14, 0xfff2b0, 0, 0.88, 0.06));
  g.add(fork, vWheel('wheelR', 0.28, 0.14, 0, 0.28, -0.62));
  return g;
}
export function makeCar() { // sedan
  const g = new THREE.Group(), C = 0x2f6fd0;
  g.add(vBox(1.8, 0.55, 4.1, C, 0, 0.62, 0), vBox(1.5, 0.5, 2.0, C, 0, 1.15, -0.2), vBox(1.54, 0.3, 1.7, 0x1b2a38, 0, 1.18, -0.2, { metalness: 0.6, roughness: 0.2 }), vBox(1.5, 0.06, 1.6, C, 0, 1.42, -0.2));
  g.add(vBox(1.82, 0.14, 0.14, 0x222222, 0, 0.42, 2.0), vBox(1.82, 0.14, 0.14, 0x222222, 0, 0.42, -2.0));
  for (const s of [-1, 1]) g.add(vLamp(0.4, 0.16, 0xfff2b0, s * 0.6, 0.72, 2.07), vLamp(0.4, 0.14, 0xff2222, s * 0.6, 0.72, -2.07));
  [['wheelFL', -1, 1.3], ['wheelFR', 1, 1.3], ['wheelRL', -1, -1.3], ['wheelRR', 1, -1.3]].forEach(([n, s, z]) => g.add(vWheel(n, 0.34, 0.25, s * 0.92, 0.34, z)));
  return g;
}
export function makeAngkot() { // minibus angkot (biru + strip kuning)
  const g = new THREE.Group(), C = 0x2a63c9;
  g.add(vBox(1.85, 0.9, 4.3, C, 0, 0.8, 0), vBox(1.8, 0.85, 3.4, C, 0, 1.68, -0.4), vBox(1.84, 0.4, 3.0, 0x1b2a38, 0, 1.75, -0.4, { metalness: 0.6, roughness: 0.2 }));
  g.add(vBox(1.82, 0.08, 3.42, 0xeeeeee, 0, 2.14, -0.4), vBox(1.87, 0.12, 4.32, 0xffd23a, 0, 0.72, 0), vBox(0.6, 0.2, 0.3, 0xffd23a, 0, 2.28, 0.8));
  for (const s of [-1, 1]) g.add(vLamp(0.35, 0.16, 0xfff2b0, s * 0.65, 0.9, 2.17), vLamp(0.3, 0.2, 0xff2222, s * 0.7, 0.95, -2.17));
  [['wheelFL', -1, 1.4], ['wheelFR', 1, 1.4], ['wheelRL', -1, -1.4], ['wheelRR', 1, -1.4]].forEach(([n, s, z]) => g.add(vWheel(n, 0.38, 0.26, s * 0.95, 0.38, z)));
  return g;
}

// max/acc/brk dalam m/s & m/s^2; steer rad/s; r = radius tabrakan; cam = jarak kamera
const VEH = {
  motor: { make: makeMotor, max: 24, acc: 12, brk: 22, steer: 2.4, r: 1.0, rev: 5, wr: 0.34, cam: 9.5, rider: true },
  // iter 79: Honda Beat & Yamaha Mio. seat = [y, z] pengendara di jok (dihitung dari tinggi jok & jarak stang tiap model relatif ke Scoopy, lihat tools/prep_motor2.py)
  beat: { make: makeMotor, max: 23, acc: 11.5, brk: 22, steer: 2.5, r: 1.0, rev: 5, wr: 0.34, cam: 9.5, rider: true },
  mio: { make: makeMotor, max: 25, acc: 12.5, brk: 22, steer: 2.4, r: 1.0, rev: 5, wr: 0.34, cam: 9.5, rider: true },
  car: { make: makeCar, max: 32, acc: 9, brk: 20, steer: 1.7, r: 1.6, rev: 8, wr: 0.34, cam: 10 },
  angkot: { make: makeAngkot, max: 18, acc: 5.5, brk: 14, steer: 1.35, r: 1.9, rev: 5, wr: 0.38, cam: 11 },
  // iterasi 15 (model dari vehicles-pack; fallback procedural = sedan kalau .glb tidak ada)
  taxi: { make: makeCar, max: 30, acc: 8.5, brk: 20, steer: 1.7, r: 1.6, rev: 8, wr: 0.34, cam: 10 },
  hatch: { make: makeCar, max: 30, acc: 9.5, brk: 20, steer: 1.9, r: 1.4, rev: 8, wr: 0.30, cam: 9 },
  pickup: { make: makeCar, max: 27, acc: 7.5, brk: 18, steer: 1.5, r: 1.8, rev: 6, wr: 0.39, cam: 11 },
  suv: { make: makeCar, max: 29, acc: 8, brk: 19, steer: 1.55, r: 1.75, rev: 7, wr: 0.36, cam: 11 },
  sedan: { make: makeCar, max: 31, acc: 8.5, brk: 20, steer: 1.7, r: 1.6, rev: 8, wr: 0.34, cam: 10 },
  sports: { make: makeCar, max: 36, acc: 11, brk: 22, steer: 1.9, r: 1.5, rev: 8, wr: 0.33, cam: 10 },
  muscle: { make: makeCar, max: 34, acc: 10, brk: 20, steer: 1.6, r: 1.7, rev: 8, wr: 0.36, cam: 10 },
  truck: { make: makeCar, max: 24, acc: 5, brk: 15, steer: 1.2, r: 2.1, rev: 5, wr: 0.45, cam: 12 },
  police: { make: makeCar, max: 34, acc: 10, brk: 21, steer: 1.75, r: 1.6, rev: 8, wr: 0.34, cam: 10 },
  polsuv: { make: makeCar, max: 32, acc: 9, brk: 20, steer: 1.6, r: 1.75, rev: 7, wr: 0.36, cam: 11 },
  ambulance: { make: makeCar, max: 28, acc: 7, brk: 17, steer: 1.4, r: 1.9, rev: 6, wr: 0.38, cam: 12 },
  becak: { make: makeCar, max: 7, acc: 3, brk: 9, steer: 1.6, r: 1.3, rev: 2, wr: 0.3, cam: 7 },   // iter 30: kayuh, pelan
  firetruck: { make: makeCar, max: 22, acc: 4.5, brk: 14, steer: 1.0, r: 2.6, rev: 5, wr: 0.5, cam: 14 },
  // iter 35: batch 4
  muscle2: { make: makeCar, max: 34, acc: 10, brk: 20, steer: 1.6, r: 1.7, rev: 8, wr: 0.36, cam: 10 },
  polmuscle: { make: makeCar, max: 35, acc: 10.5, brk: 21, steer: 1.65, r: 1.7, rev: 8, wr: 0.36, cam: 10 },
  polsports: { make: makeCar, max: 37, acc: 11, brk: 22, steer: 1.9, r: 1.5, rev: 8, wr: 0.33, cam: 10 },
  roadster: { make: makeCar, max: 36, acc: 11, brk: 22, steer: 1.9, r: 1.5, rev: 8, wr: 0.33, cam: 10 },
  monster: { make: makeCar, max: 26, acc: 6.5, brk: 16, steer: 1.3, r: 2.3, rev: 5, wr: 0.7, cam: 12 },
  limo: { make: makeCar, max: 26, acc: 6, brk: 16, steer: 1.0, r: 2.4, rev: 5, wr: 0.36, cam: 13 },
  bus: { make: makeCar, max: 20, acc: 4, brk: 13, steer: 0.9, r: 2.8, rev: 4, wr: 0.62, cam: 15 },   // iter 37
  trailer: { make: makeCar, max: 18, acc: 3.5, brk: 12, steer: 0.7, r: 3.2, rev: 4, wr: 0.5, cam: 16 },   // iter 38
};
// iter 45: nama tampil di toast saat pemain mendekati kendaraan
// iter 79: pose duduk per motor, koordinat LOKAL motor (y atas, z depan). Diukur dari mesh GLB (lihat STATE iter 79): y = tinggi tempat holder pengendara berdiri (pinggul = y + 0.824; pantat menempel
// jok: y = tinggi jok - 0.64, hasil simulasi FK pose Idle+IK), z = posisi pinggul di jok; foot = target pergelangan kaki (lantai/pijakan + 0.08), grip = target tangan (stang), lean = condong badan (rad). Boncengan = z - SEAT_PILLION_DZ.
// Pose dihitung IK saat spawn (retro.js sit(P)). BELUM dilihat di render nyata: kalau melayang/tenggelam di jok ubah y (+/- 0.03), kalau tangan jauh dari stang ubah grip.
const SEATS = {
  motor: { y: 0.18, z: -0.30, foot: [0.42, 0.08], grip: [1.00, 0.38], lean: 0.30 },
  beat: { y: 0.19, z: -0.38, foot: [0.42, 0.00], grip: [1.02, 0.25], lean: 0.30 },
  mio: { y: 0.16, z: -0.30, foot: [0.38, 0.05], grip: [1.05, 0.33], lean: 0.30 },
};
const SEAT_PILLION_DZ = 0.38;
const RIDER_SKINS = ['humanMaleA', 'humanFemaleA', 'survivorMaleB', 'survivorFemaleA'], HELM_COLORS = [0x1faa59, 0x111111, 0xd9423a, 0xeeeeee, 0x3a6fd9, 0xe8c13a, 0xff8a2a, 0x7a4fd1];
const vPick = (a) => a[Math.floor(Math.random() * a.length)];
const riderOpts = () => { const r = Math.random(); return { hat: r < 0.62 ? 'helm' : r < 0.9 ? 'none' : 'peci', hatColor: vPick(HELM_COLORS), variant: vPick(RIDER_SKINS), shirt: 0xd9423a, skin: SKINS[1] }; };   // ~60% berhelm, sisanya tanpa helm / peci (ala jalanan Indonesia)
const VEH_NAMES = { motor: 'Honda Scoopy', beat: 'Honda Beat', mio: 'Yamaha Mio', car: 'Sedan', angkot: 'Angkot', taxi: 'Taxi', hatch: 'Hatchback', pickup: 'Pickup', suv: 'SUV', sedan: 'Sedan', sports: 'Sports car', muscle: 'Muscle car', muscle2: 'Muscle car', truck: 'Truck', police: 'Police car', polsuv: 'Police SUV', polmuscle: 'Police muscle car', polsports: 'Police sports car', ambulance: 'Ambulance', firetruck: 'Fire truck', becak: 'Becak', roadster: 'Roadster', monster: 'Monster truck', limo: 'Limo', bus: 'Bus', trailer: 'Trailer truck' };
// [tipe, x, z, heading]  (h=0 menghadap +Z). Dekat titik teleport supaya gampang dites.
const VEH_SPAWNS = [
  ['motor', 3.5, 16, 0], ['angkot', -3.5, 36, 0], ['car', 3.5, 52, 0], ['motor', -4, 8, 0.3],   // Spawn (Jl. Pahlawan)
  ['beat', -4, 22, 0.2], ['mio', 4, 27, -0.2],   // iter 79: Beat & Mio parkir di Spawn
  ['taxi', -3.5, 64, 0], ['pickup', 3.5, 76, 0], ['hatch', -3.5, 88, 0],
  ['sedan', 3.5, 100, 0], ['sports', -3.5, 112, 0], ['muscle', 3.5, 124, 0], ['truck', -3.5, 138, 0],
  ['police', 3.5, 150, 0], ['polsuv', -3.5, 162, 0], ['ambulance', 3.5, 174, 0], ['firetruck', -3.5, 190, 0], ['becak', 3.5, 204, 0], ['becak', -3.5, 214, 0],
  ['muscle2', 3.5, 230, 0], ['polmuscle', -3.5, 244, 0], ['polsports', 3.5, 258, 0], ['roadster', -3.5, 270, 0], ['monster', 3.5, 284, 0], ['limo', -3.5, 300, 0], ['bus', 3.5, 322, 0], ['trailer', -3.5, 346, 0],   // iterasi 35   // iterasi 29   // iterasi 28: batch 2 vehicles-pack                         // Spawn: variasi baru (iterasi 15)
  ['car', -1640, -560, 0], ['motor', -1700, -548, 1.57], ['mio', -1694, -552, 1.3],                                          // Perak (iter 55)
  ['motor', 899, 1396, 0], ['beat', 894, 1404, 0.4], ['car', 911, 1424, 0], ['becak', 903, 1452, 0],                       // Kenjeran Park (iter 54)
  ['car', 343, -64, Math.PI], ['angkot', 332, -72, Math.PI], ['motor', 338, -50, Math.PI],       // akses Suramadu
  ['pickup', 343, -2095, 0], ['becak', 334, -2112, 0.3], ['motor', 338, -2130, 0], ['angkot', 343, -2150, Math.PI],   // iter 53: desa Madura (kendaraan jadul/sedikit)
];

export async function createVehicles(scene, ctx) {
  const { ground, blocked, collider } = ctx, list = [], touchy = matchMedia('(pointer:coarse)').matches;
  const api = { list, driving: null, speed: 0 };
  let want = false;
  let lastNear = null, justLeft = null, tclock = 0, lastToast = -9;   // iter 45: toast 'dekat kendaraan'
  api.onNear = null;   // dipasang main.js: (pesan, kendaraan) => toast

  async function spawn(type, x, z, h) {
    const T = VEH[type];
    if (blocked(x, z)) { console.log(`[vehicles] ${type} @${x},${z} di air, dilewati`); return null; }
    const obj = await loadModel(type, T.make); obj.rotation.order = 'YXZ'; scene.add(obj);
    const v = { type, T, obj, h, sp: 0, steer: 0, pitch: 0, rider: null, wheels: (() => { const w = []; obj.traverse(o => { if (/^wheel/.test(o.name)) w.push(o); }); return w; })(), fork: obj.getObjectByName('fork') };   // iter 38: wheels = semua pivot bernama wheel* (truk gandeng punya 12)
    if (T.rider) { // pengendara duduk (hanya tampil saat dikendarai)
      const S = SEATS[type] || SEATS.motor;
      const seat = (ch, dz, P) => {   // posisi di jok (koordinat lokal motor), lalu pose duduk IK SEBELUM dimasukkan ke motor (retro.js sit)
        ch.position.set(0, S.y, S.z - dz); ch.position.y += ch.userData.sitLift || 0;   // iter 76: pengendara kerdil diangkat ke jok
        if (ch.userData.sit) ch.userData.sit(P);
        else { ch.getObjectByName('legL').rotation.x = ch.getObjectByName('legR').rotation.x = -1.25; ch.getObjectByName('armL').rotation.x = ch.getObjectByName('armR').rotation.x = -1.1; }   // fallback procedural
      };
      const r = makeCharacter(riderOpts()); r.visible = false; seat(r, 0, { foot: S.foot, grip: S.grip, lean: S.lean });   // iter 46/79: karakter Kenney, variasi skin + helm
      const pl = makeCharacter(riderOpts()); seat(pl, SEAT_PILLION_DZ, { foot: [S.foot[0] + 0.08, S.foot[1] - 0.3], grip: [S.y + 0.95, S.z - 0.22], lean: 0.12 });   // iter 79: penumpang boncengan, tangan di pinggang pengemudi
      const rs = r.scale.x || 1; r.add(pl); pl.position.set(0, 0, -SEAT_PILLION_DZ / rs); pl.scale.setScalar(1); pl.visible = false;   // anak si pengemudi: ikut tampil/hilang bersamanya (satpol/damage/npcs hanya mengatur rider.visible); skala dunia sama
      obj.add(r); v.rider = r; v.pillion = pl; v.pillionOn = false;
      // iter 83: saat PEMAIN naik, yang tampil harus model pemain sendiri (npc_ndas, tanpa helm), bukan pengendara acak (Kenney + helm). Dibuat malas (sekali, saat pertama dinaiki) supaya tidak menambah 17 rb segitiga per motor.
      // iter 85: motor pengejar Satpol dulu memakai pengendara ACAK (baju sipil + helm warna-warni) -> tampak seperti warga sipil mengejar. Sekarang petugas berseragam (model polisi) menggantikan pengendara bawaan; tanpa boncengan.
      v.mkCopRider = () => { const c = makeCharacter({ hat: 'satpol', rider: true, skin: SKINS[1] }); c.visible = false; seat(c, 0, { foot: S.foot, grip: S.grip, lean: S.lean }); if (v.rider) obj.remove(v.rider); obj.add(c); v.rider = c; v.pillion = null; v.pillionOn = false; return c; };
      v.pRider = null; v.mkPlayerRider = () => { if (v.pRider) return v.pRider; const c = makeCharacter({ hat: 'none', shirt: 0xd9423a, skin: SKINS[1], player: true }); c.visible = false; seat(c, 0, { foot: S.foot, grip: S.grip, lean: S.lean }); obj.add(c); return v.pRider = c; };
    }
    obj.position.set(x, ground(x, z), z); obj.rotation.y = h; collider.resolve(obj.position, T.r);
    v.home = [x, z, h]; list.push(v); return v;
  }
  for (const s of VEH_SPAWNS) await spawn(s[0], s[1], s[2], s[3]);
  console.log(`[vehicles] ${list.length} kendaraan siap`);

  function step(v, dt, thr, str, turbo, driven) {
    const T = v.T, o = v.obj.position;
    if (!driven && Math.abs(v.sp) < 0.02) { v.sp = 0; return; }
    const max = T.max * (turbo ? 1.3 : 1);
    if (thr > 0.05) { if (v.sp < max) v.sp = Math.min(max, v.sp + (v.sp < 0 ? T.brk : T.acc) * thr * dt); }
    else if (thr < -0.05) v.sp -= (v.sp > 0 ? T.brk : T.acc * 0.7) * -thr * dt;
    else v.sp -= Math.sign(v.sp) * Math.min(Math.abs(v.sp), (driven ? 4 : 10) * dt);
    if (v.sp > max) v.sp = Math.max(max, v.sp - 8 * dt);
    v.sp = Math.max(-T.rev, v.sp);
    const k = Math.max(-1, Math.min(1, v.sp / (T.max * 0.3))) * (1 - 0.45 * Math.min(1, Math.abs(v.sp) / T.max));
    v.h -= str * T.steer * k * dt; v.steer += (str - v.steer) * Math.min(1, dt * 8);
    const px = o.x, pz = o.z, fx = Math.sin(v.h), fz = Math.cos(v.h);
    o.x += fx * v.sp * dt; o.z += fz * v.sp * dt;
    if (collider.resolve(o, T.r)) { if (v === api.driving && Math.abs(v.sp) > 7 && api.onCrash) api.onCrash(Math.min(1, Math.abs(v.sp) / 25)); v.sp *= Math.max(0, 1 - 12 * dt); }                 // nabrak gedung: pelan + geser
    if (blocked(o.x, o.z) || blocked(o.x + fx * T.r, o.z + fz * T.r)) { o.x = px; o.z = pz; v.sp *= -0.2; } // laut = tembok
    const L = T.r * 0.9, yF = ground(o.x + fx * L, o.z + fz * L), yB = ground(o.x - fx * L, o.z - fz * L);
    o.y = (yF + yB) / 2; v.pitch += (-Math.atan2(yF - yB, 2 * L) - v.pitch) * Math.min(1, dt * 10);
    const lean = T.rider ? v.steer * 0.35 * Math.min(1, Math.abs(v.sp) / T.max) * Math.sign(v.sp) : 0;
    v.obj.rotation.set(v.pitch, v.h, lean);
    for (const w of v.wheels) w.rotation.x += v.sp * dt / T.wr;
    if (v.fork) v.fork.rotation.y = -v.steer * 0.4;
  }

  const nearest = (p) => { let b = null, bd = 1e9; for (const v of list) { if (!v.obj.visible) continue; const d = Math.hypot(v.obj.position.x - p.x, v.obj.position.z - p.z) - v.T.r; if (d < 3.5 && d < bd) { b = v; bd = d; } } return b; };
  function enter(v, player) {
    const was = v.ai; api.driving = v; v.ai = false; player.visible = false; if (v.rider) v.rider.visible = false; if (v.mkPlayerRider) v.mkPlayerRider().visible = true; if (v.pillion) v.pillion.visible = false; console.log(`[vehicles] masuk ${v.type}`);   // iter 79: pemain naik sendirian
    if (was && api.onEnter) api.onEnter(v, was); // iterasi 8: bajak = naik wanted
  }
  function leave(player) {
    const v = api.driving, o = v.obj.position, d = v.T.r + 1.0, rx = -Math.cos(v.h), rz = Math.sin(v.h);
    let x = o.x + rx * d, z = o.z + rz * d;
    if (blocked(x, z)) { x = o.x - rx * d; z = o.z - rz * d; }
    if (blocked(x, z)) { x = o.x; z = o.z; }
    player.position.set(x, 0, z); collider.resolve(player.position, 0.45); player.rotation.y = v.h;
    player.visible = true; if (v.rider) v.rider.visible = false; if (v.pRider) v.pRider.visible = false; api.driving = null; justLeft = v; console.log(`[vehicles] keluar ${v.type}`);
  }

  // tombol ENTER/EXIT di layar (HP) + tombol F (PC)
  const btn = document.createElement('div');
  btn.style.cssText = 'position:fixed;z-index:50;right:22px;bottom:172px;width:84px;height:44px;border-radius:10px;background:#1faa59dd;color:#fff;font:bold 14px sans-serif;display:none;align-items:center;justify-content:center;user-select:none;touch-action:none;cursor:pointer;border:2px solid #ffffff88';
  document.body.appendChild(btn);
  btn.addEventListener('touchstart', e => { want = true; e.preventDefault(); e.stopPropagation(); }, { passive: false });
  btn.addEventListener('click', () => { want = true; });
  addEventListener('keydown', e => { if (e.code === 'KeyF' && !e.repeat) want = true; });
  let label = '';

  api.leave = leave; api.enter = enter; api.spawn = spawn; api.step = step; // dipakai npcs.js (lalu lintas AI)
  api.settle = () => { for (const v of list) if (v !== api.driving) collider.resolve(v.obj.position, v.T.r); }; // dipanggil setelah kota dibangun ulang
  api.update = (dt, ctl, player) => {
    const near = api.driving ? null : nearest(player.position);
    tclock += dt;
    if (justLeft && near !== justLeft) justLeft = null;   // sudah menjauh -> boleh di-toast lagi
    if (near !== lastNear) {   // iter 45: baru masuk jangkauan naik (sama dengan munculnya tombol ENTER) -> toast sekali
      lastNear = near;
      if (near && near !== justLeft && api.onNear && Math.abs(near.sp) < 6 && tclock - lastToast > 1.2) {   // kendaraan AI yang melaju kencang tidak di-toast (spam di jalan)
        lastToast = tclock;
        const name = near.satpol ? 'Satpol PP bike' : (VEH_NAMES[near.type] || near.type), key = touchy ? 'tap ENTER' : 'press F';
        api.onNear(`${name} - ${key} to ${near.ai ? 'carjack' : 'ride'}`, near);
      }
    }
    if (want) { want = false; if (api.driving) leave(player); else if (near) enter(near, player); }
    for (const v of list) { if (v.ai) continue; const d = v === api.driving; step(v, dt, d ? ctl.y : 0, d ? ctl.x : 0, d && ctl.run, d); }
    if (api.driving) { const o = api.driving.obj.position; player.position.set(o.x, o.y, o.z); api.speed = Math.abs(api.driving.sp) * 3.6; } else api.speed = 0;
    const want2 = api.driving ? 'EXIT' : near ? 'ENTER' : '';
    if (want2 !== label) { label = want2; btn.style.display = want2 ? 'flex' : 'none'; btn.textContent = want2 + (touchy || !want2 ? '' : ' [F]'); }
  };
  return api;
}
