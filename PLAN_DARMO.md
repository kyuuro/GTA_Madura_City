# PLAN: Perluasan map ke DARMO (Surabaya Selatan)
Status: PERENCANAAN (belum ada kode game yang diubah). Basis: gta-suramadu iter 85. Dibuat dari analisis `data/darmo_osm_raw.geojson` (export Overpass 2026-11-22) + pembacaan STATE.md, world.js, roaddata.js, roads.js, buildings.js (planCity), traffic.js, main.js, build_test.py.
Angka di bawah dihitung dengan `tools/analyze_darmo.py` (jalankan ulang: `python3 -I tools/analyze_darmo.py data/darmo_osm_raw.geojson`).

---------------------------------------------------------------------
## 1. Temuan data (export Overpass)
- 1.612 fitur: 1.143 jalan (LineString) + 469 poligon (bangunan/taman). Bbox asli lon 112.719..112.761, lat -7.317..-7.276 (~4,6 x 4,5 km asli).
- Jalan (panjang dalam unit game, 1 unit = 3 m asli): residential 744 way / 31.538 (94,6 km asli), tertiary 106 / 6.194, primary 112 / 5.931, trunk 101 / 5.596, secondary 74 / 3.666, unclassified 6 / 500. 6.250 titik, 373 nama unik, ~595 simpul persimpangan (endpoint bersama).
- Jalan utama nyaris SEMUA `oneway=yes` (primary 108/112, trunk 92/101, secondary 53/74): OSM menggambar jalan dua jalur sebagai DUA way terpisah. Game hanya punya ribbon dua-arah -> perlu langkah "gabung dua jalur" (lihat 3.2). 65 way `bridge=yes layer=1` (Jl. Layang Wonokromo, jembatan kali, dll). `lanes`: 1 (315), 2 (269), 3 (44), 4 (34). Permukaan: aspal 470, paving_stones 221 (cocok dengan paving.js iter 75), beton 13.
- Poligon: HANYA ~469 bangunan (kebanyakan POI: sekolah 74+, rumah sakit 42, masjid 39, bank 37, kantor pemerintah 23, TK 19, klinik 14, gereja 14, kampus 14, kantor kelurahan 14 ...) + 20 taman. TOTAL luas bangunan cuma ~360.000 m2 = rumah hunian BIASA TIDAK ADA di data. `building:levels` ada di ~310 poligon (1-3 lantai dominan; maks 12). Jadi: bangunan POI = diambil dari data (posisi/footprint/nama/lantai nyata), rumah warga = tetap prosedural seperti planCity sekarang.
- TIDAK ada geometri sungai & rel di export (hanya tag turunan: 5 rumah pompa, 2 pintu air). Kali Surabaya/Kali Wonokromo, rel Stasiun Wonokromo, dan landuse harus di-query terpisah (query Overpass ada di bagian 9).
- Landmark kunci (koordinat GAME x,z): Darmo Trade Center (-1189, 3239, 9 lantai); Royal Plaza (-1321, 3488); Taman Bungkul (-1116, 2841, 15.556 m2); Stasiun Wonokromo (-1147, 3226); Terminal Intermoda Joyoboyo (-1245, 3118); Polsek Wonokromo (-1216, 3109); Marvell City Mall (-888, 2759); Transmart Ngagel (-977, 2836); RS Surabaya Medical Center (-1063, 2751); Giant Extra (-1544, 2373); Pasar Wonokitri (-1640, 2958); Pasar Dinoyo Tangsi (-998, 2656).
- Jalan terpanjang/utama: Jl. Raya Diponegoro (trunk 1.573), Jl. Raya Darmo (primary 1.339), Jl. Jagir Wonokromo (1.115), Jl. Ngagel (trunk 1.052), Jl. Gunung Sari (897), Jl. Dr. Soetomo (738), Jl. Wonokromo (686), Jl. A. Yani (535), Jl. Darmo Kali, Jl. Bendul Merisi, Jl. R.A. Kartini, Jl. Kutai, Jl. Mayjend Sungkono.

