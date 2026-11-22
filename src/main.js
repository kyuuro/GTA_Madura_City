import * as THREE from 'three';
import { loadModel } from './assets.js';
import { createHUD } from './hud.js';
import { createWorld } from './world.js';
import { makeCharacter, animateCharacter, SKINS } from './character.js';
import { createControls } from './controls.js';
import { createCollider } from './collide.js';
import { createRoads } from './roads.js';
import { createBuildings } from './buildings.js';
import { createKoridor } from './koridor.js';
import { createDarmoBld } from './darmo_bld.js';   // iter 89   // iter 88
import { inZone } from './districts.js';
import { createRumput } from './rumput.js';
import { createPaving } from './paving.js';
import { createPerak } from './perak.js';
import { createKenjeran } from './kenjeran.js';
import { createKampung } from './kampung.js';
import { createSuramadu } from './suramadu.js';
import { createMadura } from './madura.js';
import { createVehicles } from './vehicles.js';
import { createNPCs } from './npcs.js';
import { createFight } from './fight.js';
import { createImpact } from './impact.js';
import { createWeapons } from './weapons.js';
import { createSatpol } from './satpol.js';
import { createHealth } from './health.js';
import { initRetro } from './retro.js';
import { createMusic } from './music.js';
await initRetro();   // iter 26: karakter Kenney (CC0) menggantikan makeCharacter procedural; gagal -> procedural
import { createTraffic } from './traffic.js';
import { createVehicleCollisions } from './vcollide.js';
import { createDamage } from './damage.js';
import { createBengkel } from './bengkel.js';
import { createLights } from './lights.js';
import { createSFX } from './sfx.js';

let quality = matchMedia('(pointer:coarse)').matches ? 'Low' : 'High';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xf2a65a, 80, 1100);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 3000);

const world = createWorld(scene, camera);

