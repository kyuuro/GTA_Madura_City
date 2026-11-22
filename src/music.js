// Iterasi 27: musik latar per area. SEMUA area sekarang memakai lagu yang sama (sementara).
// >>> PASANG LAGU PER MAP DI SINI: ganti path di MUSIC (taruh mp3 di assets/audio/). Path sama = tidak restart saat pindah area. <<<
// Nama area: 'default' = seluruh kota di luar area lain; 'perak' & 'kenjeran' = kotak ZONES di districts.js; 'suramadu' = jalur jembatan (x ~ 340, perkiraan, cek).
import { ZONES } from './districts.js';
export const MUSIC = {
  default:  'assets/audio/bgm.mp3',
  perak:    'assets/audio/bgm.mp3',
  kenjeran: 'assets/audio/bgm.mp3',
  suramadu: 'assets/audio/bgm.mp3',
};
const VOL = 0.45, FADE = 1.6;   // volume akhir & detik crossfade
export function zoneAt(x, z) {
  for (const k in ZONES) { const q = ZONES[k]; if (x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1) return k; }
  if (Math.abs(x - 340) < 30 && z > -1930) return 'suramadu';
  return 'default';
}
export function createMusic() {
  const api = { zone: null, muted: false }, cache = new Map(); let cur = null, fading = [], tChk = 0;
  const src = (p) => (typeof window !== 'undefined' && window.__AUD && window.__AUD[p]) || p;
  function get(p) {
    const H = typeof window !== 'undefined' && window.__splashAudio;   // lagu splash yang sama -> pakai elemennya (lanjut tanpa putus)
    if (!cache.has(p) && H && H.el && H.src === p) { H.adopted = true; if (H.muted) api.muted = true; cache.set(p, H.el); console.log('[music] lagu splash dilanjutkan'); }
    if (!cache.has(p)) { const a = new Audio(src(p)); a.loop = true; a.preload = 'auto'; a.volume = 0; a.addEventListener('error', () => console.log('[music] gagal muat ' + p)); cache.set(p, a); }
    return cache.get(p);
  }
  function play(a) { const pr = a.play(); if (pr && pr.catch) pr.catch(() => {}); }
  function to(p) {
    if (cur && cur.p === p) return;
    if (cur) fading.push({ a: cur.a, dir: -1 });
    const a = get(p); cur = { p, a }; fading = fading.filter(f => f.a !== a); fading.push({ a, dir: 1 }); if (!api.muted) play(a);
    console.log('[music] ' + (api.zone || '-') + ' -> ' + p);
  }
  const unlock = () => { if (cur && !api.muted && cur.a.paused) play(cur.a); };   // autoplay diblokir? coba lagi di gesture berikutnya
  if (typeof window !== 'undefined') { ['pointerdown', 'pointerup', 'mousedown', 'click', 'keydown', 'touchstart', 'touchend'].forEach(e => window.addEventListener(e, unlock, { passive: true })); window.addEventListener('keydown', (e) => { if (e.key === 'm' || e.key === 'M') api.toggle(); }); }
  api.toggle = () => { api.muted = !api.muted; if (cur) { if (api.muted) cur.a.pause(); else play(cur.a); } console.log('[music] ' + (api.muted ? 'OFF' : 'ON')); };
  api.update = (dt, x, z) => {
    if (typeof window !== 'undefined' && window.gtaSplash && !window.gtaSplash.isDone()) return;   // splash masih tampil: lagunya dipegang splash.js
    tChk -= dt; if (tChk <= 0) { tChk = 0.5; const zn = zoneAt(x, z); if (zn !== api.zone || !cur) { api.zone = zn; to(MUSIC[zn] || MUSIC.default); } }
    for (const f of fading) { const d = VOL * dt / FADE; f.a.volume = (f.dir > 0 && f.a.volume > VOL) ? Math.max(VOL, f.a.volume - d) : Math.max(0, Math.min(VOL, f.a.volume + f.dir * d)); }
    fading = fading.filter(f => { if (f.dir < 0 && f.a.volume <= 0.001) { f.a.pause(); return false; } return !(f.dir > 0 && Math.abs(f.a.volume - VOL) < 0.002); });
  };
  return api;
}
