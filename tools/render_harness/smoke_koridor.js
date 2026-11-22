const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } }); const errs = [], logs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { const t = m.text(); if (m.type() === 'error') errs.push(t.slice(0, 200)); else if (/koridor|junction|\[roads\]|\[traffic\]|\[buildings\]/i.test(t)) logs.push(t.slice(0, 160)); });
  await p.goto('file://' + process.argv[2] + '/test.html?q=1');
  await p.waitForFunction(() => window.__gameStarted, null, { timeout: 240000 }).catch(e => errs.push('TIMEOUT start'));
  console.log('started', await p.evaluate(() => !!window.__gameStarted)); await p.waitForTimeout(3000); await p.evaluate(() => { for (const e of document.body.children) { const cs = getComputedStyle(e); if (cs.position === 'fixed' && /LOADING|MULAI|START/i.test(e.textContent) && e.textContent.length > 40 && e.querySelectorAll('button').length < 3) e.remove(); } }); await p.keyboard.press('Space'); await p.waitForTimeout(4000);
  const btn = p.getByText('>> Koridor'); console.log('tombol Koridor:', await btn.count());
  await btn.first().click({ force: true }); await p.waitForTimeout(15000);
  await p.screenshot({ path: process.argv[3], timeout: 170000 }); console.log('ERR', errs.slice(0, 8)); console.log('LOG', logs.slice(0, 8));
  await b.close();
})();
