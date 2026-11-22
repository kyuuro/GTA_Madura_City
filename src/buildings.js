// Bangunan procedural padat (InstancedMesh): badan + atap genteng / tandon air, jendela lewat shader (menyala malam).
import * as THREE from 'three';
import { loadKenney } from './assets.js';

const CITY_CELL = { Low: 30, High: 20, Ultra: 14 };
const CHUNK = 160, DRAW = { Low: 600, High: 850, Ultra: 1000 };   // iter 48: bangunan dipecah per chunk 160 m (culling frustum + bayangan per chunk) & jarak gambar per kualitas (fog sudah ~97% di 1000 m)
// Iterasi 16: tabel model Kenney [nama, lebar, tinggi, dalam] (unit Kenney; depan = +Z). Dipakai upgrade() di bawah.
const KB_COMM = [['a',.88,1.29,.94],['b',.97,1.29,.94],['c',.88,.89,1.09],['d',.84,1.29,.9],['e',1.64,.89,1.01],['f',.84,1.69,1.03],['g',.97,1.69,.92],['h',.88,1.29,1.01],['i',1.24,1.68,1.3],['j',2.08,1.69,1.34],['k',2.08,1.47,.94],['l',1.37,2.27,1.4],['m',1.24,3.15,1.24],['n',2.32,2.48,1.82]].map(a => ['commercial/building-' + a[0], a[1], a[2], a[3]]);
const KB_SKY = [['a',1.36,2.88,1.36],['b',1.36,4.48,1.36],['c',1.28,4.08,1.39],['d',1.28,5.47,1.39],['e',1.29,4.08,1.24]].map(a => ['commercial/building-skyscraper-' + a[0], a[1], a[2], a[3]]);
const KB_SUB = [['a',1.3,.83,1.03],['b',1.83,1.14,1.14],['c',1.29,1.03,1.03],['d',1.76,1.24,1.03],['e',1.3,1.14,1.03],['f',1.43,1.14,1.41],['g',1.45,.77,1.18],['h',1.3,.74,.92],['i',1.29,.74,1.03],['j',1.37,1.04,.92],['k',.92,1.15,1.02],['l',1.03,1.05,1.02],['m',1.43,.74,1.43],['n',1.78,1.14,1.38],['o',1.27,1.14,1.03],['p',1.24,.92,.99],['q',1.24,.92,.89],['r',1.03,1.14,1.02],['s',1.41,1.14,1.09],['t',1.31,1.16,1.41],['u',1.43,1.14,1.09]].map(a => ['suburban/building-type-' + a[0], a[1], a[2], a[3]]);
// Iterasi 57: rumah kampung = modul Kenney Retro Urban (kubus 1x1x1, detail pintu/jendela di sisi -Z model) + atap seng. Dirakit per rumah dari sel 3 m.
const KR_WALL = ['retro-urban/wall-a', 'retro-urban/wall-b'], KR_WIN = ['retro-urban/wall-a-window', 'retro-urban/wall-b-window'], KR_DOOR = ['retro-urban/wall-a-door', 'retro-urban/wall-b-door'], KR_ROOF = ['retro-urban/roof-metal-type-a', 'retro-urban/roof-metal-type-b'];
const KR_FENCE = 'retro-urban/wall-fence', KR_ALL = [...KR_WALL, ...KR_WIN, ...KR_DOOR, ...KR_ROOF, KR_FENCE], KR_CELL = 4.2, KR_H = 3.8, KR_ROOFY = 2.1, KR_FENCEY = 3.2;   // iter 60: dibesarkan (3.0/2.7 -> 4.2/3.8): karakter Kenney ~2.5 m (kepala besar), pintu dulu ~1.7 m
// Iterasi 63: varian rumah kampung dari 3 model Sketchfab (CC BY 4.0, lihat CREDITS.md): [path, lebar, tinggi, dalam (m, sudah diskala di tools/prep_houses.py)]; depan (teras/tangga) = -Z seperti modul retro-urban.
// KH_PROB = peluang rumah <=2 lantai jadi varian (30% rusty = 3 rb segitiga, 25% abandoned = 3,4 rb, 45% indo = 268). Set 0 untuk mematikan.
// Iterasi 80: varian ke-4 = minimarket Indomaret (Pojan, CC BY 4.0; tools/prep_indomaret.py, 3,3 rb segitiga, papan merah-biru-kuning). Bukan bagian KH_PROB: dipilih terpisah (IM_PROB) HANYA di rumah <=2 lantai yang dekat jalan (clearance < IM_NEAR), skala maks 1.0 (9,2 x 12,3 m), dilewati kalau petak terlalu sempit (<0.5). ?indomaret=0 mematikan.
const KH_VAR = [['rumah/rusty', 8.4, 7.4, 10.5], ['rumah/indo', 9.5, 5.9, 8.8], ['rumah/abandoned', 9.8, 6.4, 9.8], ['rumah/indomaret', 9.2, 5.2, 12.3]], KH_PROB = 0.4, IM_PROB = 0.12, IM_GAP = 110, IM_NEAR = 16, IM_ON = typeof location === 'undefined' || new URLSearchParams(location.search).get('indomaret') !== '0';
const PALETTE = [0xe8d8b8, 0xd9c09a, 0xbfd0c0, 0xe0b8a8, 0xc9c9c0, 0x9fb7c9, 0xe7e1d0, 0xd8a77a, 0xb5a58f, 0xf0e6c8];
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Iterasi 75: arah depan rumah (sisi terdekat jalan) dipakai bersama buildings (yaw model) & paving.js (halaman + jalur paving). k*PI/2: 0=+Z, 1=+X, 2=-Z, 3=-X.
function faceOfBuilding(o, b) {
  let best = 1e9, face = 0;
  for (let k = 0; k < 4; k++) { const dx = Math.round(Math.sin(k * Math.PI / 2)), dz = Math.round(Math.cos(k * Math.PI / 2)), reach = (dx ? b.w : b.d) / 2 + 4;
    const c = o.roads.clearance(b.x + dx * reach, b.z + dz * reach); if (c < best) { best = c; face = k * Math.PI / 2; } }
  return face;
}
// Iterasi 75: penempatan bangunan dipisah supaya bisa dites tanpa three.js (tools/tests/paving.test.mjs). Mengembalikan {B, R, cell}; R = generator acak yang DILANJUTKAN createBuildings (urutan sama seperti sebelumnya).
// Semua bangunan dapat b.face (arah depan); rumah (<=2 lantai) juga b.nx (jumlah modul lebar) dan b.doorI (modul pintu: dekat tengah, supaya jalur paving lurus ke pintu & celah pagar).
export function planCity(o) {
  const cell = CITY_CELL[o.quality], R = mulberry32(1337), B = [], imAt = [];
  for (let cx = -1300; cx <= 1000; cx += cell) for (let cz = -40; cz <= 890; cz += cell) {
    const x = cx + (R() - 0.5) * cell * 0.2, z = cz + (R() - 0.5) * cell * 0.2;
    const w = cell * (0.5 + R() * 0.32), d = cell * (0.5 + R() * 0.32), gy = o.height(x, z);
    if (gy < 0.25 || Math.hypot(x, z) < 32) continue;
    if (o.exclude && o.exclude(x, z, Math.hypot(w, d) / 2)) continue;
    const cl = o.roads.clearance(x, z); if (cl < Math.hypot(w, d) / 2 + 1.5) continue;
    const f = Math.exp(-((x / 700) ** 2 + ((z - 170) / 320) ** 2));
    const floors = 1 + Math.floor(R() * R() * (2 + 14 * f) + (cl < 12 ? 1 : 0));
    const b = { x, z, w, d, gy, floors, h: floors * 3.2 + 0.4 };
    if (floors <= 2) {   // iter 63: varian rumah Sketchfab; footprint = kotak model (kecil kalau petak sempit, dilewati kalau <60%)
      const hv = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
      const hm = Math.abs(Math.sin(x * 4.371 + z * 9.113) * 24634.63) % 1, im = KH_VAR[3], ims = Math.min(1, Math.min(w, d) * 0.92 / Math.max(im[1], im[3]));
      if (IM_ON && cl < IM_NEAR && hm < IM_PROB && ims >= 0.5 && imAt.every(p => Math.hypot(p[0] - x, p[1] - z) > IM_GAP)) { imAt.push([x, z]); b.v = 3; b.vs = ims; b.w = b.d = Math.max(im[1], im[3]) * ims; }   // iter 80: Indomaret
      else if (hv < KH_PROB) { const v = hv < KH_PROB * 0.3 ? 0 : hv < KH_PROB * 0.55 ? 2 : 1, m = KH_VAR[v], big = Math.max(m[1], m[3]), s = Math.min(0.9 + (hv * 97 % 1) * 0.25, Math.min(w, d) * 0.92 / big);
        if (s >= 0.6) { b.v = v; b.vs = s; b.w = b.d = big * s; } }
    }
    B.push(b);
    o.collider.add(x, z, b.w / 2, b.d / 2);
  }
  for (const b of B) {   // iter 75: semua bangunan dapat b.face (paving.js); rumah juga nx/doorI
    b.face = faceOfBuilding(o, b); if (b.floors > 2) continue;
    const sw = Math.abs(Math.sin(b.face)) > 0.5, W = sw ? b.d : b.w; b.nx = Math.max(1, Math.min(4, Math.floor((W * 0.9) / KR_CELL)));
    const hb = Math.abs(Math.sin(b.x * 3.1 + b.z * 5.7) * 9371.7) % 1; b.doorI = (b.nx - 1) >> 1; if (b.nx % 2 === 0 && hb < 0.5) b.doorI = b.nx >> 1;
  }
  return { B, R, cell };
}

