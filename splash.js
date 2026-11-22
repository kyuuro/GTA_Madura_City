/* SPLASH LOADING ala GTA. Skrip KLASIK (bukan module) supaya muncul langsung, sebelum three.js (CDN) selesai diunduh.
   Gambar baru: taruh di assets/ lalu tambahkan path-nya ke SPLASH.images. Musik: SPLASH.music (sekarang assets/audio/bgm.mp3, sama dgn musik game; diserahkan ke src/music.js saat splash selesai). */
(function () {
  var SPLASH = {
    images: ['assets/splash0.jpg', 'assets/splash1.jpg', 'assets/splash2.jpg', 'assets/splash3.jpg', 'assets/splash4.jpg'],   // <- tambah gambar lain di sini
    intro: { image: 'assets/intro.jpg', fadeInMs: 800, holdMs: 2200, fadeOutMs: 1100 },   // iter 44: gambar pembuka (VI) sebelum layar loading; tap/tombol = lewati. image: null = tanpa intro
    music: 'assets/audio/bgm.mp3',                         // lagu sementara (sama dengan musik game, lihat src/music.js)
    musicVolume: 0.7,
    musicFadeMs: 2500,
    slideMs: 5200,      // ganti gambar tiap sekian ms
    minMs: 4500,        // splash minimal tampil sekian ms walau game sudah siap
    warnMs: 15000,      // lewat ini dianggap macet
    sub: 'SURAMADU CITY',
    credit: 'Police model: &ldquo;Indonesian Police Dalmas&rdquo; by mixboni (skfb.ly/pDCwr) &middot; CC BY 4.0 (creativecommons.org/licenses/by/4.0) &middot; modified: simplified, rigged &amp; retextured. Road texture: &ldquo;Low road&rdquo; by Yarelon &middot; Sidewalk texture: &ldquo;Sidewalks&rdquo; by Caboose3d &middot; Grass: &ldquo;Simple grass chunks&rdquo; by 3dhdscan. Houses: &ldquo;Old house with rusty roof 3d model free&rdquo; by iGauravRajput &amp; &ldquo;[old] Indonesian Simple House&rdquo; by sakit.jawa &amp; &ldquo;Abadoned Building | Lowpoly&rdquo; by Frid.blend (all downloaded from Sketchfab, CC BY 4.0, modified). Trees: &ldquo;Tree Animate&rdquo; by RandyGF (Sketchfab, CC BY 4.0, modified: 3 variants simplified &amp; retextured). Minimarket: &ldquo;minimarket - indomaret&rdquo; by Pojan (Sketchfab, CC BY 4.0, modified: simplified, vertex-coloured; unaffiliated with Indomaret). Full credits: CREDITS.md',   // iter 56: atribusi CC BY (wajib)
    tips: [
      'Red lights are just suggestions.',
      'Helmets are accessories, not requirements.',
      'Suramadu Bridge: free to cross on a motorbike, mandatory to daydream about.',
      'Narrow alley? That is the village toll road.',
      'No map needed. Just ask at the nearest warung.',
      'Lost? Follow the smell of satay.',
      'Satpol PP are people too. Sometimes.',
      'Press F next to a vehicle to hop in. Parking rules are optional.'
    ]
  };

  var css = [
    '#gtaSplash{position:fixed;inset:0;z-index:200;background:linear-gradient(180deg,#2a1450,#c2457a 60%,#ff9a3c);overflow:hidden;color:#fff;font-family:Anton,Impact,"Arial Narrow",sans-serif;user-select:none;-webkit-user-select:none;touch-action:none;transition:opacity .9s ease}',
    '#gtaSplash.out{opacity:0;pointer-events:none}',
    '#gtaSplash .bg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transition:opacity 1.3s ease;transform-origin:50% 50%}',
    '#gtaSplash .bg.on{opacity:1;animation:gtaKB 9s ease-out forwards}',
    '#gtaSplash .bg.alt.on{animation-name:gtaKB2}',
    '@keyframes gtaKB{from{transform:scale(1.02) translate(0,0)}to{transform:scale(1.12) translate(-1.5%,-1%)}}',
    '@keyframes gtaKB2{from{transform:scale(1.12) translate(1.5%,1%)}to{transform:scale(1.02) translate(0,0)}}',
    '#gtaSplash .vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 45%,transparent 45%,#000a 100%),linear-gradient(0deg,#000e 0,#0008 22%,transparent 45%),linear-gradient(180deg,#0009 0,transparent 18%)}',
    '#gtaSplash .grain{position:absolute;inset:0;pointer-events:none;opacity:.10;mix-blend-mode:overlay;background:repeating-linear-gradient(0deg,#000 0,#000 1px,transparent 1px,transparent 3px)}',
    '#gtaSplash .bar{position:absolute;left:0;right:0;height:7vh;background:#000;z-index:2}',
    '#gtaSplash .bar.t{top:0}#gtaSplash .bar.b{bottom:0}',
    '#gtaSplash .top{position:absolute;z-index:3;left:4vw;top:calc(7vh + 14px);font-size:clamp(11px,1.6vw,16px);letter-spacing:.35em;color:#ffd7a0;text-shadow:0 2px 0 #000}',
    '#gtaSplash .top b{color:#ff4fa3;font-weight:normal}',
    '#gtaSplash .mute{position:absolute;z-index:6;right:4vw;top:calc(7vh + 10px);background:#000a;color:#ffe9a8;border:1px solid #ffe9a866;border-radius:6px;padding:6px 10px;font:12px monospace;cursor:pointer}',
    '#gtaSplash .mute.hint{color:#ffe36b;border-color:#ffe36b;animation:gtaBlink 1.1s steps(2,jump-none) infinite}',
    '#gtaSplash .ttl{position:absolute;z-index:3;left:4vw;bottom:calc(7vh + 62px);transform:skew(-6deg);line-height:.9}',
    '#gtaSplash .ttl .g{display:block;font-size:clamp(80px,19vw,190px);letter-spacing:4px;background:linear-gradient(180deg,#ffe36b 10%,#ff8a2a 55%,#ff3d8b 100%);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-stroke:3px #000;paint-order:stroke fill;filter:drop-shadow(5px 6px 0 #000)}',
    '#gtaSplash .ttl .s{display:block;margin-top:6px;font-size:clamp(14px,3vw,30px);letter-spacing:.3em;color:#fff;text-shadow:3px 3px 0 #000}',
    '#gtaSplash .tip{position:absolute;z-index:3;right:4vw;bottom:calc(7vh + 62px);max-width:min(44vw,420px);text-align:right;font:500 clamp(11px,1.7vw,15px)/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff;text-shadow:0 2px 3px #000}',
    '#gtaSplash .tip b{display:block;font:normal clamp(10px,1.3vw,12px) Anton,Impact,sans-serif;letter-spacing:.3em;color:#ff4fa3;margin-bottom:3px}',
    '#gtaSplash .ld{position:absolute;z-index:3;left:4vw;right:4vw;bottom:calc(7vh + 20px);display:flex;align-items:center;gap:12px;font-size:clamp(11px,1.5vw,14px);letter-spacing:.2em;text-shadow:0 2px 0 #000}',
    '#gtaSplash .trk{flex:1;height:8px;background:#0008;border:1px solid #fff5;transform:skew(-20deg)}',
    '#gtaSplash .fill{height:100%;width:0;background:linear-gradient(90deg,#ff3d8b,#ff9a3c,#ffe36b);box-shadow:0 0 10px #ff3d8b}',
    '#gtaSplash .pct{min-width:3.2em;text-align:right;font-variant-numeric:tabular-nums}',
    '#gtaSplash .go{position:absolute;z-index:4;left:0;right:0;bottom:calc(7vh + 48px);text-align:center;font-size:clamp(14px,2.6vw,24px);letter-spacing:.3em;color:#ffe36b;text-shadow:0 2px 0 #000,0 0 14px #ff3d8b;display:none;animation:gtaBlink 1.1s steps(2,jump-none) infinite;pointer-events:none}',
    '@keyframes gtaBlink{50%{opacity:.25}}',
    '#gtaSplash.rdy .go{display:block}#gtaSplash.rdy .ld{opacity:.55}',
    '@media (max-width:700px),(max-aspect-ratio:1/1){#gtaSplash .tip{left:4vw;right:4vw;max-width:none;text-align:left;bottom:auto;top:calc(7vh + 46px)}#gtaSplash .ttl{bottom:calc(7vh + 92px)}#gtaSplash .go{bottom:calc(7vh + 46px);font-size:12px;letter-spacing:.18em}}',
    '#gtaSplash .cred{position:absolute;z-index:3;left:4vw;right:4vw;bottom:calc(3.5vh - 7px);text-align:center;font:clamp(9px,1.2vw,11px)/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#bbb;letter-spacing:.02em;pointer-events:none}',
    '#gtaSplash .warn{position:absolute;z-index:5;left:0;right:0;top:50%;text-align:center;font:13px monospace;color:#ff9b9b;text-shadow:0 1px 2px #000;display:none;padding:0 12vw}'
  ].join('\n');

  var ff = document.createElement('style'); ff.textContent = '@font-face{font-family:Anton;src:url(vendor/anton.woff2) format("woff2");font-display:swap}'; document.head.appendChild(ff); // font Anton lokal (vendor/, SIL OFL) -> tanpa internet
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var root = document.createElement('div'); root.id = 'gtaSplash';
  var bgs = SPLASH.images.map(function (src, i) {
    var d = document.createElement('div'); d.className = 'bg' + (i % 2 ? ' alt' : ''); d.style.backgroundImage = 'url("' + src + '")'; root.appendChild(d); return d;
  });
  root.insertAdjacentHTML('beforeend',
    '<div class="vig"></div><div class="grain"></div><div class="bar t"></div><div class="bar b"></div>' +
    '<div class="top"><b>///</b> LOADING <b>///</b></div>' +
    '<button class="mute" type="button">&#9835; MUSIC: ON</button>' +
    '<div class="ttl"><span class="g">GTA</span><span class="s">' + SPLASH.sub + '</span></div>' +
    '<div class="tip"><b>TIPS</b><span></span></div>' +
    '<div class="go">TAP / PRESS ANY KEY TO START</div>' +
    '<div class="ld"><span>LOADING</span><div class="trk"><div class="fill"></div></div><span class="pct">0%</span></div>' +
    '<div class="cred">' + SPLASH.credit + '</div>' +
    '<div class="warn"></div>');
  (document.body || document.documentElement).appendChild(root);

  var q = function (s) { return root.querySelector(s); };
  var fill = q('.fill'), pct = q('.pct'), tipEl = q('.tip span'), warn = q('.warn'), muteBtn = q('.mute');
  var t0 = performance.now(), cur = -1, tipI = Math.floor(Math.random() * SPLASH.tips.length);
  var done = false, ready = false, p = 0;

  // ---- slideshow gambar + tips ----
  function showSlide(i) {
    if (!bgs.length) return;
    cur = i % bgs.length;
    bgs.forEach(function (b, k) { b.classList.remove('on'); if (k === cur) { void b.offsetWidth; b.classList.add('on'); } });
  }
  function nextTip() { tipEl.textContent = SPLASH.tips[tipI++ % SPLASH.tips.length]; }
  showSlide(0); nextTip();
  var slideTimer = setInterval(function () { showSlide(cur + 1); }, SPLASH.slideMs);
  var tipTimer = setInterval(nextTip, 3800);

  // ---- INTRO (iter 44): gambar pembuka tampil dulu (fade in -> tahan -> fade out), baru layar loading terlihat. Loading tetap jalan di belakangnya ----
  var introOn = false, introEl = null, introT = [];
  function endIntro() {
    if (!introOn) return; introOn = false; introT.forEach(clearTimeout);
    introEl.style.transition = 'opacity ' + SPLASH.intro.fadeOutMs + 'ms ease'; introEl.style.opacity = '0'; introEl.style.pointerEvents = 'none';
    showSlide(0);   // ulang animasi gambar pertama supaya terlihat segar saat intro hilang
    setTimeout(function () { if (introEl) { introEl.remove(); introEl = null; } }, SPLASH.intro.fadeOutMs + 100);
  }
  if (SPLASH.intro && SPLASH.intro.image) {
    introOn = true; introEl = document.createElement('div'); introEl.id = 'gtaIntro';
    introEl.style.cssText = 'position:fixed;inset:0;z-index:210;background:#fff;opacity:0;transition:opacity ' + SPLASH.intro.fadeInMs + 'ms ease;overflow:hidden;cursor:pointer';
        introEl.style.background = 'radial-gradient(ellipse 70% 45% at 0% 100%,#e4b4fb 0,transparent 100%),radial-gradient(ellipse 70% 55% at 100% 75%,#a3d3fc 0,transparent 100%),#fff';   // latar polos selaras warna gambar (sisi kosong di HP portrait)
    introEl.innerHTML = '<img alt="" src="' + SPLASH.intro.image + '" style="position:absolute;inset:0;margin:auto;max-width:100%;max-height:100%;-webkit-mask-image:linear-gradient(to right,transparent,#000 7%,#000 93%,transparent),linear-gradient(to bottom,transparent,#000 7%,#000 93%,transparent);-webkit-mask-composite:source-in;mask-image:linear-gradient(to right,transparent,#000 7%,#000 93%,transparent),linear-gradient(to bottom,transparent,#000 7%,#000 93%,transparent);mask-composite:intersect">';   // gambar utuh (tidak terpotong di HP), tepinya memudar ke latar gradien
    (document.body || document.documentElement).appendChild(introEl);
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (introEl) introEl.style.opacity = '1'; }); });
    introT.push(setTimeout(endIntro, SPLASH.intro.fadeInMs + SPLASH.intro.holdMs));
    introEl.addEventListener('pointerdown', endIntro);
    console.log('[splash] intro tampil ' + (SPLASH.intro.fadeInMs + SPLASH.intro.holdMs) + ' ms lalu fade ke loading');
  }

  // ---- musik: coba autoplay; kalau diblokir browser, mulai di gesture PERTAMA apa pun (bukan cuma saat tombol START) ----
  var audio = null, muted = false, audioOK = true;
  var UNLOCK = ['pointerup', 'touchend', 'mouseup', 'click', 'keydown'];   // event yang dihitung browser sebagai gesture (di HP: touchend/pointerup, BUKAN pointerdown/touchstart)
  function label() {
    var on = !!(audio && !audio.paused);
    muteBtn.textContent = !audioOK ? '\u266B MUSIC: (no mp3 yet)' : muted ? '\u266B MUSIC: OFF' : on ? '\u266B MUSIC: ON' : '\u266B TAP FOR MUSIC';
    muteBtn.classList.toggle('hint', audioOK && !muted && !on);
  }
  try {
    audio = new Audio((window.__AUD && window.__AUD[SPLASH.music]) || SPLASH.music); audio.loop = true; audio.volume = SPLASH.musicVolume; audio.preload = 'auto';
    audio.addEventListener('error', function () { audioOK = false; label(); console.log('[splash] musik tidak ditemukan: ' + SPLASH.music + ' (placeholder, abaikan)'); });
    audio.addEventListener('playing', label); audio.addEventListener('pause', label);
  } catch (e) { audio = null; }
  function unlockOff() { UNLOCK.forEach(function (n) { removeEventListener(n, unlock, true); }); }
  function tryPlay() {
    if (!audio || !audioOK || muted || !audio.paused) return;
    var pr = audio.play();
    if (pr && pr.then) pr.then(function () { unlockOff(); label(); console.log('[splash] musik mulai'); }, function () { label(); });
  }
  function unlock(e) { if (e && e.target && e.target.closest && e.target.closest('.mute')) return; tryPlay(); }
  UNLOCK.forEach(function (n) { addEventListener(n, unlock, true); });   // didaftarkan SEBELUM onKey supaya keydown tetap sampai ke sini
  muteBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  muteBtn.addEventListener('click', function (e) {
    e.stopPropagation(); muted = !muted;
    if (audio) { if (muted) audio.pause(); else tryPlay(); }
    label();
  });
  label(); tryPlay();

  // ---- progres: palsu sampai game benar-benar jalan (window.__gameStarted) ----
  function frame(now) {
    if (done) return;
    var el = now - t0;
    if (window.__gameStarted && el >= SPLASH.minMs) ready = true;
    var target = ready ? 100 : Math.min(92, el / 160); // naik pelan, tahan di 92% sampai game siap
    p += (target - p) * (ready ? 0.12 : 0.04);
    if (ready && p > 99.4) p = 100;
    fill.style.width = p + '%'; pct.textContent = Math.floor(p) + '%';
    if (ready && p >= 100 && !root.classList.contains('rdy')) root.classList.add('rdy');
    if (!ready && el > SPLASH.warnMs && !window.__gameStarted) {
      root.style.zIndex = 50; // turunkan supaya tombol Console (z 99) bisa dipencet
      warn.style.display = 'block';
      warn.textContent = 'Game has not started. Check your internet (three.js CDN) or open the Console button at the top right.';
    } else if (warn.style.display === 'block' && window.__gameStarted) { warn.style.display = 'none'; root.style.zIndex = 200; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- mulai ----
  function finish() {
    if (done) return; done = true;
    clearInterval(slideTimer); clearInterval(tipTimer);
    root.classList.add('out');
    removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKey, true);
    // lagu DISERAHKAN ke src/music.js (elemen audio yang sama, lanjut tanpa putus/menumpuk). Kalau tidak diambil dalam 4 dtk -> fade-out lalu berhenti
    var H = window.__splashAudio = { el: audio, src: SPLASH.music, muted: muted, adopted: false };
    setTimeout(function () {
      if (H.adopted || !audio || audio.paused) return;
      var v0 = audio.volume, s0 = performance.now();
      (function fade(n) { var k = Math.min(1, (n - s0) / SPLASH.musicFadeMs); audio.volume = v0 * (1 - k); if (k < 1) requestAnimationFrame(fade); else audio.pause(); })(s0);
    }, 4000);
    setTimeout(function () { root.remove(); st.remove(); }, 1000);
  }
  function onPress() { tryPlay(); if (introOn) { endIntro(); return; } if (ready && p >= 99) finish(); }   // iter 44: saat intro, tap/tombol hanya melewati intro
  function onKey(e) { // selama splash tampil, tombol tidak diteruskan ke game (WASD dll)
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.type === 'keydown') onPress();
  }
  root.addEventListener('pointerdown', onPress);
  addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true);

  // dipakai game kalau perlu: window.gtaSplash.finish()
  window.gtaSplash = { finish: finish, config: SPLASH, isDone: function () { return done; } };   // music.js menunggu isDone() sebelum mulai
})();
