// iter 88: teleport ke koridor, putar kamera (Q/E) dan ambil beberapa screenshot. Pakai: NODE_PATH=$(npm root -g) node smoke_koridor2.js <akar> <prefix_out> [tombol] [kunci_putar] [jumlah]
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } }); const errs = [], logs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { const t = m.text(); if (m.type() === 'error') errs.push(t.slice(0, 160)); else if (/koridor|lazy|darmo_bld/i.test(t)) logs.push(t.slice(0, 160)); });
  await p.goto('file://' + process.argv[2] + '/test.html?q=1');
  await p.waitForFunction(() => window.__gameStarted, null, { timeout: 240000 }).catch(e => errs.push('TIMEOUT start')); await p.waitForTimeout(3000);
  await p.evaluate(() => { for (const e of document.body.children) { const cs = getComputedStyle(e); if (cs.position === 'fixed' && /LOADING|MULAI|START/i.test(e.textContent) && e.textContent.length > 40 && e.querySelectorAll('button').length < 3) e.remove(); } }); await p.keyboard.press('Space'); await p.waitForTimeout(3000);
  await p.getByText('>> ' + (process.argv[4] || 'Koridor')).first().click({ force: true }); await p.waitForTimeout(8000);
  const key = process.argv[5] || 'KeyE', n = +(process.argv[6] || 3);
  for (let i = 0; i < n; i++) { await p.screenshot({ path: process.argv[3] + i + '.png', timeout: 170000 }); await p.keyboard.down(key); await p.waitForTimeout(+(process.env.HOLD || 1500)); await p.keyboard.up(key); await p.waitForTimeout(1500); }
  console.log('ERR', errs.slice(0, 4)); console.log('LOG', logs.slice(0, 6)); await b.close();
})();
