// Iterasi 90: MINIMAP / RADAR ala GTA + renderer peta penuh (dipakai menu pause di settings.js).
// createMinimap({ scene, height, roads, ground, night, settings, getBlips, toast }) -> { render, update, setWaypoint, clearWaypoint, wp, toggleExpand, insetLeft, last, ... }
//  - Latar darat/laut: tekstur kecil yang disampel dari world.height di sekitar tampilan (dibangun ulang kalau tampilan keluar dari area / zoom berubah banyak).
//  - Jalan: vektor dari roads.lines (dipotong per bbox, kelas lebar: gang / sedang / besar), + dek Jembatan Suramadu, taman Darmo (DARMO_PARKS).
//  - Radar: bulat/kotak, berputar mengikuti kamera atau utara-di-atas, klik/tap atau tombol N = DIBESARKAN. Blip: polisi (berkedip saat wanted), bengkel, waypoint (menempel di tepi kalau jauh).
//  - Waypoint: diset dari peta penuh (menu M); ada berkas cahaya magenta 3D + jarak di HUD; otomatis hilang saat sampai.
import * as THREE from 'three';
import { DARMO_PARKS } from './darmo_bld_data.js';

export const MM_B = { x0: -2400, x1: 1400, z0: -3100, z1: 3960 };        // batas peta (koordinat dunia)
export const MM_ZOOMS = [90, 140, 220, 340];                              // radius radar (m) per level zoom
export const MM_DPR = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
const MM_LAND = [203, 197, 180], MM_SHAL = [150, 184, 201], MM_DEEP = [118, 152, 176];
export const MM_LABELS = [   // [teks, x, z, jenis]  (koordinat dari tombol teleport / zona)
  ['TANJUNG PERAK', -1700, -540], ['KENJERAN', 930, 1425], ['JEMBATAN SURAMADU', 340, -1010], ['MADURA', 340, -2450],
  ['SURABAYA PUSAT', 0, 330], ['KORIDOR DARMO', -740, 1640], ['DARMO', -1130, 2800], ['SELAT MADURA', -750, -1000, 'sea'], ['LAUT JAWA', -300, 3300, 'sea'],
];
// area bisa dimainkan = sama dengan batas dunia di main.js (di luar itu = laut lepas)
export const mmPlay = (x, z) => x > -2380 && x < 1380 && z > -3080 && z < 3940 && !(z > 500 && x < -2000) && !(z > 1800 && x > -205);
export const mmClamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const mmToScreen = (v, W, H, x, z) => { const c = Math.cos(v.rot), s = Math.sin(v.rot); return [W / 2 + v.ppm * ((x - v.cx) * c - (z - v.cz) * s), H / 2 + v.ppm * ((x - v.cx) * s + (z - v.cz) * c)]; };
export const mmToWorld = (v, W, H, sx, sy) => { const c = Math.cos(v.rot), s = Math.sin(v.rot), u = (sx - W / 2) / v.ppm, w = (sy - H / 2) / v.ppm; return [v.cx + u * c + w * s, v.cz - u * s + w * c]; };

function mmLandTex(height, x0, z0, x1, z1, nx, nz) {
  const cv = document.createElement('canvas'); cv.width = nx; cv.height = nz;
  const g = cv.getContext('2d'), im = g.createImageData(nx, nz), d = im.data, sx = (x1 - x0) / nx, sz = (z1 - z0) / nz;
  for (let j = 0; j < nz; j++) {
    const z = z0 + (j + 0.5) * sz;
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * sx, h = mmPlay(x, z) ? height(x, z) : -9, c = h >= -0.15 ? MM_LAND : h > -1.6 ? MM_SHAL : MM_DEEP, o = (j * nx + i) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0); return cv;
}

