// Data jalan (spline Catmull-Rom). Format: {name, width(m), pts:[[x,z],...]}. Berupa .js (bukan .json) agar bisa dibundel ke test.html.
// Iterasi 52: Akses Suramadu berujung di kaki jembatan (340,-105); jembatan skala 1:3 memanjang ke z=-1915 (lihat suramadu.js, geo13.js).
// Peta: Surabaya = z > -120, utara = laut. Pantai Kenjeran di z~-30. Akses Suramadu berujung di pantai (x~340, z~-105) untuk jembatan iterasi 5.
import { eastShore } from './world.js';
import { DARMO_ROADS } from './darmo_data.js';
import { KORIDOR_ROADS } from './koridor_data.js';
export const ROADS = [
  { name: 'Jl. Kenjeran (pantai)', width: 14, pts: [[-850, -20], [-400, -35], [0, -30], [200, -32], [345, -34]] },
  { name: 'Jl. Tanjung Perak Raya', width: 16, pts: [[-1560, -590], [-1500, -430], [-1380, -230], [-1150, 30], [-850, 180], [-300, 150], [0, 170], [350, 140], [520, 162]] },
  { name: 'Jl. Raya Darmo', width: 14, pts: [[-430, -30], [-410, 200], [-440, 500], [-420, 880]] },
  { name: 'Jl. Pahlawan', width: 14, pts: [[0, 880], [10, 500], [-5, 170], [5, -30]] },
  { name: 'Jl. Akses Suramadu', width: 20, pts: [[345, 880], [330, 500], [335, 140], [340, 20], [340, -105]] }   /* iter 68: lebar 20 = lebar dek, 2 titik akhir lurus sejajar sumbu jembatan (x=340) */,
  { name: 'Jl. Rungkut', width: 12, pts: [[620, 880], [600, 500], [640, 440], [715, 428]] },
];
const onLand = (x, z) => x < eastShore(z) - 24;   // iter 54: titik jalan harus di darat (laut timur = Kenjeran)
for (const gx of [-640, -520, -280, -140, 140, 220, 520, 700]) { // gang/jalan kampung N-S
  const pts = [-25, 125, 275, 425, 575, 725, 880].map(z => [gx + 18 * Math.sin(z * 0.013 + gx), z]).filter(p => onLand(p[0], p[1]));
  if (pts.length >= 2) ROADS.push({ name: 'Gang ' + gx, width: 7, pts });
}
for (const gz of [330, 480, 640, 780]) { // E-W
  const pts = [-850, -680, -510, -340, -170, 0, 170, 340, 510, 680, 850].map(x => [x, gz + 14 * Math.sin(x * 0.011 + gz)]).filter(p => onLand(p[0], p[1]));
  const e = pts[pts.length - 1]; if (e[0] < 800) pts.push([eastShore(e[1]) - 34, e[1] + 4]);   // sambung sampai dekat pantai
  ROADS.push({ name: 'Jl. ' + gz, width: 7, pts });
}

// Iterasi 53: Madura (z < -1930). Jalan sempit (width < 10 => tanpa lampu jalan, pohon, marka; hw < 6 => tanpa lalu lintas AI & lampu merah). zone:'madura' dipakai kampung.js/madura.js. DITAMBAH DI AKHIR (indeks perpotongan lampu lalu lintas = indeks array).
const madShore = (x) => -1900 + 30 * Math.sin(x * 0.008) + 12 * Math.sin(x * 0.03);
ROADS.push({ name: 'Pangkal Suramadu (Madura)', width: 20, zone: 'madura', pts: [[340, -1915], [340, -1975]] });   // iter 68: lanjutan dek (lebar 20) sampai gerbang, supaya jalan Madura (9) tidak langsung menyempit di ujung jembatan
ROADS.push({ name: 'Jl. Raya Suramadu-Bangkalan', width: 9, zone: 'madura', pts: [[340, -1975], [336, -2100], [346, -2300], [332, -2500], [342, -2700], [330, -2900], [335, -3070]] });
ROADS.push({ name: 'Jl. Pesisir Madura', width: 8, zone: 'madura', pts: [-960, -800, -640, -480, -320, -160, 0, 160, 320, 480, 640, 800, 960].map(x => [x, madShore(x) - 95]) });
ROADS.push({ name: 'Jl. Desa A', width: 5, zone: 'madura', pts: [[-900, -2270], [-600, -2250], [-330, -2262], [0, -2225], [340, -2205], [600, -2290], [800, -2330], [960, -2300]] });
ROADS.push({ name: 'Jl. Desa B', width: 5, zone: 'madura', pts: [[-900, -2750], [-560, -2720], [-100, -2690], [330, -2700], [760, -2830], [960, -2800]] });
ROADS.push({ name: 'Jl. Desa C', width: 5, zone: 'madura', pts: [[-330, -2000], [-335, -2262], [-320, -2480], [-560, -2720]] });
ROADS.push({ name: 'Jl. Desa D', width: 5, zone: 'madura', pts: [[800, -1995], [800, -2330], [790, -2560], [760, -2830]] });

// Iterasi 54: Jl. Raya Kenjeran menyusuri pantai timur (~45 unit dari garis pantai) sampai Kenjeran Park (game ~945,1407). Ditambah di AKHIR.
ROADS.push({ name: 'Jl. Raya Kenjeran', width: 14, pts: [[490, 150], [581, 250], [725, 470], [835, 690], [866, 900], [884, 1190], [905, 1410], [1045, 1690]] });

// Iterasi 55: Pelabuhan Tanjung Perak di tanjung barat laut (x -1960..-1420, z -650..-430). Jalan pelabuhan menghubungkan ke Tanjung Perak Raya (di ujung barat). Ditambah di AKHIR.
ROADS.push({ name: 'Jl. Pelabuhan Perak', width: 12, pts: [[-1990, -540], [-1800, -545], [-1650, -552], [-1560, -560], [-1450, -520]] });

// Iterasi 86: jalan DARMO (OSM -> tools/osm_to_game.py -> src/darmo_data.js, zone:'darmo'). Ditambah di AKHIR supaya indeks perpotongan lalu lintas lama aman.
for (const r of DARMO_ROADS) ROADS.push(r);

// Iterasi 87: KORIDOR kota lama -> Darmo (src/koridor_data.js, zone:'koridor'). Ditambah PALING AKHIR (sesudah Darmo): indeks jalan lama dan Darmo tidak berubah.
for (const r of KORIDOR_ROADS) ROADS.push(r);
