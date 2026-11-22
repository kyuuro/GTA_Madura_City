// Iterasi 10: efek suara sintetis (WebAudio, tanpa file): klakson, siren Satpol, tabrakan, pejalan tertabrak, BUSTED.
// AudioContext baru dibuat saat suara pertama diminta (setelah ketukan/tombol pertama = aturan autoplay). Mute: tombol M / tombol Sound di layar.
// Semua aman kalau audio tidak tersedia (try/catch), jadi aman di node/tes.
export function createSFX() {
  let ac = null, master = null, noise = null, sirenOsc = null, sirenGain = null, lastCrash = 0;
  const api = { muted: false };
  const ctx = () => {
    if (ac === false) return null;
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = api.muted ? 0 : 0.9; master.connect(ac.destination);
        noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = false; return null; }
    }
    if (ac.state === 'suspended' && ac.resume) ac.resume();
    return ac;
  };
  const env = (g, t, peak, dur) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); };
  function burst(freq, peak, dur, tone) {                              // noise lewat lowpass + dentuman sinus rendah
    const a = ctx(); if (!a) return; const t = a.currentTime;
    const src = a.createBufferSource(); src.buffer = noise; const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = freq;
    const g = a.createGain(); env(g, t, peak, dur); src.connect(lp); lp.connect(g); g.connect(master); src.start(t); src.stop(t + dur + 0.05);
    const o = a.createOscillator(), og = a.createGain(); o.frequency.setValueAtTime(tone, t); o.frequency.exponentialRampToValueAtTime(tone * 0.4, t + dur); env(og, t, peak * 0.9, dur); o.connect(og); og.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  api.horn = () => {
    try {
      const a = ctx(); if (!a) return; const t = a.currentTime, g = a.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.03); g.gain.setValueAtTime(0.14, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42); g.connect(master);
      for (const f of [392, 494]) { const o = a.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + 0.45); }
    } catch (e) { /* audio tidak tersedia */ }
  };
  api.crash = (s = 1) => { try { const n = performance.now(); if (n - lastCrash < 300) return; lastCrash = n; burst(700, 0.5 * s + 0.1, 0.4, 90); } catch (e) { /* */ } };
  api.thud = () => { try { burst(320, 0.45, 0.18, 120); } catch (e) { /* */ } };
  // iter 72b: suara berkelahi. punch(power): bunyi "buk" (1 pukulan, 1.6 tendangan, 2.2 finisher); whoosh(): ayunan meleset; oof(pitch): erangan pendek (sawtooth turun + noise tipis)
  api.punch = (power = 1) => { try { burst(260 + power * 90, 0.35 + power * 0.12, 0.1 + power * 0.04, 150 - power * 15); if (power >= 1.5) burst(140, 0.5, 0.3, 70); } catch (e) { /* */ } };
  api.whoosh = () => {
    try {
      const a = ctx(); if (!a) return; const t = a.currentTime, src = a.createBufferSource(); src.buffer = noise;
      const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(1800, t + 0.14);
      const g = a.createGain(); env(g, t, 0.12, 0.16); src.connect(bp); bp.connect(g); g.connect(master); src.start(t); src.stop(t + 0.2);
    } catch (e) { /* */ }
  };
  api.oof = (pitch = 1) => {
    try {
      const a = ctx(); if (!a) return; const t = a.currentTime, o = a.createOscillator(), g = a.createGain(), lp = a.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(230 * pitch, t); o.frequency.exponentialRampToValueAtTime(110 * pitch, t + 0.22); lp.type = 'lowpass'; lp.frequency.value = 900;
      env(g, t, 0.16, 0.26); o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3);
    } catch (e) { /* */ }
  };
  api.sting = () => {                                                  // BUSTED: dua nada turun
    try {
      const a = ctx(); if (!a) return;
      [[440, 0], [330, 0.28], [220, 0.56]].forEach(([f, d]) => { const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + d; o.type = 'sawtooth'; o.frequency.value = f; env(g, t, 0.12, 0.3); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.35); });
    } catch (e) { /* */ }
  };
  api.siren = (level) => {                                             // level 0..1 (jarak motor pengejar); dipanggil tiap frame
    try {
      if (!sirenOsc) {
        if (level <= 0.01) return; const a = ctx(); if (!a) return;
        sirenOsc = a.createOscillator(); sirenOsc.type = 'sawtooth'; sirenOsc.frequency.value = 800; sirenGain = a.createGain(); sirenGain.gain.value = 0;
        const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 0.7; lg.gain.value = 320; lfo.connect(lg); lg.connect(sirenOsc.frequency);
        const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; sirenOsc.connect(lp); lp.connect(sirenGain); sirenGain.connect(master); sirenOsc.start(); lfo.start();
      }
      sirenGain.gain.setTargetAtTime(level * 0.05, ac.currentTime, 0.15);
    } catch (e) { /* */ }
  };
  api.toggle = () => { api.muted = !api.muted; if (master) master.gain.value = api.muted ? 0 : 0.9; return api.muted; };
  return api;
}