export function createMinimap(ctx) {
  const { scene, height, roads, ground, settings } = ctx, getBlips = ctx.getBlips || (() => []), toast = ctx.toast || (() => {}), night = ctx.night || { value: 0 };
  const touchy = matchMedia('(pointer:coarse)').matches;
  const api = { wp: null, last: { x: 0, z: 0, yaw: 0, heading: 0, kmh: 0, driving: false }, expanded: false };

  // ---------- data jalan & taman ----------
  const RD = [];
  for (const L of roads.lines) {
    const n = L.pts.length, p = new Float32Array(n * 2); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, len = 0;
    for (let i = 0; i < n; i++) {
      const x = L.pts[i].x, z = L.pts[i].z; p[2 * i] = x; p[2 * i + 1] = z;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; if (i) len += Math.hypot(x - p[2 * i - 2], z - p[2 * i - 1]);
    }
    const w = L.hw * 2; RD.push({ p, n, name: L.name, w, cls: w >= 14 ? 2 : w >= 10 ? 1 : 0, x0, x1, z0, z1, sp: Math.max(1, len / Math.max(1, n - 1)) });
  }
  RD.push({ p: Float32Array.of(340, -105, 340, -1915), n: 2, name: 'Jembatan Suramadu', w: 20, cls: 2, x0: 330, x1: 350, z0: -1915, z1: -105, sp: 1810 });   // dek jembatan (suramadu.js)
  const PK = DARMO_PARKS.map(f => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < f.length; i += 2) { x0 = Math.min(x0, f[i]); x1 = Math.max(x1, f[i]); z0 = Math.min(z0, f[i + 1]); z1 = Math.max(z1, f[i + 1]); } return { f, x0, x1, z0, z1 }; });

  // ---------- lapisan darat/laut ----------
  const land = { cv: null, x0: 0, x1: 0, z0: 0, z1: 0, ppm: 0 };
  function ensureLand(cx, cz, hx, hz, ppm) {
    const nx0 = Math.max(MM_B.x0, cx - hx), nx1 = Math.min(MM_B.x1, cx + hx), nz0 = Math.max(MM_B.z0, cz - hz), nz1 = Math.min(MM_B.z1, cz + hz);
    if (nx1 <= nx0 || nz1 <= nz0) return;
    const ratio = land.ppm ? ppm / land.ppm : 0;
    if (land.cv && nx0 >= land.x0 && nx1 <= land.x1 && nz0 >= land.z0 && nz1 <= land.z1 && ratio > 0.55 && ratio < 1.8) return;
    const x0 = Math.max(MM_B.x0, cx - hx * 1.3), x1 = Math.min(MM_B.x1, cx + hx * 1.3), z0 = Math.max(MM_B.z0, cz - hz * 1.3), z1 = Math.min(MM_B.z1, cz + hz * 1.3);
    const nx = mmClamp(Math.ceil((x1 - x0) * ppm / 1.6), 24, 640), nz = mmClamp(Math.ceil((z1 - z0) * ppm / 1.6), 24, 640);
    land.cv = mmLandTex(height, x0, z0, x1, z1, nx, nz); land.x0 = x0; land.x1 = x1; land.z0 = z0; land.z1 = z1; land.ppm = ppm;
  }

  // ---------- render (dipakai radar & peta penuh) ----------
  // v = {cx,cz,ppm,rot}; o = {names, labels, blips, north, shape:'round'|'square', size, player:{x,z,h}, dash, clampWp, cross}
  const CASE = ['#8f8873', '#8f8873', '#7d7660'], FILL = ['#ece8da', '#f4f1e6', '#ffffff'], MINPX = [1.6, 2.4, 3.4], WM = [6, 11, 17];
  const vis = [[], [], []];
  function render(g, W, H, v, o) {
    const { cx, cz, ppm, rot } = v, rr = Math.hypot(W, H) / 2 / ppm, hx = rot ? rr : W / 2 / ppm, hz = rot ? rr : H / 2 / ppm;
    const vx0 = cx - hx, vx1 = cx + hx, vz0 = cz - hz, vz1 = cz + hz, now = performance.now() / 1000;
    ensureLand(cx, cz, hx, hz, ppm);
    g.setTransform(MM_DPR, 0, 0, MM_DPR, 0, 0);
    g.fillStyle = `rgb(${MM_DEEP})`; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H / 2); g.rotate(rot); g.scale(ppm, ppm); g.translate(-cx, -cz);
    g.imageSmoothingEnabled = true; if (land.cv) g.drawImage(land.cv, land.x0, land.z0, land.x1 - land.x0, land.z1 - land.z0);
    g.fillStyle = '#a9c28b';
    for (const k of PK) { if (k.x1 < vx0 || k.x0 > vx1 || k.z1 < vz0 || k.z0 > vz1) continue; g.beginPath(); g.moveTo(k.f[0], k.f[1]); for (let i = 2; i < k.f.length; i += 2) g.lineTo(k.f[i], k.f[i + 1]); g.closePath(); g.fill(); }
    vis[0].length = vis[1].length = vis[2].length = 0;
    for (const r of RD) if (!(r.x1 < vx0 - 12 || r.x0 > vx1 + 12 || r.z1 < vz0 - 12 || r.z0 > vz1 + 12)) vis[r.cls].push(r);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let c = 0; c < 3; c++) {
      if (!vis[c].length) continue;
      for (let pass = 0; pass < 2; pass++) {
        g.beginPath();
        for (const r of vis[c]) {
          const p = r.p, n = r.n, st = Math.max(1, Math.floor(1.5 / (ppm * r.sp)));
          g.moveTo(p[0], p[1]); for (let i = st; i < n - 1; i += st) g.lineTo(p[2 * i], p[2 * i + 1]); g.lineTo(p[2 * n - 2], p[2 * n - 1]);
        }
        const px = Math.max(MINPX[c], WM[c] * ppm); g.lineWidth = (px + (pass === 0 ? 2.2 : 0)) / ppm; g.strokeStyle = pass === 0 ? CASE[c] : FILL[c]; g.stroke();
      }
    }
    g.restore();
    const S = (x, z) => mmToScreen(v, W, H, x, z);
    // --- nama jalan besar (peta penuh, kalau cukup zoom)
    if (o.names && ppm > 0.16) {
      g.font = 'bold 10px Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.lineJoin = 'round'; const seen = new Set(); let cnt = 0;
      for (const r of vis[2].concat(vis[1])) {
        if (cnt > 36 || seen.has(r.name) || !r.name || /^Jl\. \d|^Gang/.test(r.name)) continue;
        const m = r.n >> 1, [sx, sy] = S(r.p[2 * m], r.p[2 * m + 1]); if (sx < 20 || sx > W - 20 || sy < 10 || sy > H - 10) continue;
        seen.add(r.name); cnt++; g.strokeStyle = '#ffffffd0'; g.strokeText(r.name, sx, sy); g.fillStyle = '#4a4638'; g.fillText(r.name, sx, sy);
      }
    }
    // --- label kawasan
    if (o.labels) {
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.lineJoin = 'round';
      for (const [t, x, z, k] of MM_LABELS) {
        const [sx, sy] = S(x, z); if (sx < -60 || sx > W + 60 || sy < -20 || sy > H + 20) continue;
        const sea = k === 'sea'; g.font = (sea ? 'italic ' : 'bold ') + mmClamp(10 + ppm * 14, 10, 15) + 'px Arial,sans-serif';
        g.strokeStyle = sea ? '#5d819ad0' : '#f4f0e2d0'; g.strokeText(t, sx, sy); g.fillStyle = sea ? '#e6f1f8' : '#59513e'; g.fillText(t, sx, sy);
      }
    }
    // --- garis putus ke waypoint (peta penuh)
    const P = o.player, wp = api.wp;
    if (o.dash && wp && P) { const [a, b] = S(P.x, P.z), [c, d] = S(wp.x, wp.z); g.save(); g.setLineDash([6, 6]); g.strokeStyle = '#ff2fd0'; g.lineWidth = 2; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); g.restore(); }
    // --- blip
    if (o.blips && settings.get('blips')) {
      const half = (o.size || Math.min(W, H)) / 2;
      for (const b of getBlips()) {
        const [sx, sy] = S(b.x, b.z); if (sx < -8 || sx > W + 8 || sy < -8 || sy > H + 8) continue;
        if (o.shape === 'round' && Math.hypot(sx - W / 2, sy - H / 2) > half - 6) continue;
        g.beginPath(); g.arc(sx, sy, b.t === 'shop' ? 6.5 : 5.5, 0, 6.2832);
        g.fillStyle = b.t === 'cop' ? (((now * 4) | 0) & 1 ? '#ff2b2b' : '#2f6bff') : '#2cff7a'; g.fill(); g.lineWidth = 1.8; g.strokeStyle = '#000d'; g.stroke();
        if (b.t === 'shop') { g.fillStyle = '#04260f'; g.font = 'bold 9px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('B', sx, sy + 0.5); }
      }
    }
    // --- waypoint
    if (wp) {
      let [sx, sy] = S(wp.x, wp.z), edge = false;
      if (o.clampWp) {
        const half = (o.size || Math.min(W, H)) / 2 - 9, dx = sx - W / 2, dy = sy - H / 2;
        const out = o.shape === 'round' ? Math.hypot(dx, dy) > half : Math.max(Math.abs(dx), Math.abs(dy)) > half;
        if (out) { const k = o.shape === 'round' ? half / Math.hypot(dx, dy) : half / Math.max(Math.abs(dx), Math.abs(dy)); sx = W / 2 + dx * k; sy = H / 2 + dy * k; edge = true; }
      }
      g.save(); g.translate(sx, sy); g.beginPath(); g.moveTo(0, edge ? -8 : -10); g.lineTo(8, 0); g.lineTo(0, 8); g.lineTo(-8, 0); g.closePath();
      g.fillStyle = '#ff2fd0'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(); g.restore();
    }
    // --- pemain
    if (P) {
      const [sx, sy] = o.player.fixed ? [W / 2, H / 2] : S(P.x, P.z), a = Math.PI - P.h + rot, s = o.player.s || 8;
      g.save(); g.translate(sx, sy); g.rotate(a); g.beginPath(); g.moveTo(0, -s * 1.15); g.lineTo(s * 0.85, s * 0.9); g.lineTo(0, s * 0.45); g.lineTo(-s * 0.85, s * 0.9); g.closePath();
      g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#000'; g.lineJoin = 'round'; g.stroke(); g.restore();
    }
    // --- penanda utara (radar)
    if (o.north) {
      const half = (o.size || Math.min(W, H)) / 2 - 10, dx = Math.sin(rot), dy = -Math.cos(rot), k = o.shape === 'round' ? half : half / Math.max(Math.abs(dx), Math.abs(dy));
      const nx = W / 2 + dx * k, ny = H / 2 + dy * k; g.beginPath(); g.arc(nx, ny, 7, 0, 6.2832); g.fillStyle = '#d82b2b'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#000c'; g.stroke();
      g.fillStyle = '#fff'; g.font = 'bold 10px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', nx, ny + 0.5);
    }
    if (o.cross) { g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(W / 2 - 9, H / 2); g.lineTo(W / 2 + 9, H / 2); g.moveTo(W / 2, H / 2 - 9); g.lineTo(W / 2, H / 2 + 9); g.stroke(); }
  }
  api.render = render;

  // ---------- waypoint + berkas cahaya 3D ----------
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 260, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xff2fd0, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending }));
  beam.visible = false; beam.frustumCulled = false; scene.add(beam);
  api.setWaypoint = (x, z) => { api.wp = { x, z }; beam.position.set(x, ground(x, z) + 130, z); beam.visible = true; };
  api.clearWaypoint = () => { api.wp = null; beam.visible = false; };
  api.distToWp = () => api.wp ? Math.hypot(api.wp.x - api.last.x, api.wp.z - api.last.z) : 0;

  // ---------- DOM radar ----------
  const box = document.createElement('div'), wrap = document.createElement('div'), cv = document.createElement('canvas'), panel = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:25;display:flex;gap:10px;pointer-events:none;user-select:none;-webkit-user-select:none';
  wrap.style.cssText = 'position:relative;box-sizing:border-box;border:3px solid #000d;box-shadow:0 0 0 2px #ffffff40,0 4px 14px #0009;overflow:hidden;pointer-events:auto;cursor:pointer;touch-action:manipulation;background:#7698b0';
  cv.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none';   // pointer-events:none -> target klik = div (controls.js menganggap klik di CANVAS = pukul)
  panel.style.cssText = 'display:flex;flex-direction:column;justify-content:flex-end;gap:5px;pointer-events:none;font:bold 13px Arial,sans-serif;color:#fff;text-shadow:0 1px 3px #000,0 0 2px #000';
  wrap.appendChild(cv); box.append(wrap, panel); document.body.appendChild(box);
  const g = cv.getContext('2d');
  api.toggleExpand = () => { api.expanded = !api.expanded; };
  wrap.addEventListener('click', (e) => { api.toggleExpand(); e.stopPropagation(); });
  wrap.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });   // jangan memulai stick/kamera sentuh dari radar
  wrap.title = 'Click / N = enlarge radar, M = full map';

  let sz = 0, rc = 0, lastHtml = '', lastNight = -1, lastLay = '', frame = 0;
  api.size = () => sz;
  api.insetLeft = () => (settings.get('radar') && (settings.get('radarPos') || (touchy ? 'tl' : 'bl')) === 'tl' ? sz + 34 : 14);
  api.update = (dt, st) => {
    api.last = st;
    const wp = api.wp;
    if (wp) { const d = api.distToWp(); if (d < (st.driving ? 24 : 12)) { api.clearWaypoint(); toast('Waypoint reached'); } else beam.material.opacity = 0.32 + 0.1 * Math.sin(performance.now() / 300); }
    const on = settings.get('radar'), pos = settings.get('radarPos') || (touchy ? 'tl' : 'bl');
    const base = (touchy ? 128 : 168) * settings.get('radarSize'), target = Math.min(base * (api.expanded ? 1.9 : 1), innerHeight * 0.66, innerWidth * 0.5);
    sz += (target - sz) * Math.min(1, dt * 10) || 0; if (!sz) sz = target; if (Math.abs(sz - target) < 0.5) sz = target;
    const lay = on + pos + settings.get('radarShape') + Math.round(sz);
    if (lay !== lastLay) {
      lastLay = lay; box.style.display = on ? 'flex' : 'none';
      if (pos === 'tl') { box.style.left = '14px'; box.style.top = '14px'; box.style.bottom = 'auto'; box.style.alignItems = 'flex-start'; }
      else { box.style.left = '14px'; box.style.top = 'auto'; box.style.bottom = (touchy ? 12 : 16) + 'px'; box.style.alignItems = 'flex-end'; }
      const S = Math.round(sz); wrap.style.width = wrap.style.height = S + 'px'; wrap.style.borderRadius = settings.get('radarShape') === 'round' ? '50%' : '9px';
      const px = Math.round((S - 6) * MM_DPR); if (cv.width !== px) { cv.width = cv.height = px; }
    }
    // panel info (kecepatan kendaraan + jarak waypoint)
    if (on) {
      const parts = [];
      if (st.driving && settings.get('hudInfo')) parts.push(`<div style="background:#000a;border-left:4px solid #ff7a1a;padding:5px 10px 6px;border-radius:4px"><span style="font:30px Anton,Impact,sans-serif;letter-spacing:1px">${Math.round(st.kmh)}</span> <small style="font-size:11px;opacity:.8">KM/H</small><div style="font-size:11px;opacity:.85;margin-top:1px">${st.vehName || ''}</div><div style="margin-top:4px;height:5px;width:100%;min-width:92px;background:#0008;border-radius:3px;overflow:hidden"><div style="height:100%;width:${mmClamp(st.vhp ?? 100, 0, 100)}%;background:${(st.vhp ?? 100) > 50 ? '#3fbf5a' : (st.vhp ?? 100) > 25 ? '#e0b030' : '#d93a2e'}"></div></div></div>`);
      if (wp) { const d = api.distToWp(); parts.push(`<div style="background:#000a;border-left:4px solid #ff2fd0;padding:3px 9px;border-radius:4px;font-size:12px">WAYPOINT ${d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'}</div>`); }
      const html = parts.join(''); if (html !== lastHtml) { lastHtml = html; panel.innerHTML = html; }
    }
    if (!on || (touchy && (frame++ & 1))) return;
    const S = Math.round(sz), R0 = MM_ZOOMS[settings.get('radarZoom')] * (api.expanded ? 1.7 : 1), want = R0 * (settings.get('radarAuto') && st.driving ? 1 + 0.9 * mmClamp(st.kmh / 100, 0, 1) : 1);
    rc += (want - rc) * Math.min(1, dt * 3) || 0; if (!rc) rc = want;
    const inner = S - 6, ppm = (inner / 2) / rc, rot = settings.get('radarRotate') ? st.yaw : 0;
    render(g, inner, inner, { cx: st.x, cz: st.z, ppm, rot }, { blips: true, north: true, shape: settings.get('radarShape'), size: inner, clampWp: true, player: { x: st.x, z: st.z, h: st.heading, fixed: true, s: 7.5 } });
    const n = night.value; if (Math.abs(n - lastNight) > 0.03) { lastNight = n; wrap.style.filter = `brightness(${(1 - 0.42 * n).toFixed(2)})`; }
  };
  return api;
}
