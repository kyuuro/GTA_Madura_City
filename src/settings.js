// Iterasi 90: SETTING + MENU PAUSE ala GTA (tab MAP = peta penuh, tab SETTINGS = pengaturan). Disimpan di localStorage.
// createSettings() -> { get(k), set(k,v), on(fn(k,v)), paused, open(tab), close(), update(dt), setTeleports([[nama, fn]]), attach({mm, toast, teleport}) }
// Kunci: Esc/P = menu setting, M = peta penuh, N = radar dibesarkan/dikecilkan. Di menu: Tab = MAP/SETTINGS, Atas/Bawah pilih, Kiri/Kanan ubah, Q/E ganti kategori.
// Saat menu terbuka game DIJEDA (main.js membaca settings.paused). Event keydown ditelan (fase capture) supaya tombol game tidak ikut jalan.
import { MM_B, MM_DPR, mmPlay, mmClamp, mmToWorld, mmToScreen } from './minimap.js';

const ST_KEY = 'gta-suramadu.settings.v1';
const ST_DEF = { debug: false, hint: true, hudInfo: true, radar: true, radarShape: 'round', radarSize: 1, radarZoom: 1, radarRotate: true, radarAuto: true, radarPos: '', blips: true, music: 100, sfx: 100, mute: false, quality: '', timeScale: 1 };
const ST_NOSAVE = ['mute', 'timeScale'];
const ST_CATS = [
  { name: 'DISPLAY', rows: [
    { k: 'debug', label: 'Debug info (FPS, triangles, draw calls)', type: 'toggle' },
    { k: 'hint', label: 'Controls hint on screen', type: 'toggle' },
    { k: 'hudInfo', label: 'Clock, fines, weapon & speedometer', type: 'toggle' } ] },
  { name: 'RADAR', rows: [
    { k: 'radar', label: 'Show radar', type: 'toggle' },
    { k: 'radarShape', label: 'Radar shape', type: 'choice', opts: [['round', 'Round'], ['square', 'Square']] },
    { k: 'radarSize', label: 'Radar size', type: 'choice', opts: [[0.8, 'Small'], [1, 'Medium'], [1.25, 'Large']] },
    { k: 'radarZoom', label: 'Radar zoom', type: 'choice', opts: [[0, 'Close'], [1, 'Normal'], [2, 'Far'], [3, 'Very far']] },
    { k: 'radarRotate', label: 'Rotate with camera (off = north up)', type: 'toggle' },
    { k: 'radarAuto', label: 'Zoom out while driving', type: 'toggle' },
    { k: 'radarPos', label: 'Radar position', type: 'choice', opts: [['', 'Auto'], ['bl', 'Bottom-left'], ['tl', 'Top-left']] },
    { k: 'blips', label: 'Blips (police, workshop)', type: 'toggle' } ] },
  { name: 'AUDIO', rows: [
    { k: 'music', label: 'Music volume', type: 'slider', min: 0, max: 150, step: 10 },
    { k: 'sfx', label: 'Sound effects volume', type: 'slider', min: 0, max: 150, step: 10 },
    { k: 'mute', label: 'Mute all sound', type: 'toggle' } ] },
  { name: 'GRAPHICS', rows: [
    { k: 'quality', label: 'Quality (rebuilds the city)', type: 'choice', opts: [['Low', 'Low'], ['High', 'High'], ['Ultra', 'Ultra']] },
    { k: 'timeScale', label: 'Time speed (T)', type: 'choice', opts: [[1, 'Normal'], [30, 'Fast x30']] } ] },
  { name: 'TELEPORT', dyn: 'tp' },
  { name: 'CONTROLS', info: [['Move', 'W A S D / arrows'], ['Run / turbo', 'Shift'], ['Camera', 'Q / E'], ['Enter / exit vehicle', 'F'], ['Horn', 'H'], ['Punch / kick', 'J / K  (or click)'], ['Drop weapon', 'G'], ['Full map', 'M'], ['Enlarge radar', 'N  (or click the radar)'], ['Settings / pause', 'Esc  or  P'], ['Time x30', 'T'], ['Quality', '1 / 2 / 3'],
    ['Touch', 'left stick = move, drag right = camera, RUN / PUNCH / KICK / ENTER buttons']] },
];

