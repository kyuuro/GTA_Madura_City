// Kontrol: keyboard (WASD/panah, Shift, Q/E) + sentuh (stick kiri, geser kanan = kamera, tombol LARI).
export function createControls() {
  const c = { x: 0, y: 0, run: false, yaw: 0 }, keys = new Set();
  let tx = 0, ty = 0, runT = false, stickId = null, camId = null, o = null, lastX = 0;
  let punchReq = false; c.consumePunch = () => { const p = punchReq; punchReq = false; return p; };   // iter 69: tombol pukul (J / klik kiri / tombol PUNCH di HP)
  let kickReq = false; c.consumeKick = () => { const k = kickReq; kickReq = false; return k; };   // iter 72b: tendangan (K / tombol KICK di HP)
  addEventListener('keydown', e => { keys.add(e.code); if (e.code === 'KeyJ' && !e.repeat) punchReq = true; if (e.code === 'KeyK' && !e.repeat) kickReq = true; });
  addEventListener('mousedown', e => { if (e.button === 0 && e.target && e.target.tagName === 'CANVAS') punchReq = true; });
  addEventListener('keyup', e => keys.delete(e.code));
  const touchy = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
  const mk = (css) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;z-index:50;touch-action:none;display:none;' + css; document.body.appendChild(d); return d; };
  const base = mk('width:110px;height:110px;margin:-55px 0 0 -55px;border-radius:50%;background:#ffffff22;border:2px solid #ffffff66;pointer-events:none');
  const knob = mk('width:50px;height:50px;margin:-25px 0 0 -25px;border-radius:50%;background:#ffe9a8aa;pointer-events:none');
  if (touchy) {
    const rb = mk('display:flex;right:22px;bottom:70px;width:84px;height:84px;border-radius:50%;background:#ff7a1acc;color:#fff;font:bold 15px sans-serif;align-items:center;justify-content:center;user-select:none');
    rb.textContent = 'RUN';
    rb.addEventListener('touchstart', e => { runT = true; e.preventDefault(); e.stopPropagation(); }, { passive: false });
    rb.addEventListener('touchend', e => { runT = false; e.stopPropagation(); });
    const pb = mk('display:flex;right:122px;bottom:90px;width:70px;height:70px;border-radius:50%;background:#d93a3acc;color:#fff;font:bold 13px sans-serif;align-items:center;justify-content:center;user-select:none');
    pb.textContent = 'PUNCH'; pb.addEventListener('touchstart', e => { punchReq = true; e.preventDefault(); e.stopPropagation(); }, { passive: false });
    const kb = mk('display:flex;right:122px;bottom:166px;width:62px;height:62px;border-radius:50%;background:#8a3ad9cc;color:#fff;font:bold 12px sans-serif;align-items:center;justify-content:center;user-select:none');
    kb.textContent = 'KICK'; kb.addEventListener('touchstart', e => { kickReq = true; e.preventDefault(); e.stopPropagation(); }, { passive: false });
    addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.5 && stickId === null) {
          stickId = t.identifier; o = { x: t.clientX, y: t.clientY };
          base.style.cssText += `display:block;left:${o.x}px;top:${o.y}px`; knob.style.cssText += `display:block;left:${o.x}px;top:${o.y}px`;
        } else if (t.clientX >= innerWidth * 0.5 && camId === null) { camId = t.identifier; lastX = t.clientX; }
      }
    }, { passive: false });
    addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          let dx = (t.clientX - o.x) / 50, dy = (t.clientY - o.y) / 50; const l = Math.hypot(dx, dy);
          if (l > 1) { dx /= l; dy /= l; }
          tx = dx; ty = -dy; knob.style.left = o.x + dx * 50 + 'px'; knob.style.top = o.y + dy * 50 + 'px';
        } else if (t.identifier === camId) { c.yaw -= (t.clientX - lastX) * 0.007; lastX = t.clientX; }
      }
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) { stickId = null; tx = ty = 0; base.style.display = knob.style.display = 'none'; }
        if (t.identifier === camId) camId = null;
      }
    };
    addEventListener('touchend', end); addEventListener('touchcancel', end);
  }
  c.update = (dt) => {
    if (keys.has('KeyQ')) c.yaw += 1.8 * dt;
    if (keys.has('KeyE')) c.yaw -= 1.8 * dt;
    const k = (n, p) => (keys.has(n) || keys.has(p) ? 1 : 0);
    const x = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft') + tx, y = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown') + ty, l = Math.hypot(x, y);
    c.x = l > 1 ? x / l : x; c.y = l > 1 ? y / l : y;
    c.run = keys.has('ShiftLeft') || runT;
  };
  return c;
}
