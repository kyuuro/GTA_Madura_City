// Iterasi 69-70: BERKELAHI - pemain meninju. Tombol J / klik kiri (PC) atau PUNCH (HP).
// Alur: tekan -> animasi pukul (punchCharacter) -> 0,14 dtk kemudian cek sasaran terdekat di depan (<=1,7 m, +-60 derajat) di antara 3 jenis:
//  - pejalan (crowd.peds): HP 3, terdorong, terhuyung/KO, bangun lalu lari dari pemain. Dipukul di depan saksi (petugas patroli <45 m / Satpol <60 m) -> heat +8 'Assault!'.
//  - petugas Satpol jalan kaki (satpol.targets()): HP 2/3/4 per bintang, KO 4 dtk (tidak menangkap). Heat +25 'Assaulting an officer!' (maks 1x / 4 dtk).
//  - petugas patroli persimpangan (traffic.patrols): jatuh 4 dtk, heat +30 (maks 1x / 4 dtk).
// Iter 71 MEMBALAS: pejalan yang dipukul (tidak KO) 20% melawan (d.brawl 10 dtk, npcs.js mengejar pemain), petugas Satpol jalan kaki memukul pemain saat <1,4 m.
//  Serangan: animasi punchCharacter -> 0,25 dtk kemudian kalau pemain masih <1,7 m & bisa kena: ctx.onHurt(dmg) (main: health.hit + terhuyung 0,3 dtk). Pejalan dmg 4 tiap 1,2 dtk, petugas dmg 6 tiap 1,4 dtk.
//  Memukul petugas -> satpol.brawlT = 3 (penangkapan jalan kaki tertunda 2 dtk, petugas sibuk memukul).
// Iter 72b RASA PUKULAN: (1) KOMBO 3 pukulan: tekan J berturut-turut dalam 0,8 dtk -> tangan kanan, kiri, lalu FINISHER (dmg 2, dorongan 2,2x, kamera goyang kuat, toast 'Combo finisher!'). Telat/ganti serangan = kombo ulang dari 1.
//  (2) TENDANGAN (tombol K / KICK di HP): jangkauan 2,1 m, busur 70 derajat, dorongan 1,7x, sasaran jatuh 1,3 dtk, cooldown 0,8 dtk. (3) Input buffer 0,25 dtk (tombol ditekan sedikit sebelum cooldown habis tetap jalan).
//  (4) Suara sfx.punch/whoosh/oof, percikan impact.burst (impact.js), kamera goyang `api.shake` (0..1, main.js memakainya). Kena balasan -> main memanggil fight.shake.
// Iter 74 POLESAN: (1) AUTO-AIM + LUNGE: saat menyerang, sasaran terbaik dalam jangkauan+1 m & busur 75 derajat (skor = jarak + 0,8 x sudut) dihadapi (`player.rotation.y`, `api.faceLock` 0,35 dtk supaya main.js tidak memutar balik) dan pemain melangkah maju sampai ~1,1 m (maks 0,8 m, via ctx.lunge). (2) HIT-STOP: `api.hitstop` (dtk) -> main.js memperlambat dt jadi 6% (pukulan 0,07 s, tendangan 0,09, finisher 0,12). (3) Pejalan lain dalam 14 m kabur (crowd.scare) tiap ada yang kena pukul/tendang.
// Iter 73 SENJATA: ctx.weapons (weapons.js). Memegang senjata -> pukulan (BUKAN tendangan) memakai stats(): dmg (finisher +1), jangkauan, pengali dorongan, cdMul; power +0.4, goyang +0.08.
//  Tiap pukulan senjata yang KENA memanggil weapons.use() (patah kalau habis). Memukul pejalan di depan saksi dengan senjata = heat +16 (bukan +8). Petugas Satpol KO menjatuhkan pentungan.
import { punchCharacter, kickCharacter } from './character.js';

