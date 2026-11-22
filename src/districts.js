// Zona distrik khusus (bangunan acak tidak dibuat di sini).
export const ZONES = { perak: { x0: -1960, x1: -1420, z0: -650, z1: -430 }, kenjeran: { x0: 840, x1: 1020, z0: 1330, z1: 1520 } };
export function inZone(x, z, pad = 0) {
  for (const k in ZONES) { const q = ZONES[k]; if (x > q.x0 - pad && x < q.x1 + pad && z > q.z0 - pad && z < q.z1 + pad) return true; }
  return false;
}
export function shoreZ(h, x) { for (let z = 0; z > -900; z -= 2) if (h(x, z) < 0.1) return z; return -120; } // z garis pantai di x
export function seededRand(a) { return () => { a = (a * 1664525 + 1013904223) | 0; return (a >>> 0) / 4294967296; }; }
