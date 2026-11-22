// iter 90 lanjutan: tes fungsional UI (waypoint, teleport peta, radar di kendaraan/malam, ganti kualitas, sentuh). NODE_PATH=$(npm root -g) node ui_test90.js <akar> <out_prefix> [touch]
const { chromium } = require('playwright');
(async () => {
  const touch = process.argv[4] === 'touch';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext(touch ? { viewport: { width: 740, height: 360 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: { width: 1000, height: 600 } });
  const p = await ctx.newPage(); const errs = [], logs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { const t = m.text(); if (m.type() === 'error') errs.push(t.slice(0, 200)); else if (/\[(minimap|settings|tp|buildings|koridor|music)\]/.test(t)) logs.push(t.slice(0, 120)); });
  await p.goto('file://' + process.argv[2] + '/test.html?q=1');
  await p.waitForFunction(() => window.__gameStarted, null, { timeout: 280000 }).catch(e => errs.push('TIMEOUT start'));
  await p.waitForTimeout(1500); await p.evaluate(() => window.gtaSplash && window.gtaSplash.finish()); await p.waitForTimeout(2500);
  const out = process.argv[3], R = [];
  const ok = (n, c, x) => { R.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x) : '')); };
  const shot = async (n, w = 1500) => { await p.waitForTimeout(w); await p.screenshot({ path: out + n + '.png', timeout: 170000 }); };
  const S = () => p.evaluate(() => { const u = window.__ui; return { paused: u.settings.paused, wp: u.mm.wp ? { x: Math.round(u.mm.wp.x), z: Math.round(u.mm.wp.z) } : null, pos: [Math.round(u.player.position.x), Math.round(u.player.position.z)], exp: u.mm.expanded, drv: !!(u.veh.driving) }; });
  // 1. buka peta penuh
  if (touch) { await p.evaluate(() => window.__ui.settings.open('map')); } else await p.keyboard.press('KeyM');
  await p.waitForTimeout(800); let s = await S(); ok('peta penuh membuka & jeda', s.paused === true, s);
  // 2. klik/tap di peta -> waypoint
  const box = await p.evaluate(() => { const r = document.querySelector('.gm-map').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  ok('elemen .gm-map ada', box.w > 50, box);
  const tx = box.x + box.w * 0.5, ty = box.y + box.h * 0.55;
  if (touch) await p.touchscreen.tap(tx, ty); else await p.mouse.click(tx, ty);
  await p.waitForTimeout(600); s = await S(); ok('tap peta -> waypoint', !!s.wp, s.wp);
  await shot('a_wp', 800);
  // 3. tombol teleport ke waypoint
  const wpBefore = s.wp;
  const tpBtn = await p.evaluate(() => { const b = [...document.querySelectorAll('.gm-btn')].find(e => /teleport|tp/i.test(e.textContent) || e.dataset.a === 'tp'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, t: b.textContent }; });
  ok('tombol teleport ada', !!tpBtn, tpBtn);
  if (tpBtn) { if (touch) await p.touchscreen.tap(tpBtn.x, tpBtn.y); else await p.mouse.click(tpBtn.x, tpBtn.y); await p.waitForTimeout(2500); s = await S();
    ok('teleport -> menu tutup, pemain pindah ke waypoint (+-30)', s.paused === false && wpBefore && Math.hypot(s.pos[0] - wpBefore.x, s.pos[1] - wpBefore.z) < 30, { s, wpBefore }); ok('waypoint dibersihkan', s.wp === null); }
  await shot('b_after_tp', 1500);
  // 4. radar saat naik kendaraan + malam
  const vinfo = await p.evaluate(() => { const u = window.__ui; const v = u.veh.list.filter(x => !x.ai).sort((a, b) => Math.hypot(a.obj.position.x - u.player.position.x, a.obj.position.z - u.player.position.z) - Math.hypot(b.obj.position.x - u.player.position.x, b.obj.position.z - u.player.position.z))[0]; return v ? { t: v.type, d: Math.round(Math.hypot(v.obj.position.x - u.player.position.x, v.obj.position.z - u.player.position.z)) } : null; });
  ok('ada kendaraan parkir terdekat', !!vinfo, vinfo);
  await p.evaluate(() => { const u = window.__ui; const v = u.veh.list.filter(x => !x.ai).sort((a, b) => Math.hypot(a.obj.position.x - u.player.position.x, a.obj.position.z - u.player.position.z) - Math.hypot(b.obj.position.x - u.player.position.x, b.obj.position.z - u.player.position.z))[0]; if (v) { u.player.position.set(v.obj.position.x + 1.5, 0, v.obj.position.z); if (u.veh.enter) u.veh.enter(v, u.player); } });
  await p.waitForTimeout(1500); s = await S(); ok('naik kendaraan (driving)', s.drv === true, s);
  await p.evaluate(() => window.__ui.settings.set('timeScale', 30)); await p.waitForTimeout(100);
  await shot('c_vehicle_radar', 6000);
  // 5. ganti kualitas lewat setting (Low -> Ultra -> Low), cek tanpa error
  for (const q of ['Ultra', 'Low']) { await p.evaluate((q) => window.__ui.settings.set('quality', q), q); await p.waitForTimeout(5000); const st = await p.evaluate(() => ({ q: window.__ui.settings.get('quality'), paused: window.__ui.settings.paused })); ok('ganti kualitas ' + q, st.q === q, st); await shot('d_q_' + q, 2500); }
  console.log(R.join('\n')); console.log('LOGS', logs.slice(-8)); console.log('ERR', errs.slice(0, 8)); await b.close();
})();
