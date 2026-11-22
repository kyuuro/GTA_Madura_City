// Iterasi 88: penjadwal "bangun saat didekati" (PLAN_DARMO.md 11.1). Murni JS (tanpa three) supaya bisa dites.
// Region: {id, x, z, r, build()}. Region dibangun SEKALI saat pemain berada < r dari (x,z); terdekat dulu; jatah waktu per frame
// (minimal 1 region per tick yang punya antrean, supaya tidak pernah macet). Setelah dibangun tidak dibuang (ganti kualitas = buat penjadwal baru).
export function createLazy(now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  const regions = []; let builtN = 0, lastMs = 0;
  const due = (px, pz) => regions.filter(r => !r.built && Math.hypot(r.x - px, r.z - pz) < r.r).sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz));
  const run = (r) => { const t = now(); try { r.build(); } catch (e) { console.log('[lazy] GAGAL membangun ' + r.id + ': ' + e.message); } r.built = true; builtN++; lastMs = now() - t; };
  return {
    add(r) { regions.push({ built: false, ...r }); },
    // dipanggil tiap frame; budgetMs = batas total per frame (region pertama selalu dibangun). Return jumlah region yang dibangun.
    tick(px, pz, budgetMs = 5) { const t0 = now(); let n = 0; for (const r of due(px, pz)) { if (n > 0 && now() - t0 >= budgetMs) break; run(r); n++; } return n; },
    // sinkron: bangun SEMUA region yang jatuh tempo di (px,pz) sekarang juga (dipakai teleport supaya tidak muncul dari kosong)
    flush(px, pz) { let n = 0; for (const r of due(px, pz)) { run(r); n++; } return n; },
    stats() { return { total: regions.length, built: builtN, pending: regions.length - builtN, lastMs }; },
    each(fn) { regions.forEach(fn); },
  };
}