## 2. Posisi di dunia game & masalah geometrinya
Rumus (sama dengan geo13.js + offset kaki jembatan): `x = (lon-112.7795)*111320*cos(7.25deg)/3 + 340`, `z = -(lat+7.2115)*110574/3 - 105`. Sudah dipakai `analyze_darmo.py` (fungsi `g`). Cek silang: POI "Stasiun Wonokromo" di geo13 (-1519,3366) + (340,-105) = (-1179,3261) vs hasil data (-1147,3226): meleset ~45 unit (135 m), wajar untuk geo13 kasar.

Kotak Darmo di koordinat game: **x -1883..-343, z 2275..3782** (1.540 x 1.507 unit; kira-kira SAMA luas dengan seluruh kota Surabaya yang sudah ada, x -1300..1000 x z -40..890).

Masalah:
1. Terrain utama hanya sampai z 1800 (world.js: PlaneGeometry 2400x4900, x -1000..1400, z -3100..1800); patch barat (terrainW) x -2402..-1000, z -897..496. Darmo di LUAR keduanya -> perlu patch terrain baru "selatan" ~ x -2000..-200, z 1800..3950.
2. Pantai timur `eastShore(z)` berakhir di z 1850 dan mengekstrapolasi setelahnya; di z 2275..3782 pantai asli (Gunung Anyar/Rungkut) ada di x >> 1000 jadi Darmo (x<-343) aman jauh daratan, tapi pastikan `terrainHeight` tidak memotong (tes node: tinggi >0,25 di seluruh kotak Darmo).
3. Batas jalan kaki & dunia: x -2380..1380, z -3080..1780 (main.js) -> z diperluas ke ~3950. Air (water mesh) tidak perlu (Darmo daratan), tapi `kapal lewat`, kabut, `DRAW` jarak gambar tetap.
4. CELAH kosong antara kota yang sudah dibangun (z<=890; jalan gang sampai 880; Kenjeran Park z1407; Tugu Pahlawan geo (-1194,1161) belum ada) dan Darmo (z>=2275): ~1.400 unit (4,2 km asli) tanpa isi. Ini keputusan desain utama (bagian 4).
5. Koordinat dasar rendah akurasi: `geo13` meleset sampai +-800 unit di sisi barat; data OSM Darmo akurat. Jangan memaksa Darmo "menyambung" ke tata letak fiksi lama; Darmo = referensi nyata, kota lama = fiksi.

## 3. Arsitektur data-driven (rekomendasi)
Prinsip: JANGAN menulis ratusan koordinat jalan di roaddata.js. Buat pipeline offline Python -> modul data kecil, supaya mudah diulang kalau Overpass di-update.

### 3.1 Alat baru `tools/osm_to_game.py` (sumber: data/darmo_osm_raw.geojson + export tambahan)
Keluaran: `src/darmo_data.js` (export const DARMO_ROADS, DARMO_POIS, DARMO_PARKS, DARMO_WATER, DARMO_RAIL; ukuran target <= 250 KB, ES module biasa supaya ikut bundel test.html).
Langkah:
1. Konversi lon/lat -> (x,z) game (rumus bagian 2), bulatkan 1 desimal.
2. Gabung way se-nama dan se-kelas yang endpoint-nya bersambung (join) -> 1.143 way menjadi ~650 polyline (hasil nyata iter 86).
3. Gabung dua jalur `oneway` berlawanan (sejajar, jarak sumbu 6-40 unit) menjadi SATU ribbon dua-arah: garis tengah = rata-rata, lebar = jarak + lebar jalur (ribbon tidak punya median; opsi fase lanjut). Jalan satu arah murni dibiarkan, ditandai `oneway:true` -> AI lalu lintas hanya satu arah (lihat 5, traffic).
4. Sederhanakan (Douglas-Peucker toleransi ~2,5 unit), rapikan sudut tajam, snap endpoint <3 unit jadi satu simpul (supaya `trFindJunctions` mendeteksi persimpangan).
5. Lebar game (unit): trunk 18, primary 16, secondary 13, tertiary 10, residential 7, unclassified 6; bridge=yes diratakan (lihat 8 Risiko) tetapi diberi flag `bridge:true`.
6. Hapus gang buntu <12 unit, potong jalan di luar bbox + 40 unit margin.
7. Poligon -> {name, kind, x, z, w, d, rot (sumbu utama footprint), floors, h} (kotak berputar paling pas; poligon besar >60% bukan kotak seperti DTC/Royal Plaza disimpan sebagai poligon sederhana <=12 titik untuk landmark).
8. Taman -> {name, poly, kind}. Taman Bungkul 15.556 m2.
9. Tes otomatis di skrip: tidak ada titik jalan di luar bbox, jumlah simpul, laporan jalan putus.

