// Iterasi 9: aturan lalu lintas. Lampu lalu lintas di persimpangan jalan utama (hw>=6 x hw>=6, otomatis dari roads.lines),
// kendaraan AI berhenti di lampu merah (npcs.js memanggil traffic.ahead), pelanggar pemain (terobos merah / lawan arah)
// kena wanted HANYA kalau ada saksi: Satpol patroli di tiap persimpangan atau petugas pengejar. Klakson: tombol H / tombol HORN di HP.
import * as THREE from 'three';
import { makeCharacter, animateCharacter, SKINS } from './character.js';
import { loadKenney } from './assets.js';

const TR_CYCLE = 26;                                                      // detik: A hijau 10, kuning 2, semua merah 1, B hijau 10, kuning 2, semua merah 1
const trState = (ph, axis) => { const p = axis === 0 ? ph : ph - 13; return p < 0 ? 'R' : p < 10 ? 'G' : p < 12 ? 'Y' : 'R'; };
const trUnit = (x, z) => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };
const TR_LIT = { R: 0xff2a1a, Y: 0xffc21a, G: 0x22e66a }, TR_DIM = { R: 0x331412, Y: 0x33280a, G: 0x0a2a16 };

// Persimpangan = perpotongan dua polyline jalan utama (digabung kalau <14 m)
function trBox(L) { if (L._box) return L._box; let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const p of L.pts) { if (p.x < a) a = p.x; if (p.x > b) b = p.x; if (p.z < c) c = p.z; if (p.z > d) d = p.z; } return (L._box = [a - 2, b + 2, c - 2, d + 2]); }
function trBoxOverlap(A, B) { const a = trBox(A), b = trBox(B); return a[0] <= b[1] && b[0] <= a[1] && a[2] <= b[3] && b[2] <= a[3]; }
export function trFindJunctions(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const A = lines[i]; if (A.hw < 6) continue;
    for (let j = i + 1; j < lines.length; j++) {
      const B = lines[j]; if (B.hw < 6) continue;
      if ((A.zone === 'darmo' || B.zone === 'darmo') && (A.hw < 8 || B.hw < 8)) continue;   // iter 86: Darmo = lampu hanya di persimpangan trunk/primary (>=16 lebar), bukan semua simpul
      if (!trBoxOverlap(A, B)) continue;   // iter 86: lewati pasangan jalan yang kotak batasnya tidak bertumpuk (O(n^2) segmen)
      for (let a = 0; a < A.pts.length - 1; a++) {
        const p = A.pts[a], q = A.pts[a + 1], d1x = q.x - p.x, d1z = q.z - p.z;
        for (let b = 0; b < B.pts.length - 1; b++) {
          const r = B.pts[b], s = B.pts[b + 1], d2x = s.x - r.x, d2z = s.z - r.z, den = d1x * d2z - d1z * d2x;
          if (Math.abs(den) < 0.15 * Math.hypot(d1x, d1z) * Math.hypot(d2x, d2z)) continue;   // iter 87: sejajar / menyambung lurus (sudut < ~8,6 derajat) bukan persimpangan (dulu hanya den ~ 0): cegah lampu merah palsu di sambungan koridor-OSM dan jalur ganda OSM (7 palsu di Darmo, sudut 0,7-5,7)
          const t = ((r.x - p.x) * d2z - (r.z - p.z) * d2x) / den, u = ((r.x - p.x) * d1z - (r.z - p.z) * d1x) / den;
          if (t < 0 || t >= 1 || u < 0 || u >= 1) continue;
          const x = p.x + d1x * t, z = p.z + d1z * t;
          if (out.some(o => Math.hypot(o.x - x, o.z - z) < 14)) continue;
          out.push({ x, z, ax: [trUnit(d1x, d1z), trUnit(d2x, d2z)], hw: [A.hw, B.hw], name: i + 'x' + j });
        }
      }
    }
  }
  return out;
}