const FT_RANGE = 1.7, FT_ARC = Math.PI / 3, FT_COMBO_WIN = 0.8, FT_BUF = 0.25;
// iter 72b: parameter per serangan. cd = cooldown, wind = jeda sebelum cek sasaran, dmg = HP sasaran berkurang, kn = pengali dorongan, power = suara/percikan, shake = goyang kamera
const FT_ATK = { p1: { cd: 0.34, wind: 0.12, dmg: 1, kn: 1, power: 1, shake: 0.12 }, p2: { cd: 0.34, wind: 0.12, dmg: 1, kn: 1.1, power: 1.15, shake: 0.16 }, p3: { cd: 0.7, wind: 0.2, dmg: 2, kn: 2.2, power: 2.2, shake: 0.5 },
  kick: { cd: 0.8, wind: 0.2, dmg: 1, kn: 1.7, power: 1.6, shake: 0.3, range: 2.1, arc: Math.PI * 7 / 18 } };
const FT_PED_HP = 3, FT_HEAT_PED = 8, FT_HEAT_OFFICER = 25, FT_HEAT_PATROL = 30, FT_BRAWL_P = 0.2, FT_BRAWL_T = 10, FT_FOE = { ped: [4, 1.2], officer: [6, 1.4] }, FT_FOE_REACH = 1.7, FT_FOE_WIND = 0.25;

