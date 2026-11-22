// Tabrakan lingkaran (pemain) vs kotak sejajar sumbu (gedung), pakai grid hash. Murni JS, tanpa three.
export function createCollider(cell = 24) {
  let xs = [], zs = [], hws = [], hds = [], grid = new Map();
  const key = (ix, iz) => ix * 73856093 ^ iz * 19349663;
  return {
    clear() { xs = []; zs = []; hws = []; hds = []; grid = new Map(); },
    add(x, z, hw, hd) {
      const i = xs.length; xs.push(x); zs.push(z); hws.push(hw); hds.push(hd);
      for (let a = Math.floor((x - hw) / cell); a <= Math.floor((x + hw) / cell); a++)
        for (let b = Math.floor((z - hd) / cell); b <= Math.floor((z + hd) / cell); b++) {
          const k = key(a, b); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(i);
        }
    },
    hit(x, z, r) { // query murni (tidak mengubah apa pun): apakah lingkaran (x,z,r) menyentuh gedung?
      const ix = Math.floor(x / cell), iz = Math.floor(z / cell);
      for (let a = ix - 1; a <= ix + 1; a++) for (let b = iz - 1; b <= iz + 1; b++) {
        const l = grid.get(key(a, b)); if (!l) continue;
        for (const i of l) { const dx = x - Math.max(xs[i] - hws[i], Math.min(x, xs[i] + hws[i])), dz = z - Math.max(zs[i] - hds[i], Math.min(z, zs[i] + hds[i])); if (dx * dx + dz * dz < r * r) return true; }
      }
      return false;
    },
    resolve(p, r) { // p: {x,z}, dimodifikasi di tempat. Return true kalau menabrak.
      let hit = false;
      const ix = Math.floor(p.x / cell), iz = Math.floor(p.z / cell);
      for (let a = ix - 1; a <= ix + 1; a++) for (let b = iz - 1; b <= iz + 1; b++) {
        const l = grid.get(key(a, b)); if (!l) continue;
        for (const i of l) {
          const cx = Math.max(xs[i] - hws[i], Math.min(p.x, xs[i] + hws[i])), cz = Math.max(zs[i] - hds[i], Math.min(p.z, zs[i] + hds[i]));
          let dx = p.x - cx, dz = p.z - cz; const d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue; hit = true;
          if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
          else { const ox = hws[i] - Math.abs(p.x - xs[i]), oz = hds[i] - Math.abs(p.z - zs[i]);
            if (ox < oz) p.x += (p.x >= xs[i] ? 1 : -1) * (ox + r); else p.z += (p.z >= zs[i] ? 1 : -1) * (oz + r); }
        }
      }
      return hit;
    },
  };
}
