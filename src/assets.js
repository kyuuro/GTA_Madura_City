// Loader aset + ADAPTER model: coba assets/<nama>.glb (atau window.__GLB[nama] di test.html), kalau tidak ada -> fallback procedural.
// Adapter menormalkan model luar supaya cocok dengan game: depan = +Z, skala = MODEL_CFG.length (m), alas di y=0, titik tengah di 0,
// roda (node bernama wheel/tire/tyre/roda) dipasang pivot di pusat roda dan dinamai wheelFL/FR/RL/RR (motor: wheelF/wheelR + 'fork' untuk stang).
// Depan terbalik? edit `yaw` di MODEL_CFG (derajat), atau tes cepat lewat URL: index.html?yaw_car=180
import * as THREE from 'three';
const cache = new Map();
export const MODEL_CFG = {
  car: { length: 4.3, yaw: 0 },
  motor: { length: 2.6, yaw: 0 },   // iter 64: 1.9 -> 2.6 (terlalu kecil vs karakter Kenney ~2.3 m)
  // Iterasi 79: dua skuter baru (assets/beat.glb, mio.glb dari tools/prep_motor2.py: node body/fork_front/roda_F/roda_R, depan +Z). moto = diperlakukan seperti 'motor' (2 roda + garpu berbelok)
  beat: { length: 2.6, yaw: 0, moto: true },
  mio: { length: 2.6, yaw: 0, moto: true },
  angkot: { length: 4.6, yaw: 0 },
  player: { height: 1.8, yaw: 0 },
  // Iterasi 15: variasi lalu lintas dari assets/vehicles-pack (depan = +Z, 4 roda, tanpa yaw). `file` = path di assets/ tanpa .glb
  taxi: { length: 4.5, yaw: 0, file: 'vehicles-pack/taxi' },
  hatch: { length: 3.9, yaw: 0, file: 'vehicles-pack/hatchback' },
  pickup: { length: 5.0, yaw: 0, file: 'vehicles-pack/pickup' },
  suv: { length: 4.7, yaw: 0, file: 'vehicles-pack/suv' },
  // Iterasi 28: batch 2 vehicles-pack
  sedan: { length: 4.6, yaw: 0, file: 'vehicles-pack/sedan' },
  sports: { length: 4.4, yaw: 0, file: 'vehicles-pack/sports' },
  muscle: { length: 4.8, yaw: 0, file: 'vehicles-pack/muscle' },
  truck: { length: 5.6, yaw: 0, multi: true, file: 'vehicles-pack/truck' },   // iter 83: gandar belakang ganda -> satu pivot per gandar (dulu satu pivot untuk 2 gandar = roda mengorbit 'cyclone')
  // Iterasi 29: batch 3 (layanan darurat)
  police: { length: 4.6, yaw: 0, file: 'vehicles-pack/police_sedan' },
  polsuv: { length: 4.8, yaw: 0, file: 'vehicles-pack/police_suv' },
  ambulance: { length: 5.2, yaw: 0, file: 'vehicles-pack/ambulance' },
  firetruck: { length: 8.4, yaw: 0, file: 'vehicles-pack/firetruck' },
  // Iterasi 35: batch 4 (parkir di Spawn)
  muscle2: { length: 4.8, yaw: 0, file: 'vehicles-pack/muscle_2' },
  polmuscle: { length: 4.8, yaw: 0, file: 'vehicles-pack/police_muscle' },
  polsports: { length: 4.4, yaw: 0, file: 'vehicles-pack/police_sports' },
  roadster: { length: 4.4, yaw: 0, file: 'vehicles-pack/roadster' },
  monster: { length: 5.2, yaw: 0, file: 'vehicles-pack/monster_truck' },
  limo: { length: 7.4, yaw: 0, file: 'vehicles-pack/limousine' },
  bus: { length: 10.5, yaw: 0, file: 'vehicles-pack/bus' },   // iter 37
  trailer: { length: 13.6, yaw: 0, multi: true, file: 'vehicles-pack/truck_with_trailer' },   // iter 38: 12 roda
  // Iterasi 30/31: becak (props/becak.glb). Model aslinya miring ~45 derajat di XZ; yaw 45.5 meluruskan. Depan = sisi DUA roda (kabin penumpang, becak Jawa), belakang = 1 roda. Roda sudah dipisah jadi node 'wheel_*' di GLB (3 roda: FL, FR, RR/RL) -> berputar. Kalau terbalik: ?yaw_becak=180
  becak: { length: 2.7, yaw: 45.5, file: 'props/becak' },
};
const WHEEL_RE = /wheel|tire|tyre|roda/i, FORK_RE = /fork|handle|steer|stang/i;
const bx = (o) => new THREE.Box3().setFromObject(o);