### 3.2 Aturan yang sudah ada dan HARUS dihormati (dari STATE.md)
- Indeks perpotongan lampu lalu lintas = indeks array ROADS -> jalan Darmo DITAMBAH DI AKHIR (setelah Jl. Pelabuhan Perak, indeks 25) dan semua `zone`-based logic memakai properti `zone:'darmo'`.
- width < 10 = tanpa lampu jalan/pohon/marka; hw < 6 (width < 12) = tanpa lalu lintas AI & lampu merah (aturan madura iter 53). Berlaku sama: hanya trunk/primary/secondary Darmo yang punya lalu lintas AI.
- Jangan tambah importmap/CDN/link eksternal (aturan offline iter 82). Modul baru -> tambah ke MODULES di tools/build_test.py setelah 'madura'.
- "Permintaan pasang/tambah = MENAMBAH, jangan menimpa aset yang ada" (iter 32).

## 4. Keputusan desain besar (butuh jawaban user; default = rekomendasi)
| # | Pertanyaan | Opsi | Rekomendasi |
|---|---|---|---|
| A | Celah z 890..2275 (4,2 km asli) | (1) biarkan kosong, Darmo hanya lewat teleport; (2) koridor jalan raya + kota "murah" (low-detail) sampai Darmo; (3) isi penuh Surabaya (Tugu Pahlawan, Gubeng, dst) | **(1) dulu, lalu (2)**: fase awal teleport `>> Darmo`, koridor Jl. Raya Darmo/Ngagel menyusul di fase 5; (3) terlalu besar |
| B | Skala | tetap 1:3 | tetap 1:3 (konsisten, jalan lebar tampil 10-18 unit) |
| C | Dua jalur oneway | digabung jadi 1 ribbon dua-arah (cepat) / dua ribbon + median (setia peta) | digabung dulu; median bisa fase polesan |
| D | Jalan layang & jembatan (65 way bridge) | diratakan di tanah / benar-benar naik (seperti dek Suramadu) | diratakan dulu; Jl. Layang Wonokromo = satu pekerjaan khusus di fase 6 |
| E | Waktu bangun | dibangun saat start / lazy saat pemain mendekat | **lazy** (dibangun ketika pemain pertama kali < 1.200 unit dari pusat Darmo atau teleport) -> start game tidak melambat; Low (HP) mungkin perlu zona lebih kecil |
| F | Isi bangunan | hanya POI OSM + rumah prosedural | POI OSM nyata (nama, lantai) + planCity prosedural untuk sisanya, rumah/ruko/Indomaret seperti kota lama |

