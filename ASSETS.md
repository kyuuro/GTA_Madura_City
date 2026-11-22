# STATUS ASET (update tiap iterasi)
Legenda: ✅ = file sudah ada di assets/ (sudah dimasukkan) · ⬜ = BELUM ada / belum dibuat · 🔧 = file ada tapi belum disambung ke kode game · 🔌 = SUDAH tersambung ke kode (dipakai game)

## Ringkasan
| Aset | Status | Lokasi / catatan |
|---|---|---|
| Mobil sedan (car.glb) | ✅ | assets/car.glb - rgsdev CC0 (iter 13b) |
| Angkot (angkot.glb) | ✅ | assets/angkot.glb - rgsdev CC0 (iter 13b) |
| 21 kendaraan lain (taxi, polisi, bus, truk, ...) | ✅ | assets/vehicles-pack/ - sudah dikonversi; 🔌 tersambung (iter 15): taxi, hatchback, pickup, suv (lalu lintas AI + 3 parkir di Spawn). Sisanya (bus, truk, polisi, dll) 🔧 |
| Kenney City Kit Roads (95 model) | ✅ (2 🔌) | assets/kenney/roads/ - tersambung: light-square (lampu jalan, roads.js), electricity-pole (tiang listrik, kampung.js). Sisanya 🔧 |
| Kenney City Kit Commercial (41 model) | ✅ (19 🔌) | assets/kenney/commercial/ - building-a..n + skyscraper-a..e tersambung (buildings.js, iter 16); sisanya 🔧 |
| Motor / skuter (motor.glb) | ✅🔌 | assets/motor.glb = Honda Scoopy dari user (iter 45), hasil `tools/prep_scoopy.py` (18k segitiga, 424 KB). Pembuat/lisensi model asli belum diketahui - isi di CREDITS.md. Fallback procedural (makeMotor) tetap ada kalau file hilang |
| Karakter pemain (player.glb) | ⬜ | Masih procedural. Opsi CC0: Quaternius / KayKit |
| Karakter manusia (Kenney Animated Characters Retro) | ✅🔌 | assets/char_retro.glb + SKIN ASLI assets/retro/humanMaleA.png, humanFemaleA.png (iter 33). Varian recolor lama assets/retro/m0_*,m1_*,f0_*.png masih ada tapi tidak dipakai. Skin zombie (zombieMaleA/FemaleA) belum dimasukkan |
| Skin tambahan NPC (Kenney Animated Characters Survivors 1.1, CC0) | ✅🔌 | assets/retro/survivorMaleB.png + survivorFemaleA.png (1024 px, UV sama dgn model Retro -> dipakai di char_retro.glb). NPC acak antara skin Retro & Survivors; pemain & Satpol tetap skin dasar. Lisensi: assets/retro/KENNEY_LICENSE_survivors.txt; kredit di CREDITS.md. Skin zombie sengaja tidak dipakai. |
| NPC tambahan: Muslim_Girl (hijab, Ready Player Me) & anak SMA cewe (Sketchfab) | ✅🔌 | assets/npc_hijab.glb (4,4 rb segitiga, 272 KB) + assets/npc_sma.glb (3,8 rb segitiga, 297 KB), dibuat `tools/prep_npc_chars.py` dari tools/src_models/. Tiap GLB: 1 mesh + 1 atlas + klip Idle/Run. Dipakai retro.js (EXTRA_DEFS, peluang 30% per pejalan NPC; pemain/Satpol/pengendara tidak). Tinggi dunia: hijab 2,0 m, SMA 1,9 m (setel di EXTRA_DEFS atau ?h_extra=). Matikan: ?npc_extra=0. LISENSI BELUM DIPASTIKAN - lihat CREDITS.md |
| Model polisi (npc_polisi.glb) | ✅🔌 | "Indonesian Police Dalmas" mixboni, **CC BY 4.0 (WAJIB kredit)**, https://skfb.ly/pDCwr. Sumber 19 MB / 555 rb segitiga -> assets/npc_polisi.glb 0,7 MB (9 rb segitiga, tekstur 1024, 18 tulang, klip Idle/Run) lewat `tools/prep_polisi.py`. Dipakai retro.js (`POLISI_DEF`, tinggi 2,3 m): semua karakter `hat:'satpol'` (Satpol pengejar jalan kaki, petugas turun dari motor, patroli, NPC satpol). Bukan pengendara (tanpa pose duduk). Perisai di sisi kiri (+X). Matikan: ?polisi=0. Kredit: CREDITS.md, splash.js, assets/npc_polisi_CREDIT.txt |
| Kenney City Kit Suburban (40 model: rumah kampung, pagar, pohon) | ✅ (21 🔌) | assets/kenney/suburban/ - building-type-a..u tersambung (buildings.js, iter 16); sisanya 🔧 |
| Kenney Car Kit (kendaraan tambahan) | ⬜ | Opsional; rgsdev pack sudah cukup |
| Kapal / crane / kontainer (Perak) | ⬜ | Masih procedural. poly.pizza "ship", "container", "crane" |
| Becak (becak.glb) | ✅🔧 | assets/props/becak.glb - hasil reduksi (10.7k vertex, 845 KB; asli 425k vertex/35 MB). Belum disambung; orientasi/skala/roda (node tidak bernama wheel) perlu dicek saat dipakai |
| Varian rumah kampung (Sketchfab, CC BY 4.0): rusty.glb "Old house with rusty roof" iGauravRajput, indo.glb "[old] Indonesian Simple House" sakit.jawa, abandoned.glb "Abadoned Building | Lowpoly" Frid.blend | ✅🔌 | assets/kenney/rumah/ (3 rb & 268 segitiga), dipakai buildings.js `KH_VAR` (iter 63). Diunduh dari Sketchfab; WAJIB kredit (CREDITS.md, splash.js) |
| Kenney Retro Urban Kit (115 model: tembok, atap seng, pintu, jendela, truk, pohon, lampu, kabel, jalan tanah) | ✅ (2 🔌: wall-a-door, roof-metal-type-a di warung kampung) | assets/kenney/retro-urban/ - ada, belum disambung. Colormap BERBEDA (Textures/*.png banyak file) - jangan dicampur folder |
| Pagoda / patung Kenjeran, perahu nelayan, warung | ⬜ | Masih procedural |
| Musik splash + game (assets/audio/bgm_*.mp3) | ✅🔌 | 4 lagu buatan Suno (default/perak/kenjeran/suramadu), dipetakan di src/music.js; lagu default juga dipakai splash.js. Kredit Suno di CREDITS.md + splash.js |
| Efek suara asli (klakson, mesin, siren) | ⬜ | Masih WebAudio sintetis (sfx.js) |
| Tekstur aspal/tembok (ambientcg), HDRI langit (polyhaven) | ⬜ | Belum diambil |
| Splash gambar (splash0-2.jpg) | ✅ | assets/splash*.jpg |

**Daftar sambungan (urut):** #1 light-square -> lampu jalan (roads.js, `upgradeLamps`). Berikutnya: lampu merah, tiang listrik, pohon, ruko, rumah kampung.

**Cara pakai model Kenney:** `GLTFLoader` memuat `assets/kenney/<kit>/<nama>.glb`; tekstur `Textures/colormap.png` dimuat otomatis (path relatif, JANGAN dipindah/rename). Colormap tiap kit BERBEDA (roads, commercial, suburban) - jangan dicampur folder. Ukuran 1 tile jalan = 1 unit Kenney (skala ke meter di kode). Model Kenney yang SUDAH disambung otomatis ter-inline ke test.html (tekstur ditanam) lewat daftar `KENNEY_USED` di tools/build_test.py - tambahkan path tiap sambungan baru. Yang belum disambung tidak ikut (jaga ukuran test.html). Loader: `loadKenney('roads/light-square')` di assets.js; gagal muat = game tetap pakai procedural.

## Kenney City Kit Roads (CC0) - semua ✅ ada di assets/kenney/roads/, 🔧 belum dipakai kode
| Kelompok | Rencana pakai | Model |
|---|---|---|
| Jalan lurus/tikungan/ujung | Pengganti jalan procedural (roads.js) | ✅ road-bend, ✅ road-bend-sidewalk, ✅ road-bend-square, ✅ road-crossing, ✅ road-crossroad, ✅ road-crossroad-line, ✅ road-crossroad-path, ✅ road-curve, ✅ road-curve-intersection, ✅ road-curve-pavement, ✅ road-end, ✅ road-end-round, ✅ road-intersection, ✅ road-intersection-line, ✅ road-intersection-path, ✅ road-roundabout, ✅ road-split, ✅ road-square, ✅ road-straight, ✅ road-straight-half |
| Jalan + barrier/pagar | Rel/pagar jalan & jembatan | ✅ construction-barrier, ✅ road-bend-barrier, ✅ road-bend-square-barrier, ✅ road-crossroad-barrier, ✅ road-curve-barrier, ✅ road-curve-intersection-barrier, ✅ road-driveway-double-barrier, ✅ road-driveway-single-barrier, ✅ road-end-barrier, ✅ road-end-round-barrier, ✅ road-intersection-barrier, ✅ road-roundabout-barrier, ✅ road-side-barrier, ✅ road-side-entry-barrier, ✅ road-side-exit-barrier, ✅ road-slant-barrier, ✅ road-slant-curve-barrier, ✅ road-slant-high-barrier, ✅ road-split-barrier, ✅ road-square-barrier, ✅ road-straight-barrier, ✅ road-straight-barrier-end, ✅ road-straight-barrier-half |
| Samping/driveway/slant (ramp) | Akses gang, ramp Suramadu | ✅ road-bridge, ✅ road-driveway-double, ✅ road-driveway-single, ✅ road-side, ✅ road-side-entry, ✅ road-side-exit, ✅ road-slant, ✅ road-slant-curve, ✅ road-slant-flat, ✅ road-slant-flat-curve, ✅ road-slant-flat-high, ✅ road-slant-high, ✅ tile-high, ✅ tile-low, ✅ tile-slant, ✅ tile-slantHigh |
| Lampu jalan | Lampu jalan (roads.js) | ✅ light-curved, ✅ light-curved-cross, ✅ light-curved-double, ✅🔌 light-square, ✅ light-square-cross, ✅ light-square-double |
| Lampu merah | Lampu lalu lintas (traffic.js) | ✅ traffic-light, ✅ traffic-light-hanging, ✅ traffic-light-object-hanging, ✅ traffic-light-object-horizontal, ✅ traffic-light-object-vertical |
| Rambu | Rambu & papan jalan tol Suramadu | ✅ road-sign-empty, ✅ road-sign-empty-hanging, ✅ road-sign-object-stop, ✅ road-sign-object-street, ✅ road-sign-object-warning, ✅ road-sign-stop, ✅ road-sign-street, ✅ road-sign-warning, ✅ sign-highway, ✅ sign-highway-detailed, ✅ sign-highway-wide |
| Tiang listrik & kabel | Kampung (kampung.js) | 🔌 electricity-pole, ✅ electricity-pole-single, ✅ electricity-pole-wide, ✅ electricity-side, ✅ electricity-side-single, ✅ electricity-side-wide, ✅ electricity-wires, ✅ electricity-wires-wide |
| Konstruksi & props | Props jalan | ✅ construction-cone, ✅ construction-fence, ✅ construction-light, ✅ dumpster |
| Pilar jembatan | Pilar Suramadu (suramadu.js) | ✅ bridge-pillar, ✅ bridge-pillar-wide |

## Kenney City Kit Commercial (CC0) - semua ✅ ada di assets/kenney/commercial/, 🔧 belum dipakai kode
| Kelompok | Rencana pakai | Model |
|---|---|---|
| Gedung komersial a-n | Ruko/gedung (buildings.js) | ✅ building-a, ✅ building-b, ✅ building-c, ✅ building-d, ✅ building-e, ✅ building-f, ✅ building-g, ✅ building-h, ✅ building-i, ✅ building-j, ✅ building-k, ✅ building-l, ✅ building-m, ✅ building-n |
| Gedung pencakar langit | Gedung tinggi pusat kota | ✅ building-skyscraper-a, ✅ building-skyscraper-b, ✅ building-skyscraper-c, ✅ building-skyscraper-d, ✅ building-skyscraper-e |
| Low detail (jarak jauh / LOD) | LOD kota jauh (kualitas Low) | ✅ low-detail-building-a, ✅ low-detail-building-b, ✅ low-detail-building-c, ✅ low-detail-building-d, ✅ low-detail-building-e, ✅ low-detail-building-f, ✅ low-detail-building-g, ✅ low-detail-building-h, ✅ low-detail-building-i, ✅ low-detail-building-j, ✅ low-detail-building-k, ✅ low-detail-building-l, ✅ low-detail-building-m, ✅ low-detail-building-n, ✅ low-detail-building-wide-a, ✅ low-detail-building-wide-b |
| Detail (kanopi, payung) | Kanopi ruko, payung warung | ✅ detail-awning, ✅ detail-awning-wide, ✅ detail-overhang, ✅ detail-overhang-wide, ✅ detail-parasol-a, ✅ detail-parasol-b |

## Kenney City Kit Suburban (CC0) - semua ✅ ada di assets/kenney/suburban/, 🔧 belum dipakai kode
| Kelompok | Rencana pakai | Model |
|---|---|---|
| Rumah (building-type a-u) | Rumah kampung/permukiman (kampung.js, buildings.js) | ✅ building-type-a, ✅ building-type-b, ✅ building-type-c, ✅ building-type-d, ✅ building-type-e, ✅ building-type-f, ✅ building-type-g, ✅ building-type-h, ✅ building-type-i, ✅ building-type-j, ✅ building-type-k, ✅ building-type-l, ✅ building-type-m, ✅ building-type-n, ✅ building-type-o, ✅ building-type-p, ✅ building-type-q, ✅ building-type-r, ✅ building-type-s, ✅ building-type-t, ✅ building-type-u |
| Pagar | Pagar rumah/gang | ✅ fence, ✅ fence-1x2, ✅ fence-1x3, ✅ fence-1x4, ✅ fence-2x2, ✅ fence-2x3, ✅ fence-3x2, ✅ fence-3x3, ✅ fence-low |
| Jalan masuk & jalan setapak | Driveway, jalan setapak gang | ✅ driveway-long, ✅ driveway-short, ✅ path-long, ✅ path-short, ✅ path-stones-long, ✅ path-stones-messy, ✅ path-stones-short |
| Pohon & tanaman | Pohon pinggir jalan (roads.js), pot | ✅ planter, ✅ tree-large, ✅ tree-small |


---
# PASANG MODEL KENDARAAN (adapter di src/assets.js)
Taruh file di folder **gta-suramadu/assets/** dengan nama persis:
| File | Isi | Panjang akhir (otomatis) |
|---|---|---|
| assets/car.glb | mobil (sedan/taksi/polisi) | 4.3 m |
| assets/motor.glb | skuter/motor | 1.9 m |
| assets/angkot.glb | minibus/van | 4.6 m |
| assets/player.glb | karakter (opsional) | tinggi 1.8 m |

Lalu: `python3 tools/build_test.py` -> test.html (semua .glb ikut ter-inline, bisa dibuka langsung dari HP). Atau jalankan `python -m http.server 8000` dan buka index.html.
Adapter otomatis: skala, sumbu panjang -> Z, alas di y=0, roda (node bernama *wheel*/*tire*/*tyre*/*roda*) diberi pivot supaya berputar; motor: stang/fork ikut berbelok.
Syarat model: roda HARUS objek terpisah bernama wheel/tire/roda (cek di Blender). Depan terbalik -> ubah `yaw: 180` di MODEL_CFG (assets.js), atau tes cepat: index.html?yaw_car=180
Kirim .glb ke chat kalau mau saya yang memasang + build ulang.