export function createSettings() {
  const touchy = matchMedia('(pointer:coarse)').matches;
  const api = { paused: false, hooks: {} };
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(ST_KEY)) || {}; } catch (e) { /* tanpa localStorage: tetap jalan */ }
  const v = {}; for (const k in ST_DEF) v[k] = (typeof saved[k] === typeof ST_DEF[k] && !ST_NOSAVE.includes(k)) ? saved[k] : ST_DEF[k];
  if (new URLSearchParams(location.search).get('debug') === '1') v.debug = true;
  const L = []; let saveT = 0, open = false, tab = 'settings', ci = 0, sel = 0, tp = [];
  api.on = (fn) => { L.push(fn); };
  api.get = (k) => v[k];
  api.set = (k, val) => {
    if (v[k] === val) return; v[k] = val;
    clearTimeout(saveT); saveT = setTimeout(() => { try { const o = {}; for (const q in v) if (!ST_NOSAVE.includes(q)) o[q] = v[q]; localStorage.setItem(ST_KEY, JSON.stringify(o)); } catch (e) { /* abaikan */ } }, 250);
    L.forEach(f => f(k, val)); if (open) renderRows();
  };
  api.setTeleports = (list) => { tp = list; };
  api.attach = (h) => { api.hooks = h; };
  Object.defineProperty(api, 'isOpen', { get: () => open });

  // ---------- DOM ----------
  let ov, catsEl, rowsEl, mapEl, cv, g, footEl, tabEls, mapInfo;
  const mv = { cx: 0, cz: 0, ppm: 0.1 };
  const rowsOf = (cat) => cat.dyn === 'tp' ? tp.map(([n, fn]) => ({ type: 'action', label: n, fn })) : cat.info ? cat.info.map(([a, b]) => ({ type: 'info', label: a, val: b })) : cat.rows;
  const optLabel = (r) => { const o = r.opts.find(q => q[0] === v[r.k]); return o ? o[1] : String(v[r.k]); };
  function build() {
    if (ov) return;
    const st = document.createElement('style');
    st.textContent = `
.gm-ov{position:fixed;inset:0;z-index:300;display:none;background:rgba(8,8,11,.92);color:#fff;font:15px Arial,Helvetica,sans-serif;-webkit-user-select:none;user-select:none}
.gm-top{display:flex;align-items:center;gap:6px;padding:10px 22px 0;height:46px;border-bottom:2px solid #ff7a1a}
.gm-title{font:30px Anton,Impact,sans-serif;letter-spacing:3px;color:#ff7a1a;margin-right:26px}
.gm-tab{padding:9px 18px 7px;font:19px Anton,Impact,sans-serif;letter-spacing:2px;color:#aaa;cursor:pointer;border-bottom:4px solid transparent;margin-bottom:-2px}
.gm-tab.on{color:#fff;border-bottom-color:#ff7a1a}
.gm-x{margin-left:auto;padding:7px 14px;cursor:pointer;font:bold 13px Arial;background:#ff7a1a;color:#000;border-radius:4px;margin-bottom:6px}
.gm-body{position:absolute;top:50px;bottom:32px;left:0;right:0;display:flex}
.gm-cats{width:190px;padding:16px 0;flex:none;overflow-y:auto}
.gm-cat{padding:11px 20px;cursor:pointer;font:17px Anton,Impact,sans-serif;letter-spacing:1.5px;color:#bbb;border-left:4px solid transparent}
.gm-cat.on{background:#ffffff1c;color:#fff;border-left-color:#ff7a1a}
.gm-rows{flex:1;overflow-y:auto;padding:16px 26px;max-width:860px}
.gm-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 14px;margin-bottom:4px;background:rgba(255,255,255,.08);cursor:pointer}
.gm-row.sel{background:#fff;color:#000}
.gm-row.info{cursor:default;background:rgba(255,255,255,.04)}
.gm-row .gm-val{font-weight:bold;min-width:130px;text-align:center}
.gm-row.info .gm-val{text-align:right;font-weight:normal;opacity:.85}
.gm-ctl{display:flex;align-items:center;gap:6px}
.gm-arr{padding:0 8px;font-size:20px;cursor:pointer;opacity:.75}
.gm-bar{display:flex;gap:2px;cursor:pointer;padding:6px 0}
.gm-bar i{display:block;width:9px;height:14px;background:#ffffff30}
.gm-bar i.on{background:#ff7a1a}
.gm-row.sel .gm-bar i{background:#00000030}.gm-row.sel .gm-bar i.on{background:#ff7a1a}
.gm-foot{position:absolute;left:0;right:0;bottom:0;height:32px;line-height:32px;padding:0 22px;background:#000a;color:#bbb;font-size:12px;white-space:nowrap;overflow:hidden}
.gm-map{position:relative;flex:1;margin:12px 16px 4px;border:2px solid #000;box-shadow:0 0 0 2px #ffffff30;overflow:hidden;cursor:grab;touch-action:none;background:#7698b0}
.gm-map canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.gm-btn{position:absolute;min-width:36px;height:36px;padding:0 12px;box-sizing:border-box;text-align:center;background:#000c;color:#fff;font:bold 13px/34px Arial;border:1px solid #fff5;border-radius:5px;cursor:pointer}
.gm-btn:hover{background:#ff7a1a;color:#000}
.gm-leg{position:absolute;left:10px;bottom:10px;padding:6px 10px;background:#000b;font-size:12px;line-height:1.7;border-radius:5px;pointer-events:none}
.gm-info{position:absolute;left:10px;top:10px;padding:5px 10px;background:#000b;font-size:12px;border-radius:5px;pointer-events:none}
@media (max-height:520px),(max-width:700px){.gm-cats{width:118px}.gm-cat{padding:8px 10px;font-size:14px}.gm-rows{padding:8px 12px}.gm-row{padding:6px 10px;font-size:13px}.gm-title{font-size:22px;margin-right:12px}.gm-tab{font-size:15px;padding:9px 10px 7px}.gm-body{top:48px}.gm-row .gm-val{min-width:96px}.gm-bar i{width:6px}.gm-leg,.gm-info{font-size:11px}}`;
    document.head.appendChild(st);
    ov = document.createElement('div'); ov.className = 'gm-ov';
    ov.innerHTML = `<div class="gm-top"><span class="gm-title">PAUSE</span><span class="gm-tab" data-t="map">MAP</span><span class="gm-tab" data-t="settings">SETTINGS</span><span class="gm-x">RESUME &#10005;</span></div>
<div class="gm-body"><div class="gm-cats"></div><div class="gm-rows"></div>
<div class="gm-map"><canvas></canvas><div class="gm-info"></div>
<div class="gm-btn" data-a="in" style="right:10px;top:10px">+</div><div class="gm-btn" data-a="out" style="right:10px;top:52px">&minus;</div><div class="gm-btn" data-a="me" style="right:10px;top:94px" title="Center on player">&#9678;</div>
<div class="gm-btn" data-a="wp" style="right:10px;bottom:10px">SET WAYPOINT</div><div class="gm-btn" data-a="clr" style="right:140px;bottom:10px">CLEAR</div><div class="gm-btn" data-a="tp" style="right:210px;bottom:10px">TELEPORT TO WAYPOINT</div>
<div class="gm-leg"><span style="color:#fff;text-shadow:0 0 2px #000">&#9650;</span> You &nbsp; <span style="color:#ff2b2b">&#9679;</span><span style="color:#2f6bff">&#9679;</span> Police &nbsp; <span style="color:#2cff7a">&#9679;</span> Workshop &nbsp; <span style="color:#ff2fd0">&#9670;</span> Waypoint</div></div></div>
<div class="gm-foot"></div>`;
    document.body.appendChild(ov);
    catsEl = ov.querySelector('.gm-cats'); rowsEl = ov.querySelector('.gm-rows'); mapEl = ov.querySelector('.gm-map'); cv = mapEl.querySelector('canvas'); g = cv.getContext('2d');
    footEl = ov.querySelector('.gm-foot'); tabEls = [...ov.querySelectorAll('.gm-tab')]; mapInfo = ov.querySelector('.gm-info');
    mapInfo.textContent = touchy ? 'Drag = pan, pinch = zoom, tap = set waypoint' : 'Drag = pan, wheel = zoom, click = set / remove waypoint';
    ST_CATS.forEach((c, i) => { const d = document.createElement('div'); d.className = 'gm-cat'; d.textContent = c.name; d.onclick = () => { ci = i; sel = firstSel(); renderCats(); renderRows(); }; catsEl.appendChild(d); });
    tabEls.forEach(t => { t.onclick = () => setTab(t.dataset.t); });
    ov.querySelector('.gm-x').onclick = () => closeMenu();
    ov.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    ov.addEventListener('mousedown', (e) => e.stopPropagation());
    // --- peta penuh: tombol
    mapEl.querySelectorAll('.gm-btn').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); const a = b.dataset.a, [W, H] = mapSize(); const mm = api.hooks.mm;
      if (a === 'in') zoomAt(W / 2, H / 2, 1.5, true); else if (a === 'out') zoomAt(W / 2, H / 2, 1 / 1.5, true); else if (a === 'me') { mv.cx = mm.last.x; mv.cz = mm.last.z; }
      else if (a === 'wp') setWp(mv.cx, mv.cz); else if (a === 'clr') mm.clearWaypoint(); else if (a === 'tp' && mm.wp && api.hooks.teleport) { const w = mm.wp; mm.clearWaypoint(); closeMenu(); api.hooks.teleport(w.x, w.z); } }));
    // --- peta penuh: geser / cubit / roda / tap
    const ptr = new Map(); let down = null;
    mapEl.addEventListener('pointerdown', (e) => { if (e.target.closest('.gm-btn')) return; try { mapEl.setPointerCapture(e.pointerId); } catch (x) { /* */ } ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptr.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, pinch: false }; else if (down) down.pinch = true; mapEl.style.cursor = 'grabbing'; });
    mapEl.addEventListener('pointermove', (e) => {
      const p = ptr.get(e.pointerId); if (!p || !down) return; const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (ptr.size === 1) { mv.cx -= dx / mv.ppm; mv.cz -= dy / mv.ppm; down.moved += Math.abs(dx) + Math.abs(dy); clampView(); }
      else { const o = [...ptr.entries()].find(([id]) => id !== e.pointerId)[1], d0 = Math.hypot(p.x - o.x, p.y - o.y), d1 = Math.hypot(e.clientX - o.x, e.clientY - o.y); if (d0 > 0) zoomAt((e.clientX + o.x) / 2, (e.clientY + o.y) / 2, d1 / d0); down.pinch = true; }
      p.x = e.clientX; p.y = e.clientY;
    });
    const up = (e) => { const had = ptr.delete(e.pointerId); if (had && down && !down.pinch && down.moved < 7 && performance.now() - down.t < 700 && ptr.size === 0 && e.type === 'pointerup') tapAt(e.clientX, e.clientY); if (!ptr.size) { down = null; mapEl.style.cursor = 'grab'; } };
    mapEl.addEventListener('pointerup', up); mapEl.addEventListener('pointercancel', up);
    mapEl.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.3 : 1 / 1.3); }, { passive: false });
    // --- daftar setting: delegasi klik
    rowsEl.addEventListener('click', (e) => {
      const row = e.target.closest('.gm-row'); if (!row || row.classList.contains('info')) return; const i = +row.dataset.i, r = rowsOf(ST_CATS[ci])[i]; sel = i;
      const bar = e.target.closest('.gm-bar'), arr = e.target.closest('.gm-arr');
      if (bar && r.type === 'slider') { const b = bar.getBoundingClientRect(), n = (r.max - r.min) / r.step; api.set(r.k, r.min + Math.round(mmClamp((e.clientX - b.left) / b.width, 0, 1) * n) * r.step); }
      else act(r, arr ? +arr.dataset.d : 1); renderRows();
    });
  }
  const firstSel = () => Math.max(0, rowsOf(ST_CATS[ci]).findIndex(r => r.type !== 'info'));
  function renderCats() { [...catsEl.children].forEach((d, i) => d.classList.toggle('on', i === ci)); }
  function renderRows() {
    const rows = rowsOf(ST_CATS[ci]), top = rowsEl.scrollTop; rowsEl.innerHTML = '';
    if (!rows.length) rowsEl.innerHTML = '<div class="gm-row info"><span>(nothing here)</span></div>';
    rows.forEach((r, i) => {
      const d = document.createElement('div'); d.className = 'gm-row' + (r.type === 'info' ? ' info' : '') + (i === sel && r.type !== 'info' ? ' sel' : ''); d.dataset.i = i;
      let right = '';
      if (r.type === 'toggle') right = `<span class="gm-ctl"><span class="gm-arr" data-d="-1">&#8249;</span><span class="gm-val">${v[r.k] ? 'ON' : 'OFF'}</span><span class="gm-arr" data-d="1">&#8250;</span></span>`;
      else if (r.type === 'choice') right = `<span class="gm-ctl"><span class="gm-arr" data-d="-1">&#8249;</span><span class="gm-val">${optLabel(r)}</span><span class="gm-arr" data-d="1">&#8250;</span></span>`;
      else if (r.type === 'slider') { const n = (r.max - r.min) / r.step, on = Math.round((v[r.k] - r.min) / r.step); right = `<span class="gm-ctl"><span class="gm-arr" data-d="-1">&#8249;</span><span class="gm-bar">${Array.from({ length: n }, (_, q) => `<i class="${q < on ? 'on' : ''}"></i>`).join('')}</span><span class="gm-val" style="min-width:52px">${v[r.k]}%</span><span class="gm-arr" data-d="1">&#8250;</span></span>`; }
      else if (r.type === 'action') right = '<span class="gm-val">GO &#8250;</span>';
      else right = `<span class="gm-val">${r.val}</span>`;
      d.innerHTML = `<span>${r.label}</span>${right}`;
      d.onmouseenter = () => { if (r.type !== 'info' && sel !== i) { sel = i; [...rowsEl.children].forEach((c, q) => c.classList.toggle('sel', q === i && !c.classList.contains('info'))); } };
      rowsEl.appendChild(d);
    });
    rowsEl.scrollTop = top;
  }
  function act(r, d) {
    if (r.type === 'toggle') api.set(r.k, !v[r.k]);
    else if (r.type === 'choice') { const i = Math.max(0, r.opts.findIndex(o => o[0] === v[r.k])); api.set(r.k, r.opts[(i + d + r.opts.length) % r.opts.length][0]); }
    else if (r.type === 'slider') api.set(r.k, mmClamp(v[r.k] + d * r.step, r.min, r.max));
    else if (r.type === 'action') r.fn();
  }
  function setTab(t) {
    tab = t; tabEls.forEach(e => e.classList.toggle('on', e.dataset.t === t));
    const m = t === 'map'; catsEl.style.display = rowsEl.style.display = m ? 'none' : ''; mapEl.style.display = m ? '' : 'none';
    footEl.textContent = m ? (touchy ? 'Drag to pan  |  Pinch to zoom  |  Tap to set a waypoint' : 'Drag: pan   Wheel / + -: zoom   Click or Enter: waypoint   C: center on you   Backspace: clear   Tab: settings   Esc: resume')
      : (touchy ? 'Tap an option to change it  |  Tap RESUME to go back' : 'Up/Down: select   Left/Right: change   Enter: toggle   Q/E: category   Tab: map   Esc: resume');
    if (m) { const mm = api.hooks.mm, [W, H] = mapSize(); if (mm) { mv.cx = mm.last.x; mv.cz = mm.last.z; } mv.ppm = mmClamp(W / 1400, minPpm(), 1.6); lastDraw = 0; } else { renderCats(); renderRows(); }
  }
  function openMenu(t) { build(); open = true; api.paused = true; ov.style.display = 'block'; sel = firstSel(); setTab(t || 'settings'); }
  function closeMenu() { if (!open) return; open = false; api.paused = false; ov.style.display = 'none'; }
  api.open = openMenu; api.close = closeMenu; api.toggle = (t) => (open ? closeMenu() : openMenu(t));

  // ---------- peta penuh ----------
  const mapSize = () => { const r = mapEl.getBoundingClientRect(); return [Math.max(60, Math.round(r.width)), Math.max(60, Math.round(r.height))]; };
  const minPpm = () => { const [W, H] = mapSize(); return Math.min(H / (MM_B.z1 - MM_B.z0), W / (MM_B.x1 - MM_B.x0)); };
  const clampView = () => { mv.cx = mmClamp(mv.cx, MM_B.x0, MM_B.x1); mv.cz = mmClamp(mv.cz, MM_B.z0, MM_B.z1); };
  const view = () => ({ cx: mv.cx, cz: mv.cz, ppm: mv.ppm, rot: 0 });
  function zoomAt(cx, cy, f, local) {
    const r = mapEl.getBoundingClientRect(), [W, H] = mapSize(), sx = local ? cx : cx - r.left, sy = local ? cy : cy - r.top, a = mmToWorld(view(), W, H, sx, sy);
    mv.ppm = mmClamp(mv.ppm * f, minPpm(), 1.6); const b = mmToWorld(view(), W, H, sx, sy); mv.cx += a[0] - b[0]; mv.cz += a[1] - b[1]; clampView();
  }
  function setWp(x, z) { const mm = api.hooks.mm; if (!mm) return; if (!mmPlay(x, z)) { if (api.hooks.toast) api.hooks.toast("Can't set a waypoint there"); return; } mm.setWaypoint(x, z); if (api.hooks.toast) api.hooks.toast('Waypoint set'); }
  function tapAt(cx, cy) {
    const r = mapEl.getBoundingClientRect(), [W, H] = mapSize(), sx = cx - r.left, sy = cy - r.top, mm = api.hooks.mm; if (!mm) return;
    if (mm.wp) { const [wx, wy] = mmToScreen(view(), W, H, mm.wp.x, mm.wp.z); if (Math.hypot(wx - sx, wy - sy) < 16) { mm.clearWaypoint(); return; } }
    const [x, z] = mmToWorld(view(), W, H, sx, sy); setWp(x, z);
  }
  let lastDraw = 0;
  function drawMap() {
    const now = performance.now(); if (now - lastDraw < 33) return; lastDraw = now;
    const mm = api.hooks.mm; if (!mm) return; const [W, H] = mapSize(), px = Math.round(W * MM_DPR), py = Math.round(H * MM_DPR);
    if (cv.width !== px || cv.height !== py) { cv.width = px; cv.height = py; }
    const st = mm.last; mm.render(g, W, H, view(), { names: true, labels: true, blips: true, dash: true, cross: true, shape: 'square', player: { x: st.x, z: st.z, h: st.heading, s: 9 } });
    ov.querySelector('[data-a="clr"]').style.display = ov.querySelector('[data-a="tp"]').style.display = mm.wp ? '' : 'none';
  }
  api.update = () => { if (open && tab === 'map') drawMap(); };

  // ---------- keyboard ----------
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (window.gtaSplash && window.gtaSplash.isDone && !window.gtaSplash.isDone()) return;   // splash masih tampil
    const c = e.code;
    if (!open) {
      if (e.repeat) return;
      if (c === 'Escape' || c === 'KeyP') openMenu('settings'); else if (c === 'KeyM') openMenu('map'); else if (c === 'KeyN' && api.hooks.mm) api.hooks.mm.toggleExpand(); else return;
      e.preventDefault(); e.stopPropagation(); return;
    }
    e.stopPropagation();
    if (c === 'Escape' || c === 'KeyP') { closeMenu(); e.preventDefault(); return; }
    if (c === 'Tab') { setTab(tab === 'map' ? 'settings' : 'map'); e.preventDefault(); return; }
    if (c === 'KeyM') { if (tab === 'map') closeMenu(); else setTab('map'); e.preventDefault(); return; }
    if (tab === 'map') {
      const [W, H] = mapSize(), step = 70 / mv.ppm, mm = api.hooks.mm; let h = true;
      if (c === 'ArrowLeft' || c === 'KeyA') mv.cx -= step; else if (c === 'ArrowRight' || c === 'KeyD') mv.cx += step; else if (c === 'ArrowUp' || c === 'KeyW') mv.cz -= step; else if (c === 'ArrowDown' || c === 'KeyS') mv.cz += step;
      else if (c === 'Equal' || c === 'NumpadAdd' || c === 'KeyX' || c === 'PageUp') zoomAt(W / 2, H / 2, 1.3, true); else if (c === 'Minus' || c === 'NumpadSubtract' || c === 'KeyZ' || c === 'PageDown') zoomAt(W / 2, H / 2, 1 / 1.3, true);
      else if (c === 'Enter' || c === 'Space') setWp(mv.cx, mv.cz); else if (c === 'KeyC' && mm) { mv.cx = mm.last.x; mv.cz = mm.last.z; } else if ((c === 'Backspace' || c === 'Delete') && mm) mm.clearWaypoint(); else h = false;
      if (h) { clampView(); e.preventDefault(); } return;
    }
    const rows = rowsOf(ST_CATS[ci]), n = rows.length; let h = true;
    const move = (d) => { if (!n) return; let i = sel; for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (rows[i].type !== 'info') { sel = i; break; } } renderRows(); const el = rowsEl.children[sel]; if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); };
    if (c === 'ArrowDown' || c === 'KeyS') move(1); else if (c === 'ArrowUp' || c === 'KeyW') move(-1);
    else if (c === 'ArrowLeft' || c === 'KeyA') { if (rows[sel] && rows[sel].type !== 'info') { act(rows[sel], -1); renderRows(); } }
    else if (c === 'ArrowRight' || c === 'KeyD') { if (rows[sel] && rows[sel].type !== 'info') { act(rows[sel], 1); renderRows(); } }
    else if (c === 'Enter' || c === 'Space') { if (rows[sel] && rows[sel].type !== 'info') { act(rows[sel], 1); renderRows(); } }
    else if (c === 'KeyE' || c === 'PageDown') { ci = (ci + 1) % ST_CATS.length; sel = firstSel(); renderCats(); renderRows(); }
    else if (c === 'KeyQ' || c === 'PageUp') { ci = (ci + ST_CATS.length - 1) % ST_CATS.length; sel = firstSel(); renderCats(); renderRows(); }
    else h = false;
    if (h) e.preventDefault();
  }
  addEventListener('keydown', onKey, true);
  return api;
}