## 5. Perubahan kode per file (ringkas)
- **world.js**: `terrainS` patch baru x -2000..-200, z 1700..3950, sel SAMA dengan grid terrain utama (9 unit) supaya tanpa retak (pelajaran iter 55 terrainW); `terrainHeight` mendukung wilayah z>1800 (sekarang `h` ada di main: aman karena eastShore hanya untuk z<=... cek). Warna tanah kota (bukan tembakau Madura). Kali (sungai) = alur turun tipis (-0,8) + air plane kecil `waterD` untuk Kali Surabaya/Wonokromo (fase 6, butuh data waterway).
- **roaddata.js**: `import { DARMO_ROADS } from './darmo_data.js'; ROADS.push(...DARMO_ROADS)` di AKHIR.
- **roads.js**: sudah menangani `r.zone` (madura); tambahkan 'darmo' ke ketentuan trotoar (SW_W) seperti kota. Cek biaya: ~300 polyline x panjang 63.000 unit total -> sampling 4 unit = ~16.000 sampel x 2 sisi; masih OK tetapi `lines`/`grid` spasial dipakai NPC/satpol -> uji `roads.clearance()` pada skala ini. Tambahan: flag `oneway` diteruskan ke `roads.lines`.
- **buildings.js**: `planCity` kini grid tetap x -1300..1000, z -40..890 -> ubah jadi daftar REGION `[{x0,x1,z0,z1,faktor_tinggi,kerapatan}]` + region 'darmo' dengan pusat kepadatan di DTC/Royal Plaza (f = exp(-...) ala kota lama), lantai tinggi sepanjang Jl. Raya Darmo/Ngagel. Bangunan POI OSM disisipkan DULU (collider.add), lalu prosedural mengisi sisanya (cek `clearance` dan `exclude`). Chunk 160 m (iter 48) sudah cocok -> nol perubahan di render.
- **districts.js**: `ZONES.darmo = {x0:-1883,x1:-343,z0:2275,z1:3782}` HANYA kalau bangunan acak lama harus berhenti; sebaliknya biarkan planCity region menanganinya. Landmark pakai `inZone` untuk menolak prosedural di footprint POI.
- **darmo.js (modul baru, mirip kenjeran.js/madura.js)**: landmark & dekorasi: Taman Bungkul (rumput + pohon + jalur paving + patung/plaza), DTC (kotak 9 lantai berpapan), Royal Plaza, Stasiun Wonokromo (+ peron + rel), Terminal Joyoboyo (bus parkir), masjid-masjid berkubah (masjid 39 poligon -> pakai ulang `madura.js` kubah+menara), gereja (14), sekolah/rumah sakit (papan nama kecil). Tidak butuh aset baru: Kenney commercial/skyscraper + prosedural; nama jalan sebagai papan kecil di persimpangan utama (fase poles).
- **traffic.js**: `trFindJunctions(lines)` (sudah dibaca) = loop 4 tingkat tanpa indeks spasial: tiap pasangan jalan hw>=6 x semua segmen (sampel ~4 unit). Jalan utama Darmo ~21.000 unit = ~5.300 segmen -> ~14 juta uji pasangan segmen + `out.some` per temuan, jalan di main thread saat start. Mitigasi: lewati pasangan yang bbox-nya tidak tumpang tindih / grid spasial, dan batasi ke trunk/primary/secondary (target <=25 persimpangan berlampu di Darmo, bukan semua simpul).
- **npcs.js / satpol.js**: lalu lintas AI memilih jalan hw>=6 sudah dihitung dari `roads.lines` -> hanya otomatis bekerja; tambahkan `oneway` (AI jalan satu arah) dan batas respawn cincin agar tidak muncul di wilayah belum dibangun (lazy). Patroli Satpol: `satpol.js` 1 patroli per persimpangan -> otomatis, uji beban.
- **bengkel.js**: tambah 1-2 titik `BK_SITES` di Darmo (Jl. Raya Darmo, Jl. Ngagel). **vehicles.js**: 3-4 kendaraan parkir dekat teleport Darmo (taxi, angkot, motor).
- **main.js**: teleport `>> Darmo` ke (-1150, 2900) (dekat Taman Bungkul), batas jalan kaki z dinaikkan ke ~3950 & x -2380..1380 (sudah), `exclude` untuk planCity.
- **tools/build_test.py**: MODULES + 'darmo_data', 'darmo' (setelah 'madura'); ukuran test.html dijaga (< 5 MB).
- **hud.js / minimap (jika ada)**: nama distrik "Darmo" di HUD (opsional).

