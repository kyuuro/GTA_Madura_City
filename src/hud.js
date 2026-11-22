// HUD (iter 90, ala GTA): teks debug (FPS, segitiga, draw call, kualitas) HANYA tampil kalau setting Debug ON;
// status kanan-atas (jam, denda, senjata, berenang) + petunjuk kontrol singkat (25 dtk pertama / saat setting dinyalakan).
// Kecepatan kendaraan & jarak waypoint ada di panel di samping radar (minimap.js).
export function createHUD(renderer, o) {
  const { getQuality, getDebugExtra, getStatus, settings, mm } = o;
  const el = document.getElementById('hud'), ttl = document.getElementById('title'), touchy = matchMedia('(pointer:coarse)').matches;
  const mk = (css) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;pointer-events:none;z-index:22;' + css; document.body.appendChild(d); return d; };
  const status = mk('right:62px;top:46px;text-align:right;color:#fff;font:24px Anton,Impact,sans-serif;letter-spacing:1px;text-shadow:2px 2px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000;line-height:1.25');
  const hint = mk('left:50%;bottom:34px;transform:translateX(-50%);max-width:92vw;padding:5px 12px;border-radius:6px;background:#0008;color:#fff;font:12px Arial,sans-serif;text-align:center;transition:opacity .6s;opacity:0');
  hint.textContent = touchy ? 'Left stick: move   Drag right: camera   RUN / PUNCH / KICK / ENTER   Menu: gear button' : 'WASD move   Shift run   Q/E camera   F vehicle   J punch   K kick   H horn   M map   N radar size   Esc settings';
  let hintUntil = performance.now() + 25000, lastSt = '', lastHint = null;
  settings.on((k, val) => { if (k === 'hint' && val) hintUntil = performance.now() + 25000; });
  const gear = mk('right:12px;top:44px;width:40px;height:40px;border-radius:50%;background:#000b;border:2px solid #ffffff66;color:#fff;font:22px/36px Arial;text-align:center;pointer-events:auto;cursor:pointer');
  gear.textContent = '\u2699'; gear.title = 'Settings (Esc)';
  gear.addEventListener('click', (e) => { settings.open('settings'); e.stopPropagation(); }); gear.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true }); gear.addEventListener('mousedown', (e) => e.stopPropagation());
  let frames = 0, last = performance.now(), fps = 0;
  return function update() {
    frames++;
    const now = performance.now();
    if (now - last >= 500) { fps = Math.round(frames * 1000 / (now - last)); frames = 0; last = now; }
    const dbg = settings.get('debug'), left = mm ? mm.insetLeft() : 12;
    if (el) { el.style.display = dbg ? 'block' : 'none'; el.style.left = (left === 14 ? 12 : left) + 'px'; }
    if (ttl) ttl.style.display = dbg ? 'block' : 'none';
    if (dbg && el) {
      const i = renderer.info.render;
      el.textContent = `FPS       : ${fps}\nTriangles : ${i.triangles.toLocaleString('en-US')}\nDraw calls: ${i.calls}\nQuality   : ${getQuality()}  (press 1=Low 2=High 3=Ultra)\n` + getDebugExtra();
    }
    // status kanan-atas
    let html = '';
    if (settings.get('hudInfo')) {
      const s = getStatus();
      html = `<div>${s.clock}</div>` + `<div style="font-size:17px;color:${s.fines ? '#ff8a6a' : '#cfe8cf'}">FINES Rp ${s.fines.toLocaleString('en-US')}</div>`
        + (s.weapon ? `<div style="font-size:15px;color:#ffe9a8">${s.weapon}</div>` : '') + (s.swimming ? '<div style="font-size:15px;color:#9fd8ff">SWIMMING</div>' : '');
    }
    if (html !== lastSt) { lastSt = html; status.innerHTML = html; }
    const sh = settings.get('hint') && now < hintUntil && !settings.paused;
    if (sh !== lastHint) { lastHint = sh; hint.style.opacity = sh ? 1 : 0; }
  };
}