export function createFight(ctx) {
  const { player, crowd, sfx, satpol, traffic, impact, weapons } = ctx; const hurt = ctx.onHurt || (() => {});   // ctx.canPunch() -> bool (tidak naik kendaraan, tidak BUSTED/mati/berenang)
  const api = { cd: 0, pending: -1, hits: 0, combo: 0, comboT: 0, shake: 0, atk: null, hitstop: 0, faceLock: 0 }; let lungeRem = 0, lungeX = 0, lungeZ = 0; let buf = null, bufT = 0;   // buf: serangan yang ditunggu ('punch'|'kick')
  const foes = new Map();   // iter 71: penyerang aktif (kunci: objek karakter) -> {cd, wind}
  let pedHeatCd = 0, offHeatCd = 0; const pko = new Map();   // pko: patroli yang sedang jatuh (o -> {t, y})
  const wrap = (a) => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const witnessed = (x, z) => (traffic && traffic.patrols.some(p => p.o.visible && Math.hypot(p.o.position.x - x, p.o.position.z - z) < 45)) || (satpol && satpol.witness(x, z, 60));
  function candidates() {   // -> [{kind, ref, o}]
    const c = [];
    for (const d of crowd.peds) if (d.o.visible && d.down <= 0.9) c.push({ kind: 'ped', ref: d, o: d.o });
    if (satpol && satpol.targets) for (const f of satpol.targets()) c.push({ kind: 'officer', ref: f, o: f.o });
    if (traffic) for (const p of traffic.patrols) if (p.o.visible && !pko.has(p.o)) c.push({ kind: 'patrol', ref: p, o: p.o });
    return c;
  }
  function aim(atk) {   // iter 74: pilih sasaran (jangkauan+1 m, busur 75 derajat), hadapi, dan mulai lunge
    const px = player.position.x, pz = player.position.z, fy = player.rotation.y, R = (atk.range || FT_RANGE) + 1.0; let best = null, bs = 1e9;
    for (const c of candidates()) {
      const dx = c.o.position.x - px, dz = c.o.position.z - pz, dist = Math.hypot(dx, dz); if (dist > R || dist < 0.05) continue;
      const da = Math.abs(wrap(Math.atan2(dx, dz) - fy)); if (da > Math.PI * 5 / 12) continue;
      const sc = dist + da * 0.8; if (sc < bs) { bs = sc; best = { dx, dz, dist }; }
    }
    if (!best) { atk.yaw = undefined; return; }
    atk.yaw = Math.atan2(best.dx, best.dz); player.rotation.y = atk.yaw; api.faceLock = 0.35;
    const want = Math.min(0.8, Math.max(0, best.dist - 1.1)); if (want > 0.05 && ctx.lunge) { lungeRem = want; lungeX = best.dx / best.dist; lungeZ = best.dz / best.dist; }
  }
  function resolve(atk) {   // cari sasaran terdekat di depan
    const px = player.position.x, pz = player.position.z, fy = atk.yaw !== undefined ? atk.yaw : player.rotation.y, rng = atk.range || FT_RANGE, arc = atk.arc || FT_ARC; let best = null, bd = rng;
    for (const c of candidates()) {
      const dx = c.o.position.x - px, dz = c.o.position.z - pz, dist = Math.hypot(dx, dz); if (dist > bd) continue;
      if (dist > 0.4 && Math.abs(wrap(Math.atan2(dx, dz) - fy)) > arc) continue;
      bd = dist; best = { c, dx, dz, dist };
    }
    if (!best) return false;
    const { c } = best, l = best.dist || 1, nx = best.dx / l, nz = best.dz / l; api.hits++; if (atk.weapon && weapons) weapons.use(); api.hitstop = Math.max(api.hitstop, Math.min(0.12, 0.04 + 0.035 * atk.power));
    if (sfx && sfx.punch) sfx.punch(atk.power); else if (sfx && sfx.thud) sfx.thud();
    if (impact) impact.burst(c.o.position.x - nx * 0.3, c.o.position.y + (atk.kick ? 0.9 : 1.3) * (c.o.scale.y || 1), c.o.position.z - nz * 0.3, nx, nz, atk.power);
    api.shake = Math.min(1, Math.max(api.shake, atk.shake)); if (atk.step === 3 && satpol && satpol.toast) satpol.toast('Combo finisher!');
    if (c.kind === 'ped') {
      const d = c.ref; d.hp = (d.hp === undefined ? FT_PED_HP : d.hp) - atk.dmg;
      const ko = d.hp <= 0, hard = atk.kick || atk.step === 3, sp = (ko ? 6 : 3.5) * atk.kn; d.down = ko ? 3.5 : (hard ? 1.3 : 0.8); d.vx = nx * sp; d.vz = nz * sp;
      d.fleeAfter = ko ? 6 : 4; d.fx = px; d.fz = pz;
      if (!ko && !hard && Math.random() < FT_BRAWL_P) { d.brawl = FT_BRAWL_T; d.fleeAfter = 0; }   // iter 71: melawan, bukan lari (iter 72b: tidak kalau terpental keras)
      if ((ko || hard) && sfx && sfx.oof) sfx.oof(0.85 + Math.random() * 0.4);
      if (pedHeatCd <= 0 && satpol && witnessed(px, pz)) { pedHeatCd = 3; satpol.report(atk.weapon ? FT_HEAT_PED * 2 : FT_HEAT_PED, 'Assault!'); }
      console.log(`[fight] ${atk.name} pejalan (HP ${Math.max(0, d.hp)})${ko ? ' KO' : ''}`);
    } else if (c.kind === 'officer') {
      const ko = satpol.hurt(c.ref, atk.dmg, nx, nz); satpol.brawlT = 3; c.ref.vx *= atk.kn; c.ref.vz *= atk.kn; if (ko && weapons && weapons.dropAt) weapons.dropAt(c.o.position.x, c.o.position.z, 'pentungan'); if ((ko || atk.kick || atk.step === 3) && sfx && sfx.oof) sfx.oof(0.8 + Math.random() * 0.3);
      if (offHeatCd <= 0) { offHeatCd = 4; satpol.report(FT_HEAT_OFFICER, 'Assaulting an officer!'); }
      console.log(`[fight] ${atk.name} petugas Satpol${ko ? ' KO' : ''}`);
    } else {
      pko.set(c.o, { t: 4, y: c.o.position.y }); c.o.rotation.x = -Math.PI / 2; c.o.position.y += 0.15;
      if (offHeatCd <= 0) { offHeatCd = 4; satpol.report(FT_HEAT_PATROL, 'Assaulting an officer!'); }
      console.log(`[fight] ${atk.name} petugas patroli`);
    }
    crowd.scare(px, pz, 14, 5);   // iter 74: pejalan lain kabur (yang kena sudah down>0 jadi tidak ikut)
    return true;
  }
  api.update = (dt, ctl) => {
    if (api.cd > 0) api.cd -= dt; if (api.comboT > 0 && (api.comboT -= dt) <= 0) api.combo = 0; if (api.shake > 0) api.shake = Math.max(0, api.shake - dt * 2.4); if (api.faceLock > 0) api.faceLock -= dt;
    if (lungeRem > 0) { const st = Math.min(lungeRem, 7 * dt); lungeRem -= st; if (ctx.lunge) ctx.lunge(lungeX * st, lungeZ * st); } if (bufT > 0 && (bufT -= dt) <= 0) buf = null; if (pedHeatCd > 0) pedHeatCd -= dt; if (offHeatCd > 0) offHeatCd -= dt;
    for (const [o, k] of pko) { k.t -= dt; if (k.t <= 0) { o.rotation.x = 0; o.position.y = k.y; pko.delete(o); } }
    // iter 71: serangan balik. Pejalan yang melawan (d.near dihitung npcs.js) & petugas Satpol jalan kaki di dekat pemain.
    const can = ctx.canBeHit ? ctx.canBeHit() : true, px = player.position.x, pz = player.position.z;
    const attackers = []; for (const d of crowd.peds) if (d.brawl > 0 && d.o.visible && d.down <= 0) attackers.push({ k: 'ped', o: d.o, near: d.near });
    if (satpol && satpol.targets && satpol.brawlT > 0) for (const f of satpol.targets()) if (!(f.stun > 0) && Math.hypot(f.o.position.x - px, f.o.position.z - pz) < 1.4) attackers.push({ k: 'officer', o: f.o, near: true });
    const live = new Set(attackers.map(a => a.o));
    for (const o of [...foes.keys()]) if (!live.has(o)) foes.delete(o);
    for (const a of attackers) {
      let st = foes.get(a.o); if (!st) foes.set(a.o, st = { cd: 0.4, wind: -1 });
      if (st.cd > 0) st.cd -= dt;
      if (st.wind >= 0) { st.wind -= dt; if (st.wind < 0 && can && Math.hypot(a.o.position.x - px, a.o.position.z - pz) < FT_FOE_REACH) { hurt(FT_FOE[a.k][0]); console.log(`[fight] ${a.k} memukul pemain (-${FT_FOE[a.k][0]})`); } }
      else if (a.near && can && st.cd <= 0) { st.cd = FT_FOE[a.k][1]; st.wind = FT_FOE_WIND; punchCharacter(a.o); }
    }
    if (ctl.consumePunch && ctl.consumePunch()) { buf = 'punch'; bufT = FT_BUF; }
    if (ctl.consumeKick && ctl.consumeKick()) { buf = 'kick'; bufT = FT_BUF; }
    if (buf && api.cd <= 0 && api.pending < 0) {
      if (!ctx.canPunch()) { buf = null; }
      else {
        let a;
        if (buf === 'kick') { a = Object.assign({ name: 'tendang', kick: true, step: 0 }, FT_ATK.kick); api.combo = 0; api.comboT = 0; kickCharacter(player); }
        else { const step = api.comboT > 0 && api.combo < 3 ? api.combo + 1 : 1; a = Object.assign({ name: step === 3 ? 'FINISHER' : 'pukul', kick: false, step }, FT_ATK['p' + step]); const w = weapons && weapons.stats ? weapons.stats() : null;
          if (w) { a.dmg = step === 3 ? w.dmg + 1 : w.dmg; a.range = w.range; a.kn *= w.kn; a.power += 0.4; a.cd *= w.cdMul; a.shake += 0.08; a.weapon = true; a.name += '+senjata'; }
          api.combo = step; api.comboT = step === 3 ? 0.001 : FT_COMBO_WIN; punchCharacter(player, step === 2 ? 'L' : 'R'); }
        aim(a); api.cd = a.cd; api.pending = a.wind; api.atk = a; buf = null; if (sfx && sfx.whoosh) sfx.whoosh();
      }
    }
    if (api.pending >= 0) { api.pending -= dt; if (api.pending < 0) resolve(api.atk); }
  };
  return api;
}