## 6. Fase / iterasi (REVISI setelah keputusan user, lihat bagian 11)
Setiap fase meninggalkan game dalam keadaan JALAN dan tercatat di STATE.md.
- **Iter 86 - Data jalan + terrain + teleport**. `tools/osm_to_game.py` + `src/darmo_data.js`; ROADS.push; terrain baru (2 patch, bagian 11.3); teleport `>> Darmo`. Tes node (semua titik jalan di darat, tak ada jalan putus), render harness (tanpa retak).
- **Iter 87 - KORIDOR (jalan)**. Jalan penghubung kota lama -> Darmo + kerangka jalan samping (bagian 11.2). Teleport `>> Koridor`. Tes: jalan kontinu dari (-420,880) ke ujung utara Jl. Raya Darmo OSM (-1073,2344), AI bisa menempuhnya.
- **Iter 88 - KORIDOR (isi)**. Bangunan low-detail per chunk (lazy), pohon, tiang listrik; kabut jarak jauh.
- **Iter 89 - Darmo: bangunan POI + prosedural** (lazy, bagian 11.1). Tes: 0 bangunan di jalan/taman, waktu planCity, FPS harness.
- **Iter 90 - KBS bagian 1**: data layout dari gambar, terrain/sungai buatan, jalan dalam, pagar (bagian 12).
- **Iter 91 - KBS bagian 2**: bangunan atap cokelat, bangunan tengah berhalaman, paviliun besar, kandang abu-abu (oval/oktagon), taman. Dirender dekat.
- **Iter 92 - Landmark Darmo**: Taman Bungkul, DTC, Royal Plaza, Stasiun Wonokromo, Terminal Joyoboyo, masjid/gereja.
- **Iter 93 - Lalu lintas & gameplay**: lampu merah (hanya persimpangan utama), AI oneway, patroli Satpol, bengkel, parkir.
- **Iter 94+ - Poles**: median, jalan layang Wonokromo (opsional), nama jalan, minimap.

## 7. Anggaran performa (perkiraan, perlu dibuktikan di harness)
- Terrain: +1.800x2.250 / 9 unit = ~200x250 sel = ~100 rb segitiga (utama saat ini ~287 rb + barat) -> total 650 rb; masih wajar utk PC, berat utk HP kualitas Low -> pertimbangkan sel 12 unit di patch selatan (-45%).
- Bangunan: Darmo luas ~sama dengan kota lama; kota lama: Low 30 m, High 20 m, Ultra 14 m. Darmo yang dibangun sekaligus MENGGANDAKAN jumlah instance -> lazy-build (opsi E) dan jarak gambar `DRAW` tetap (chunk 160 m dibuang di luar jarak).
- Jalan: ~63.000 unit panjang total, bahu+trotoar+paving: gandakan vertex jalan ~2x kota lama. Hindari lampu/pohon pada jalan residential (sudah aturan width<10).
- Lalu lintas/NPC: tetap bergantung "hidup di sekitar pemain" (cincin 70-260 m) jadi tidak bertambah per wilayah.

## 8. Risiko & mitigasi
1. **OSM dua jalur -> satu ribbon**: jarak antar jalur bervariasi (median taman di Jl. Raya Darmo ~20-40 m asli); ribbon gabungan bisa terlalu lebar atau salah gabung. Mitigasi: gabung hanya bila rata-rata jarak < 30 unit dan sudut < 20 derajat; sisanya biarkan dua ribbon satu-arah (AI satu arah).
2. **Jalan layang/jembatan diratakan** -> persimpangan palsu di bawah layang (jalan di atas & di bawah bersilang di y sama). Mitigasi: way `bridge=yes` TIDAK dihitung persimpangan (`trFindJunctions` abaikan `bridge`).
3. **Persimpangan berlebihan** (595 simpul): lampu merah tiap simpul = kacau. Mitigasi: lampu hanya persimpangan trunk/primary x trunk/primary/secondary.
4. **Terrain patch retak** di batas (iter 55 pernah): sel grid harus sama dengan terrain utama; kalau memakai sel berbeda (12) beri skirt.
5. **Posisi POI vs rumah prosedural**: POI OSM mencakup hanya yang tercatat; area tanpa data tampak kosong. Mitigasi: kepadatan prosedural tinggi di antara jalan, kosongkan di polygon taman/kolam.
6. **Hak/ lisensi data**: ODbL (OSM) -> tambahkan ke CREDITS.md + layar kredit: "Data peta (c) kontributor OpenStreetMap, ODbL"; turunan data (darmo_data.js) wajib dicantumkan.
7. **Jatah sesi**: tiap fase kecil & mandiri; kerja harus berhenti di titik aman (game tetap jalan) - lihat catatan di STATE.md.

