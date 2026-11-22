// node tools/tests/sitik.test.mjs  -- IK pose duduk (src/sitik.js). Panjang tulang = hasil ukur char_retro.glb x FIT 0.957 (lihat STATE iter 79).
import assert from 'node:assert/strict';
import { sikRot, sikSolve } from '../../src/sitik.js';
const F = 0.957, thigh = [-0.353 * F, 0.001 * F], shin = [-0.389 * F, -0.12 * F];
// rotasi: sudut negatif -> ujung ke depan (+z)
{ const r = sikRot([-1, 0], -0.5); assert.ok(r[1] > 0.4 && r[0] < -0.8, 'negatif = ke depan'); }
// kasus nyata: pinggul Beat y 0.974 z -0.36 ; pergelangan target y 0.42 z 0.00
for (const [nm, hip, foot] of [['beat', [0.974, -0.36], [0.42, 0.0]], ['mio', [0.944, -0.28], [0.38, 0.05]], ['scoopy', [0.964, -0.28], [0.42, 0.08]], ['pillion beat', [0.974, -0.74], [0.5, -0.3]]]) {
  const t = [foot[0] - hip[0], foot[1] - hip[1]], r = sikSolve(thigh, shin, t);
  const knee = sikRot(thigh, r.a1);
  console.log(nm.padEnd(13), 'jarak', Math.hypot(...t).toFixed(3), 'a1', r.a1.toFixed(2), 'a2', r.a2.toFixed(2), 'err', r.err.toFixed(4), 'lutut y,z', (hip[0] + knee[0]).toFixed(2), (hip[1] + knee[1]).toFixed(2));
  assert.ok(r.err < 0.02, nm + ' tidak terjangkau: ' + r.err);
  assert.ok(hip[1] + knee[1] > hip[1] + 0.05, 'lutut harus ke depan pinggul');
  assert.ok(r.a1 < 0 && r.a2 >= -0.3, 'sudut masuk akal');
}
// target di luar jangkauan: ujung menjulur lurus ke arah target, galat > 0 tapi tidak NaN
{ const r = sikSolve(thigh, shin, [-0.2, 1.2]); assert.ok(isFinite(r.err) && r.err > 0.1); }
// lengan (stang): bahu setelah condong ke depan
{ const arm = [-0.314 * F, 0], fore = [-0.352 * F, 0.0], r = sikSolve(arm, fore, [1.02 - 1.63, 0.25 - 0.0], { a1: [-2.2, 0.3], a2: [-1.3, 1.3], pref: 0, reg: 0.01 });
  console.log('lengan'.padEnd(13), 'a1', r.a1.toFixed(2), 'a2', r.a2.toFixed(2), 'err', r.err.toFixed(4)); assert.ok(r.err < 0.05); }
console.log('sitik OK');
