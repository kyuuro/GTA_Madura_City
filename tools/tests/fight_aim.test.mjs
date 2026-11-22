import { createFight } from './src/fight.js';
const log = console.log; let fails = 0; const ok = (c, m) => { if (!c) { fails++; log('GAGAL:', m); } else log('ok:', m); }; console.log = () => {};
const mkO = (x, z) => ({ visible: true, position: { x, y: 0, z }, rotation: { x: 0, y: 0 }, scale: { x: 1, y: 1, z: 1 }, userData: {} });
function setup(peds, opts = {}) {
  const player = mkO(0, 0); player.rotation.y = opts.yaw || 0; let scares = []; const moves = [];
  const f = createFight({ player, crowd: { peds, scare: (...a) => scares.push(a) }, sfx: { punch() {}, whoosh() {}, oof() {}, thud() {} }, impact: { burst() {} }, satpol: null, traffic: null, weapons: null, canPunch: () => true,
    lunge: (dx, dz) => { player.position.x += dx; player.position.z += dz; moves.push([dx, dz]); } });
  let P = 0; const ctl = { consumePunch: () => { const p = P; P = 0; return p; }, consumeKick: () => false };
  return { f, player, scares, moves, press: () => { P = 1; }, run: (t) => { for (let i = 0; i < Math.round(t / 0.016); i++) f.update(0.016, ctl); } };
}
// sasaran di samping-depan (45 derajat) pada 2,4 m: di luar tinju biasa, tapi auto-aim memutar + lunge sehingga kena
{ const a = Math.PI / 4, ped = { o: mkO(Math.sin(a) * 2.4, Math.cos(a) * 2.4), down: 0, hp: 3, vx: 0, vz: 0 }; const s = setup([ped]); s.press(); s.run(0.02);
  ok(Math.abs(s.player.rotation.y - a) < 1e-6, 'auto-aim menghadap sasaran (yaw ' + s.player.rotation.y.toFixed(3) + ')'); ok(s.f.faceLock > 0, 'faceLock aktif');
  s.run(0.4); ok(ped.hp === 2, 'pukulan kena berkat aim+lunge (hp ' + ped.hp + ')'); const d = Math.hypot(ped.o.position.x - s.player.position.x, ped.o.position.z - s.player.position.z); ok(d < 1.7 && d > 0.9, 'jarak setelah lunge ' + d.toFixed(2) + ' m');
  const tot = s.moves.reduce((a, m) => a + Math.hypot(m[0], m[1]), 0); ok(tot <= 0.8001 && tot > 0.3, 'lunge total ' + tot.toFixed(2) + ' m (<= 0,8)'); ok(s.f.hitstop > 0.05 && s.f.hitstop <= 0.12, 'hitstop ' + s.f.hitstop.toFixed(3)); ok(s.scares.length === 1 && s.scares[0][2] === 14, 'crowd.scare dipanggil radius 14'); }
// sasaran di belakang (>75 derajat): tidak ada aim, tidak ada lunge
{ const ped = { o: mkO(0, -2.0), down: 0, hp: 3, vx: 0, vz: 0 }; const s = setup([ped]); s.press(); s.run(0.4); ok(s.player.rotation.y === 0 && s.moves.length === 0 && ped.hp === 3 && s.scares.length === 0, 'sasaran di belakang: tanpa aim/lunge/scare'); }
// terlalu jauh (> jangkauan+1): tidak lunge
{ const ped = { o: mkO(0, 3.5), down: 0, hp: 3, vx: 0, vz: 0 }; const s = setup([ped]); s.press(); s.run(0.4); ok(s.moves.length === 0 && ped.hp === 3, 'sasaran 3,5 m: di luar aim (jangkauan 1,7+1)'); }
// dua sasaran: pilih yang lebih lurus & dekat
{ const near = { o: mkO(1.9, 0.6), down: 0, hp: 3, vx: 0, vz: 0 }, str = { o: mkO(0, 2.2), down: 0, hp: 3, vx: 0, vz: 0 }; const s = setup([near, str]); s.press(); s.run(0.4); ok(str.hp === 2 && near.hp === 3, 'memilih sasaran yang lurus di depan'); }
// hit-stop pada finisher lebih lama
{ const ped = { o: mkO(0, 1.2), down: 0, hp: 9, vx: 0, vz: 0 }; const s = setup([ped]); s.press(); s.run(0.2); const h1 = s.f.hitstop; s.f.hitstop = 0; s.run(0.25); ped.down = 0; s.press(); s.run(0.3); ped.down = 0; s.f.hitstop = 0; s.press(); s.run(0.25); ok(s.f.hitstop > h1 && s.f.hitstop <= 0.12, 'hitstop finisher ' + s.f.hitstop.toFixed(3) + ' > pukulan ' + h1.toFixed(3)); }
console.log = log; log(fails ? fails + ' GAGAL' : 'SEMUA TES LULUS'); process.exit(fails ? 1 : 0);
