import { createFight } from './src/fight.js';
const log = console.log; let fails = 0; const ok = (c, m) => { if (!c) { fails++; log('GAGAL:', m); } else log('ok:', m); }; console.log = () => {};
const mkO = (x, z) => ({ visible: true, position: { x, y: 0, z }, rotation: { x: 0, y: 0 }, scale: { x: 1, y: 1, z: 1 }, userData: {} });
const player = mkO(0, 0); const sf = { punch() {}, whoosh() {}, oof() {}, thud() {} };
function setup(peds, stats, satpol) {
  let uses = 0, drops = []; const weapons = { stats: () => stats, use: () => { uses++; return false; }, dropAt: (x, z, t) => drops.push(t) };
  const f = createFight({ player, crowd: { peds, scare() {} }, sfx: sf, impact: { burst() {} }, satpol: satpol || null, traffic: null, weapons, canPunch: () => true });
  let P = 0; const ctl = { consumePunch: () => { const p = P; P = 0; return p; }, consumeKick: () => false };
  return { f, press: () => { P = 1; }, run: (t) => { for (let i = 0; i < Math.round(t / 0.016); i++) f.update(0.016, ctl); }, get uses() { return uses; }, drops };
}
const ST = { name: 'Wooden stick', dmg: 2, range: 2.2, kn: 1.3, cdMul: 1.0 };
{ const ped = { o: mkO(0, 2.1), down: 0, hp: 3, vx: 0, vz: 0 }; const s = setup([ped], ST); s.press(); s.run(0.3); ok(ped.hp === 1, 'tongkat: jangkauan 2,1 m kena, dmg 2 (hp ' + ped.hp + ')'); ok(s.uses === 1, 'use() dipanggil sekali'); }
{ const ped = { o: mkO(0, 2.1), down: 0, hp: 3, vx: 0, vz: 0 }; const s = setup([ped], null); s.press(); s.run(0.3); ok(ped.hp === 3 && s.uses === 0, 'tanpa senjata: 2,1 m tidak kena, use() tidak dipanggil'); }
{ const ped = { o: mkO(0, 1.2), down: 0, hp: 3, vx: 0, vz: 0 }; const s = setup([ped], ST); s.press(); s.run(0.3); const v = Math.hypot(ped.vx, ped.vz); ok(ped.hp === 1 && v > 4, 'dorongan diperkuat senjata: ' + v.toFixed(1)); }
{ const ped = { o: mkO(0, 1.2), down: 0, hp: 3, vx: 0, vz: 0 }; let heat = 0; const sp = { witness: () => true, report: (a) => { heat = a; }, targets: () => [], brawlT: 0 }; const s = setup([ped], ST, sp); s.press(); s.run(0.3); ok(heat === 16, 'heat saksi dengan senjata = 16 (' + heat + ')'); }
{ const off = { o: mkO(0, 1.2), hp: 2, vx: 0, vz: 0 }; const sp = { targets: () => [off], witness: () => false, report() {}, toast() {}, brawlT: 0, hurt: (f, n, nx, nz) => { f.hp -= n; f.vx = nx; f.vz = nz; return f.hp <= 0; } }; const s = setup([], ST, sp); s.press(); s.run(0.3); ok(off.hp <= 0 && s.drops.includes('pentungan'), 'petugas KO satu pukulan tongkat dan menjatuhkan pentungan'); }
console.log = log; log(fails ? fails + ' GAGAL' : 'SEMUA TES LULUS'); process.exit(fails ? 1 : 0);
