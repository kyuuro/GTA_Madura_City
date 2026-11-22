// iter 88: tangkapan di titik ?tp=x,z (kamera menghadap utara). NODE_PATH=$(npm root -g) node shot_tp.js <akar> <out.png> <x,z> [query_tambahan] [tunggu_ms]
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } }); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
  await p.goto('file://' + process.argv[2] + '/test.html?q=1&tp=' + process.argv[4] + (process.argv[5] || ''));
  await p.waitForFunction(() => window.__gameStarted, null, { timeout: 240000 }).catch(e => errs.push('TIMEOUT start')); await p.waitForTimeout(3000);
  await p.evaluate(() => { for (const e of document.body.children) { const cs = getComputedStyle(e); if (cs.position === 'fixed' && /LOADING|MULAI|START/i.test(e.textContent) && e.textContent.length > 40 && e.querySelectorAll('button').length < 3) e.remove(); } }); await p.keyboard.press('Space');
  await p.waitForTimeout(+(process.argv[6] || 9000)); await p.screenshot({ path: process.argv[3], timeout: 170000 }); console.log('ERR', errs.slice(0, 3)); await b.close();
})();
