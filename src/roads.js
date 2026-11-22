// Jalan: ribbon mengikuti terrain + marka tengah + lampu jalan & pohon (instanced). Juga query jarak ke jalan.
import * as THREE from 'three';
import { ROADS } from './roaddata.js';
import { loadKenney } from './assets.js';

export function createRoads(scene, heightFn) {
  const group = new THREE.Group(); scene.add(group);
  const CELL = 24, grid = new Map(), key = (a, b) => a * 73856093 ^ b * 19349663;
  const CL = { wide: { p: [], u: [], i: [] }, mid: { p: [], u: [], i: [] }, plain: { p: [], u: [], i: [] } };   // iter 62: ribbon per kelas tekstur (aspal "Low road")
  const dp = [], di = [], lampC = [], treeC = [], lines = [];
  const quad = (P, I, v) => { const a = P.length / 3; for (const q of v) P.push(q[0], q[1], q[2]); I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); return a; };
  const SW_W = 2.2, SW_N = 1.3, CURB = 0.15;   // lebar trotoar jalan besar / gang (m), tinggi trotoar (m)
  ROADS.forEach((r, ri) => {
    const curve = new THREE.CatmullRomCurve3(r.pts.map(p => new THREE.Vector3(p[0], 0, p[1])), false, 'centripetal');
    const n = Math.max(2, Math.ceil(curve.getLength() / 4)), pts = curve.getSpacedPoints(n), hw = r.width / 2, off = 0.1 - r.width * 0.002;
    const K = r.width >= 14 ? CL.wide : r.width >= 10 ? CL.mid : CL.plain, plain = K === CL.plain, uMax = plain ? r.width / 4 : 1, base = K.p.length / 3, sw = r.zone === 'madura' ? 0 : r.width >= 10 ? SW_W : SW_N; let acc = 0; lines.push({ hw, pts, name: r.name, zone: r.zone });
    for (let i = 0; i <= n; i++) {
      const p = pts[i], q = pts[Math.min(i + 1, n)], o = pts[Math.max(i - 1, 0)];
      let tx = q.x - o.x, tz = q.z - o.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const nx = -tz, nz = tx; if (i > 0) acc += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
      const along = plain ? acc / 4 : acc / (r.width * 1.5);
      for (const s of [-1, 1]) { const x = p.x + nx * hw * s, z = p.z + nz * hw * s; K.p.push(x, heightFn(x, z) + off, z); K.u.push(s < 0 ? 0 : uMax, along); }
      const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL)); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(p.x, p.z, hw, sw, ri);
      if (i < n) K.i.push(base + i * 2, base + i * 2 + 1, base + i * 2 + 2, base + i * 2 + 1, base + i * 2 + 3, base + i * 2 + 2);
      if (r.width >= 12 && i % 2 === 0 && i < n) { // marka putus-putus
        const f = (s, a, b) => { const x = p.x + tx * a + nx * b * s, z = p.z + tz * a + nz * b * s; return [x, heightFn(x, z) + off + 0.03, z]; };
        quad(dp, di, [f(-1, 0, 0.13), f(1, 0, 0.13), f(-1, 3, 0.13), f(1, 3, 0.13)]);
      }
      if (r.width >= 10 && i % 6 === 0) { const s = (i / 6) % 2 ? 1 : -1; lampC.push([p.x + nx * (hw + 1.3) * s, p.z + nz * (hw + 1.3) * s, s, Math.atan2(nx * s, nz * s)]); }
      if (r.width >= 12 && i % 4 === 2) { const s = (i >> 2) % 2 ? 1 : -1; treeC.push([p.x + nx * (hw + 4.5) * s, p.z + nz * (hw + 4.5) * s]); }
    }
  });
  const mesh = (P, I, mat, U) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); if (U) g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.receiveShadow = true; group.add(m); return m; return m; };
  // iter 62: tekstur aspal dari "Low road" (Yarelon, CC BY 4.0) + trotoar dari "Sidewalks" (Caboose3d, CC BY 4.0). Gagal muat -> aspal abu polos + marka procedural.
  const tl = new THREE.TextureLoader(), texUrl = (n) => (typeof window !== 'undefined' && window.__TEX && window.__TEX[n]) || `assets/tex/${n}.jpg`;
  const loadTex = (name, mat, wrapS, rep) => tl.load(texUrl(name), (t) => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = wrapS; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (rep) t.repeat.set(rep, rep); mat.map = t; mat.color.set(0xffffff); mat.needsUpdate = true; texOk[name] = true; console.log(`[roads] tekstur ${name} dimuat`); }, undefined, () => console.log(`[roads] tekstur ${name} gagal, pakai polos`));
  const texOk = {}, mk = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 });
  const mWide = mk(0x2b2b2e), mMid = mk(0x2b2b2e), mPlain = mk(0x2b2b2e);
  loadTex('road_wide', mWide, THREE.ClampToEdgeWrapping); loadTex('road_mid', mMid, THREE.ClampToEdgeWrapping); loadTex('road_plain', mPlain, THREE.RepeatWrapping);
  mesh(CL.wide.p, CL.wide.i, mWide, CL.wide.u); mesh(CL.mid.p, CL.mid.i, mMid, CL.mid.u); mesh(CL.plain.p, CL.plain.i, mPlain, CL.plain.u);
  const dpMat = new THREE.MeshBasicMaterial({ color: 0xe8e2c0 }), dpMesh = mesh(dp, di, dpMat);
  const dpCheck = setInterval(() => { if (texOk.road_wide && texOk.road_mid) { dpMesh.visible = false; clearInterval(dpCheck); } }, 500);   // marka putus-putus procedural hilang kalau tekstur (sudah bermarka) termuat

  const clearance = (x, z) => { // jarak ke tepi jalan terdekat (m); negatif = di atas jalan
    let m = 1e9; const ix = Math.floor(x / CELL), iz = Math.floor(z / CELL);
    for (let a = ix - 1; a <= ix + 1; a++) for (let b = iz - 1; b <= iz + 1; b++) {
      const l = grid.get(key(a, b)); if (!l) continue;
      for (let i = 0; i < l.length; i += 5) { const d = Math.hypot(x - l[i], z - l[i + 1]) - l[i + 2]; if (d < m) m = d; }
    }
    return m;
  };
  // iter 62: trotoar menerus (beton "Sidewalks") di kedua sisi jalan non-Madura: bingkai (curb) + permukaan + rok ke tanah. Terputus di persimpangan (di dalam jalan lain) & di laut.
  const clearExcl = (x, z, id) => { let m = 1e9; const ix = Math.floor(x / CELL), iz = Math.floor(z / CELL);
    for (let a = ix - 1; a <= ix + 1; a++) for (let b = iz - 1; b <= iz + 1; b++) { const l = grid.get(key(a, b)); if (!l) continue;
      for (let i = 0; i < l.length; i += 5) { if (l[i + 4] === id) continue; const d = Math.hypot(x - l[i], z - l[i + 1]) - l[i + 2]; if (d < m) m = d; } }
    return m; };
  const SWCH = 200, swChunks = new Map(); let swTri = 0;   // trotoar dipecah per chunk 200 m -> frustum culling (iter 62)
  ROADS.forEach((r, ri) => {
    if (r.zone === 'madura') return;
    const curve = new THREE.CatmullRomCurve3(r.pts.map(p => new THREE.Vector3(p[0], 0, p[1])), false, 'centripetal'), m = Math.max(2, Math.ceil(curve.getLength() / 3)), pts = curve.getSpacedPoints(m);
    const hw = r.width / 2, swd = r.width >= 10 ? SW_W : SW_N, off = 0.1 - r.width * 0.002, T = 3;   // T = ukuran petak tekstur (m)
    for (const s of [-1, 1]) {
      const rows = []; let acc = 0;
      for (let j = 0; j <= m; j++) {
        const p = pts[j], q = pts[Math.min(j + 1, m)], o = pts[Math.max(j - 1, 0)]; let tx = q.x - o.x, tz = q.z - o.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; const nx = -tz, nz = tx;
        if (j > 0) acc += Math.hypot(p.x - pts[j - 1].x, p.z - pts[j - 1].z);
        const ex = p.x + nx * hw * s, ez = p.z + nz * hw * s, ox = p.x + nx * (hw + swd) * s, oz = p.z + nz * (hw + swd) * s, mx = p.x + nx * (hw + swd * 0.5) * s, mz = p.z + nz * (hw + swd * 0.5) * s;
        const y0 = heightFn(ex, ez) + off, y1 = y0 + CURB, cut = clearExcl(ex, ez, ri) < 0.3 || clearExcl(mx, mz, ri) < 0.6 || clearExcl(ox, oz, ri) < 0.6 || heightFn(ox, oz) < 0.15;
        rows.push({ ex, ez, ox, oz, y0, y1, cut, v: acc / T });
      }
      for (let j = 0; j < m; j++) {
        const A = rows[j], Bw = rows[j + 1]; if (A.cut || Bw.cut) continue;
        const ck = Math.floor((A.ex + Bw.ex) / 2 / SWCH) + ',' + Math.floor((A.ez + Bw.ez) / 2 / SWCH); let c = swChunks.get(ck); if (!c) swChunks.set(ck, c = { P: [], U: [], I: [] });
        const b0 = c.P.length / 3;
        for (const w of [A, Bw]) {   // 6 simpul/baris: [0,1] muka curb, [2,3] permukaan, [4,5] rok luar; simpul tiap strip sendiri -> normal tegas
          c.P.push(w.ex, w.y0, w.ez, w.ex, w.y1, w.ez, w.ex, w.y1, w.ez, w.ox, w.y1, w.oz, w.ox, w.y1, w.oz, w.ox, w.y1 - 0.4, w.oz);
          c.U.push(0, w.v, CURB / T, w.v, 0, w.v, swd / T, w.v, 0, w.v, 0.4 / T, w.v);
        }
        for (let k = 0; k < 6; k += 2) c.I.push(b0 + k, b0 + k + 1, b0 + 6 + k, b0 + k + 1, b0 + 7 + k, b0 + 6 + k);
        swTri += 6;
      }
    }
  });
  const swMat = new THREE.MeshStandardMaterial({ color: 0x9a9a96, roughness: 0.95, side: THREE.DoubleSide });
  tl.load(texUrl('sidewalk'), (t) => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.anisotropy = 4; swMat.map = t; swMat.color.set(0xffffff); swMat.needsUpdate = true; console.log('[roads] tekstur sidewalk dimuat'); }, undefined, () => console.log('[roads] tekstur sidewalk gagal, beton polos'));
  for (const c of swChunks.values()) { const m = mesh(c.P, c.I, swMat, c.U); m.castShadow = false; m.geometry.computeBoundingSphere(); }
  console.log(`[roads] trotoar ${swChunks.size} chunk, ${swTri} segitiga`);
  // tinggi trotoar di titik (x,z): CURB kalau di dalam lebar trotoar dari tepi jalan terdekat, 0 di jalan/di luar. Dipakai main.js ground() supaya kaki/roda tidak tenggelam.
  const curbAt = (x, z) => { let m = 1e9, sw = 0; const ix = Math.floor(x / CELL), iz = Math.floor(z / CELL);
    for (let a = ix - 1; a <= ix + 1; a++) for (let b = iz - 1; b <= iz + 1; b++) { const l = grid.get(key(a, b)); if (!l) continue;
      for (let i = 0; i < l.length; i += 5) { const d = Math.hypot(x - l[i], z - l[i + 1]) - l[i + 2]; if (d < m) { m = d; sw = l[i + 3]; } } }
    return m > 0.35 && m < sw - 0.2 ? CURB : 0; };
  // Props: lampu & pohon (lewati yang jatuh di jalan lain)
  const lamps = lampC.filter(c => clearance(c[0], c[1]) > 0.5), trees = treeC.filter(c => clearance(c[0], c[1]) > 0.5);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), C = new THREE.Color();
  const inst = (geo, mat, list, fn) => { const m = new THREE.InstancedMesh(geo, mat, list.length); m.castShadow = true;
    list.forEach((c, i) => { fn(c, i); m.setMatrixAt(i, M); }); group.add(m); return m; };
  const pole = inst(new THREE.CylinderGeometry(0.07, 0.11, 6, 8).translate(0, 3, 0), new THREE.MeshStandardMaterial({ color: 0x555a60 }), lamps,
    c => M.compose(P.set(c[0], heightFn(c[0], c[1]), c[1]), Q, S));
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffd070, emissiveIntensity: 0 });
  const headI = inst(new THREE.SphereGeometry(0.28, 12, 8).translate(0, 6.1, 0), headMat, lamps, c => M.compose(P.set(c[0], heightFn(c[0], c[1]), c[1]), Q, S));
  const trunkI = inst(new THREE.CylinderGeometry(0.18, 0.28, 3, 8).translate(0, 1.5, 0), new THREE.MeshStandardMaterial({ color: 0x5a3f2a }), trees,
    c => M.compose(P.set(c[0], heightFn(c[0], c[1]), c[1]), Q, S));
  const canopy = inst(new THREE.IcosahedronGeometry(2.1, 1).translate(0, 4.6, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), trees, (c, i) => {
    const k = 0.8 + (i * 7 % 5) * 0.12; M.compose(P.set(c[0], heightFn(c[0], c[1]), c[1]), Q, S.set(k, k, k)); S.set(1, 1, 1); });
  trees.forEach((c, i) => canopy.setColorAt(i, C.setHSL(0.27 + (i * 13 % 7) * 0.012, 0.5, 0.25 + (i * 5 % 4) * 0.04)));
  console.log(`[roads] ${ROADS.length} jalan, ${lamps.length} lampu, ${trees.length} pohon`);
  // Sambungan #1 (iter 14): tiang lampu procedural -> Kenney 'roads/light-square' (lengan menghadap jalan). Gagal muat = tetap procedural.
  async function upgradeLamps() {
    const g = await loadKenney('roads/light-square'); if (!g || !lamps.length) return false;
    g.updateMatrixWorld(true); const K = 10, Y = new THREE.Vector3(0, 1, 0), parts = []; g.traverse(o => { if (o.isMesh) parts.push(o); });
    for (const o of parts) {
      const im = new THREE.InstancedMesh(o.geometry.clone().applyMatrix4(o.matrixWorld), o.material, lamps.length); im.castShadow = true;
      lamps.forEach((c, i) => { Q.setFromAxisAngle(Y, c[3]); M.compose(P.set(c[0], heightFn(c[0], c[1]), c[1]), Q, S.set(K, K, K)); im.setMatrixAt(i, M); });
      group.add(im);
    }
    pole.visible = false; headI.geometry.dispose(); headI.geometry = new THREE.SphereGeometry(0.4, 10, 6);   // bola cahaya di ujung lengan (lokal 0,5.85,-1.95)
    const hp = new THREE.Vector3();
    lamps.forEach((c, i) => { hp.set(0, 5.85, -1.95).applyAxisAngle(Y, c[3]); M.compose(P.set(c[0] + hp.x, heightFn(c[0], c[1]) + hp.y, c[1] + hp.z), Q.identity(), S.set(1, 1, 1)); headI.setMatrixAt(i, M); });
    headI.instanceMatrix.needsUpdate = true;
    console.log(`[roads] ${lamps.length} lampu -> Kenney light-square`); return true;
  }
  // Sambungan #2 (iter 72): pohon procedural -> "Tree Animate" (RandyGF, CC BY 4.0), 3 varian 600-900 segitiga (assets/kenney/pohon/trees.glb, dibuat tools/prep_tree.py).
  // Instance per chunk 160 m (frustum culling + jarak gambar di update), goyang angin di shader (fase beda tiap pohon), pohon mengecil halus di ujung jarak gambar.
  // ?pohon=0 = pohon procedural lama. Gagal muat = tetap procedural.
  const treeChunks = [], uT = { value: 0 }, uFar = { value: 300 };
  async function upgradeTrees() {
    if (new URLSearchParams(location.search).get('pohon') === '0' || !trees.length) return false;
    const g = await loadKenney('pohon/trees'); if (!g) return false;
    g.updateMatrixWorld(true); const parts = []; g.traverse(o => { if (o.isMesh) parts.push(o); }); if (!parts.length) return false;
    const hk = parseFloat(new URLSearchParams(location.search).get('h_pohon')) || 1;   // ?h_pohon=1.3 = semua pohon 30% lebih besar
    const mat = parts[0].material.clone(); mat.side = THREE.DoubleSide; mat.metalness = 0; mat.roughness = 1; mat.customProgramCacheKey = () => 'pohon-iter72';
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = uT; sh.uniforms.uFar = uFar;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT; uniform float uFar;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec3 io_ = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float ph_ = io_.x * 0.37 + io_.z * 0.23, hh_ = clamp(position.y / 6.5, 0.0, 1.3), am_ = hh_ * hh_ * 0.12;
        transformed.x += sin(uT * 1.25 + ph_ + position.y * 0.35) * am_;
        transformed.z += sin(uT * 0.95 + ph_ * 1.7 + position.x * 0.45) * am_ * 0.8;
        transformed *= 1.0 - smoothstep(uFar * 0.82, uFar, distance(io_.xz, cameraPosition.xz));
        #endif`);
      // normal daun = "bola" dari pusat kanopi: jangan dibalik untuk sisi belakang kartu
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'));
    };
    const Y = new THREE.Vector3(0, 1, 0), geos = parts.map(p => p.geometry.clone().applyMatrix4(p.matrixWorld)), CH = 160, cells = new Map();
    trees.forEach((c, i) => { const v = (i * 7 + (i >> 2)) % geos.length, k = Math.floor(c[0] / CH) + ',' + Math.floor(c[1] / CH) + ',' + v; let e = cells.get(k); if (!e) cells.set(k, e = { v, l: [] }); e.l.push(i); });
    const hs = (i, s) => (Math.imul(i + 1, 2654435761) ^ Math.imul(s + 17, 1597334677)) >>> 0, h01 = (i, s) => hs(i, s) / 4294967296;
    for (const e of cells.values()) {
      const im = new THREE.InstancedMesh(geos[e.v], mat, e.l.length); im.castShadow = true; let sx = 0, sz = 0;
      e.l.forEach((i, j) => {
        const c = trees[i], k = (0.85 + 0.3 * h01(i, 1)) * hk; sx += c[0]; sz += c[1];
        im.setMatrixAt(j, M.compose(P.set(c[0], heightFn(c[0], c[1]) - 0.05, c[1]), Q.setFromAxisAngle(Y, h01(i, 2) * 6.2832), S.set(k, k, k)));
        im.setColorAt(j, C.setRGB(0.82 + 0.3 * h01(i, 3), 0.88 + 0.22 * h01(i, 3), 0.78 + 0.3 * h01(i, 4)));
      });
      if (im.computeBoundingSphere) im.computeBoundingSphere();
      group.add(im); treeChunks.push({ im, cx: sx / e.l.length, cz: sz / e.l.length });
    }
    trunkI.visible = false; canopy.visible = false;
    console.log(`[roads] ${trees.length} pohon -> Tree Animate (${geos.map(x => x.index.count / 3).join('/')} segitiga per varian, ${treeChunks.length} chunk)`); return true;
  }
  return { group, clearance, curbAt, lines, upgradeLamps, upgradeTrees,
    update(night, px, pz, q) {
      headMat.emissiveIntensity = night * 3; uT.value = performance.now() / 1000;
      if (px === undefined || !treeChunks.length) return;
      const far = q === 'Low' ? 200 : q === 'Ultra' ? 420 : 300; uFar.value = far;   // jarak gambar pohon per kualitas (m); chunk 160 m -> radius ~113
      for (const t of treeChunks) t.im.visible = Math.hypot(t.cx - px, t.cz - pz) < far + 120;
    } };
}