export function createTraffic(scene, ctx) {
  const { roads, ground, veh, collider, sfx } = ctx, lines = roads.lines;
  const api = { junctions: trFindJunctions(lines), approaches: [], patrols: [], sat: null, violations: 0 };
  const J = api.junctions, AP = api.approaches;
  let T = 0, wrongT = 0, wrongAcc = 0, spCool = 0, offCool = 0, offT = 0;
  J.forEach((j, i) => { j.off = (i * 7) % TR_CYCLE; j.st = ['R', 'R']; j.y = ground(j.x, j.z); });

  // pendekat: 2 sumbu x 2 arah per persimpangan. Titik berhenti = pusat - arah * (setengah lebar jalan lain + 3.5)
  J.forEach((j, ji) => {
    for (let k = 0; k < 2; k++) for (const d of [1, -1]) {
      const hx = j.ax[k][0] * d, hz = j.ax[k][1] * d, stopD = j.hw[1 - k] + 3.5;
      AP.push({ ji, axis: k, hx, hz, hw: j.hw[k], stopD, px: j.x - hx * stopD, pz: j.z - hz * stopD, prev: null, cool: 0, shown: '' });
    }
  });

  // ---------- visual lampu: tiang + kotak + 3 bulb (instanced), garis berhenti ----------
  if (AP.length) {
    const N = AP.length, M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0), C = new THREE.Color();
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.08, 4.8, 8).translate(0, 2.4, 0), new THREE.MeshStandardMaterial({ color: 0x4a4f55 }), N);
    const box = new THREE.InstancedMesh(new THREE.BoxGeometry(0.36, 1.15, 0.3).translate(0, 4.1, 0), new THREE.MeshStandardMaterial({ color: 0x1b1b1b }), N);
    const bulbGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.06, 12); bulbGeo.rotateX(Math.PI / 2);
    api.bulbs = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), N * 3);
    const lp = [], li = [];
    AP.forEach((a, i) => {
      const lx = a.hz, lz = -a.hx, off = a.hw + 0.9, x = a.px + lx * off, z = a.pz + lz * off, y = ground(x, z);  // tiang di sisi kiri jalan (lalu lintas kiri)
      Q.setFromAxisAngle(Y, Math.atan2(-a.hx, -a.hz));                                                           // wajah lampu menghadap kendaraan yang datang
      pole.setMatrixAt(i, M4.compose(P.set(x, y, z), Q, S)); box.setMatrixAt(i, M4.compose(P.set(x, y, z), Q, S));
      [4.45, 4.1, 3.75].forEach((h, b) => { api.bulbs.setMatrixAt(i * 3 + b, M4.compose(P.set(x - a.hx * 0.17, y + h, z - a.hz * 0.17), Q, S)); api.bulbs.setColorAt(i * 3 + b, C.setHex(TR_DIM['RYG'[b]])); });
      const y0 = ground(a.px, a.pz) + 0.2, pt = (u, w) => [a.px + a.hx * u + lx * w, y0, a.pz + a.hz * u + lz * w];
      const base = lp.length / 3; for (const q of [pt(0, 0.4), pt(0, a.hw), pt(0.45, 0.4), pt(0.45, a.hw)]) lp.push(q[0], q[1], q[2]);
      li.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base, base + 2, base + 1, base + 1, base + 2, base + 3);
    });
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); sg.setIndex(li);
    const lines3 = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0xf0f0e0, side: THREE.DoubleSide }));
    pole.castShadow = true; scene.add(pole, box, api.bulbs, lines3);
    // Sambungan Kenney #4 (iter 17): tiang+kotak lampu procedural -> Kenney 'roads/traffic-light' (skala x10 = ~5 m). Bulb berwarna tetap procedural (di depan kepala lampu). Gagal muat = procedural tetap.
    api.upgradeSignals = async () => {
      const g = await loadKenney('roads/traffic-light'); if (!g) return false;
      g.updateMatrixWorld(true); const K = 10, parts = []; g.traverse(o => { if (o.isMesh) parts.push(o); });
      for (const o of parts) {
        const im = new THREE.InstancedMesh(o.geometry.clone().applyMatrix4(o.matrixWorld), o.material, N); im.castShadow = true;
        AP.forEach((a, i) => { const lx = a.hz, lz = -a.hx, off = a.hw + 0.9, x = a.px + lx * off, z = a.pz + lz * off; Q.setFromAxisAngle(Y, Math.atan2(-a.hx, -a.hz)); im.setMatrixAt(i, M4.compose(P.set(x, ground(x, z), z), Q, S.set(K, K, K))); });
        scene.add(im);
      }
      pole.visible = false; box.visible = false;
      console.log(`[traffic] ${N} lampu -> Kenney traffic-light`); return true;
    };
  }
  // ---------- Satpol patroli (saksi) di satu sudut tiap persimpangan; hanya tampil dalam 160 m dari pemain ----------
  J.forEach((j, i) => {
    const o = makeCharacter({ hat: 'satpol', shirt: 0x8a7a45, pants: 0x3a3a2a, skin: SKINS[1 + (i % 3)] }), sa = i % 2 ? 1 : -1, sb = (i >> 1) % 2 ? 1 : -1;
    const x = j.x + j.ax[0][0] * (j.hw[1] + 2.4) * sa + j.ax[1][0] * (j.hw[0] + 2.4) * sb, z = j.z + j.ax[0][1] * (j.hw[1] + 2.4) * sa + j.ax[1][1] * (j.hw[0] + 2.4) * sb;
    o.position.set(x, ground(x, z), z); if (collider) { collider.resolve(o.position, 0.4); o.position.y = ground(o.position.x, o.position.z); }
    o.rotation.y = Math.atan2(j.x - x, j.z - z); o.visible = false; scene.add(o); api.patrols.push({ o });
  });

  // titik jalan utama + garis singgung (untuk deteksi lawan arah)
  const main = [];
  for (const L of lines) if (L.hw >= 6) for (let i = 1; i < L.pts.length - 1; i++) { const p = L.pts[i], t = trUnit(L.pts[i + 1].x - L.pts[i - 1].x, L.pts[i + 1].z - L.pts[i - 1].z); main.push({ x: p.x, z: p.z, tx: t[0], tz: t[1], hw: L.hw }); }
  api.wrongWay = (x, z, h) => {
    let best = null, bd = 1e9; for (const m of main) { const d = (m.x - x) ** 2 + (m.z - z) ** 2; if (d < bd) { bd = d; best = m; } }
    if (!best || bd > best.hw * best.hw) return false;
    const dt = Math.sin(h) * best.tx + Math.cos(h) * best.tz, s = (x - best.x) * best.tz - (z - best.z) * best.tx; // s>0: di sisi kiri arah jalan
    return (dt > 0.5 && s < -1.5) || (dt < -0.5 && s > 1.5);
  };

  // ---------- query untuk AI: lampu di depan (state + jarak ke garis berhenti) ----------
  api.ahead = (x, z, hx, hz, range) => {
    let best = null;
    for (const a of AP) {
      if (hx * a.hx + hz * a.hz < 0.75) continue;
      const rx = J[a.ji].x - x, rz = J[a.ji].z - z, dist = rx * a.hx + rz * a.hz - a.stopD;
      if (dist < -0.5 || dist > range || Math.abs(rx * a.hz - rz * a.hx) > a.hw + 1) continue;
      if (!best || dist < best.dist) best = { dist, state: J[a.ji].st[a.axis] };
    }
    return best;
  };
  api.bind = (sat) => { api.sat = sat; };

  function violation(x, z, why, heat) {
    api.violations++;
    const seen = api.patrols.some(p => p.o.visible && Math.hypot(p.o.position.x - x, p.o.position.z - z) < 45) || (api.sat && api.sat.witness(x, z, 60));
    console.log(`[traffic] pelanggaran: ${why} (saksi: ${!!seen})`);
    if (!api.sat) return seen;
    if (seen) api.sat.report(heat, why); else api.sat.toast(why + ' Nobody saw you. This time.');
    return seen;
  }

  // ---------- klakson (suara dari sfx.js; pejalan dekat kaget via api.onHorn -> crowd.honk) ----------
  api.horn = () => { const d = veh.driving; if (sfx) sfx.horn(); if (api.onHorn && d) api.onHorn(d.obj.position.x, d.obj.position.z); console.log('[traffic] klakson'); };
  addEventListener('keydown', e => { if (e.code === 'KeyH' && !e.repeat && veh.driving) api.horn(); });
  const hb = document.createElement('div');
  hb.style.cssText = 'position:fixed;z-index:50;right:118px;bottom:82px;width:62px;height:62px;border-radius:50%;background:#2a63c9dd;color:#fff;font:bold 13px sans-serif;display:none;align-items:center;justify-content:center;user-select:none;touch-action:none;cursor:pointer;border:2px solid #ffffff88';
  hb.textContent = 'HORN'; document.body.appendChild(hb);
  hb.addEventListener('touchstart', e => { api.horn(); e.preventDefault(); e.stopPropagation(); }, { passive: false }); hb.addEventListener('click', api.horn);
  let hbOn = false;

  api.update = (dt, player) => {
    T += dt;
    J.forEach(j => { const ph = (T + j.off) % TR_CYCLE; j.st[0] = trState(ph, 0); j.st[1] = trState(ph, 1); });
    if (api.bulbs) {
      let dirty = false;
      AP.forEach((a, i) => { const st = J[a.ji].st[a.axis]; if (st === a.shown) return; a.shown = st; dirty = true; const C = new THREE.Color(); 'RYG'.split('').forEach((c, b) => api.bulbs.setColorAt(i * 3 + b, C.setHex(c === st ? TR_LIT[c] : TR_DIM[c]))); });
      if (dirty) api.bulbs.instanceColor.needsUpdate = true;
    }
    api.patrols.forEach(p => { const v = Math.hypot(p.o.position.x - player.position.x, p.o.position.z - player.position.z) < 160; p.o.visible = v; if (v) animateCharacter(p.o, dt, 0); });
    const drv = veh.driving; if (!!drv !== hbOn) { hbOn = !!drv; hb.style.display = hbOn ? 'flex' : 'none'; }
    if (!drv) { AP.forEach(a => { a.prev = null; }); wrongT = 0; return; }
    const o = drv.obj.position, fx = Math.sin(drv.h), fz = Math.cos(drv.h);
    for (const a of AP) {                                                  // terobos lampu merah = melewati garis berhenti saat merah
      if (a.cool > 0) a.cool -= dt;
      if (fx * a.hx + fz * a.hz < 0.7) { a.prev = null; continue; }
      const rx = J[a.ji].x - o.x, rz = J[a.ji].z - o.z, dist = rx * a.hx + rz * a.hz - a.stopD, lat = Math.abs(rx * a.hz - rz * a.hx);
      if (lat > a.hw + 1 || dist > 30 || dist < -6) { a.prev = null; continue; }
      if (a.prev !== null && a.prev > 0 && dist <= 0 && drv.sp > 4 && J[a.ji].st[a.axis] === 'R' && a.cool <= 0) { a.cool = 6; violation(o.x, o.z, 'You ran a red light!', 12); }
      a.prev = dist;
    }
    api.extra(dt, drv);
    wrongAcc += dt;                                                        // lawan arah di jalan utama (cek tiap 0.25 dtk)
    if (wrongAcc >= 0.25) {
      const dtc = wrongAcc; wrongAcc = 0;
      if (drv.sp > 6 && api.wrongWay(o.x, o.z, drv.h)) { wrongT += dtc; if (wrongT > 2.5) { wrongT = -8; violation(o.x, o.z, 'Wrong way!', 10); } } else wrongT = Math.min(0, wrongT) < 0 ? wrongT + dtc : 0;
    }
  };
  api.extra = (dt, drv) => {                                               // iterasi 10: ngebut & lewat trotoar, hanya dihitung kalau ada patroli <45 m (otomatis saksi)
    const o = drv.obj.position; spCool -= dt; offCool -= dt;
    if (!api.patrols.some(p => p.o.visible && Math.hypot(p.o.position.x - o.x, p.o.position.z - o.z) < 45)) { offT = 0; return; }
    if (drv.sp > 20 && spCool <= 0) { spCool = 10; violation(o.x, o.z, 'Speeding past a patrol!', 8); }
    if (roads.clearance(o.x, o.z) > 2.5 && Math.abs(drv.sp) > 5) { offT += dt; if (offT > 1.5 && offCool <= 0) { offCool = 12; offT = 0; violation(o.x, o.z, 'Driving on the sidewalk!', 8); } } else offT = 0;
  };
  console.log(`[traffic] ${J.length} persimpangan berlampu, ${AP.length} pendekat, ${api.patrols.length} Satpol patroli`);
  return api;
}