## Sudah terpasang (Iterasi 13b): rgsdev Free Low Poly Vehicles Pack (CC0)
- assets/car.glb = Sedan (badan dicat biru), assets/angkot.glb = Van (badan dicat biru angkot). Roda objek terpisah, depan = +Z, adapter otomatis.
- assets/vehicles-pack/*.glb = 21 model lain hasil konversi (taxi, hatchback, SUV, pickup, bus, polisi, dst). Tidak ikut ter-inline ke test.html; salin ke assets/ dan ganti nama kalau mau dipakai.
- Konversi FBX -> GLB tanpa Blender: `python3 tools/fbx2glb.py in.fbx out.glb [--recolor "nama material=rrggbb"] [--yaw 180]` (cek hasil: `python3 tools/glbinfo.py out.glb`).
- MOTOR: pack rgsdev tidak punya motor, jadi motor tetap model procedural buatan sendiri (gratis). Hanya pakai aset GRATIS (CC0): cari "scooter"/"motorcycle" di https://poly.pizza (filter CC0) atau Sketchfab (filter CC0), lalu taruh sebagai assets/motor.glb. Jangan pakai model berbayar (CGTrader/TurboSquid/Unity Asset Store berbayar).

---
# Daftar aset umum (gratis)
Taruh .glb di assets/. Loader: `loadModel(name, fallback)` -> assets/<name>.glb (motor, car, angkot, player). Catat tiap aset di CREDITS.md.

## Model 3D
| Kebutuhan | Sumber | Link | Lisensi |
|---|---|---|---|
| Mobil, van (-> angkot, recolor), taksi, polisi, truk | Kenney Car Kit (40+ model, glTF) | https://kenney.nl/assets/car-kit | CC0 |
| Jalan, marka, lampu jalan, rambu, lampu merah | Kenney City Kit (Roads) | https://kenney.nl/assets/city-kit-roads | CC0 |
| Ruko / gedung komersial, papan, kanopi | Kenney City Kit (Commercial) | https://kenney.nl/assets/city-kit-commercial | CC0 |
| Rumah kampung, pagar, pohon, driveway | Kenney City Kit (Suburban) | https://kenney.nl/assets/city-kit-suburban | CC0 |
| Semua kit Kenney lain (Retro Urban, Nature, dll) | Kenney | https://kenney.nl/assets | CC0 |
| Motor/skuter, becak, warung, kontainer, kapal, crane | Poly Pizza (cari "scooter", "motorcycle", "container", "ship") | https://poly.pizza | CC0/CC-BY (cek per model) |
| Idem + karakter, props | Sketchfab (filter Downloadable + CC) | https://sketchfab.com/features/free-3d-models | cek per model |
| Karakter animasi (walk/run/idle) low-poly | Quaternius | https://quaternius.com | CC0 |
| Karakter + animasi rig | KayKit (Kay Lousberg) | https://kaylousberg.itch.io | CC0 |
| Animasi karakter (perlu login Adobe gratis) | Mixamo | https://www.mixamo.com | gratis, dipakai di game boleh |

## Tekstur / langit
- Tekstur aspal, tembok, genteng, karat: https://ambientcg.com (CC0)
- HDRI langit/senja + tekstur + model: https://polyhaven.com (CC0)

## Audio
- Efek (klakson, mesin, tabrakan, siren): https://kenney.nl/assets/category:Audio (CC0) , https://pixabay.com/sound-effects/ , https://freesound.org (cek lisensi per file)
- Musik splash -> assets/audio/splash.mp3: https://pixabay.com/music/ , https://incompetech.com (Kevin MacLeod, CC-BY: wajib kredit) , https://opengameart.org (filter CC0)

## Font
- Anton (sudah dipakai splash): https://fonts.google.com/specimen/Anton (OFL)

## Catatan
- Pilih .glb / glTF. Model Kenney ada glTF-nya, tinggal rename ke motor/car/angkot.glb.
- Kenney Car Kit tidak punya motor: ambil dari Poly Pizza/Sketchfab.
- Lisensi CC-BY = wajib kredit di CREDITS.md. Hindari NC (non-commercial) kalau mau rilis.


## Kenney Retro Urban Kit 2.0 (CC0) - ✅ di assets/kenney/retro-urban/ (115 dari 124 model), 🔧 belum dipakai kode
Dipilih karena tampilan bangunan tua/kumuh cocok untuk kampung & gang Surabaya Utara. Dibuang (9): cliff-corner, cliff-side, grass, grass-corner, grass-corner-inner, grass-hill, tree-pine-large, tree-pine-small, tree-park-pine-large (tidak cocok tropis / tidak dipakai).
| Kelompok | Rencana pakai (nanti diputuskan) | Model |
|---|---|---|
| Tembok bangunan modular | Rumah/ruko kampung, gudang Perak | wall-a*, wall-b*, wall-c-flat*, wall-type-a/b, wall-broken-type-a/b, wall-fence, wall-steps-type-a/b |
| Atap | Atap seng kampung | roof-metal-poles, roof-metal-type-a/b, wall-a/b-roof*, roof-slant* |
| Pintu/jendela/balkon | Detail bangunan | door-type-a/b, window-small-type-a/b, window-wide-type-a..d, balcony-* |
| Kanopi/tenda | Warung, ruko | detail-awning-small, detail-awning-wide |
| Props jalan | Lampu, kabel, bangku, tong sampah, pallet | detail-light-single/double/traffic, detail-cables-type-a/b, detail-bench, detail-dumpster-open/closed, detail-barrier-*, detail-beam, detail-block, detail-bricks-*, pallet, pallet-small, planks, scaffolding-* |
| Kendaraan | Truk lalu lintas / Perak | truck-flat, truck-green, truck-green-cargo, truck-grey, truck-grey-cargo |
| Pohon | Pinggir jalan | tree-large, tree-small, tree-shrub, tree-park-large |
| Jalan | Gang tanah kampung, aspal rusak | road-dirt-*, road-asphalt-* |

## Senjata (iter 73)
Tongkat kayu, pentungan, sapu dibuat procedural di src/weapons.js (silinder/kotak THREE); tidak ada file aset/lisensi baru. Kalau nanti diganti model GLB (mis. Kenney/Sketchfab), tambahkan kredit di CREDITS.md.
