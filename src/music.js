// Iterasi 90: musik latar per area, 4 lagu buatan Suno (kredit di CREDITS.md & splash.js). Satu lagu per area.
// >>> PASANG LAGU PER MAP DI SINI: ganti path di MUSIC (taruh mp3 di assets/audio/). Path sama = tidak restart saat pindah area. <<<
// Nama area: 'default' = seluruh kota di luar area lain; 'perak' & 'kenjeran' = kotak ZONES di districts.js; 'suramadu' = jalur jembatan (x ~ 340, perkiraan, cek).
import { ZONES } from './districts.js';
export const MUSIC = {
  default:  'assets/audio/bgm_default.mp3',    // Ini Tanah Gusti (Suno) - juga lagu splash
  perak:    'assets/audio/bgm_perak.mp3',      // BESI TUA (Suno)
  kenjeran: 'assets/audio/bgm_kenjeran.mp3',   // Mo-MONEY (Suno)
  suramadu: 'assets/audio/bgm_suramadu.mp3',   // Carok After Dark (Suno)
};
const VOL = 0.45, FADE = 1.6;   // volume akhir & detik crossfade
export function zoneAt(x, z) {
  for (const k in ZONES) { const q = ZONES[k]; if (x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1) return k; }
  if (Math.abs(x - 340) < 30 && z > -1930) return 'suramadu';
  return 'default';
}
export function createMusic() {
  const api = { zone: null, muted: false, vol: 1 }, cache = new Map(); let cur = null, fading = [], tChk = 0;
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
  if (typeof window !== 'undefined') { ['pointerdown', 'pointerup', 'mousedown', 'click', 'keydown', 'touchstart', 'touchend'].forEach(e => window.addEventListener(e, unlock, { passive: true })); }   // iter 90: tombol M kini = peta penuh (settings.js); mute lewat menu setting
  api.toggle = () => { api.muted = !api.muted; if (cur) { if (api.muted) cur.a.pause(); else play(cur.a); } console.log('[music] ' + (api.muted ? 'OFF' : 'ON')); };
  api.setMuted = (b) => { if (b !== api.muted) api.toggle(); };
  api.setVolume = (f) => { api.vol = f; const V = VOL * f; fading.forEach(q => { if (q.dir < 0) q.a.volume = Math.min(q.a.volume, V); }); if (cur && !fading.some(q => q.a === cur.a)) cur.a.volume = V; };   // iter 90: slider volume musik (1 = bawaan)
  api.update = (dt, x, z) => {
    const VOLX = VOL * api.vol;
    if (typeof window !== 'undefined' && window.gtaSplash && !window.gtaSplash.isDone()) return;   // splash masih tampil: lagunya dipegang splash.js
    tChk -= dt; if (tChk <= 0) { tChk = 0.5; const zn = zoneAt(x, z); if (zn !== api.zone || !cur) { api.zone = zn; to(MUSIC[zn] || MUSIC.default); } }
    for (const f of fading) { const d = VOLX * dt / FADE; f.a.volume = (f.dir > 0 && f.a.volume > VOLX) ? Math.max(VOLX, f.a.volume - d) : Math.max(0, Math.min(VOLX, f.a.volume + f.dir * d)); }
    fading = fading.filter(f => { if (f.dir < 0 && f.a.volume <= 0.001) { f.a.pause(); return false; } return !(f.dir > 0 && Math.abs(f.a.volume - VOLX) < 0.002); });
  };
  return api;
}