## 9. Data tambahan yang disarankan (Overpass Turbo, bbox 112.719,-7.317,112.761,-7.276 = S,W,N,E: `-7.317,112.719,-7.276,112.761`)
```
[out:json][timeout:60];
(
  way["waterway"~"river|canal|stream|drain"](-7.317,112.719,-7.276,112.761);
  way["railway"~"rail|light_rail"](-7.317,112.719,-7.276,112.761);
  way["landuse"~"residential|commercial|retail|cemetery|industrial"](-7.317,112.719,-7.276,112.761);
  way["building"~"house|residential|apartments|retail"](-7.317,112.719,-7.276,112.761);
  way["natural"="water"](-7.317,112.719,-7.276,112.761);
  node["highway"="traffic_signals"](-7.317,112.719,-7.276,112.761);
);
out geom;
```
Prioritas: waterway SUDAH TIDAK DIPERLUKAN (sungai dibuat sendiri, bagian 11.4); railway (iter 92), traffic_signals (iter 93, lokasi lampu NYATA daripada tebakan), landuse (kerapatan region). Ekspor sebagai GeoJSON seperti yang sekarang (`data/darmo_*.geojson`).

## 10. Pertanyaan (SUDAH DIJAWAB user, lihat bagian 11)

## 11. KEPUTUSAN USER (2026-11-22) dan dampaknya
1. **Bangun koridor** (bukan teleport saja). 2. **Darmo lazy ("mendekat")**. 3. **KBS dibangun ulang dari gambar user**, dengan peta dan sungai buatan sendiri.

### 11.1 Lazy-build (mendekat)
- `lazy.js` (modul baru): daftar region {id, pusat, radius_pemicu, build(), dispose()}. Pemicu: pemain < radius (Darmo 1.300 unit dari (-1100,3000); KBS 450 dari (-1230,2930); koridor per chunk 160 m). Dibangun bertahap lintas frame (maks ~8 ms/frame) supaya tidak patah. Setelah dibangun tidak dibuang (kecuali ganti kualitas = dispose + bangun lagi, pola iter 48).
- Jalan Darmo/koridor TETAP dibuat sekali saat start (data kecil) supaya `roads.lines` stabil bagi NPC/lalu lintas; hanya bangunan/dekor yang lazy. Teleport memicu build sebelum pemain dipindah (tampil layar loading singkat).
- Efek: start game tidak melambat; HP (Low) hanya membayar Darmo saat sampai di sana.

### 11.2 Koridor (jalan Surabaya Selatan -> Darmo)
- Panjang celah: dari kota lama (z~890) ke ujung utara Jl. Raya Darmo OSM (-1073, 2344): ~1.450 unit lurus (~4,4 km asli). Ujung utara Jl. Diponegoro OSM ada di (-1533, 2328).
- Jalan koridor (dibuat sendiri, ditambah di AKHIR ROADS, `zone:'koridor'`): (a) "Jl. Raya Darmo Lanjutan" (width 16): (-420,880) -> (-520,1250) -> (-800,1600) -> (-1000,1950) -> (-1073,2344) (sambung persis ke titik OSM); (b) "Jl. Diponegoro Lanjutan" (14): dari (-1300,890) -> (-1400,1500) -> (-1533,2328); (c) 2-3 jalan melintang (width 10) memotong a dan b setiap ~450 unit supaya ada persimpangan/lampu; (d) beberapa gang (width 7) untuk kampung. Titik persis disetel dengan tes node `onLand` + jarak ke jalan lama.
- Isi: region planCity 'koridor' dengan cell 2x lebih besar dari kota (Low 60 / High 40 / Ultra 28) dan lantai rendah (1-4); tanpa Indomaret tiap 110 m (jarang), pohon/kabel lebih sedikit, jarak gambar tetap `DRAW`. Kampung.js dipakai ulang (tiang listrik hanya di jalan utama koridor).
- Terrain: patch BARU karena terrain utama hanya x >= -1000 sampai z 1800 dan terrainW (x -2402..-1000) hanya sampai z 496. Dua patch sel 9 unit (SAMA dengan grid utama, bukan 12 -> tanpa retak): (S1) x -2000..-1000, z 496..3950; (S2) x -1000..-200, z 1800..3950. Total ~(1000x3454 + 800x2150)/81 x 2 = ~120 rb segitiga. Baris sambungan di z=496 (S1 dengan terrainW) dan x=-1000 (S1 dengan utama z<=1800) dites numerik (tinggi sama di batas).
- Batas jalan kaki: z <= 3950.

