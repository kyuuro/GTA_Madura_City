// Iterasi 11: tabrakan antar kendaraan (lingkaran 2D, massa ~ r^2). Dorong keluar + tukar sedikit kecepatan + callback dampak.
// createVehicleCollisions({veh, collider, blocked, onImpact(a,b,impact)}) -> {update(dt, focus)}. Tanpa three.
export function createVehicleCollisions(ctx) {
  const { veh, collider, blocked, onImpact } = ctx;
  const api = { hits: 0 };
  api.update = (dt, focus) => {
    const L = veh.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i]; if (!a.obj.visible) continue;
      const pa = a.obj.position;
      if (focus && Math.hypot(pa.x - focus.x, pa.z - focus.z) > 160) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j]; if (!b.obj.visible) continue;
        const pb = b.obj.position;
        let dx = pb.x - pa.x, dz = pb.z - pa.z; const d = Math.hypot(dx, dz), min = a.T.r + b.T.r;
        if (d >= min) continue;
        if (d < 1e-4) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
        const wa = a.T.r * a.T.r, wb = b.T.r * b.T.r, ov = min - Math.max(d, 1e-4), sw = wa + wb;
        // closing speed sepanjang normal (a -> b)
        const fa = [Math.sin(a.h), Math.cos(a.h)], fb = [Math.sin(b.h), Math.cos(b.h)];
        const closing = (a.sp * fa[0] - b.sp * fb[0]) * dx + (a.sp * fa[1] - b.sp * fb[1]) * dz;
        const pax = pa.x, paz = pa.z, pbx = pb.x, pbz = pb.z;
        pa.x -= dx * ov * wb / sw; pa.z -= dz * ov * wb / sw;
        pb.x += dx * ov * wa / sw; pb.z += dz * ov * wa / sw;
        collider.resolve(pa, a.T.r); collider.resolve(pb, b.T.r);
        if (blocked(pa.x, pa.z)) { pa.x = pax; pa.z = paz; }
        if (blocked(pb.x, pb.z)) { pb.x = pbx; pb.z = pbz; }
        if (closing > 0.5) {
          const j2 = 1.3 * closing / (1 / wa + 1 / wb); // e = 0.3
          a.sp -= (j2 / wa) * (dx * fa[0] + dz * fa[1]) * 0.6;
          b.sp += (j2 / wb) * (dx * fb[0] + dz * fb[1]) * 0.6;
          a.sp *= 0.9; b.sp *= 0.9;
          if (closing > 3) { api.hits++; if (onImpact) onImpact(a, b, closing); }
        }
      }
    }
  };
  return api;
}
