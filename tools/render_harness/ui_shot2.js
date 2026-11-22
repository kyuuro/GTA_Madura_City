// iter 90: skenario UI (berkendara + wanted + waypoint + debug + peta zoom out). NODE_PATH=$(npm root -g) node ui_shot2.js <akar> <prefix> [WxH] [touch]
const { chromium } = require('playwright');
(async () => {
  const [W, H] = (process.argv[4] || '1100x650').split('x').map(Number), touch = process.argv[5] === 'touch';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch }); const p = await c.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await p.goto('file://' + process.argv[2] + '/test.html?q=1');
  await p.waitForFunction(() => window.__gameStarted, null, { timeout: 240000 }).catch(e => errs.push('TIMEOUT start'));
  await p.waitForTimeout(1500); await p.evaluate(() => window.gtaSplash && window.gtaSplash.finish()); await p.waitForTimeout(1500);
  const shot = async (n, w = 3000) => { await p.waitForTimeout(w); await p.screenshot({ path: process.argv[3] + n + '.png', timeout: 170000 }); };
  await p.evaluate(() => { const u = window.__ui, v = u.veh.list.find(q => q.type === 'car' || q.type === 'sedan') || u.veh.list[0]; u.player.position.set(v.obj.position.x + 2, 0, v.obj.position.z); u.veh.enter(v, u.player); v.sp = 14;
    u.settings.set('debug', true); u.satpol.report(100, 'Test wanted'); u.mm.setWaypoint(u.player.position.x + 350, u.player.position.z - 260); });
  await shot('f_drive', 6000);
  await p.evaluate(() => { const u = window.__ui; u.settings.set('radarShape', 'square'); u.settings.set('radarPos', 'tl'); u.settings.set('radarRotate', false); });
  await shot('g_square_tl', 3500);
  await p.keyboard.press('KeyM'); await p.waitForTimeout(800);
  for (let i = 0; i < 6; i++) await p.keyboard.press('Minus');
  await shot('h_map_world', 1500);
  console.log('ERR', errs.slice(0, 6)); await b.close();
})();
