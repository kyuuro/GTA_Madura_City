// Iterasi 7: NPC pejalan kaki + lalu lintas AI. Hanya "hidup" di sekitar pemain (respawn di cincin 60-260 m), jadi murah.
// Jalur = roads.lines [{hw, pts:[Vector3...]}] (titik tiap ~4 m). Lalu lintas jalan di lajur kiri (Indonesia), kendaraan AI bisa dibajak (masuk lewat F/ENTER).
import { makeCharacter, animateCharacter, SKINS } from './character.js';

const NPC_HATS = ['peci', 'helm', 'none', 'none', 'none', 'satpol'];
const NPC_SHIRTS = [0xd9423a, 0x1faa59, 0x3a6fd9, 0xeeeeee, 0xe0609a, 0xe8c13a, 0x7a4fd1, 0x333333, 0xff8a2a];
const NPC_PANTS = [0x2b3a67, 0x222222, 0x4a3a2a, 0x3a4a5a];
const npcWrap = (a) => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const npcClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const NPC_PILLION = 0.3;
const npcPick = (a) => a[Math.floor(Math.random() * a.length)];

// Pilih titik acak di jalur yang jaraknya dari (px,pz) antara rmin..rmax (reservoir sampling, murah)
function npcSpot(lines, px, pz, rmin, rmax, minHw) {
  let best = null, n = 0;
  for (const L of lines) {
    if (L.hw < minHw || L.zone === 'madura') continue;   // iter 68: pangkal jembatan Madura (hw 10) tanpa lalu lintas AI
    for (let i = 2; i < L.pts.length - 3; i++) {
      const p = L.pts[i], d = Math.hypot(p.x - px, p.z - pz);
      if (d >= rmin && d <= rmax && Math.random() * ++n < 1) best = { L, i };
    }
  }
  return best;
}

