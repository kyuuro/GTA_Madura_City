# Harness render headless (iterasi 83-84)
Merender kode game ASLI (src/*.js, vendor/three.bundle.js, assets/*.glb) di Chromium + Playwright (swiftshader), lalu menyimpan PNG. Dipakai untuk memeriksa pose/model/roda tanpa perangkat.
  NODE_PATH=$(npm root -g) PAGE=<halaman>.html node tools/render_harness/shot.js <akar_proyek> <out.png> "<query>"
Halaman (query):
- kick.html  `view=side|front|game&n=6&who=player|kenney|satpol` : fase tendangan 0..0,9 (KT 0,45 dtk)
- moto.html  `mode=player|ai|pillion|cop` : pemain/pengendara/boncengan di Scoopy, Beat, Mio (samping/depan/3-4)
- glb.html   `m=npc_xxx&clip=Run&t=0.2&head=1|feet=1&wire=1` : model .glb apa adanya (depan/samping/belakang/3-4)
- spin.html  `m=truck` : roda diputar 5 sudut (cek pivot roda 'cyclone')
- wheels.html: audit pivot roda semua kendaraan (DUMP=1 -> JSON)
- ayah_game.html: karakter NPC lewat retro.js + animasi
shot.js menyajikan folder proyek lewat http lokal (halaman harness diambil dari folder ini). Ukuran viewport diubah di shot.js (sesuaikan lebar dgn jumlah panel).
Catatan: di moto.html mode non-pemain, model pemain tetap berdiri di titik 0 (artefak harness).
