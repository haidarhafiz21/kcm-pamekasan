/*
 * ─────────────────────────────────────────────────────────────
 *  DATA STUDIO KCM PAMEKASAN
 *  Semua ukuran dalam METER. Ubah angka di sini agar sesuai
 *  dengan ukuran studio sebenarnya — peta kursi, animasi 3D,
 *  jarak, dan sudut pandang akan menyesuaikan otomatis.
 * ─────────────────────────────────────────────────────────────
 *
 *  rows        : huruf baris, urut dari yang PALING DEKAT layar.
 *  blocks      : jumlah kursi per blok (kiri → kanan, dilihat dari kursi
 *                menghadap layar). Di antara blok ada lorong.
 *  rowBlocks   : (opsional) jumlah kursi berbeda untuk baris tertentu,
 *                contoh { A: [0, 10, 0] } → baris A hanya blok tengah.
 *  seatWidth   : lebar satu kursi (dari tengah sandaran tangan ke tengah).
 *  rowPitch    : jarak antar baris (dari sandaran ke sandaran).
 *  aisleWidth  : lebar lorong di antara blok. Angka tunggal atau daftar
 *                (satu angka per lorong). Lorong < 0,8 m tidak dilewati.
 *  sideAisle   : lebar lorong di sisi kiri & kanan (dekat dinding).
 *  firstRow    : jarak dari layar ke baris pertama.
 *  flatRows    : jumlah baris depan yang lantainya masih datar.
 *  riser       : tinggi tiap undakan setelah baris datar.
 *  screen      : ukuran layar & tinggi tepi bawah layar dari lantai depan.
 *  entrance    : posisi pintu masuk. side: 'left' | 'right',
 *                end: 'back' (di atas/belakang) | 'front' (dekat layar).
 *  seat        : 'regular' atau 'recliner'.
 *  numbering   : 'ltr' (1 di paling kiri) atau 'rtl' (1 di paling kanan).
 *  price       : harga tiket (angka, contoh 35000) atau null untuk
 *                disembunyikan.
 */

export const CINEMA = {
  name: 'KCM Pamekasan',
  short: 'KCM',
  city: 'Pamekasan, Madura',
};

export const STUDIOS = [
  {
    id: 'studio-1',
    name: 'Studio 1',
    type: 'Reguler',
    seat: 'regular',
    price: null,
    rows: 'ABCDEFGHI',
    blocks: [4, 10, 4],
    rowBlocks: {},
    seatWidth: 0.56,
    rowPitch: 1.05,
    aisleWidth: 1.1,
    sideAisle: 1.15,
    firstRow: 4.4,
    flatRows: 2,
    riser: 0.34,
    screen: { width: 11.0, height: 4.6, bottom: 1.25 },
    entrance: { side: 'left', end: 'back' },
    numbering: 'ltr',
  },
  {
    id: 'studio-2',
    name: 'Studio 2',
    type: 'Reguler',
    seat: 'regular',
    price: null,
    rows: 'ABCDEFGH',
    blocks: [3, 10, 3],
    rowBlocks: {},
    seatWidth: 0.56,
    rowPitch: 1.05,
    aisleWidth: 1.1,
    sideAisle: 1.1,
    firstRow: 4.0,
    flatRows: 2,
    riser: 0.34,
    screen: { width: 9.6, height: 4.0, bottom: 1.2 },
    entrance: { side: 'right', end: 'back' },
    numbering: 'ltr',
  },
  {
    id: 'suites-1',
    name: 'Suites 1',
    type: 'Suites',
    seat: 'recliner',
    price: null,
    rows: 'ABCD',
    blocks: [2, 2, 2, 2],
    rowBlocks: {},
    seatWidth: 0.92,
    rowPitch: 1.85,
    aisleWidth: [0.4, 1.05, 0.4],
    sideAisle: 1.05,
    firstRow: 4.3,
    flatRows: 1,
    riser: 0.45,
    screen: { width: 8.2, height: 3.43, bottom: 1.15 },
    entrance: { side: 'left', end: 'back' },
    numbering: 'ltr',
  },
  {
    id: 'suites-2',
    name: 'Suites 2',
    type: 'Suites',
    seat: 'recliner',
    price: null,
    rows: 'ABCDE',
    blocks: [2, 2, 2, 2],
    rowBlocks: {},
    seatWidth: 0.92,
    rowPitch: 1.8,
    aisleWidth: [0.4, 1.05, 0.4],
    sideAisle: 1.05,
    firstRow: 4.2,
    flatRows: 1,
    riser: 0.42,
    screen: { width: 8.6, height: 3.6, bottom: 1.15 },
    entrance: { side: 'right', end: 'back' },
    numbering: 'ltr',
  },
];