export async function createNPCs(scene, ctx) {
  const { roads, ground, blocked, collider, veh, traffic } = ctx, lines = roads.lines, touchy = matchMedia('(pointer:coarse)').matches;
  const NCAR = touchy ? 14 : 26, NPED = touchy ? 10 : 18, api = { cars: [], peds: [] };   // iter 79: lalu lintas ~2x lebih ramai (dulu 7/12), ~72% motor

  // ---------- lalu lintas AI ----------
  // iterasi 79: komposisi lalu lintas ala Indonesia (~72% sepeda motor: Scoopy/Beat/Mio, sisanya mobil; sports/muscle jarang di jalan biasa -> tidak ikut lagi).
  // Slot awal dikuota (merata, tepat ~72% motor) supaya tidak kebetulan sepi motor; kendaraan pengganti (dibajak) dipilih acak dengan peluang yang sama.
  const MOTOS = ['motor', 'beat', 'mio'], CARS = ['car', 'car', 'sedan', 'hatch', 'hatch', 'suv', 'suv', 'angkot', 'angkot', 'taxi', 'pickup', 'truck', 'police', 'ambulance'], MOTO_SHARE = 0.72;
  const pickType = (i) => ((i === undefined ? Math.random() < MOTO_SHARE : Math.floor((i + 1) * MOTO_SHARE) > Math.floor(i * MOTO_SHARE)) ? npcPick(MOTOS) : npcPick(CARS));   // i berurutan: motor tersebar merata, tepat ~72% untuk berapa pun jumlah slot
  const mkAI = (v) => {   // motor: lajur acak di sisi kiri (0.42-0.8 x setengah lebar jalan) & sedikit lebih ngebut; mobil di lajur kiri 0.5
    const moto = !!v.T.rider; v.ai = true; if (v.rider) v.rider.visible = true; v.obj.visible = false;
    return { v, L: null, i: 0, dir: 1, moto, laneK: moto ? 0.42 + Math.random() * 0.38 : 0.5, cruise: v.T.max * (moto ? 0.34 + Math.random() * 0.18 : 0.3 + Math.random() * 0.15), stuck: 0 };
  };
  for (let i = 0; i < NCAR; i++) {
    const v = await veh.spawn(pickType(i), 0, 12, 0); if (!v) continue;
    api.cars.push(mkAI(v));
  }
  function placeCar(c, px, pz) {
    const s = npcSpot(lines, px, pz, 70, 260, 6); if (!s) return false;
    const dir = Math.random() < 0.5 ? 1 : -1, p = s.L.pts[s.i], q = s.L.pts[s.i + dir];
    let tx = q.x - p.x, tz = q.z - p.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const lane = s.L.hw * c.laneK, x = p.x + tz * lane, z = p.z - tx * lane;      // kiri arah jalan = (tz, -tx)
    if (blocked(x, z)) return false;
    c.L = s.L; c.i = s.i; c.dir = dir; c.stuck = 0;
    const v = c.v; v.h = Math.atan2(tx, tz); v.sp = c.cruise * 0.7; v.pitch = 0; v.steer = 0;
    v.obj.position.set(x, ground(x, z), z); v.obj.rotation.set(0, v.h, 0); v.obj.visible = true; v.hp = 100; v.stun = 0; v.em = 0; v.burn = 0;
    if (v.pillion) v.pillion.visible = v.pillionOn = Math.random() < NPC_PILLION;   // iter 79: ~30% motor AI berboncengan (penumpang = anak pengendara, ikut hilang bersamanya)
    return true;
  }
  // iterasi 20: belok di persimpangan. Dekat titik persimpangan (<10 m, belum dilewati) peluang 35% pindah ke jalan lain, arah acak, target = 3 titik setelah persimpangan
  function maybeTurn(c, o) {
    if (!traffic || !traffic.junctions) return false;
    for (const j of traffic.junctions) {
      if (c.lastJ === j || Math.hypot(j.x - o.x, j.z - o.z) > 10) continue;
      const [a, b] = j.name.split('x').map(Number), ia = lines[a] === c.L ? a : lines[b] === c.L ? b : -1; c.lastJ = j;
      if (ia < 0 || Math.random() > 0.35) return false;
      const L2 = lines[ia === a ? b : a]; let bi = 2, bd = 1e9;
      for (let k = 2; k < L2.pts.length - 3; k++) { const d = Math.hypot(L2.pts[k].x - j.x, L2.pts[k].z - j.z); if (d < bd) { bd = d; bi = k; } }
      const dir = Math.random() < 0.5 ? 1 : -1, ni = bi + dir * 3; if (ni < 2 || ni > L2.pts.length - 4) return false;
      c.L = L2; c.i = ni; c.dir = dir; console.log('[npc] AI belok di persimpangan ' + j.name); return true;
    }
    if (c.lastJ && Math.hypot(c.lastJ.x - o.x, c.lastJ.z - o.z) > 25) c.lastJ = null;
    return false;
  }
  function driveCar(c, dt, pp) {
    const v = c.v, o = v.obj.position, pts = c.L.pts, n = pts.length;
    maybeTurn(c, o);
    while (c.i > 1 && c.i < n - 2 && Math.hypot(pts[c.i].x - o.x, pts[c.i].z - o.z) < 7) c.i += c.dir;
    if (c.i <= 1 || c.i >= n - 2) return false;                                // ujung jalan -> respawn
    const j = npcClamp(c.i + c.dir * 2, 1, n - 2), p = pts[j], q = pts[j + c.dir] || p;
    let tx = q.x - p.x, tz = q.z - p.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const lane = c.L.hw * c.laneK, gx = p.x + tz * lane, gz = p.z - tx * lane;
    const diff = npcWrap(Math.atan2(gx - o.x, gz - o.z) - v.h), str = npcClamp(-diff * 2, -1, 1);
    let target = c.cruise * (1 - 0.6 * Math.min(1, Math.abs(diff)));
    const fx = Math.sin(v.h), fz = Math.cos(v.h), look = (x, z, w) => {       // ada penghalang di depan?
      const dx = x - o.x, dz = z - o.z, ahead = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 16 && side < w) target = Math.min(target, ahead < 7 ? 0 : c.cruise * 0.3);
    };
    for (const u of veh.list) if (u !== v && u.obj.visible) look(u.obj.position.x, u.obj.position.z, u.T.rider && v.T.rider ? 1.3 : u.T.r + v.T.r + 0.6);   // iter 79: motor vs motor cukup 1.3 m -> bisa berdampingan/menyalip
    look(pp.x, pp.z, 2);
    for (const pd of api.peds) look(pd.o.position.x, pd.o.position.z, 1.6);
    let wait = false;                                                          // iterasi 9: berhenti di lampu merah / kuning (kuning: terobos kalau tidak sempat berhenti)
    const sg = traffic && traffic.ahead(o.x, o.z, fx, fz, 60);
    if (sg && sg.state !== 'G') { const sd = sg.dist - 1.5; if (!(sg.state === 'Y' && sd < v.sp * v.sp / 12)) { target = Math.min(target, Math.sqrt(8 * Math.max(0, sd))); wait = true; } }
    if (v.stun > 0) { v.stun -= dt; target = 0; wait = true; } if (v.hp <= 0) target = 0;   // iterasi 12 (bangkai tetap dihitung macet -> respawn 18 dtk): terkejut / mesin mati
    veh.step(v, dt, npcClamp((target - v.sp) * 0.6, -1, 1), str, false, true);
    c.stuck = v.sp < 0.5 && !wait ? c.stuck + dt : 0;
    return c.stuck < 18;
  }

  // ---------- pejalan kaki ----------
  for (let i = 0; i < NPED; i++) {
    const o = makeCharacter({ npc: true, hat: npcPick(NPC_HATS), shirt: npcPick(NPC_SHIRTS), pants: npcPick(NPC_PANTS), skin: npcPick(SKINS), sarung: Math.random() < 0.1, scale: 0.9 + Math.random() * 0.15 });
    o.visible = false; scene.add(o);
    api.peds.push({ o, L: null, i: 0, dir: 1, side: 1, sp: 1.2 + Math.random() * 0.7, wait: 0, down: 0, vx: 0, vz: 0 });
  }
  function placePed(d, px, pz) {
    const s = npcSpot(lines, px, pz, 25, 170, 3); if (!s) return false;
    d.L = s.L; d.i = s.i; d.dir = Math.random() < 0.5 ? 1 : -1; d.side = Math.random() < 0.5 ? 1 : -1; d.down = 0; d.wait = 0; d.hp = 3; d.fleeAfter = 0; d.flee = 0; d.brawl = 0; d.near = false;
    const off = (d.L.hw >= 6 ? d.L.hw + 0.7 : 1.0) * d.side, p = d.L.pts[d.i], q = d.L.pts[d.i + 1];
    let tx = q.x - p.x, tz = q.z - p.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const x = p.x + tz * off, z = p.z - tx * off; if (blocked(x, z)) return false;
    d.o.position.set(x, ground(x, z), z); d.o.rotation.set(0, 0, 0); d.o.visible = true; return true;
  }
  function walkPed(d, dt, pp) {
    const o = d.o, pts = d.L.pts, n = pts.length;
    if (d.down > 0) {                                                          // ditabrak: tergeletak sebentar, terdorong, lalu bangun
      d.down -= dt; o.position.x += d.vx * dt; o.position.z += d.vz * dt; d.vx *= 1 - 3 * dt; d.vz *= 1 - 3 * dt;
      o.rotation.x = -Math.PI / 2; o.position.y = ground(o.position.x, o.position.z) + 0.15;
      if (d.down <= 0) { o.rotation.x = 0; d.wait = 1.5; if (d.fleeAfter) { d.flee = d.fleeAfter; d.fleeAfter = 0; d.wait = 0; } } return;   // iter 69: habis dipukul -> lari dari pemain (fight.js)
    }
    for (const v of veh.list) {                                                // tabrakan kendaraan vs NPC
      if (!v.obj.visible || Math.abs(v.sp) < 3) continue;
      const dx = o.position.x - v.obj.position.x, dz = o.position.z - v.obj.position.z;
      if (dx * dx + dz * dz < (v.T.r + 0.5) ** 2) { d.down = 3; d.vx = Math.sin(v.h) * v.sp * 0.5; d.vz = Math.cos(v.h) * v.sp * 0.5; v.sp *= 0.85; console.log('[npc] pejalan tertabrak'); if (api.onHit) api.onHit(v); return; }
    }
    if (d.brawl > 0) {                                                         // iter 71: NPC yang dipukul & memilih melawan: kejar pemain, serangan diurus fight.js (d.near, d.atk)
      d.brawl -= dt; const ax = pp.x - o.position.x, az = pp.z - o.position.z, dist = Math.hypot(ax, az); d.near = dist < 1.5;
      if (dist > 28) d.brawl = 0;
      else {
        if (dist > 1.3) { const nx = o.position.x + ax / dist * 4.4 * dt, nz = o.position.z + az / dist * 4.4 * dt; if (!blocked(nx, nz)) { o.position.x = nx; o.position.z = nz; collider.resolve(o.position, 0.4); } }
        o.position.y = ground(o.position.x, o.position.z); o.rotation.y += npcWrap(Math.atan2(ax, az) - o.rotation.y) * Math.min(1, dt * 10); animateCharacter(o, dt, dist > 1.3 ? 4.4 : 0); return;
      }
      d.near = false;
    }
    if (d.flee > 0) {                                                          // iterasi 10: kaget klakson -> menjauh dari sumber suara
      d.flee -= dt; const ax = o.position.x - d.fx, az = o.position.z - d.fz, al = Math.hypot(ax, az) || 1, nx = o.position.x + ax / al * 3.8 * dt, nz = o.position.z + az / al * 3.8 * dt;
      if (!blocked(nx, nz)) { o.position.x = nx; o.position.z = nz; collider.resolve(o.position, 0.4); }
      o.position.y = ground(o.position.x, o.position.z); o.rotation.y += npcWrap(Math.atan2(ax, az) - o.rotation.y) * Math.min(1, dt * 10); animateCharacter(o, dt, 3.8); return;
    }
    if (d.wait > 0) { d.wait -= dt; animateCharacter(o, dt, 0); return; }
    if (Math.random() < dt * 0.04) { d.wait = 2 + Math.random() * 3; return; } // sesekali berhenti
    const j = npcClamp(d.i + d.dir, 1, n - 2), p = pts[j], q = pts[j + 1], off = (d.L.hw >= 6 ? d.L.hw + 0.7 : 1.0) * d.side;
    let tx = q.x - p.x, tz = q.z - p.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const gx = p.x + tz * off, gz = p.z - tx * off, dx = gx - o.position.x, dz = gz - o.position.z, dist = Math.hypot(dx, dz);
    if (dist < 1.2) { d.i += d.dir; if (d.i < 2 || d.i > n - 3) d.dir = -d.dir; return; }
    const nx = o.position.x + dx / dist * d.sp * dt, nz = o.position.z + dz / dist * d.sp * dt;
    if (blocked(nx, nz)) { d.dir = -d.dir; return; }
    o.position.x = nx; o.position.z = nz; collider.resolve(o.position, 0.4);
    o.position.y = ground(nx, nz);
    o.rotation.y += npcWrap(Math.atan2(dx, dz) - o.rotation.y) * Math.min(1, dt * 8);
    animateCharacter(o, dt, d.sp);
  }

  api.scare = (x, z, r, t) => { let n = 0; for (const d of api.peds) if (d.o.visible && d.down <= 0 && Math.hypot(d.o.position.x - x, d.o.position.z - z) < r) { d.flee = t; d.fx = x; d.fz = z; d.wait = 0; n++; } return n; };   // iter 18: ledakan -> pejalan lari
  api.blast = (x, z, r) => { let n = 0; for (const d of api.peds) { const dx = d.o.position.x - x, dz = d.o.position.z - z, l = Math.hypot(dx, dz) || 1; if (d.o.visible && d.down <= 0 && l < r) { d.down = 3.5; d.vx = dx / l * 9; d.vz = dz / l * 9; n++; } } return n; };   // iter 19: ledakan melempar pejalan
  api.honk = (x, z) => { for (const d of api.peds) if (d.o.visible && d.down <= 0 && Math.hypot(d.o.position.x - x, d.o.position.z - z) < 14) { d.flee = 2.5; d.fx = x; d.fz = z; d.wait = 0; } };
  api.update = (dt, pp) => {
    for (const c of api.cars) {
      const v = c.v;
      if (!v.ai) { if (c.L) { c.L = null; } continue; }                         // dibajak pemain -> keluar dari lalu lintas
      const far = Math.hypot(v.obj.position.x - pp.x, v.obj.position.z - pp.z) > 300;
      if (!c.L || far || !driveCar(c, dt, pp)) { if (!placeCar(c, pp.x, pp.z)) { v.obj.visible = !!c.L && !far; } }
    }
    // kendaraan yang dibajak diganti mobil baru: pakai slot AI yang sudah tidak ai
    for (const c of api.cars) if (!c.v.ai && !c.replaced) { c.replaced = true; veh.spawn(pickType(), 0, 12, 0).then(v => { if (!v) return; api.cars.push(mkAI(v)); }); }
    for (const d of api.peds) {
      if (!d.L || Math.hypot(d.o.position.x - pp.x, d.o.position.z - pp.z) > 190) { if (!placePed(d, pp.x, pp.z)) d.o.visible = !!d.L && d.o.visible; continue; }
      walkPed(d, dt, pp);
    }
  };
  console.log(`[npcs] ${api.cars.length} mobil AI, ${api.peds.length} pejalan kaki`);
  return api;
}