const collider = createCollider();
const roads = createRoads(scene, world.height);
roads.upgradeLamps();   // async, tanpa await: procedural dulu, diganti Kenney kalau berhasil dimuat
roads.upgradeTrees();   // iter 72: pohon procedural -> Tree Animate (3 varian), async; ?pohon=0 mematikan
const dctx = { height: world.height, roads, collider, quality, night: world.nightU };
const bridge = createSuramadu(scene, dctx);
const kampung = createKampung(scene, dctx);
kampung.upgradePoles();   // async, tanpa await (iterasi 15): tiang procedural dulu, diganti Kenney kalau berhasil dimuat
kampung.upgradeKiosks();   // async (iter 16b): warung kios -> Kenney retro-urban
const madura = createMadura(scene, dctx);
const districts = [createPerak(scene, dctx), createKenjeran(scene, dctx), kampung, bridge, madura];
let veh, city, grass, paving, koridor, darmoB;
function buildCity() {
  if (city) city.dispose();
  collider.clear(); districts.forEach(d => d.colliders(collider));
  city = createBuildings(scene, { quality, height: world.height, roads, collider, night: world.nightU, exclude: inZone });
  console.log(`[city] ${quality}: ${city.count} bangunan`);
  if (koridor) koridor.dispose(); koridor = new URLSearchParams(location.search).get('koridor') === '0' ? null : createKoridor(scene, { quality, height: world.height, roads, collider, night: world.nightU, exclude: inZone });  window.__koridor = koridor;
  if (darmoB) darmoB.dispose(); darmoB = new URLSearchParams(location.search).get('darmo') === '0' ? null : createDarmoBld(scene, { quality, height: world.height, roads, collider, night: world.nightU, exclude: inZone });  window.__darmoB = darmoB;   // iter 89: bangunan Darmo (OSM + prosedural, lazy per chunk); collider eager   // debug (harness)   // iter 88: rumah koridor (lazy per chunk); collider ditambah di sini (sesudah collider.clear)
  city.upgrade();   // async, tanpa await (iterasi 16): bangunan Kenney menggantikan balok procedural kalau model berhasil dimuat
  if (paving) paving.dispose(); paving = new URLSearchParams(location.search).get('paving') === '0' ? null : createPaving(scene, { quality, height: world.height, roads, collider, houses: city.list, cell: city.cell });   // iter 75: jalur paving antar rumah (jalan kota tetap aspal)
  if (grass) grass.dispose(); grass = new URLSearchParams(location.search).get('rumput') === '0' ? null : createRumput(scene, { quality, height: world.height, roads, collider, skip: (x, z) => bridge.heightAt(x, z) != null || inZone(x, z, 12) || (paving && paving.near(x, z, 0.9)) });   // iter 61: rumput 3D; iter 75: tidak tumbuh di atas paving
  if (veh) veh.settle();
}
buildCity();
const ground = (x, z) => bridge.heightAt(x, z) ?? (Math.max(0, world.height(x, z)) + roads.curbAt(x, z));   // iter 62: + tinggi trotoar
const blocked = (x, z) => bridge.heightAt(x, z) == null && world.height(x, z) < -0.15;
veh = await createVehicles(scene, { ground, blocked, collider });
const sfx = createSFX();
veh.onCrash = (s) => { sfx.crash(s); dmg.hit(veh.driving, s * 18); };
const music = createMusic();   // iter 27: musik per area (src/music.js)
let deathT = 0, lastVhp = null, lastV = null;   // iter 25: HP pemain
const health = createHealth({ onDeath: () => { deathT = 3; blastStun = 3; if (veh.driving) veh.leave(player); } });
let blastStun = 0;   // iter 21: pemain terpental ledakan
const dmg = createDamage(scene, { veh, sfx, ground, onWarn: (m) => satpol.toast(m), onExplode: (v) => { const n = crowd.scare(v.obj.position.x, v.obj.position.z, 35, 5); const hurt = crowd.blast(v.obj.position.x, v.obj.position.z, 8); console.log(`[boom] ${n} pejalan kabur, ${hurt} terlempar`); if (Math.hypot(player.position.x - v.obj.position.x, player.position.z - v.obj.position.z) < 7) { const bd = Math.hypot(player.position.x - v.obj.position.x, player.position.z - v.obj.position.z); health.hit(Math.round(10 + 40 * (1 - bd / 7))); blastStun = 2.5; satpol.toast('Knocked down by the blast!'); console.log('[boom] pemain terpental 2.5 dtk'); } if (hurt && v === veh.driving) satpol.report(25, 'Your explosion hurt pedestrians!'); else if (v === veh.driving && satpol.witness(v.obj.position.x, v.obj.position.z, 60)) satpol.report(15, 'Public explosion!'); if (v === veh.driving) { veh.leave(player); satpol.toast('BOOM! Your ride is gone.'); } }, onWreck: (v) => { if (v === veh.driving) satpol.toast('Engine dead! Find another ride.'); } });
const traffic = createTraffic(scene, { roads, ground, veh, collider, sfx });
if (traffic.upgradeSignals) traffic.upgradeSignals();   // async, tanpa await (iter 17)
const crowd = await createNPCs(scene, { roads, ground, blocked, collider, veh, traffic });
const satpol = await createSatpol(scene, { ground, blocked, collider, veh, onRespawn: (x, z) => camera.position.set(x, 6, z + 8), onBust: () => sfx.sting() });
const lights = createLights(scene, { veh, night: world.nightU });   // iter 40: lampu kendaraan malam
const bengkel = createBengkel(scene, { roads, ground, veh, toast: (m) => satpol.toast(m) });
const vcol = createVehicleCollisions({ veh, collider, blocked, onImpact: (a, b, imp) => {
  dmg.hit(a, imp); dmg.hit(b, imp);
  const me = veh.driving; if (a !== me && b !== me) return;
  sfx.crash(Math.min(1, imp / 18)); const o = me.obj.position;
  if (imp > 6 && satpol.witness(o.x, o.z, 45)) satpol.report(10, 'Hit and run!');
} });
traffic.onHorn = (x, z) => crowd.honk(x, z);
traffic.bind(satpol);
crowd.onHit = (v) => { if (v === veh.driving) { sfx.thud(); satpol.report(30, 'You ran over a pedestrian!'); } };
veh.onEnter = (v) => satpol.report(35, v.satpol ? 'You stole a Satpol PP bike!' : 'Carjacking!');
veh.onNear = (msg) => satpol.toast(msg);   // iter 45: toast saat mendekati kendaraan (jangkauan sama dengan tombol ENTER)
const qb = document.createElement('button');
const BTN = 'position:fixed;right:8px;z-index:99;background:#000b;color:#ffe9a8;border:1px solid #ffe9a866;padding:6px 9px;border-radius:6px;font:12px monospace;';
qb.style.cssText = BTN + 'top:46px';
const setQ = (q) => { quality = q; qb.textContent = 'Quality: ' + q; buildCity(); };
qb.textContent = 'Quality: ' + quality; qb.onclick = () => setQ({ Low: 'High', High: 'Ultra', Ultra: 'Low' }[quality]);
document.body.appendChild(qb);
const sb = document.createElement('button'); sb.style.cssText = BTN + 'top:228px'; sb.textContent = 'Sound: On';
const toggleSfx = () => { sb.textContent = 'Sound: ' + (sfx.toggle() ? 'Off' : 'On'); }; sb.onclick = toggleSfx; document.body.appendChild(sb);
addEventListener('keydown', e => { if (e.code === 'KeyM' && !e.repeat) toggleSfx(); });
[['Spawn', 0, 12], ['Perak', -1640, -565], ['Kenjeran', 898, 1385], ['Suramadu', 340, -60]].forEach(([n, x, z], i) => { // teleport untuk tes
  const b = document.createElement('button'); b.textContent = '>> ' + n; b.style.cssText = BTN + 'top:' + (84 + i * 36) + 'px';
  b.onclick = () => { player.position.set(x, 0, z); camera.position.set(x, 6, z + 8); }; document.body.appendChild(b); });