### 11.3 Efek ke sisa rencana
- Bagian 4 keputusan A, E: tidak lagi pertanyaan. Fase 5 (koridor) naik jadi iter 87-88.
- Teleport baru: `>> Koridor` (-800,1600), `>> Darmo` (-1150,2900), `>> KBS` (-1230,2930).

### 11.4 "Sungai buatan sendiri"
Diartikan: sungai/kanal/kolam KBS DAN Kali Surabaya/Kali Wonokromo di Darmo digambar manual (tidak dari OSM). Konsekuensi: query waterway di bagian 9 tidak perlu. Implementasi umum (dipakai KBS dan sungai Darmo): daftar `WATER` = poligon/garis lebar (x,z,w) di `darmo_data.js`/`kbs_data.js`; `terrainHeight` diberi pengurangan lembah (dasar -1,2, tepi landai 3-6 unit); mesh air kecil (material air yang sama dengan `world.js` water, y=0) ditempel hanya di area lembah. Pemain jalan kaki otomatis berenang (aturan iter 11: terrain<0), kendaraan diblok (sama dengan laut). Jembatan kecil di jalan yang memotong sungai = dek datar di atas (pola `bridge.heightAt`, dibuat generik `deck(x,z)`).

## 12. KBS (Kebun Binatang Surabaya) dari gambar
Acuan: `data/kbs_ref_sketchup.png` (model SketchUp perspektif, label "Jl Setail", "Golden Berry Regency", "Togamas"). Lokasi: Jl. Setail OSM ada di (-1249..-1157, 2889..3011) -> KBS di sisi timur/utara-nya, pusat kira-kira (-1230, 2930) (SETEL ulang dengan melihat peta; BELUM diverifikasi). Ukuran asli ~15 ha -> di 1:3 sekitar 130 x 130 unit; tapak gambar memanjang barat-barat daya -> timur-timur laut.
Inventaris dari gambar (posisi relatif pada tapak, ujung kiri-bawah = barat daya):
- **Tapak**: poligon trapesium bertembok hitam; tepi kiri-bawah dan kanan-bawah berbatasan Jl. Setail; di luar tapak kiri-atas ada sungai lebar (biru tua) dan rumput.
- **Barat daya (area parkir/plaza)**: lapangan aspal gelap + kolam lincah (hijau-teal) berbentuk organik dengan 3 pulau/alas abu-abu (garis strip gelap) dan satu kolam bundar kecil di ujung kiri; dikelilingi deretan bangunan 2 lantai atap cokelat (kiri: ~6 unit memanjang diagonal; kiri-bawah: ~3; depan: ~4 rumah petak; kanan-bawah: satu bangunan panjang berrangka kayu beratap pelana panjang).
- **Tengah**: bangunan berhalaman (cincin persegi dengan atrium dalam, atap cokelat) + lapangan abu-abu di selatannya + ~20 rumah petak atap cokelat berpasangan di utaranya; paviliun BESAR atap limas/pelana silang di tengah-atas.
- **Utara**: kanal teal bercabang (laguna berlobus) di atas-tengah; jalur aspal gelap membelah.
- **Timur**: halaman rumput luas dibagi jalur aspal gelap bergrid; satu lapangan gelap persegi; kanal teal berkelok dari tengah-utara ke timur; danau oval/oktagon besar dengan pulau oktagon abu-abu; oktagon abu-abu lain dan kotak abu-abu di ujung timur.
Pendekatan:
1. Karena gambar perspektif, layout ditrace KASAR ke koordinat lokal 0..1 (tapak) lalu diskalakan: `tools/kbs_layout.py` membuat `src/kbs_data.js` {site poly, roads(path,w), water(poly), lawns(poly), buildings([x,z,w,d,rot,tipe]), pads(poly)}. Hasilnya bisa di-edit tangan.
2. Bangunan: atap cokelat pelana = pakai ulang model procedural kota (genteng) / Kenney suburban (type), skala 2 lantai; "pasangan" dan "deretan" sebagai grup berulang; bangunan berhalaman & paviliun = prosedural baru (dinding putih/rangka kayu + atap cokelat) di `kbs.js` (pola madura.js).
3. Tanpa kandang satwa (belum ada di gambar): pads abu-abu = kandang/area pamer placeholder (tanpa hewan; fase poles: satwa sederhana).
4. Sungai/kolam = bagian 11.4. Pagar/tembok tapak = collider garis + 2 gerbang di Jl. Setail.
5. Jalan dalam (aspal gelap) = polyline `zone:'kbs'` width 5-7 (tanpa AI/lampu merah), diaspal lewat roads.js biasa.
Pertanyaan opsional: bisa ekspor model SketchUp-nya (.skp/.dae) atau screenshot tampak ATAS (top view/ortografis)? Itu membuat trace jauh lebih akurat dibanding gambar perspektif ini. Tanpa itu: trace kasar, dirapikan setelah dilihat di game.

