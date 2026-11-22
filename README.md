# GTA: Gak Tau Aturan - Suramadu City
Jalankan:  python -m http.server 8000   lalu buka http://localhost:8000
Aset .glb di assets/: car.glb (Sedan) dan angkot.glb (Van) sudah terpasang dari pack rgsdev (CC0); motor.glb / player.glb opsional (tanpa itu pakai model procedural). Detail: ASSETS.md.

Tes cepat tanpa server (HP/PC): buka test.html langsung. Bangun ulang: python3 tools/build_test.py
Madura (iter 53): seberang jembatan, desa-desa sepi tanpa lampu jalan; teleport ">> Madura".
Error tampil di tombol Console (pojok kanan atas).
Splash: edit splash.js (SPLASH.images / SPLASH.music). Musik placeholder: assets/audio/splash.mp3
Kendaraan: dekati motor/mobil/angkot lalu tekan F (PC) atau tombol ENTER (HP). Gas = W / stick atas, belok = A/D, RUN/Shift = turbo.
Kota hidup: pejalan kaki dan lalu lintas AI muncul di sekitar pemain. Kendaraan AI bisa dibajak (dekati lalu tekan F).
Wanted: tabrak pejalan atau bajak kendaraan -> bintang WANTED, Satpol PP mengejar (jalan kaki + motor). Lari/ngebut sampai jauh untuk lolos; tertangkap = denda + respawn di Spawn.
Lalu lintas: lampu di persimpangan utama; AI berhenti di merah. Terobos merah / lawan arah di depan Satpol (patroli di persimpangan) = wanted. Klakson: H atau tombol HORN.
Suara: klakson (H / tombol HORN), siren Satpol, tabrakan. Mute: M atau tombol Sound. Klakson mengusir pejalan. Ngebut atau lewat trotoar di depan patroli = wanted.
Tabrakan: kendaraan saling dorong/pantul (motor kalah dari angkot). Tabrak di depan Satpol = wanted. Renang: jalan kaki ke laut = berenang pelan; Satpol jalan kaki tidak bisa mengikuti.
Kendaraan rusak: HP 0 = terbakar, 10 dtk lagi meledak (keluar dulu!). Bengkel (cincin hijau 'BENGKEL' di jalan): berhenti pelan 2.5 dtk = diperbaiki gratis.
Malam hari (jam ~17:40+): kendaraan menyalakan lampu depan/belakang otomatis; lampu rem membesar saat mengerem.
NPC tambahan (hijab & anak SMA, iter 50): muncul acak ~30% di antara pejalan kaki. URL ?npc_extra=0 mematikan, ?h_extra=2.3 mengubah tinggi. Buat ulang GLB: python3 tools/prep_npc_chars.py hijab|sma <sumber> assets/<keluaran>.glb
Model polisi (iter 56): semua petugas Satpol/polisi memakai model "Indonesian Police Dalmas" oleh mixboni (CC BY 4.0, https://skfb.ly/pDCwr; kredit di CREDITS.md + layar loading). URL ?polisi=0 = kembali ke karakter Kenney + topi satpol, ?h_polisi=2.2 mengubah tinggi. Buat ulang GLB (19 MB -> 0,7 MB): python3 tools/prep_polisi.py <sumber.glb|zip> assets/npc_polisi.glb 9000 1024 (butuh pip: fast-simplification xatlas scipy opencv-python pillow numpy)
Berkelahi (iter 69-72): PUNCH = J / klik kiri / tombol PUNCH; tekan 3x berturut-turut = kombo + finisher. KICK = K / tombol KICK (HP). Pukul/tendang pejalan atau petugas = efek suara + percikan + kamera goyang; di depan saksi Satpol = wanted.
Senjata (iter 73): dekati senjata (cincin oranye di tanah) lalu G / tombol GRAB = pungut, G lagi = lepas. Pukulan dengan senjata lebih jauh & lebih kuat, tapi senjata bisa patah. Petugas Satpol yang KO menjatuhkan pentungan.
Polesan tempur (iter 74): serangan otomatis menghadap sasaran terdekat di depan & melangkah maju (auto-aim/lunge), jeda singkat saat kena (hit-stop), pejalan sekitar kabur saat ada perkelahian.