function topMatches(root, re) {            // node yang namanya cocok, tanpa node di dalam node cocok lain
  const out = [];
  (function walk(n) { for (const c of n.children) { if (re.test(c.name || '')) out.push(c); else walk(c); } })(root);
  return out;
}
export function fitModel(src, name) {
  const cfg = MODEL_CFG[name] || {}, holder = new THREE.Group(), inner = new THREE.Group();
  inner.add(src); holder.add(inner); holder.updateMatrixWorld(true);
  let sz = bx(inner).getSize(new THREE.Vector3());
  if (!cfg.height && sz.x > sz.z * 1.15) inner.rotation.y = Math.PI / 2;          // sumbu terpanjang -> Z
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('yaw_' + name) : null;
  inner.rotation.y += ((cfg.yaw || 0) + (q ? parseFloat(q) || 0 : 0)) * Math.PI / 180;
  holder.updateMatrixWorld(true); sz = bx(inner).getSize(new THREE.Vector3());
  const k = cfg.height ? cfg.height / (sz.y || 1) : (cfg.length || sz.z) / (sz.z || 1);
  inner.scale.setScalar(k); holder.updateMatrixWorld(true);
  const b = bx(inner), c = b.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -b.min.y, -c.z); holder.updateMatrixWorld(true);
  inner.traverse(m => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = true; } });
  if (cfg.height) return holder;
  // ---- roda ----
  const wn = topMatches(inner, WHEEL_RE);
  if (!wn.length) { console.log(`[assets] ${name}: node roda tidak ditemukan (nama harus mengandung wheel/tire/roda), roda tidak berputar`); return holder; }
  const info = wn.map(n => ({ n, c: bx(n).getCenter(new THREE.Vector3()) }));
  const sizeB = bx(inner).getSize(new THREE.Vector3()), maxX = Math.max(...info.map(i => Math.abs(i.c.x)));
  const moto = name === 'motor' || !!cfg.moto, two = moto || maxX < sizeB.x * 0.3, groups = {};
  for (const i of info) { const key = (i.c.z >= 0 ? 'F' : 'R') + (two ? '' : (i.c.x >= 0 ? 'R' : 'L')); (groups[key] ||= []).push(i); }
  const pivots = {};
  for (const [key, arr] of Object.entries(groups)) {
    const parts = [];   // iter 38: cfg.multi = banyak gandar -> satu pivot per roda (kelompok z berjarak >0.5 m), nama wheel<key><n>
    if (cfg.multi) { for (const i of [...arr].sort((a, b) => a.c.z - b.c.z)) { const l = parts[parts.length - 1]; if (l && Math.abs(i.c.z - l[l.length - 1].c.z) < 0.5) l.push(i); else parts.push([i]); } } else parts.push(arr);
    parts.forEach((part, pi) => {
      const c = new THREE.Vector3(); part.forEach(i => c.add(i.c)); c.divideScalar(part.length);
      const p = new THREE.Group(); p.name = 'wheel' + key + (pi || ''); p.position.copy(c); holder.add(p); p.updateMatrixWorld(true);
      part.forEach(i => p.attach(i.n)); pivots[key + (pi || '')] = p;
    });
  }
  if (moto && pivots.F) {                // stang + roda depan berbelok bersama ('fork')
    const f = pivots.F, fork = new THREE.Group(); fork.name = 'fork'; fork.position.set(f.position.x, 0, f.position.z); holder.add(fork); fork.updateMatrixWorld(true);
    fork.attach(f);
    for (const n of topMatches(inner, FORK_RE)) if (bx(n).getCenter(new THREE.Vector3()).z > 0) fork.attach(n);
  }
  console.log(`[assets] ${name}: ${Object.keys(pivots).length} grup roda (${Object.keys(pivots).join(',')}), skala x${k.toFixed(3)}`);
  return holder;
}

const failed = new Set();   // nama model yang gagal dimuat (iter 41)
export async function loadModel(name, fallbackFn) {
  if (failed.has(name)) return fallbackFn();   // iter 41: fallback dibuat BARU tiap panggilan (clone() membuang userData.retroAnim & skeleton ikut asli -> pemain pose T)
  if (cache.has(name)) return cache.get(name).clone();
  let obj;
  try {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const url = await glbUrl((typeof window !== 'undefined' && window.__GLB && window.__GLB[name]) || `assets/${(MODEL_CFG[name] && MODEL_CFG[name].file) || name}.glb`);
    const g = await new GLTFLoader().loadAsync(url);
    obj = fitModel(g.scene, name);
    console.log(`[assets] ${name}.glb dimuat`);
  } catch (e) {
    console.log(`[assets] ${name}.glb tidak ada / gagal (${e && e.message ? e.message : e}), pakai fallback`);
    failed.add(name); return fallbackFn();
  }
  cache.set(name, obj);
  return obj.clone();
}
// Model kit Kenney (belum dinormalkan; 1 unit Kenney ~ 10 m di game, skala diatur pemanggil). path mis. 'roads/light-square'.
// Urutan: window.__GLB['kenney/<path>'] (test.html, tekstur sudah ditanam) -> assets/kenney/<path>.glb. Gagal -> null (pemanggil pakai procedural).
// iter 24: test.html menyimpan GLB sebagai 'gz:<base64 gzip>' (hemat ~60%); di sini dibuka dengan DecompressionStream -> blob URL
export async function glbUrl(u) {
  if (typeof u !== 'string' || !u.startsWith('gz:')) return u;
  if (typeof DecompressionStream === 'undefined') throw new Error('browser tanpa DecompressionStream');
  const bin = Uint8Array.from(atob(u.slice(3)), (c) => c.charCodeAt(0));
  const ab = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return URL.createObjectURL(new Blob([ab], { type: 'model/gltf-binary' }));
}
const kcache = new Map();
export function loadKenney(path) {
  if (!kcache.has(path)) kcache.set(path, (async () => {
    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const url = await glbUrl((typeof window !== 'undefined' && window.__GLB && window.__GLB['kenney/' + path]) || `assets/kenney/${path}.glb`);
      const g = await new GLTFLoader().loadAsync(url);
      console.log(`[kenney] ${path} dimuat`); return g.scene;
    } catch (e) { console.log(`[kenney] ${path} gagal (${e && e.message ? e.message : e}), pakai procedural`); return null; }
  })());
  return kcache.get(path);
}
export function tri(geo) { return geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3; }
export { THREE };
