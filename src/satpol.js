// Iterasi 8: wanted level + Satpol PP. Pemicu: tabrak pejalan pakai kendaraan (+30), bajak kendaraan (+35). Heat 0..120 -> 0-3 bintang.
// Satpol jalan kaki (2/4/6 orang, HP 2/3/4) mengejar lurus; mulai 2 bintang ada motor pengejar. Tertangkap = denda + respawn di Spawn.
// Lolos: jauhi petugas (>40 m) sampai heat habis. Kendaraan pengejar bisa dicuri (kena wanted lagi).
import * as THREE from 'three';
import { makeCharacter, animateCharacter, SKINS } from './character.js';
import { astarFindPath, astarLos } from './astar.js';

const spWrap = (a) => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const spClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SP_FOOT = [0, 5.2, 6.4, 7.4];          // kecepatan petugas jalan kaki (m/s) per bintang; pemain lari = 9
const SP_ANG = [0.5, 1.0, 1.5, 2.0, 2.6];                  // sudut coba (rad) saat jalur lurus terhalang, ke satu sisi yang bertahan
const SP_HP = [2, 2, 3, 4];                  // iter 70: HP petugas jalan kaki per bintang
const SP_FINE = [0, 50000, 100000, 250000];  // denda (Rp) per bintang

