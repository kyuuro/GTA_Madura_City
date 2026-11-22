// iter 90: tangkapan UI (radar, radar besar, peta penuh, menu setting). NODE_PATH=$(npm root -g) node ui_shot.js <akar> <prefix_out> [query] [WxH]
const { chromium } = require('playwright');
(async () => {
  const [W, H] = (process.argv[5] || '1100x650').split('x').map(Number);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } }); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await p.goto('file://' + process.argv[2] + '/test.html?q=1' + (process.argv[4] || ''));
  await p.waitForFunction(() => window.__gameStarted, null, { timeout: 240000 }).catch(e => errs.push('TIMEOUT start'));
  await p.waitForTimeout(1500); await p.evaluate(() => window.gtaSplash && window.gtaSplash.finish());
  await p.waitForTimeout(2500);
  console.log('splashDone', await p.evaluate(() => window.gtaSplash && window.gtaSplash.isDone && window.gtaSplash.isDone()));
  const shot = async (n, w = 4000) => { await p.waitForTimeout(w); await p.screenshot({ path: process.argv[3] + n + '.png', timeout: 170000 }); };
  await shot('a_game', 5000);
  await p.keyboard.press('KeyN'); await shot('b_radar_big', 4000);
  await p.keyboard.press('KeyN'); await p.keyboard.press('KeyM'); await shot('c_map', 2500);
  await p.keyboard.press('Tab'); await shot('d_settings', 800);
  await p.keyboard.press('KeyE'); await p.keyboard.press('KeyE'); await shot('e_audio', 500);
  console.log('ERR', errs.slice(0, 6)); await b.close();
})();
