// HP pemain (iter 25). createHealth({ onDeath }) -> { hp, hit(n), update(dt), reset(), dead }
// Sumber damage dipasang di main.js: ledakan dekat, kendaraan yang dikendarai rusak/terbakar. Regen pelan kalau lama tak terkena.
export function createHealth({ onDeath }) {
  const api = { hp: 100, dead: false, since: 99 };
  const mk = (css) => { const e = document.createElement('div'); e.style.cssText = 'position:fixed;pointer-events:none;z-index:20;' + css; document.body.appendChild(e); return e; };
  const wrap = mk('left:50%;bottom:14px;transform:translateX(-50%);width:170px;height:9px;background:#0008;border:1px solid #000a;border-radius:5px;overflow:hidden');
  const bar = document.createElement('div'); bar.style.cssText = 'height:100%;width:100%;background:#3fbf5a;transition:width .15s'; wrap.appendChild(bar);
  const flash = mk('inset:0;background:#d00;opacity:0;transition:opacity .4s');
  const wasted = mk('inset:0;display:none;align-items:center;justify-content:center;background:#000a;color:#c8c8c8;font:bold 76px Impact,Anton,sans-serif;letter-spacing:4px;text-shadow:0 4px 0 #000');
  wasted.textContent = 'WASTED';
  function ui() { bar.style.width = Math.max(0, api.hp) + '%'; bar.style.background = api.hp > 50 ? '#3fbf5a' : api.hp > 25 ? '#e0b030' : '#d93a2e'; }
  api.hit = (n) => {
    if (api.dead || n <= 0) return;
    api.hp = Math.max(0, api.hp - n); api.since = 0; ui();
    flash.style.transition = 'none'; flash.style.opacity = Math.min(0.5, 0.15 + n / 100); void flash.offsetWidth; flash.style.transition = 'opacity .4s'; flash.style.opacity = 0;
    console.log(`[hp] -${Math.round(n)} -> ${Math.round(api.hp)}`);
    if (api.hp <= 0) { api.dead = true; wasted.style.display = 'flex'; console.log('[hp] WASTED'); if (onDeath) onDeath(); }
  };
  api.reset = () => { api.hp = 100; api.dead = false; api.since = 99; wasted.style.display = 'none'; ui(); };
  api.update = (dt) => { if (api.dead) return; api.since += dt; if (api.since > 6 && api.hp < 100) { api.hp = Math.min(100, api.hp + 3 * dt); ui(); } };
  ui();
  return api;
}