// iter 80: papan Indomaret menyala malam - warna vertex jenuh (merah/kuning/biru) jadi emisi x uNight (material dikloning, rumah lain tak terpengaruh); ?indomaret_lamp=0 mematikan
const IM_LAMP = typeof location === 'undefined' || new URLSearchParams(location.search).get('indomaret_lamp') !== '0';
function imSignMat(src, night) {
  const m = src.clone(); if (!IM_LAMP || !night) return m;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNightIM = night;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNightIM;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n { float mxC = max(vColor.r, max(vColor.g, vColor.b)), sat = mxC - min(vColor.r, min(vColor.g, vColor.b)); totalEmissiveRadiance += vColor.rgb * smoothstep(0.35, 0.5, sat) * step(0.55, mxC) * uNightIM * 1.1; }\n#endif');
  };
  m.customProgramCacheKey = () => 'imsign'; return m;
}
// o: {quality, height(x,z), roads, collider, night:{value}}
export function createBuildings(scene, o) {
  const { B, R, cell } = planCity(o);
  const group = new THREE.Group(); scene.add(group);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = o.night;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
        wp4 = instanceMatrix * wp4;
        #endif
        vWP = (modelMatrix * wp4).xyz;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vWP; uniform float uNight;
        float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 wn = normalize(cross(dFdx(vWP), dFdy(vWP)));
        float a = abs(wn.x) > abs(wn.z) ? vWP.z : vWP.x;
        vec2 cl = vec2(a / 3.0, vWP.y / 3.2), fr = fract(cl);
        float win = step(abs(wn.y), 0.3) * step(0.22, fr.x) * step(fr.x, 0.78) * step(0.3, fr.y) * step(fr.y, 0.8) * step(1.0, cl.y);
        float winLit = win * step(0.55, hh(floor(cl))) * uNight;
        diffuseColor.rgb *= mix(1.0, 0.3, win * (1.0 - winLit));`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1.0, 0.82, 0.45) * winLit * 1.3;');
  };
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color();
  const bodyG = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), roofG = new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), tankG = new THREE.CylinderGeometry(0.7, 0.7, 1.1, 12).translate(0, 0.55, 0);
  const roofM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), tankM = new THREE.MeshStandardMaterial({ color: 0x4a6f93, roughness: 0.5 });
  const chunks = new Map();   // iter 48: satu InstancedMesh per chunk -> three.js membuang chunk di luar layar (kamera & bayangan) per chunk, bukan seluruh kota
  B.forEach(b => { const kx = Math.floor(b.x / CHUNK), kz = Math.floor(b.z / CHUNK), k = kx + ',' + kz; let c = chunks.get(k);
    if (!c) { c = { cx: (kx + 0.5) * CHUNK, cz: (kz + 0.5) * CHUNK, B: [], ms: [], use: new Map(), on: true }; chunks.set(k, c); }
    b.c = c; b.bi = c.B.length; c.B.push(b); });
  for (const c of chunks.values()) {
    const low = c.B.filter(b => b.floors <= 2), tall = c.B.filter(b => b.floors >= 4 && (b.x * 7 + b.z * 3 | 0) % 2 === 0);
    low.forEach((b, i) => b.li = i); tall.forEach((b, i) => b.ti = i);
    const body = new THREE.InstancedMesh(bodyG, mat, c.B.length), roof = new THREE.InstancedMesh(roofG, roofM, low.length), tank = new THREE.InstancedMesh(tankG, tankM, tall.length);
    body.castShadow = body.receiveShadow = roof.castShadow = tank.castShadow = true;
    c.B.forEach((b, i) => { body.setMatrixAt(i, M.compose(P.set(b.x, b.gy - 0.3, b.z), Q, S.set(b.w, b.h + 0.3, b.d)));
      body.setColorAt(i, C.setHex(PALETTE[(R() * PALETTE.length) | 0]).offsetHSL(0, 0, (R() - 0.5) * 0.08)); });
    low.forEach((b, i) => { roof.setMatrixAt(i, M.compose(P.set(b.x, b.gy + b.h, b.z), Q, S.set(b.w * 0.7637, 1.2 + R() * 1.2, b.d * 0.7637)));
      roof.setColorAt(i, C.setHex(0xb5532f).offsetHSL((R() - 0.5) * 0.03, 0, (R() - 0.5) * 0.12)); });
    tall.forEach((b, i) => tank.setMatrixAt(i, M.compose(P.set(b.x + b.w * 0.25, b.gy + b.h, b.z + b.d * 0.2), Q, S.set(1, 1, 1))));
    [body, roof, tank].forEach(m => { m.computeBoundingSphere(); group.add(m); c.ms.push(m); }); c.body = body; c.roof = roof; c.tank = tank;
  }
  // Iterasi 16: bangunan urban Kenney. <=2 lantai -> Suburban (rumah), 3-7 -> Commercial (ruko), >=8 -> Skyscraper. Depan menghadap jalan terdekat.
  // Balok/atap/tandon procedural yang diganti disembunyikan (skala 0). Model gagal muat -> bangunan itu tetap procedural.
  // Iterasi 51: jendela menyala malam di model Kenney. Kaca = petak biru colormap (b jauh > r, b >= g); dinding abu/putih & atap hijau tidak kena.
  // Material Kenney di-clone (cache) lalu dipatch: kaca menyala hangat acak per sel dunia (1.4 x 3.2 x 1.4 m) kalau malam, gelap kalau mati. Siang tidak berubah.
  const glassCache = new Map();
  function glassMat(m) {
    let g = glassCache.get(m); if (g) return g;
    g = m.clone(); const isWin = /window/i.test(m.name || '');   // iter 59: retro-urban punya material 'windows' (tekstur abu-abu, bukan biru) -> seluruh material = kaca
    g.onBeforeCompile = (sh) => {
      sh.uniforms.uNightG = o.night;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPg;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wpg = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
        wpg = instanceMatrix * wpg;
        #endif
        vWPg = (modelMatrix * wpg).xyz;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vWPg; uniform float uNightG;
        float hg(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 wng = normalize(cross(dFdx(vWPg), dFdy(vWPg)));
        float glass = ${isWin ? '1.0' : 'step(0.22, diffuseColor.b - diffuseColor.r) * step(diffuseColor.g, diffuseColor.b + 0.02)'} * step(abs(wng.y), 0.3);
        vec3 cg = floor(vec3(vWPg.x / 1.4, vWPg.y / 3.2, vWPg.z / 1.4));
        float glit = glass * step(0.5, hg(vec2(cg.x + cg.z * 7.0, cg.y))) * uNightG;
        diffuseColor.rgb *= mix(1.0, 0.45, glass * (1.0 - glit) * uNightG);`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1.0, 0.75, 0.38) * glit * 1.0;');
    };
    glassCache.set(m, g); return g;
  }
  let dead = false;
  async function upgrade() {
    const all = [...KB_COMM, ...KB_SKY, ...KB_SUB], res = await Promise.all(all.map(a => loadKenney(a[0]))), kres = await Promise.all(KR_ALL.map(n => loadKenney(n)));
    if (dead) return 0;
    const kp = new Map(); KR_ALL.forEach((n, i) => { const g = kres[i]; if (!g) return; g.updateMatrixWorld(true); const ps = []; g.traverse(o => { if (o.isMesh) ps.push({ geo: o.geometry.clone().applyMatrix4(o.matrixWorld), mat: o.material }); }); kp.set(n, ps); });
    const kampungOk = KR_WALL.some(n => kp.has(n)) && KR_ROOF.some(n => kp.has(n));
    const vres = await Promise.all(KH_VAR.map(a => loadKenney(a[0]))); if (dead) return 0;   // iter 63: model rumah Sketchfab (bukan Kenney; folder mengikuti loader)
    KH_VAR.forEach((a, i) => { const g = vres[i]; if (!g) return; g.updateMatrixWorld(true); const ps = []; g.traverse(o => { if (o.isMesh) ps.push({ geo: o.geometry.clone().applyMatrix4(o.matrixWorld), mat: o.material }); }); kp.set(a[0], ps); });
    const KH_NAMES = new Set(KH_VAR.map(a => a[0])); let nv = 0, ni = 0;
    const parts = new Map(); all.forEach((a, i) => { const g = res[i]; if (!g) return; g.updateMatrixWorld(true); const ps = []; g.traverse(o => { if (o.isMesh) ps.push({ geo: o.geometry.clone().applyMatrix4(o.matrixWorld), mat: o.material }); }); parts.set(a[0], ps); });
    if (!parts.size) return 0;
    const ok = (L) => L.filter(a => parts.has(a[0])), comm = ok(KB_COMM), sky = ok(KB_SKY), sub = ok(KB_SUB);
    const R2 = mulberry32(4242), Z = new THREE.Matrix4().makeScale(0, 0, 0), Y = new THREE.Vector3(0, 1, 0);
    let n = 0, nk = 0;
    const pick = (L, r) => { const a = L.filter(k => kp.has(k)); return a.length ? a[Math.floor(r * a.length) % a.length] : null; };
    const add = (b, name, x, y, z, yaw, sx, sy, sz) => { const use = b.c.use; if (!use.has(name)) use.set(name, []); use.get(name).push({ x, y, z, yaw, sx, sy, sz }); };
    function addKampungHouse(b, bi, rnd) {
      // arah depan = sisi terdekat jalan; model punya detail di -Z, jadi yaw + PI
      let best = 1e9, face = 0;
      for (let k = 0; k < 4; k++) { const dx = Math.round(Math.sin(k * Math.PI / 2)), dz = Math.round(Math.cos(k * Math.PI / 2)), reach = (dx ? b.w : b.d) / 2 + 4;
        const c = o.roads.clearance(b.x + dx * reach, b.z + dz * reach); if (c < best) { best = c; face = k * Math.PI / 2; } }
      const yaw = face + Math.PI, sw = Math.abs(Math.sin(face)) > 0.5, W = sw ? b.d : b.w, D = sw ? b.w : b.d;
      const nx = Math.max(1, Math.min(4, Math.floor((W * 0.9) / KR_CELL))), nz = Math.max(1, Math.min(3, Math.floor((D * 0.9) / KR_CELL))), lv = b.floors >= 2 && rnd() < 0.45 ? 2 : 1;
      const sxz = KR_CELL, sy = KR_H, ca = Math.cos(yaw), sa = Math.sin(yaw), doorI = (rnd(), b.doorI), wallV = rnd() < 0.5 ? 0 : 1, y0 = b.gy - 0.05;
      // lokal: x kiri-kanan, z ke depan = -Z model. (lx,lz) -> dunia lewat putaran yaw sumbu Y
      const wx = (lx, lz) => b.x + lx * ca + lz * sa, wz = (lx, lz) => b.z - lx * sa + lz * ca;
      for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
        const lx = (ix - (nx - 1) / 2) * sxz, lz = (iz - (nz - 1) / 2) * sxz;   // iz=0 = deretan depan di lz paling negatif (detail pintu/jendela di -Z model)
        for (let f = 0; f < lv; f++) {
          let nm;
          if (iz === 0) nm = f === 0 && ix === doorI ? pick(KR_DOOR, wallV) : pick(KR_WIN, (ix + f + wallV) % 2 / 2 + 0.01);
          else nm = pick(KR_WALL, ((ix + iz + f) % 2) / 2 + 0.01);
          if (nm) add(b, nm, wx(lx, lz), y0 + f * sy, wz(lx, lz), yaw, sxz, sy, sxz);
        }
      }
      // atap seng satu per sel di atas; selang-seling a/b, 'menjorok' 14% di X sudah dari model (1.14)
      for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
        const lx = (ix - (nx - 1) / 2) * sxz, lz = (iz - (nz - 1) / 2) * sxz, nm = pick(KR_ROOF, ((ix + iz) % 2) / 2 + 0.01);
        if (nm) add(b, nm, wx(lx, lz), y0 + lv * sy, wz(lx, lz), yaw, sxz, KR_ROOFY, sxz);
      }
      // pagar depan (iter 58): panel wall-fence 3 m x 1,2 m, satu per modul, celah di depan pintu; dilewati kalau terlalu dekat jalan
      if (kp.has(KR_FENCE)) { const lzF = -(nz * KR_CELL) / 2 - 1.8;
        for (let ix = 0; ix < nx; ix++) { if (ix === doorI) continue; const lx = (ix - (nx - 1) / 2) * sxz, fx = wx(lx, lzF), fz = wz(lx, lzF);
          if (o.roads.clearance(fx, fz) < 1.2) continue; add(b, KR_FENCE, fx, b.gy - 0.05, fz, yaw, sxz, KR_FENCEY, 1); } }
      nk++;
      b.c.body.setMatrixAt(b.bi, Z); if (b.li !== undefined) b.c.roof.setMatrixAt(b.li, Z); if (b.ti !== undefined) b.c.tank.setMatrixAt(b.ti, Z);
    }
    B.forEach((b, bi) => {
      if (b.v !== undefined && kp.has(KH_VAR[b.v][0])) {   // iter 63: varian Sketchfab; yaw sama dengan rumah kampung (depan = -Z model -> sisi terdekat jalan)
        let best = 1e9, face = 0;
        for (let k = 0; k < 4; k++) { const dx = Math.round(Math.sin(k * Math.PI / 2)), dz = Math.round(Math.cos(k * Math.PI / 2)), reach = (dx ? b.w : b.d) / 2 + 4;
          const c = o.roads.clearance(b.x + dx * reach, b.z + dz * reach); if (c < best) { best = c; face = k * Math.PI / 2; } }
        add(b, KH_VAR[b.v][0], b.x, b.gy - 0.15, b.z, face + Math.PI, b.vs, b.vs, b.vs); nv++; n++; if (b.v === 3) ni++;
        b.c.body.setMatrixAt(b.bi, Z); if (b.li !== undefined) b.c.roof.setMatrixAt(b.li, Z); if (b.ti !== undefined) b.c.tank.setMatrixAt(b.ti, Z); return;
      }
      if (b.floors <= 2 && kampungOk) { addKampungHouse(b, bi, R2); n++; return; }   // iter 57: rumah kampung Retro Urban menggantikan rumah suburban
      const list = b.floors <= 2 ? sub : b.floors >= 8 ? (sky.length ? sky : comm) : comm; if (!list.length) return;
      // arah depan: salah satu dari 4 arah yang paling dekat ke jalan
      let best = 1e9, yaw = 0;
      for (let k = 0; k < 4; k++) { const dx = Math.round(Math.sin(k * Math.PI / 2)), dz = Math.round(Math.cos(k * Math.PI / 2)), reach = (dx ? b.w : b.d) / 2 + 4;
        const c = o.roads.clearance(b.x + dx * reach, b.z + dz * reach); if (c < best) { best = c; yaw = k * Math.PI / 2; } }
      const swap = Math.abs(Math.sin(yaw)) > 0.5, W = swap ? b.d : b.w, D = swap ? b.w : b.d;
      // pilih model: skala muat di footprint, tinggi paling dekat target
      const sc = list.map(a => { const s = Math.min(W / a[1], D / a[3]) * (b.floors <= 2 ? 0.85 : 0.92); return { a, s, e: Math.abs(a[2] * s - b.h) + R2() * 4 }; }).sort((p, q) => p.e - q.e)[0];
      let s = sc.s, sy = s; if (b.floors <= 2) sy = Math.min(s, (b.h + 2.5) / sc.a[2]); else sy = s * Math.max(0.75, Math.min(1.5, b.h / (sc.a[2] * s)));
      const use = b.c.use; if (!use.has(sc.a[0])) use.set(sc.a[0], []); use.get(sc.a[0]).push({ x: b.x, y: b.gy - 0.3, z: b.z, yaw, sx: s, sy, sz: s });
      b.c.body.setMatrixAt(b.bi, Z); if (b.li !== undefined) b.c.roof.setMatrixAt(b.li, Z); if (b.ti !== undefined) b.c.tank.setMatrixAt(b.ti, Z); n++;
    });
    for (const c of chunks.values()) c.body.instanceMatrix.needsUpdate = c.roof.instanceMatrix.needsUpdate = c.tank.instanceMatrix.needsUpdate = true;
    const mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), pp = new THREE.Vector3(), ss = new THREE.Vector3();
    const names = new Set(); for (const c of chunks.values()) for (const k of c.use.keys()) names.add(k);
    for (const c of chunks.values()) for (const [name, arr] of c.use) for (const pt of (parts.get(name) || kp.get(name))) {
      const im = new THREE.InstancedMesh(pt.geo, name === KH_VAR[3][0] ? imSignMat(pt.mat, o.night) : KH_NAMES.has(name) ? pt.mat : glassMat(pt.mat), arr.length); im.castShadow = im.receiveShadow = true; im.visible = c.on;
      arr.forEach((u, i) => { qq.setFromAxisAngle(Y, u.yaw); im.setMatrixAt(i, mm.compose(pp.set(u.x, u.y, u.z), qq, ss.set(u.sx, u.sy, u.sz))); });
      im.computeBoundingSphere(); group.add(im); c.ms.push(im);
    }
    console.log(`[buildings] ${n}/${B.length} bangunan -> Kenney (${names.size} model: ${nk} rumah kampung Retro Urban, ${nv} rumah varian Sketchfab (${ni} Indomaret), ${sub.length} rumah, ${comm.length} ruko, ${sky.length} gedung tinggi)`); return n;
  }
  const dmax = DRAW[o.quality] + CHUNK * 0.75;
  function update(px, pz) {   // iter 48: sembunyikan chunk di luar jarak gambar (fog sudah menutupinya)
    for (const c of chunks.values()) { const on = Math.hypot(c.cx - px, c.cz - pz) < dmax; if (on !== c.on) { c.on = on; c.ms.forEach(m => { m.visible = on; }); } }
  }
  return { group, count: B.length, list: B, cell, upgrade, update,
    dispose() { dead = true; scene.remove(group); group.children.forEach(m => { m.geometry.dispose(); m.dispose(); }); mat.dispose(); roofM.dispose(); tankM.dispose(); glassCache.forEach(g => g.dispose()); } };
}
