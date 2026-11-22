// Iterasi 87: KORIDOR kota lama -> Darmo (ditulis tangan; BUKAN dari OSM). zone:'koridor'. Rencana: PLAN_DARMO.md bagian 11.2.
// Dipakai roaddata.js: ROADS.push(...KORIDOR_ROADS) di AKHIR (sesudah Darmo) supaya indeks jalan lama + Darmo tidak berubah.
// Sambungan yang HARUS tetap persis (dites di tools/tests/koridor.test.mjs):
//   A awal  = ujung selatan Jl. Raya Darmo lama (-420,880), arah ~ +z.
//   A akhir = ujung utara Jl. Raya Darmo OSM (-1071.5,2349.9), tiba dengan arah ~ -10 derajat (sama dgn segmen OSM).
//   B akhir = ujung utara Jl. Raya Diponegoro OSM (-1528.6,2329.6), tiba menuju tenggara (~ +40 derajat).
//   C4 awal = ujung utara Jl. Ngagel OSM (-923.5,2322.5), berangkat ke utara.
// Belok tiap titik kontrol <= ~25 derajat (Catmull-Rom centripetal; belok tajam membuat pita jalan melipat).
// Persimpangan lampu merah = jalan melintang MEMOTONG A / B (ujung dilebihkan 40-80 unit), bukan sekadar bertemu di titik kontrol.

// Jl. Raya Darmo Lanjutan (lebar 16 = lebar OSM): dari ujung lama ke Darmo
export const KOR_A = [[-420, 880], [-428, 1000], [-470, 1180], [-560, 1380], [-690, 1580], [-830, 1780], [-950, 1980], [-1020, 2130], [-1050, 2232], [-1071.5, 2349.9]];

// Jl. Raya Diponegoro Lanjutan (lebar 18 = lebar OSM): lepas dari A di (-428,1000), ke barat, belok selatan (bulat), lalu ke ujung OSM
export const KOR_B = [[-428, 1000], [-650, 985], [-880, 955], [-1080, 925], [-1230, 912], [-1298, 929], [-1357, 967], [-1400, 1022], [-1437, 1115], [-1490, 1400], [-1560, 1700], [-1630, 1900], [-1660, 2030], [-1645, 2150], [-1600, 2245], [-1528.6, 2329.6]];

// x jalan (polyline P, z naik) di kedalaman z; dipakai untuk meletakkan gang di antara A dan B
const korXAt = (P, z) => { for (let i = 0; i + 1 < P.length; i++) { const a = P[i], b = P[i + 1]; if ((a[1] <= z && z <= b[1]) || (b[1] <= z && z <= a[1])) { const t = (z - a[1]) / ((b[1] - a[1]) || 1); return a[0] + (b[0] - a[0]) * t; } } return P[P.length - 1][0]; };

export const KORIDOR_ROADS = [
  { name: 'Jl. Raya Darmo Lanjutan', width: 16, zone: 'koridor', pts: KOR_A },
  { name: 'Jl. Raya Diponegoro Lanjutan', width: 18, zone: 'koridor', pts: KOR_B },
  // melintang (lebar 12 -> hw 6 = dapat lampu merah): memotong A dan B
  { name: 'Jl. Menanggal Raya', width: 12, zone: 'koridor', pts: [[-430, 1240], [-700, 1232], [-1000, 1225], [-1250, 1235], [-1500, 1250]] },
  { name: 'Jl. Wonokromo Lintas', width: 12, zone: 'koridor', pts: [[-640, 1622], [-900, 1618], [-1200, 1622], [-1450, 1615], [-1620, 1620]] },
  { name: 'Jl. Jagir Lintas', width: 12, zone: 'koridor', pts: [[-900, 2012], [-1150, 2008], [-1400, 2005], [-1730, 2012]] },
  // Jl. Ngagel Lanjutan (lebar 18 = OSM): dari ujung Ngagel, berangkat ke utara, melengkung ke barat, memotong A di ~ (-1029,2166)
  { name: 'Jl. Ngagel Lanjutan', width: 18, zone: 'koridor', pts: [[-923.5, 2322.5], [-920.7, 2282.6], [-932.4, 2239.1], [-958.2, 2202.2], [-995, 2176.4], [-1053, 2160.9], [-1112, 2152.6]] },
];

// Gang kampung (lebar 7, hw 3,5: tanpa lampu merah/AI padat/tiang). Antar A dan B, ujung melebihi A/B 28 unit supaya tersambung. Kerangka untuk rumah (iter 88).
for (const gz of [1350, 1490, 1760, 1880, 2090]) {
  const xe = korXAt(KOR_A, gz) + 28, xw = korXAt(KOR_B, gz) - 28;
  KORIDOR_ROADS.push({ name: 'Gang Koridor ' + gz, width: 7, zone: 'koridor', pts: [0, 1, 2, 3, 4].map(i => [xw + (xe - xw) * i / 4, gz + 9 * Math.sin(i * 1.7 + gz * 0.01)]) });
}
