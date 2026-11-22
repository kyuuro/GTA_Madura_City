import { createFight } from './src/fight.js';
import { createImpact } from './src/impact.js';
import { createSFX } from './src/sfx.js';
const log = console.log; let fails = 0; const ok = (c, m) => { if (!c) { fails++; log('GAGAL:', m); } else log('ok:', m); };
console.log = () => {};
const scene = { children: [], add(o) { this.children.push(o); } };
const imp = createImpact(scene); const pts = scene.children[0];
// --- impact
imp.burst(0, 1, 0, 1, 0, 1); imp.update(0.016);
ok(pts.visible && imp.live > 0, 'impact: partikel hidup setelah burst'); 
const arr = pts.geometry.attributes.position.array; ok([...arr].some(v => v > -900) , 'impact: posisi partikel valid');
for (let i = 0; i < 60; i++) imp.update(0.016); ok(!pts.visible && imp.live === 0, 'impact: partikel hilang setelah ~1 dtk');
for (let k = 0; k < 20; k++) imp.burst(0, 1, 0, 0, 0, 2.2); imp.update(0.016); ok(imp.live <= 72, 'impact: kolam tidak melebihi 72 (live ' + imp.live + ')');
// --- sfx aman tanpa audio
const sfx = createSFX(); let thrown = false; try { sfx.punch(2); sfx.whoosh(); sfx.oof(1); } catch (e) { thrown = true; } ok(!thrown, 'sfx: punch/whoosh/oof aman tanpa AudioContext');
// --- fight
const mkO = (x, z) => ({ visible: true, position: { x, y: 0, z }, rotation: { x: 0, y: 0 }, scale: { x: 1, y: 1, z: 1 }, userData: {} });
const player = mkO(0, 0); player.rotation.y = 0;   // menghadap +Z
const mkPed = (z, hp) => ({ o: mkO(0, z), down: 0, hp, vx: 0, vz: 0 });
let calls = [], bursts = [], toasts = [], reports = [];
const sf = { punch: p => calls.push('punch' + p), whoosh: () => calls.push('whoosh'), oof: () => calls.push('oof'), thud: () => calls.push('thud') };
const fakeImpact = { burst: (...a) => bursts.push(a) };
let canPunch = true;
function mk(peds, extra = {}) {
  const f = createFight({ player, crowd: { peds, scare() {} }, sfx: sf, impact: fakeImpact, satpol: extra.satpol || null, traffic: null, canPunch: () => canPunch });
  let P = 0, K = 0; const ctl = { consumePunch: () => { const p = P; P = 0; return p; }, consumeKick: () => { const k = K; K = 0; return k; } };
  const press = { p: () => { P = 1; }, k: () => { K = 1; } };
  const run = (t) => { for (let i = 0; i < Math.round(t / 0.016); i++) f.update(0.016, ctl); };
  return { f, press, run };
}
// 1) kombo 3 pukulan pada ped HP 3: hit1 -> hp2, hit2 -> hp1, finisher -> KO
{
  const ped = mkPed(1.2, 3); const { f, press, run } = mk([ped]);
  press.p(); run(0.3); ok(ped.hp === 2 && f.combo === 1, 'kombo: pukulan 1 -> HP 2, combo 1');
  ok(ped.down > 0 && ped.down <= 0.9, 'kombo: ped terhuyung (down <= 0.9 => bisa dipukul lagi) ' + ped.down.toFixed(2));
  run(0.1); press.p(); run(0.25); ok(ped.hp === 1 && f.combo === 2, 'kombo: pukulan 2 -> HP 1, combo 2 (hp ' + ped.hp + ')');
  ped.down = 0; run(0.2); press.p(); run(0.215); ok(ped.hp <= 0, 'kombo: finisher -> KO (hp ' + ped.hp + ')'); ok(f.shake >= 0.45, 'finisher: kamera goyang tepat saat kena ' + f.shake.toFixed(2)); run(0.14);
  ok(ped.down >= 3.4 && Math.hypot(ped.vx, ped.vz) > 12, 'finisher: KO + dorongan kuat ' + Math.hypot(ped.vx, ped.vz).toFixed(1) + ' m/s');
  run(1.0); ok(f.shake === 0, 'goyang kamera meluruh ke 0');
  ok(calls.includes('punch2.2') && calls.includes('oof'), 'finisher: suara punch(2.2) + oof');
  run(1.0); ok(f.combo === 0, 'kombo reset setelah finisher');
}
// 2) telat menekan -> kombo ulang dari 1
{
  const ped = mkPed(1.2, 3); const { f, press, run } = mk([ped]);
  press.p(); run(0.35); ped.down = 0; run(1.0); press.p(); run(0.3); ok(f.combo === 1, 'kombo: telat >0,8 dtk -> mulai lagi dari 1');
}
// 3) tendangan
{
  calls = []; const ped = mkPed(1.9, 3); const { f, press, run } = mk([ped]);   // jarak 1,9: di luar tinju 1,7, di dalam tendangan 2,1
  press.p(); run(0.3); ok(ped.hp === 3, 'tinju tidak sampai pada 1,9 m');
  run(0.5); press.k(); run(0.4); ok(ped.hp === 2, 'tendangan kena pada 1,9 m (hp ' + ped.hp + ')');
  ok(ped.down >= 1.2, 'tendangan: ped jatuh 1,3 dtk (down ' + ped.down.toFixed(2) + ')'); ok(Math.hypot(ped.vx, ped.vz) > 5, 'tendangan: dorongan ' + Math.hypot(ped.vx, ped.vz).toFixed(1));
  ok(calls.includes('punch1.6'), 'tendangan: suara punch(1.6)'); ok(f.combo === 0, 'tendangan mereset kombo');
}
// 4) buffer: tombol ditekan 0,1 dtk sebelum cooldown habis tetap jalan
{
  const ped = mkPed(1.2, 3); const { f, press, run } = mk([ped]);
  press.p(); run(0.016); const c0 = f.cd; run(0.2); press.p(); run(0.016);   // cd sisa ~0.1
  ok(f.cd > 0, 'buffer: cd masih berjalan saat tombol ke-2 ditekan (cd ' + f.cd.toFixed(2) + ')'); run(0.3); ok(f.combo === 2, 'buffer: tekanan dini dieksekusi sebagai pukulan 2');
}
// 5) sasaran di belakang / jauh tidak kena; canPunch=false memblok; percikan dipanggil di titik sasaran
{
  const behind = mkPed(-1.0, 3), far = mkPed(3.5, 3); const { f, press, run } = mk([behind, far]);
  press.p(); run(0.3); ok(behind.hp === 3 && far.hp === 3, 'tidak ada yang kena (belakang/jauh)');
  canPunch = false; const near = mkPed(1.0, 3); const m2 = mk([near]); m2.press.p(); m2.run(0.4); ok(near.hp === 3, 'canPunch=false memblok'); canPunch = true;
  bursts = []; const m3 = mk([mkPed(1.0, 3)]); m3.press.p(); m3.run(0.3); ok(bursts.length === 1 && bursts[0][1] > 0.9 && Math.abs(bursts[0][3]) < 1e-6 && bursts[0][4] > 0.9, 'impact.burst dipanggil di sasaran arah +Z: ' + JSON.stringify(bursts[0].map(v => +v.toFixed(2))));
}
// 6) petugas Satpol: finisher = 2 dmg + dorongan diskalakan
{
  const off = { o: mkO(0, 1.2), hp: 4, vx: 0, vz: 0 }; let brawl = 0;
  const sp = { targets: () => [off], witness: () => false, report: (a, w) => reports.push(w), toast: m => toasts.push(m), brawlT: 0,
    hurt: (f, n, nx, nz) => { f.hp -= n; const ko = f.hp <= 0; f.vx = nx * (ko ? 6 : 3.5); f.vz = nz * (ko ? 6 : 3.5); return ko; } };
  const { f, press, run } = mk([], { satpol: sp }); 
  press.p(); run(0.3); run(0.1); press.p(); run(0.3); run(0.1); press.p(); run(0.4);
  ok(off.hp === 4 - 1 - 1 - 2 || off.hp <= 0, 'Satpol HP 4: 1+1+2 dmg -> KO/0 (hp ' + off.hp + ')');
  ok(toasts.includes('Combo finisher!'), 'toast "Combo finisher!" muncul'); ok(reports.includes('Assaulting an officer!'), 'heat petugas dilaporkan'); ok(sp.brawlT === 3, 'brawlT = 3');
}
console.log = log; console.log(fails ? `\n${fails} GAGAL` : '\nSEMUA TES LULUS'); process.exit(fails ? 1 : 0);
