// Iterasi 79: IK 2-tulang planar (bidang Y-Z) untuk pose duduk pengendara motor. MODUL MURNI (tanpa THREE) supaya bisa dites di node: tools/tests/sitik.test.mjs.
// Vektor 2D = [y, z] (depan = +Z). Rotasi sudut `a` di sumbu X dunia: y' = y cos a - z sin a, z' = y sin a + z cos a  (sudut NEGATIF = ujung bergerak ke depan, sama dengan retro.js).
// Nama top-level diawali "sik" (build_test.py butuh nama unik antar modul).
export function sikRot(v, a) { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1]]; }

// v1 = sendi atas -> sendi tengah, v2 = sendi tengah -> ujung (pose awal), target = ujung yang diinginkan RELATIF ke sendi atas.
// Cari (a1, a2): a1 = putaran sendi atas, a2 = putaran TAMBAHAN sendi tengah (kumulatif a1+a2 untuk segmen bawah, persis cara retro.js memutar tulang dunia).
// Biaya = jarak^2 + reg * (a2 - pref)^2 (memilih tekukan alami kalau ada banyak solusi). Kasar (0.04 rad) lalu halus (0.004 rad) -> ~6 ribu evaluasi, murah.
export function sikSolve(v1, v2, target, o = {}) {
  const A1 = o.a1 || [-2.1, 0.4], A2 = o.a2 || [-0.3, 2.4], reg = o.reg ?? 0.02, pref = o.pref ?? 0.6;
  const ev = (a1, a2) => {
    const m = sikRot(v1, a1), e = sikRot(v2, a1 + a2), dy = m[0] + e[0] - target[0], dz = m[1] + e[1] - target[1];
    return dy * dy + dz * dz + reg * (a2 - pref) * (a2 - pref);
  };
  let b = [0, 0, 1e9];
  const scan = (l1, h1, l2, h2, st) => { for (let a1 = l1; a1 <= h1 + 1e-9; a1 += st) for (let a2 = l2; a2 <= h2 + 1e-9; a2 += st) { const c = ev(a1, a2); if (c < b[2]) b = [a1, a2, c]; } };
  scan(A1[0], A1[1], A2[0], A2[1], 0.04);
  scan(Math.max(A1[0], b[0] - 0.06), Math.min(A1[1], b[0] + 0.06), Math.max(A2[0], b[1] - 0.06), Math.min(A2[1], b[1] + 0.06), 0.004);
  const m = sikRot(v1, b[0]), e = sikRot(v2, b[0] + b[1]), end = [m[0] + e[0], m[1] + e[1]];
  return { a1: b[0], a2: b[1], end, err: Math.hypot(end[0] - target[0], end[1] - target[1]) };
}