### 12b. Update: gambar TAMPAK ATAS KBS diterima (data/kbs_ref_topview.png, 406x512 px)
Ini menggantikan gambar perspektif sebagai acuan utama (perspektif tetap di data/kbs_ref_sketchup.png untuk bentuk atap/bangunan). Alat: `tools/kbs_trace.py` (segmentasi warna OpenCV) -> `data/kbs_trace_draft.json` (air + bangunan dalam unit game, lubang/pulau ikut) + `data/kbs_trace_overlay.png` (cek visual: biru = air, jingga = pulau, merah = bangunan). Hasil percobaan: ~10 poligon air, ~33 bangunan terdeteksi; garis air dan atap cokelat cocok dengan gambar.
Tata letak dari gambar (px gambar; atas = utara DUGAAN):
- **Tapak** memanjang N-S, lebar ~300 px di utara menyempit ke ujung ~ (200,480) di selatan -> ~100 x 150 unit game (skala 1 px ~ 1 m asli ~ 0,333 unit; KALIBRASI kalau ada ukuran nyata).
- **Utara (y 30-110)**: 2 petak persegi panjang besar kiri-atas dan kanan-atas (kebun/kandang luas, berpagar dinding).
- **Tengah-utara (y 95-290)**: LAGUNA BESAR berbentuk cincin mengelilingi pulau oval besar (~210,140) dan pulau kecil; sungai berkelok di sisi kiri dengan 3-4 jari/teluk (x 90-165, y 120-290); kanal vertikal di kanan (x 235-260, y 190-290); petak rumput gelap (180-240, 190-240); jalur lurus horizontal di y~193 dan y~247.
- **Tengah-selatan (y 290-400)**: persegi putus-putus (152-265, 298-400) = area inti: bangunan BERHALAMAN beratap limas cokelat di (205,347) ~45 px, diapit deretan bangunan petak kecil (kiri 3-4 baris, kanan 2 baris) + 2 paviliun besar atap limas di kiri luar (75-110, 310-340).
- **Selatan (y 370-480)**: laguna kedua (160-290, 370-420), deretan bangunan diagonal di kiri-bawah (110-165, 385-430) dan kanan-bawah (285-325, 355-410), kumpulan di ujung selatan (170-290, 420-470); gerbang/jalan Jl. Setail di ujung selatan.
Rencana pakai: kbs_data.js = hasil trace yang dibersihkan tangan (rapikan sudut siku bangunan = kotak berputar via minAreaRect, air = poligon + lubang pulau, sungai jari dibiarkan organik). Ketinggian: 2 lantai atap cokelat; bangunan berhalaman 2 lantai + atrium; paviliun limas 1 lantai tinggi; pulau = alas abu-abu kecil (+0,3 m) di air.
Penempatan di dunia: ujung selatan tapak menempel Jl. Setail (-1249..-1157, 2889..3011); sehingga utara tapak membentang ke z yang lebih KECIL (utara) dari Setail, pusat ~(-1210, 2850) (BARU hitungan kasar; seimbangkan dengan Taman Bungkul (-1116,2841) yang berjarak ~95 unit -> mungkin tumpang tindih -> setel di iter 90 dengan melihat peta). Jangan pakai angka ini mentah.