[['Darmo', -1130, 2800], ['Koridor', -740, 1640]].forEach(([n, x, z], i) => { // iter 86: teleport Darmo (dekat Taman Bungkul, Jl. Raya Darmo); iter 87: Koridor (di Jl. Raya Darmo Lanjutan, ~(-740,1640))
  const b = document.createElement('button'); b.textContent = '>> ' + n; b.style.cssText = BTN + 'top:' + (336 + i * 36) + 'px';
  b.onclick = () => { if (koridor) koridor.flush(x, z); if (darmoB) darmoB.flush(x, z); player.position.set(x, 0, z); camera.position.set(x, 6, z + 8); }; document.body.appendChild(b); });   // iter 88: flush = bangun chunk koridor di tujuan SEBELUM pindah
[['Pylon', 340, -1010], ['Madura', 340, -1985]].forEach(([n, x, z], i) => { // iter 52: teleport jembatan panjang (1:3)
  const b = document.createElement('button'); b.textContent = '>> ' + n; b.style.cssText = BTN + 'top:' + (264 + i * 36) + 'px';
  b.onclick = () => { player.position.set(x, 0, z); camera.position.set(x, 6, z + 8); }; document.body.appendChild(b); });

// Player: assets/player.glb kalau ada, kalau tidak -> karakter procedural
const player = await loadModel('player', () => makeCharacter({ hat: 'none', shirt: 0xd9423a, skin: SKINS[1], player: true }));
{ const tp = new URLSearchParams(location.search).get('tp'); if (tp) { const [x, z] = tp.split(',').map(Number); if (isFinite(x) && isFinite(z)) { if (koridor) koridor.flush(x, z); if (darmoB) darmoB.flush(x, z); player.position.set(x, 0, z); camera.position.set(x, 6, z + 8); console.log('[tp] ' + x + ',' + z); } } }   // iter 88: ?tp=x,z = teleport saat start (debug/harness)
scene.add(player);
// NPC demo: variasi karakter dari satu fungsi (peci, satpol, ojol, sarung)
const npcs = [
  { hat: 'satpol', shirt: 0x8a7a45, pants: 0x3a3a2a }, { hat: 'helm', shirt: 0x1faa59, skin: SKINS[3] },
  { hat: 'none', shirt: 0x6a8a3a, skin: SKINS[2] }, { hat: 'peci', shirt: 0xeeeeee, sarung: true, skin: SKINS[0] },
  { hat: 'none', shirt: 0xe0609a, pants: 0x222222, skin: SKINS[4], scale: 0.92 },
].map((o, i) => { const c = makeCharacter(o); c.position.set(-8 + i * 4, ground(-8 + i * 4, -14), -14); scene.add(c); return c; });   // iter 43: y mengikuti tanah (dulu 0 -> kaki terbenam di rumput yang lebih tinggi)

