// Iterasi 13: bengkel (perbaikan kendaraan gratis, parodi). Cincin hijau di jalan + papan "BENGKEL". Berhenti pelan (<5 m/s) di cincin 2.5 dtk = HP 100.
// createBengkel(scene,{roads, ground, veh, toast}) -> {shops:[{x,z}], update(dt, focus)}
import * as THREE from 'three';
const BK_SITES = [[3, 0.85], [1, 0.25], [0, 0.85], [4, 0.72], ['Jl. Raya Kenjeran', 0.5]];   // [indeks jalan di roads.lines, fraksi panjang]
export function createBengkel(scene, ctx) {
  const { roads, ground, veh, toast } = ctx, shops = [], api = { shops };
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 80;
  const g = cv.getContext('2d'); g.fillStyle = '#1faa59'; g.fillRect(0, 0, 256, 80); g.fillStyle = '#fff'; g.font = 'bold 44px Impact,sans-serif'; g.textAlign = 'center'; g.fillText('BENGKEL', 128, 56);
  const tex = new THREE.CanvasTexture(cv);
  for (const [li, f] of BK_SITES) {
    const L = roads.lines[typeof li === 'string' ? roads.lines.findIndex(l => l.name === li) : li]; if (!L) continue;
    const n = L.pts.length, i = Math.max(1, Math.min(n - 2, Math.floor(n * f))), p = L.pts[i], q = L.pts[i + 1];
    let tx = q.x - p.x, tz = q.z - p.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const x = p.x + tz * L.hw * 0.5, z = p.z - tx * L.hw * 0.5, y = ground(x, z);            // lajur kiri
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.6, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2cff7a, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
    ring.position.set(x, y + 0.2, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 6), new THREE.MeshStandardMaterial({ color: 0x555555 })); pole.position.set(x - tz * 4.2, y + 2.5, z + tx * 4.2);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.25), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); sign.position.set(x - tz * 4.2, y + 5.3, z + tx * 4.2); sign.rotation.y = Math.atan2(tx, tz) + Math.PI / 2;
    scene.add(ring, pole, sign); shops.push({ x, z });
  }
  let rep = 0;
  api.update = (dt) => {
    const v = veh.driving; let near = false;
    if (v) { const o = v.obj.position; near = shops.some(s => Math.hypot(s.x - o.x, s.z - o.z) < 3.8) && Math.abs(v.sp) < 5; }
    if (near && (v.hp ?? 100) < 100) {
      rep += dt; if (rep >= 2.5) { v.hp = 100; v.burn = 0; v.warned = false; rep = 0; toast('Repaired! Free, this is not a real city.'); }
      else toast('Repairing... ' + Math.round(rep / 2.5 * 100) + '%');
    } else rep = 0;
  };
  return api;
}
