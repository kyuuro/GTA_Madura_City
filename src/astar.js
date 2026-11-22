// Iterasi 66: A* untuk petugas jalan kaki (satpol.js). Murni JS, tanpa three. Grid lokal 1.5 m di sekitar start+tujuan, 8 arah, `free(x,z,r)` dari satpol
// (tidak di air & tidak kena gedung). Hasil dihaluskan (string-pulling pakai garis pandang) -> daftar titik [{x,z}] (tanpa titik awal, titik akhir = tujuan).
// Dipakai hanya kalau garis lurus ke pemain terhalang; jalan buntu bentuk U / pagar panjang / labirin gedung tidak lagi menjebak.
const AS_CELL = 1.5, AS_PAD = 30, AS_MAXSPAN = 150, AS_MAXNODES = 6000;

export function astarLos(free, ax, az, bx, bz, r) {   // garis pandang bebas? (sampel tiap ~0.7 m)
  const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / 0.7));
  for (let i = 1; i <= n; i++) { const t = i / n; if (!free(ax + (bx - ax) * t, az + (bz - az) * t, r)) return false; }
  return true;
}

export function astarFindPath(free, sx, sz, tx, tz, r) {
  if (Math.hypot(tx - sx, tz - sz) > AS_MAXSPAN) return null;
  const x0 = Math.min(sx, tx) - AS_PAD, z0 = Math.min(sz, tz) - AS_PAD, W = Math.ceil((Math.abs(tx - sx) + 2 * AS_PAD) / AS_CELL), H = Math.ceil((Math.abs(tz - sz) + 2 * AS_PAD) / AS_CELL);
  const cx = (i) => x0 + (i % W + 0.5) * AS_CELL, cz = (i) => z0 + ((i / W | 0) + 0.5) * AS_CELL, N = W * H;
  const st = new Int8Array(N);   // 0 belum dicek, 1 bebas, 2 terhalang
  const ok = (i) => { if (st[i] === 0) st[i] = free(cx(i), cz(i), r) ? 1 : 2; return st[i] === 1; };
  const cellOf = (x, z) => Math.min(H - 1, Math.max(0, ((z - z0) / AS_CELL) | 0)) * W + Math.min(W - 1, Math.max(0, ((x - x0) / AS_CELL) | 0));
  const nearestFree = (c) => { if (ok(c)) return c; const ix = c % W, iz = c / W | 0;
    for (let k = 1; k <= 4; k++) { let best = -1, bd = 1e9;
      for (let a = -k; a <= k; a++) for (let b = -k; b <= k; b++) { if (Math.max(Math.abs(a), Math.abs(b)) !== k) continue; const x = ix + a, z = iz + b; if (x < 0 || z < 0 || x >= W || z >= H) continue;
        const i = z * W + x; if (ok(i) && a * a + b * b < bd) { bd = a * a + b * b; best = i; } }
      if (best >= 0) return best; }
    return -1; };
  const s = nearestFree(cellOf(sx, sz)), g = nearestFree(cellOf(tx, tz)); if (s < 0 || g < 0) return null;
  const gs = new Float32Array(N).fill(1e9), par = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const gx = cx(g), gz = cz(g), hf = (i) => { const dx = Math.abs(cx(i) - gx), dz = Math.abs(cz(i) - gz); return (dx + dz + (1.4142 - 2) * Math.min(dx, dz)); };
  // heap biner (f, indeks)
  const hp = [], hpush = (f, i) => { hp.push([f, i]); let k = hp.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (hp[p][0] <= hp[k][0]) break; [hp[p], hp[k]] = [hp[k], hp[p]]; k = p; } };
  const hpop = () => { const top = hp[0], last = hp.pop(); if (hp.length) { hp[0] = last; let k = 0; for (;;) { let l = 2 * k + 1, rr = l + 1, m = k; if (l < hp.length && hp[l][0] < hp[m][0]) m = l; if (rr < hp.length && hp[rr][0] < hp[m][0]) m = rr; if (m === k) break; [hp[m], hp[k]] = [hp[k], hp[m]]; k = m; } } return top; };
  gs[s] = 0; hpush(hf(s), s); let exp = 0, found = false;
  while (hp.length && exp < AS_MAXNODES) {
    const [, c] = hpop(); if (closed[c]) continue; closed[c] = 1; exp++;
    if (c === g) { found = true; break; }
    const ix = c % W, iz = c / W | 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      if (!a && !b) continue; const x = ix + a, z = iz + b; if (x < 0 || z < 0 || x >= W || z >= H) continue;
      const n = z * W + x; if (closed[n] || !ok(n)) continue;
      if (a && b && (!ok(iz * W + x) || !ok(z * W + ix))) continue;   // jangan memotong sudut gedung
      const ng = gs[c] + (a && b ? 1.4142 : 1); if (ng < gs[n]) { gs[n] = ng; par[n] = c; hpush(ng + hf(n), n); }
    }
  }
  if (!found) return null;
  const raw = []; for (let c = g; c >= 0; c = par[c]) raw.push({ x: cx(c), z: cz(c) }); raw.reverse(); raw[0] = { x: sx, z: sz }; raw[raw.length - 1] = { x: tx, z: tz };
  // string-pulling: dari jangkar, loncat ke titik terjauh yang masih terlihat langsung
  const out = []; let a = 0;
  while (a < raw.length - 1) { let b = raw.length - 1; while (b > a + 1 && !astarLos(free, raw[a].x, raw[a].z, raw[b].x, raw[b].z, r)) b--; out.push(raw[b]); a = b; }
  return out;
}