// Input
const ctl = createControls();
addEventListener('keydown', e => {
  if (e.code === 'KeyT') world.setSpeed(world.speed === 1 ? 30 : 1);
  const map = { Digit1: 'Low', Digit2: 'High', Digit3: 'Ultra' };
  if (map[e.code] && map[e.code] !== quality) setQ(map[e.code]);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let swimming = false;
const inWater = (x, z) => bridge.heightAt(x, z) == null && world.height(x, z) < -0.15;
const hud = createHUD(renderer, () => quality, () => `Time      : ${world.clock()}  (T = time x30)` + (veh.driving ? `\nSpeed     : ${Math.round(veh.speed)} km/h  (RUN = turbo)  HP ${Math.round(veh.driving.hp ?? 100)}%` : '') + (swimming ? '\nSwimming  : yes (Satpol cannot follow)' : '') + (weapons.held ? `\nWeapon    : ${weapons.stats().name} (${weapons.uses} hits left)  G = drop` : '') + `\nWanted    : ${'*'.repeat(satpol.stars) || '-'}   Fines: Rp ${satpol.fines.toLocaleString('en-US')}`);
const clock = new THREE.Clock();
const dir = new THREE.Vector3(), camTarget = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

const weapons = createWeapons(scene, { player, ground, blocked, collider, sfx, toast: (m) => satpol.toast(m), canAct: () => !veh.driving && !satpol.frozen && !health.dead && !swimming });   // iter 73: senjata
const impact = createImpact(scene);   // iter 72b: percikan kena pukul
const fight = createFight({ player, crowd, sfx, satpol, traffic, impact, weapons, lunge: (dx, dz) => { const nx = player.position.x + dx, nz = player.position.z + dz; if (!blocked(nx, nz)) { player.position.x = nx; player.position.z = nz; collider.resolve(player.position, 0.45); } }, canPunch: () => !veh.driving && !satpol.frozen && !health.dead && blastStun <= 0 && !swimming,
  canBeHit: () => !veh.driving && !satpol.frozen && !health.dead, onHurt: (dmg) => { health.hit(dmg); blastStun = Math.max(blastStun, 0.3); sfx.punch(1); sfx.oof(1); fight.shake = Math.max(fight.shake, 0.4); } });   // iter 69 (72b: suara + goyang kamera saat kena)
let camYaw = 0, moveSpeed = 0, T = 0, footHitCd = 0;
function tick() {
  let dt = Math.min(clock.getDelta(), 0.05);
  if (fight.hitstop > 0) { fight.hitstop -= dt; dt *= 0.06; }   // iter 74: hit-stop (jeda singkat saat pukulan kena)
  ctl.update(dt); camYaw = ctl.yaw;
  if (blastStun > 0) blastStun -= dt;
  { // iter 25: damage dari kendaraan yang dikendarai (tabrakan = hp kendaraan turun, terbakar) + regen + mati
    const dv = veh.driving;
    if (dv !== lastV) { lastV = dv; lastVhp = dv ? dv.hp : null; }
    if (dv && dv.hp !== undefined) { if (lastVhp !== null && dv.hp < lastVhp) health.hit((lastVhp - dv.hp) * 0.25); lastVhp = dv.hp; if (dv.burn > 5) health.hit(6 * dt); }
    if (!satpol.busted) health.update(dt);
    if (deathT > 0 && (deathT -= dt) <= 0) { satpol.respawn(player); health.reset(); blastStun = 0; }
  }
  if (footHitCd > 0) footHitCd -= dt;
  if (!veh.driving && footHitCd <= 0 && !health.dead && !satpol.busted) { // iter 34: pemain JALAN KAKI ditabrak kendaraan (>4 m/s) -> HP turun, terpental 1.5 m, jatuh 0.8 dtk
    for (const v of veh.list) {
      if (!v.obj.visible || Math.abs(v.sp) < 4) continue;
      const q = v.obj.position, dx = player.position.x - q.x, dz = player.position.z - q.z;
      if (Math.abs(dx) > 6 || Math.abs(dz) > 6 || Math.hypot(dx, dz) > ((v.T && v.T.r) || 1.2) + 0.5) continue;
      const n = Math.hypot(dx, dz) || 1, dmgN = Math.min(60, Math.round(Math.abs(v.sp) * 2.2));
      player.position.x += dx / n * 1.5; player.position.z += dz / n * 1.5; collider.resolve(player.position, 0.45);
      health.hit(dmgN); footHitCd = 1.5; blastStun = Math.max(blastStun, 0.8); sfx.thud(); satpol.toast('Hit by a vehicle!');
      console.log(`[hp] ditabrak ${v.type} ${Math.abs(v.sp).toFixed(1)} m/s -> -${dmgN}`); break;
    }
  }
  if (satpol.frozen || blastStun > 0) { ctl.x = 0; ctl.y = 0; ctl.run = false; } // BUSTED: input dibekukan
  const mag = Math.hypot(ctl.x, ctl.y);
  moveSpeed = 0;
  if (!veh.driving && mag > 0.05) {
    dir.set(ctl.x, 0, -ctl.y).normalize().applyAxisAngle(UP, camYaw);
    moveSpeed = (swimming ? (ctl.run ? 3.6 : 2.2) : (ctl.run ? 9 : 4.5)) * Math.min(1, mag);
    const px = player.position.x, pz = player.position.z;
    player.position.addScaledVector(dir, moveSpeed * dt);
    collider.resolve(player.position, 0.45);
    if (player.position.x < -2380 || player.position.x > 1380 || player.position.z < -3080 || player.position.z > 3940 || (player.position.z > 500 && player.position.x < -2000) || (player.position.z > 1800 && player.position.x > -205)) { player.position.x = px; player.position.z = pz; } // batas dunia (laut lepas)
    let d = ((Math.atan2(dir.x, dir.z) - player.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (!(fight.faceLock > 0)) player.rotation.y += d * Math.min(1, dt * 12);   // iter 74: selama auto-aim, jangan diputar balik oleh input
  }
  veh.update(dt, ctl, player);
  crowd.update(dt, player.position);
  if (grass) { const gp = veh.driving ? veh.driving.obj.position : player.position; grass.update(gp.x, gp.z); }
  music.update(dt, (veh.driving ? veh.driving.obj.position : player.position).x, (veh.driving ? veh.driving.obj.position : player.position).z);   // iter 27
  vcol.update(dt, player.position);
  dmg.update(dt, player.position);
  bengkel.update(dt);
  lights.update(dt, player.position);
  { const w = !veh.driving && inWater(player.position.x, player.position.z); if (w !== swimming) { swimming = w; sfx.thud(); console.log('[swim] ' + (w ? 'masuk air' : 'keluar air')); } }
  fight.update(dt, ctl);   // iter 69: tinju (72b: kombo/tendangan)
  impact.update(dt);
  weapons.update(dt); if (weapons.held && (health.dead || satpol.frozen)) weapons.lose(satpol.frozen && !health.dead);   // iter 73: WASTED = jatuh, BUSTED = disita
  satpol.update(dt, player);
  traffic.update(dt, player);
  sfx.siren(satpol.siren);
  animateCharacter(player, dt, moveSpeed);
  npcs.forEach((n, i) => animateCharacter(n, dt, i === 4 ? 3 : 0)); // NPC ke-5 jalan di tempat (demo animasi)
  player.position.y = swimming ? -0.95 : (bridge.heightAt(player.position.x, player.position.z) ?? (Math.max(0, world.height(player.position.x, player.position.z)) + roads.curbAt(player.position.x, player.position.z)));
  world.update(dt, player.position);
  if (city) city.update(camera.position.x, camera.position.z);
  if (koridor) koridor.update(camera.position.x, camera.position.z);
  if (darmoB) darmoB.update(camera.position.x, camera.position.z);   // iter 89   // iter 88: bangun chunk koridor yang didekati + sembunyikan yang jauh
  if (paving) paving.update(camera.position.x, camera.position.z);
  roads.update(world.nightU.value, camera.position.x, camera.position.z, quality);   // iter 72: jarak gambar pohon + goyang angin
  kampung.update();   // iter 66: lampu warung malam
  T += dt; districts.forEach(d => d.update(T, dt));
  if (veh.driving) { const d = ((veh.driving.h + Math.PI - ctl.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; ctl.yaw += d * Math.min(1, dt * 1.6); camYaw = ctl.yaw; } // kamera mengikuti belakang kendaraan
  const cd = veh.driving ? veh.driving.T.cam : 7;
  camTarget.set(Math.sin(camYaw) * cd, veh.driving ? cd * 0.5 : 4.5, Math.cos(camYaw) * cd).add(player.position);
  camera.position.lerp(camTarget, 1 - Math.pow(0.001, dt));
  const shk = fight.shake > 0 ? fight.shake * fight.shake * 0.35 : 0;   // iter 72b: goyang kamera (kuadrat supaya ekor halus); offset dipasang hanya untuk frame ini lalu dilepas
  const sx = shk ? (Math.random() - 0.5) * shk : 0, sy = shk ? (Math.random() - 0.5) * shk : 0, sz = shk ? (Math.random() - 0.5) * shk : 0;
  camera.position.x += sx; camera.position.y += sy; camera.position.z += sz;
  camera.lookAt(player.position.x, player.position.y + 1.4, player.position.z);
  renderer.render(scene, camera);
  camera.position.x -= sx; camera.position.y -= sy; camera.position.z -= sz;
  hud();
  window.__gameStarted = true; // dipakai watchdog test.html
  requestAnimationFrame(tick);
}
tick();
