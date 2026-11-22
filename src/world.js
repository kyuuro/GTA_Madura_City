// Iterasi 1: terrain, Selat Madura (shader air), langit, siklus siang-malam, kabut.
// Layout: Surabaya = daratan z > ~-120 (selatan), selat di tengah, Madura z < ~-1900 (utara; iter 52: skala 1:3, selat ~1.800 unit).
import * as THREE from 'three';

export const BRIDGE_PAD_H = 1.0;   // tinggi tanggul pangkal jembatan (iter 68)
const sstep = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };

// Iterasi 54: pantai TIMUR Surabaya (Kenjeran) skala 1:3, koordinat game = geo13 + (340,-105) (kaki jembatan). Daratan x < eastShore(z); di timurnya Selat Madura.
export const EAST_COAST = [[340, -105], [590, 195], [780, 485], [880, 685], [915, 895], [930, 1195], [960, 1415], [1100, 1695], [1170, 1850]];
export function eastShore(z) {
  const C = EAST_COAST; let x;
  if (z <= C[0][1]) return C[0][0];
  let i = 1; while (i < C.length - 1 && z > C[i][1]) i++;
  const a = C[i - 1], b = C[i]; x = a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]);
  return x + 5 * Math.sin(z * 0.021) + 3 * Math.sin(z * 0.057 + 1);
}
// Iterasi 55: pantai UTARA Surabaya ke barat melengkung ke utara menuju Tanjung Perak (tanjung z~-650 di x -1400..-2000); timur x>-300 tetap z~-120.
const NORTH_COAST = [[-2500, -560], [-2000, -650], [-1400, -650], [-1200, -520], [-900, -330], [-600, -200], [-300, -120]];
function northBase(x) {
  const C = NORTH_COAST; if (x >= C[C.length - 1][0]) return -120; if (x <= C[0][0]) return C[0][1];
  let i = 1; while (x > C[i][0]) i++;
  const a = C[i - 1], b = C[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
}
// Tinggi tanah di (x,z). Negatif = dasar laut. Diekspor untuk kendaraan/NPC/jalan nanti.
export function terrainHeight(x, z) {
  const shore1 = northBase(x) + 25 * Math.sin(x * 0.01) + 10 * Math.sin(x * 0.035 + 1);
  const shore2 = -1900 + 30 * Math.sin(x * 0.008) + 12 * Math.sin(x * 0.03);
  const d1 = z - shore1, d2 = shore2 - z;
  const n = Math.sin(x * 0.07) * Math.cos(z * 0.06) * 0.15;
  const h1 = d1 < 0 ? Math.max(d1 * 0.08, -8) : Math.min(d1 * 0.08, 0.6) + n * sstep(0, 20, d1);
  const hill = Math.max(0, d2 - 80) * 0.025 * (0.6 + 0.4 * Math.sin(x * 0.006 + 2) * Math.cos(z * 0.01));
  const h2 = d2 < 0 ? Math.max(d2 * 0.08, -8) : Math.min(d2 * 0.08, 0.6) + hill + n * sstep(0, 20, d2);
  let h = Math.max(h1, h2);
  if (z > -110) { const dE = eastShore(z) - x; h = Math.min(h, dE < 0 ? Math.max(dE * 0.08, -8) : Math.min(dE * 0.08, 0.6) + n * sstep(0, 20, dE)); }   // iter 54: laut di timur
  // iter 68: TANGGUL pangkal jembatan. Dulu jalan Akses (x 331..349, z>-105) & ujung Madura berada di tepi pantai/laut (terrain -0,6..0,7, air bergelombang naik sampai +0,5) -> air masuk ke jalan.
  // Di sini daratan diurug rata setinggi BRIDGE_PAD_H selama sisi jalan + bahu (|x-340| < 15, lereng sampai 32): Surabaya z -62..-120 (ujung utara lereng ke laut sampai -146), Madura z -1900..-1990.
  const px = 1 - sstep(15, 32, Math.abs(x - 340));
  if (px > 0) { const w = px * Math.max(sstep(-30, -62, z) * (1 - sstep(-120, -146, z)), sstep(-1880, -1900, z) * (1 - sstep(-1990, -2030, z)));
    if (w > 0) h = Math.max(h, h * (1 - w) + BRIDGE_PAD_H * w); }
  return h;
}

const SKY_V = `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const SKY_F = `
varying vec3 vP; uniform vec3 zenith, horizon, sunDir, sunCol; uniform float night;
float hash(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
void main(){
  vec3 d = normalize(vP); float h = clamp(d.y,0.,1.);
  vec3 c = mix(horizon, zenith, pow(h,.45));
  float s = max(dot(d,sunDir),0.);
  c += sunCol*(pow(s,900.)*6. + pow(s,12.)*.35);
  float st = step(.9965, hash(floor(d*260.))) * night * step(0.,d.y);
  c += vec3(st);
  gl_FragColor = vec4(c,1.);
}`;
const WATER_V = `
varying vec3 vW; uniform float time;
void main(){
  vec4 w = modelMatrix*vec4(position,1.);
  w.y += sin(w.x*.05+time*1.2)*.25 + sin(w.z*.07+time*.9)*.2 + sin((w.x+w.z)*.15+time*2.)*.08;
  vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w;
}`;
const WATER_F = `
varying vec3 vW; uniform float time, day, fogNear, fogFar; uniform vec3 deep, horizon, sunDir, sunCol, fogCol;
void main(){
  vec3 v = normalize(cameraPosition - vW);
  vec2 g = vec2(cos(vW.x*.05+time*1.2)*.0125 + cos((vW.x+vW.z)*.15+time*2.)*.012,
                cos(vW.z*.07+time*.9)*.014 + cos((vW.x+vW.z)*.15+time*2.)*.012);
  g += .07*vec2(sin(vW.x*.7+time*2.1)+sin(vW.z*1.3-time*1.4), cos(vW.z*.8+time*1.8)+cos(vW.x*1.1+time));
  vec3 n = normalize(vec3(-g.x,1.,-g.y));
  float f = pow(1.-max(dot(n,v),0.),3.);
  vec3 c = mix(deep, horizon, clamp(f+.1,0.,1.));
  c += sunCol*pow(max(dot(reflect(-sunDir,n),v),0.),140.)*2.5*day;
  float fog = smoothstep(fogNear, fogFar, distance(cameraPosition,vW));
  gl_FragColor = vec4(mix(c,fogCol,fog), .94);
}`;

const MAD_COLS = [0x7d8f45, 0xb3a064, 0x9a8c58, 0x8a9a4e, 0xc2b080];
function madColor(c, x, z, h) {
  const p = Math.sin(x * 0.011 + 1) * Math.sin(z * 0.014) + 0.6 * Math.sin(x * 0.029 + z * 0.023), i = Math.min(4, Math.max(0, Math.floor((p + 1.6) / 3.2 * 5)));
  c.set(MAD_COLS[i]); if (h < 0.9 && z > -2010) c.set(0xd9d3c0);   // tambak garam di dekat pantai
}

export function createWorld(scene, camera) {
  // --- Cahaya ---
  const hemi = new THREE.HemisphereLight(0xffffff, 0x4a3a2a, 0.8);
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, far: 500 });
  sun.shadow.mapSize.set(2048, 2048);
  const moon = new THREE.DirectionalLight(0x9db4e8, 0);   // iter 39: cahaya bulan (tanpa bayangan) supaya malam tidak hitam pekat
  scene.add(hemi, sun, sun.target, moon, moon.target);

  // --- Terrain 250x250 = ~125k segitiga ---
  // iter 52: dunia memanjang ke utara (z -3100..1000) untuk Suramadu skala 1:3; sel ~8 m, ~256k segitiga
  const CXs = 2400 / 267, CZs = 4900 / 545;   // ukuran sel grid utama; patch barat memakai grid yang SAMA (tanpa retak di x=-1000)
  const geo = new THREE.PlaneGeometry(2400, 4900, 267, 545); geo.rotateX(-Math.PI / 2); geo.translate(200, 0, -650);   // x -1000..1400, z -3100..1800
  // iter 55: patch barat (Tanjung Perak) x -2402..-1000, z -897..496 (156x155 sel, sel sama dgn grid utama)
  const geoW = new THREE.PlaneGeometry(156 * CXs, 155 * CZs, 156, 155); geoW.rotateX(-Math.PI / 2); geoW.translate(-1000 - 78 * CXs, 0, -3100 + 322.5 * CZs);
  const c = new THREE.Color();
  function fillTerrain(g) {
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = terrainHeight(x, z);
      pos.setY(i, h);
      const nz = 0.5 + 0.5 * Math.sin(x * 0.11) * Math.sin(z * 0.13);
      if (h < -0.4) c.set(0x3a3a2e);
      else if (h < 0.12) c.set(0xcdb98a);
      else if (z < -1940) madColor(c, x, z, h);   // iter 53: Madura = ladang tembakau / tanah kering / tambak garam
      else if (h > 3) c.set(0x7a7a64).lerp(new THREE.Color(0x5d7040), 0.3);
      else c.set(0x6b6a50).lerp(new THREE.Color(0x6f8a4a), nz);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  }
  // iter 86: patch SELATAN (koridor + Darmo), sel SAMA dgn grid utama (tanpa retak). S1: x -1000-112 sel..-1000, z -3100+400 sel (=496,3; sambung terrainW) .. +385 sel (~3956). S2: x -1000..-1000+89 sel (~-200), z 1800 (sambung utama) .. +240 sel (~3958).
  const zS = -3100 + 400 * CZs;
  const geoS1 = new THREE.PlaneGeometry(112 * CXs, 385 * CZs, 112, 385); geoS1.rotateX(-Math.PI / 2); geoS1.translate(-1000 - 56 * CXs, 0, zS + 192.5 * CZs);
  const geoS2 = new THREE.PlaneGeometry(89 * CXs, 240 * CZs, 89, 240); geoS2.rotateX(-Math.PI / 2); geoS2.translate(-1000 + 44.5 * CXs, 0, 1800 + 120 * CZs);
  fillTerrain(geo); fillTerrain(geoW); fillTerrain(geoS1); fillTerrain(geoS2);
  const tmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const terrain = new THREE.Mesh(geo, tmat), terrainW = new THREE.Mesh(geoW, tmat);
  const terrainS1 = new THREE.Mesh(geoS1, tmat), terrainS2 = new THREE.Mesh(geoS2, tmat);
  terrain.receiveShadow = terrainW.receiveShadow = terrainS1.receiveShadow = terrainS2.receiveShadow = true; scene.add(terrain, terrainW, terrainS1, terrainS2);

  // --- Air (300x300 = 180k segitiga) ---
  const wu = { time: { value: 0 }, day: { value: 1 }, fogNear: { value: 80 }, fogFar: { value: 1100 },
    deep: { value: new THREE.Color(0x0e3a4a) }, horizon: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, fogCol: { value: new THREE.Color() } };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3400, 5600, 272, 448).rotateX(-Math.PI / 2).translate(400, 0, -600),
    new THREE.ShaderMaterial({ uniforms: wu, vertexShader: WATER_V, fragmentShader: WATER_F, transparent: true }));
  const waterW = new THREE.Mesh(new THREE.PlaneGeometry(1500, 2100, 120, 168).rotateX(-Math.PI / 2).translate(-2050, 0, -150), water.material);   // iter 55: x -2800..-1300, z -1200..900 (sel 12.5 = grid air utama)
  water.position.y = waterW.position.y = -0.02; scene.add(water, waterW);

  // --- Langit ---
  const su = { zenith: { value: new THREE.Color() }, horizon: wu.horizon, sunDir: wu.sunDir, sunCol: wu.sunCol, night: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16),
    new THREE.ShaderMaterial({ uniforms: su, vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false }));
  sky.renderOrder = -1; scene.add(sky);

  // --- Siklus siang-malam: t 0..1 (0 = tengah malam, 0.25 = 06:00) ---
  const DAY_LEN = 240; // detik nyata per hari
  let t = 0.3, speed = 1;   // iter 36: mulai 07:12 (pagi); sebelumnya 0.7 = 16:48 (sebentar lagi malam)
  const K = { zD: new THREE.Color(0x3f7fd0), zN: new THREE.Color(0x0e1a3a), hD: new THREE.Color(0xbfd8ee),
    hN: new THREE.Color(0x1c2a52), hT: new THREE.Color(0xff8a3d), sW: new THREE.Color(0xfff3e0), sT: new THREE.Color(0xff9a50) };
  const tmp = new THREE.Color();

  function apply() {
    const elev = Math.sin((t - 0.25) * Math.PI * 2);
    const day = sstep(-0.12, 0.3, elev), tw = Math.exp(-Math.pow(elev / 0.22, 2));
    wu.sunDir.value.set(Math.cos((t - 0.25) * Math.PI * 2) * 0.8, elev, 0.6).normalize();
    wu.horizon.value.copy(K.hN).lerp(K.hD, day).lerp(K.hT, tw * 0.75);
    su.zenith.value.copy(K.zN).lerp(K.zD, day).lerp(K.hT, tw * 0.15);
    wu.sunCol.value.copy(K.sW).lerp(K.sT, tw);
    su.night.value = 1 - day; wu.day.value = day;
    wu.fogCol.value.copy(wu.horizon.value);
    wu.deep.value.set(0x0e3a4a).multiplyScalar(0.2 + 0.8 * day).lerp(tmp.set(0x4a3a30), tw * 0.2);
    scene.fog.color.copy(wu.horizon.value);
    sun.color.copy(wu.sunCol.value);
    sun.intensity = 1.8 * Math.max(0, Math.min(1, elev * 4 + 0.2)) * (0.3 + 0.7 * day);
    hemi.color.copy(wu.horizon.value).lerp(tmp.set(0xffffff), 0.3 * day).lerp(tmp.set(0x7088c8), (1 - day) * 0.8); hemi.intensity = 0.38 + 0.52 * day;   // iter 39: malam lebih terang (dulu 0.18)
    moon.intensity = 0.4 * (1 - day);
    return elev;
  }
  apply();

  return {
    terrain, water, sky, height: terrainHeight, nightU: su.night,
    setSpeed(s) { speed = s; }, get speed() { return speed; },
    clock() { const m = Math.floor(t * 1440); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); },
    update(dt, focus) {
      t = (t + dt / DAY_LEN * speed) % 1;
      wu.time.value += dt;
      apply();
      sky.position.copy(camera.position);
      sun.target.position.copy(focus);
      sun.position.copy(focus).addScaledVector(wu.sunDir.value, 200);
      moon.target.position.copy(focus); moon.position.copy(focus).addScaledVector(wu.sunDir.value, -200);   // berlawanan arah matahari
    },
  };
}