export async function createSatpol(scene, ctx) {
  const { ground, blocked, collider, veh, onRespawn } = ctx, touchy = matchMedia('(pointer:coarse)').matches;
  const api = { heat: 0, stars: 0, fines: 0, frozen: false, busted: false, siren: 0, brawlT: 0 };
  const ACT = touchy ? [0, 2, 3, 4] : [0, 2, 4, 6], NF = ACT[3], NB = touchy ? 1 : 2;
  let T = 0, bt = 0, catchT = 0, toastT = 0, near = false, lastX = 0, lastZ = 0;

  // ---------- UI (teks bahasa Inggris) ----------
  const mk = (css) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;z-index:60;pointer-events:none;display:none;' + css; document.body.appendChild(d); return d; };
  const starsEl = mk('top:10px;left:50%;transform:translateX(-50%);text-align:center;font:bold 22px monospace;color:#ffd23a;text-shadow:0 2px 0 #000');
  const toastEl = mk('top:84px;left:50%;transform:translateX(-50%);padding:5px 12px;border-radius:6px;background:#000b;color:#fff;font:bold 14px sans-serif;white-space:nowrap');
  const bustEl = mk('inset:0;align-items:center;justify-content:center;flex-direction:column;background:#0009;color:#e8362e;font:bold 76px Impact,Anton,sans-serif;letter-spacing:4px;text-shadow:0 4px 0 #000');
  const toast = (m) => { toastEl.textContent = m; toastEl.style.display = 'block'; toastT = 3; };
  const ui = () => { starsEl.style.display = api.stars ? 'block' : 'none'; starsEl.innerHTML = 'WANTED<br>' + '\u2605'.repeat(api.stars) + '\u2606'.repeat(3 - api.stars); };

  // ---------- petugas jalan kaki ----------
  const foot = [];
  for (let i = 0; i < NF; i++) {
    const o = makeCharacter({ hat: 'satpol', shirt: 0x8a7a45, pants: 0x3a3a2a, skin: SKINS[1 + (i % 3)] }); o.visible = false; scene.add(o); foot.push({ o, side: 0, clearN: 0 });
  }
  const dis = [];   // iter 23: petugas yang turun dari motor
  for (let i = 0; i < NB; i++) { const o = makeCharacter({ hat: 'satpol', shirt: 0x8a7a45, pants: 0x3a3a2a, skin: SKINS[1 + (i % 3)] }); o.visible = false; scene.add(o); dis.push({ o, side: 0, clearN: 0 }); }
  // ---------- motor pengejar ----------
  const bikes = [];
  const lightMat = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2 });
  function addBike(v) {
    if (v.mkCopRider) v.mkCopRider();   // iter 85: pengendara = petugas berseragam, bukan warga sipil acak
    v.ai = true; v.satpol = true; v.obj.visible = false; if (v.rider) v.rider.visible = true;
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.14), lightMat(0xff2222)), b = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.14), lightMat(0x2266ff));
    r.position.set(-0.12, 1.12, -0.95); b.position.set(0.12, 1.12, -0.95); v.obj.add(r, b);
    bikes.push({ v, r, b, stuck: 0, replaced: false, side: 0, clearN: 0, dm: false, dt: 0 });
  }
  for (let i = 0; i < NB; i++) { const v = await veh.spawn('motor', 0, 12, 0); if (v) addBike(v); }

  const free = (x, z, r) => !blocked(x, z) && !(collider.hit && collider.hit(x, z, r));
  function steer(u, x, z, bearing, look, r) {   // iterasi 10: kalau lurus terhalang, ikuti dinding ke SATU sisi (bertahan) sampai jalur lurus bebas lagi
    const clear = (a) => { const hx = Math.sin(bearing + a), hz = Math.cos(bearing + a); return free(x + hx * look * 0.4, z + hz * look * 0.4, r) && free(x + hx * look, z + hz * look, r); };
    if (clear(0)) { if (++u.clearN > 20) u.side = 0; return 0; }
    u.clearN = 0; if (!u.side) u.side = Math.random() < 0.5 ? 1 : -1;
    for (let pass = 0; pass < 2; pass++) { for (const k of SP_ANG) if (clear(k * u.side)) return k * u.side; u.side = -u.side; }
    return 2.4 * u.side;
  }
  function stepFoot(f, dt, tp) {   // dipakai petugas jalan kaki & petugas turun dari motor (iter 23)
    const o = f.o, p = o.position;
    const dx = tp.x - p.x, dz = tp.z - p.z, d = Math.hypot(dx, dz), v = SP_FOOT[api.stars];
    // iter 66: A*. Garis lurus ke pemain terhalang (gedung/laut) -> cari jalur (grid 1.5 m, dihaluskan) & ikuti titiknya; gagal/terlalu jauh -> susur dinding lama (steer).
    f.pT = (f.pT || 0) - dt; let tx = tp.x, tz = tp.z, usePath = false;
    if (d > 6 && d < 140 && !astarLos(free, p.x, p.z, tp.x, tp.z, 0.45)) {
      if (!f.path || f.pT <= 0 || Math.hypot(tp.x - f.pg.x, tp.z - f.pg.z) > 8) {
        f.path = astarFindPath(free, p.x, p.z, tp.x, tp.z, 0.45); f.pg = { x: tp.x, z: tp.z }; f.pT = 1.2 + Math.random() * 0.6;   // acak supaya beberapa petugas tidak mencari pada frame sama
        if (!f.path) f.pT = 2; else if (api.debug) console.log(`[satpol] A* ${f.path.length} titik, jarak ${d.toFixed(0)} m`);
      }
      if (f.path) { while (f.path.length > 1 && Math.hypot(f.path[0].x - p.x, f.path[0].z - p.z) < 1.3) f.path.shift(); tx = f.path[0].x; tz = f.path[0].z; usePath = true; }
    } else f.path = null;
    const bearing = Math.atan2(tx - p.x, tz - p.z), hd = bearing + (!usePath && d > 6 ? steer(f, p.x, p.z, bearing, 2.6, 0.45) : 0);
    if (d > 1.0) { const nx = p.x + Math.sin(hd) * v * dt, nz = p.z + Math.cos(hd) * v * dt; if (!blocked(nx, nz)) { p.x = nx; p.z = nz; collider.resolve(p, 0.4); } }
    p.y = ground(p.x, p.z);
    o.rotation.y += spWrap(hd - o.rotation.y) * Math.min(1, dt * 10);
    animateCharacter(o, dt, d > 1 ? v : 0);
    return d;
  }
  // iter 70: petugas bisa dipukul pemain (fight.js). HP per petugas = SP_HP[bintang]; kena = terhuyung 0,5 dtk, HP 0 = KO 4 dtk (tidak mengejar/menangkap), bangun dgn HP penuh.
  const hpMax = () => SP_HP[Math.max(1, api.stars)];
  function disabled(f, dt) {
    const o = f.o, p = o.position;
    if (f.ko > 0 || f.stun > 0) {
      const lying = f.ko > 0; if (lying) f.ko -= dt; else f.stun -= dt;
      const nx = p.x + f.vx * dt, nz = p.z + f.vz * dt; f.vx *= 1 - 3 * dt; f.vz *= 1 - 3 * dt; if (!blocked(nx, nz)) { p.x = nx; p.z = nz; collider.resolve(p, 0.4); }
      p.y = ground(p.x, p.z) + (lying ? 0.15 : 0); o.rotation.x = lying ? -Math.PI / 2 : 0;
      if (lying && f.ko <= 0) { o.rotation.x = 0; p.y = ground(p.x, p.z); f.hp = hpMax(); console.log('[satpol] petugas bangun'); }
      if (!lying) animateCharacter(o, dt, 0);
      return true;
    }
    return false;
  }
  api.targets = () => [...foot, ...dis].filter(f => f.o.visible && !(f.ko > 0));
  api.hurt = (f, n, nx, nz) => {   // -> true kalau KO
    f.hp = (f.hp === undefined ? hpMax() : f.hp) - n; const ko = f.hp <= 0;
    if (ko) { f.ko = 4; f.stun = 0; f.vx = nx * 6; f.vz = nz * 6; } else { f.stun = 0.5; f.vx = nx * 3.5; f.vz = nz * 3.5; }
    return ko;
  };
  function spot(px, pz, rmin, rmax) {
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * 6.283, r = rmin + Math.random() * (rmax - rmin), x = px + Math.sin(a) * r, z = pz + Math.cos(a) * r;
      if (!blocked(x, z)) return [x, z];
    }
    return null;
  }
  function placeBike(u, tp) {
    const s = spot(tp.x, tp.z, 60, 110); if (!s) return false;
    const v = u.v; v.h = Math.atan2(tp.x - s[0], tp.z - s[1]); v.sp = 8; v.pitch = 0; v.steer = 0; u.stuck = 0;
    v.obj.position.set(s[0], ground(s[0], s[1]), s[1]); v.obj.rotation.set(0, v.h, 0); collider.resolve(v.obj.position, v.T.r); v.obj.visible = true; return true;
  }
  function undis(u, i) { u.dm = false; u.dt = 0; if (u.v.rider && u.v.ai) u.v.rider.visible = true; if (dis[i]) dis[i].o.visible = false; }
  function driveBike(u, dt, tp) {
    const v = u.v, o = v.obj.position, dx = tp.x - o.x, dz = tp.z - o.z, dist = Math.hypot(dx, dz);
    const bearing = Math.atan2(dx, dz), ang = dist > 14 ? steer(u, o.x, o.z, bearing, 14, 1.3) : 0;
    const diff = spWrap(bearing + ang - v.h), str = spClamp(-diff * 2.2, -1, 1);
    let tgt = v.T.max * (api.stars >= 3 ? 1 : 0.88) * (1 - 0.55 * Math.min(1, Math.abs(diff)));
    if (dist < 10) tgt = Math.min(tgt, dist * 1.4);
    veh.step(v, dt, spClamp((tgt - v.sp) * 0.6, -1, 1), str, false, true);
    u.stuck = v.sp < 1 && dist > 6 ? u.stuck + dt : 0;
    return dist;
  }

  // ---------- API ----------
  api.toast = toast;
  api.respawn = (player) => respawn(player);   // iter 25: dipakai health.js saat WASTED
  api.witness = (x, z, r) => foot.some(f => f.o.visible && Math.hypot(f.o.position.x - x, f.o.position.z - z) < r) || bikes.some(u => u.v.obj.visible && Math.hypot(u.v.obj.position.x - x, u.v.obj.position.z - z) < r);
  api.report = (amount, why) => { api.heat = Math.min(120, api.heat + amount); toast(why); console.log(`[satpol] +${amount} heat: ${why} (heat ${Math.round(api.heat)})`); };

  function bust() {
    api.busted = true; api.frozen = true; bt = 0; api.siren = 0; if (ctx.onBust) ctx.onBust();
    const f = SP_FINE[Math.max(1, api.stars)]; api.fines += f;
    bustEl.innerHTML = 'BUSTED<div style="font:bold 22px monospace;letter-spacing:0;margin-top:10px;color:#fff">Fine: Rp ' + f.toLocaleString('en-US') + '</div>'; bustEl.style.display = 'flex';
    console.log(`[satpol] BUSTED, denda Rp ${f}`);
  }
  function respawn(player) {
    if (veh.driving) veh.leave(player);
    player.position.set(0, 0, 12); player.visible = true;
    api.heat = 0; api.stars = 0; api.busted = false; api.frozen = false; catchT = 0; bustEl.style.display = 'none';
    foot.concat(dis).forEach(f => { f.o.visible = false; f.o.rotation.x = 0; f.ko = 0; f.stun = 0; f.hp = undefined; }); bikes.forEach((u, i) => { u.v.sp = 0; u.v.obj.visible = false; undis(u, i); });
    if (onRespawn) onRespawn(0, 12); ui(); console.log('[satpol] respawn di Spawn');
  }

  api.update = (dt, player) => {
    T += dt;
    const pp = player.position, drv = veh.driving, tp = drv ? drv.obj.position : pp;
    const psp = Math.hypot(pp.x - lastX, pp.z - lastZ) / Math.max(dt, 1e-3); lastX = pp.x; lastZ = pp.z;
    if (toastT > 0 && (toastT -= dt) <= 0) toastEl.style.display = 'none';
    if (api.busted) { api.siren = 0; bt += dt; foot.forEach(f => f.o.visible && animateCharacter(f.o, dt, 0)); if (bt > 2.8) respawn(player); return; }

    const sp = Math.abs(drv ? drv.sp : psp), slowEnough = drv ? sp < 3 : true;
    let catching = false; near = false;
    const act = ACT[api.stars];
    foot.forEach((f, i) => {
      const o = f.o, p = o.position;
      if (i >= act || api.stars === 0) { if (o.visible) { if (Math.hypot(p.x - tp.x, p.z - tp.z) > 30) o.visible = false; else animateCharacter(o, dt, 0); } return; }
      if (!o.visible || Math.hypot(p.x - tp.x, p.z - tp.z) > 230) {
        const s = spot(tp.x, tp.z, 45, 85); if (!s) return; p.set(s[0], ground(s[0], s[1]), s[1]); collider.resolve(p, 0.4); o.rotation.x = 0; f.ko = 0; f.stun = 0; f.hp = undefined; o.visible = true; return;
      }
      if (disabled(f, dt)) return;
      const d = stepFoot(f, dt, tp);
      if (d < 40) near = true;
      if (d < (drv ? drv.T.r + 1.2 : 1.3) && slowEnough) catching = true;
    });

    const nb = api.stars >= 2 ? Math.min(NB, api.stars - 1) : 0, ph = Math.floor(T * 6) % 2; let sirMin = 1e9;
    bikes.forEach((u, i) => {
      const v = u.v, o = v.obj.position;
      if (!v.ai) { if (u.dm) undis(u, i); if (!u.replaced) { u.replaced = true; veh.spawn('motor', 0, 12, 0).then(nv => { if (nv) addBike(nv); }); } return; } // dicuri pemain -> ganti unit baru
      if (i >= nb) { if (u.dm) undis(u, i); if (v.obj.visible) { if (Math.hypot(o.x - tp.x, o.z - tp.z) > 30) v.obj.visible = false; else veh.step(v, dt, 0, 0, false, false); } return; }
      if (!v.obj.visible || Math.hypot(o.x - tp.x, o.z - tp.z) > 260 || u.stuck > 3) { placeBike(u, tp); return; }
      if (u.dm) {   // iter 23: petugas turun, motor parkir, kejar jalan kaki
        const f = dis[i]; veh.step(v, dt, 0, 0, false, false); u.dt += dt;
        if (disabled(f, dt)) { near = true; return; }
        const fd = stepFoot(f, dt, tp); if (fd < 40) near = true; if (fd < sirMin) sirMin = fd;
        if (fd < (drv ? drv.T.r + 1.2 : 1.3) && slowEnough) catching = true;
        if (drv || u.dt > 25 || fd > 70) undis(u, i);
        return;
      }
      const d = driveBike(u, dt, tp);
      if (!drv && d < 12 && v.sp < 9 && !u.dm) { u.dm = true; u.dt = 0; v.sp = 0; if (v.rider) v.rider.visible = false; const f = dis[i]; f.ko = 0; f.stun = 0; f.hp = undefined; f.o.rotation.x = 0; f.o.position.set(o.x + 0.8, ground(o.x, o.z), o.z); f.o.visible = true; console.log('[satpol] petugas turun dari motor'); }
      u.r.material.emissiveIntensity = ph ? 1.6 : 0.1; u.b.material.emissiveIntensity = ph ? 0.1 : 1.6;
      if (d < 60) near = true;
      if (d < sirMin) sirMin = d;
      if (d < 2.6 + (drv ? drv.T.r : 0) && slowEnough) catching = true;
    });

    api.siren = api.stars >= 2 && sirMin < 1e9 ? spClamp(1 - sirMin / 160, 0, 1) : 0;
    if (api.brawlT > 0) api.brawlT -= dt;   // iter 71: pemain sedang berkelahi dgn petugas -> petugas sibuk memukul, penangkapan jalan kaki tertunda (2 dtk)
    if (catching) { catchT += dt; if (catchT > (drv ? 1.3 : api.brawlT > 0 ? 2.0 : 0.5)) { bust(); return; } } else catchT = Math.max(0, catchT - dt * 2);
    if (api.heat > 0 && !near) api.heat = Math.max(0, api.heat - 6 * dt);          // lolos dari pandangan -> heat turun
    const st = api.heat <= 0 ? 0 : api.heat < 40 ? 1 : api.heat < 80 ? 2 : 3;
    if (st !== api.stars) { console.log(`[satpol] wanted ${api.stars} -> ${st}`); if (st === 0 && api.stars > 0) toast('You lost the cops'); api.stars = st; ui(); }
    if (api.stars) starsEl.style.opacity = near && Math.floor(T * 4) % 2 ? 0.45 : 1;
  };
  console.log(`[satpol] ${foot.length} petugas jalan kaki, ${bikes.length} motor pengejar`);
  return api;
}
