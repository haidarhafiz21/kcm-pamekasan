/*
 * ─────────────────────────────────────────────────────────────
 *  DAFTAR BIOSKOP & STUDIO
 * ─────────────────────────────────────────────────────────────
 *  Nama, alamat, dan jumlah studio tiap cabang diambil dari artikel
 *  Wikipedia "Kota Cinema Mall". Seluruh bioskop KCM tidak memakai
 *  "Studio 4" (karena tetrafobia), jadi cabang 5 studio bernomor
 *  1, 2, 3, 5, 6.
 *
 *  TATA LETAK KURSI MASIH PERKIRAAN. Setelah mengukur studio asli,
 *  ganti angkanya lalu ubah `verified: true` agar label
 *  "Tata letak perkiraan" hilang untuk bioskop itu.
 *
 *  Menambah bioskop baru: salin satu blok { id, name, ... } lalu ubah.
 *  `id` dipakai di tautan (contoh #/kcm-pamekasan/studio-1/F8), jadi
 *  gunakan huruf kecil dan tanda hubung, dan jangan diganti setelah
 *  website dibagikan.
 *
 *  Semua ukuran dalam METER.
 *    rows        huruf baris, dari yang PALING DEKAT layar
 *    blocks      jumlah kursi per blok kiri → kanan (dilihat dari kursi);
 *                di antara blok ada lorong
 *    rowBlocks   jumlah kursi khusus per baris, mis. { A: [0, 10, 0] }
 *    seatWidth   lebar satu kursi          rowPitch  jarak antar baris
 *    aisleWidth  lebar lorong antar blok (angka atau daftar per lorong;
 *                < 0,8 m dianggap tidak bisa dilewati)
 *    sideAisle   lebar lorong samping      firstRow  layar → baris A
 *    flatRows    jumlah baris depan yang lantainya datar
 *    riser       tinggi tiap undakan
 *    screen      { width, height, bottom }  (bottom = tinggi tepi bawah
 *                layar dari lantai depan)
 *    entrance    { side: 'left' | 'right', end: 'back' | 'front' }
 *    seat        'regular' | 'recliner'
 *    numbering   'ltr' (kursi 1 paling kiri) | 'rtl'
 *    price       angka (mis. 35000) atau null untuk disembunyikan
 */

const BASE = {
  type: 'Reguler',
  seat: 'regular',
  price: null,
  rowBlocks: {},
  seatWidth: 0.56,
  rowPitch: 1.05,
  aisleWidth: 1.1,
  sideAisle: 1.1,
  flatRows: 2,
  riser: 0.34,
  numbering: 'ltr',
  entrance: { side: 'left', end: 'back' },
};

// Ukuran studio umum. Pakai sebagai titik awal lalu timpa seperlunya.
const SIZE = {
  besar: { rows: 'ABCDEFGHIJ', blocks: [4, 12, 4], firstRow: 4.8, sideAisle: 1.15, screen: { width: 12.2, height: 5.1, bottom: 1.3 } },
  sedang: { rows: 'ABCDEFGHI', blocks: [4, 10, 4], firstRow: 4.4, sideAisle: 1.15, screen: { width: 11.0, height: 4.6, bottom: 1.25 } },
  kecil: { rows: 'ABCDEFGH', blocks: [3, 10, 3], firstRow: 4.0, screen: { width: 9.6, height: 4.0, bottom: 1.2 } },
  mini: { rows: 'ABCDEFG', blocks: [3, 8, 3], firstRow: 3.8, screen: { width: 8.4, height: 3.5, bottom: 1.15 } },
  suites: {
    type: 'Suites',
    seat: 'recliner',
    rows: 'ABCD',
    blocks: [2, 2, 2, 2],
    seatWidth: 0.92,
    rowPitch: 1.85,
    aisleWidth: [0.4, 1.05, 0.4],
    sideAisle: 1.05,
    firstRow: 4.3,
    flatRows: 1,
    riser: 0.45,
    screen: { width: 8.2, height: 3.43, bottom: 1.15 },
  },
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const studio = (size, name, extra = {}) => ({ ...BASE, ...SIZE[size], id: slug(name), name, ...extra });
const RIGHT = { side: 'right', end: 'back' };
const FRONT_LEFT = { side: 'left', end: 'front' };
const FRONT_RIGHT = { side: 'right', end: 'front' };

export const DEFAULT_CINEMA = 'kcm-pamekasan';

export const CINEMAS = [
  // ───────── Jawa Timur ─────────
  {
    id: 'kcm-pamekasan',
    brand: 'KCM',
    name: 'KCM Pamekasan',
    city: 'Pamekasan',
    province: 'Jawa Timur',
    address: 'Jl. Raya Nyalaran No. 224, Kowel, Pamekasan 69317',
    verified: false,
    // pintu masuk di depan (dekat layar), sisi kanan
    studios: [
      studio('sedang', 'Studio 1', { entrance: FRONT_RIGHT }),
      studio('kecil', 'Studio 2', { entrance: FRONT_RIGHT }),
    ],
  },
  {
    id: 'kcm-situbondo',
    brand: 'KCM',
    name: 'KCM Situbondo',
    city: 'Situbondo',
    province: 'Jawa Timur',
    address: 'Roxy Square Situbondo, Jl. Basuki Rahmat No. 11, Mimbaan, Panji, Situbondo 68323',
    verified: false,
    // total ±460 kursi untuk 3 studio menurut pemberitaan
    studios: [
      studio('sedang', 'Studio 1', { rows: 'ABCDEFGHIJ', firstRow: 4.6 }),
      studio('kecil', 'Studio 2', { rows: 'ABCDEFGHI', entrance: RIGHT }),
      studio('kecil', 'Studio 3', { blocks: [3, 11, 3], screen: { width: 10.0, height: 4.2, bottom: 1.2 } }),
    ],
  },
  {
    id: 'kcm-jember',
    brand: 'KCM',
    name: 'KCM Jember',
    city: 'Jember',
    province: 'Jawa Timur',
    address: 'Jl. Gajah Mada No. 176, Jember Kidul, Kaliwates, Jember 68131',
    verified: false,
    studios: [
      studio('besar', 'Studio 1'),
      studio('sedang', 'Studio 2', { entrance: RIGHT }),
      studio('sedang', 'Studio 3', { rowBlocks: { A: [0, 10, 0] } }),
      studio('kecil', 'Studio 5', { entrance: FRONT_RIGHT }),
      studio('kecil', 'Studio 6', { rows: 'ABCDEFG' }),
    ],
  },
  {
    id: 'kcm-greenland',
    brand: 'KCM',
    name: 'KCM Greenland',
    city: 'Gresik',
    province: 'Jawa Timur',
    address: 'Jl. Raya Laban, Laban, Menganti, Gresik 61174',
    verified: false,
    studios: [
      studio('sedang', 'Studio 1', { entrance: RIGHT }),
      studio('kecil', 'Studio 2'),
      studio('mini', 'Studio 3', { entrance: RIGHT }),
    ],
  },

  // ───────── Jawa Barat ─────────
  {
    id: 'kcm-jatiasih',
    brand: 'KCM',
    name: 'KCM Jati Asih',
    city: 'Bekasi',
    province: 'Jawa Barat',
    address: 'Jl. Parpostel No. 85-86, Jatiasih, Bekasi 17423',
    verified: false,
    studios: [
      studio('besar', 'Studio 1', { entrance: RIGHT }),
      studio('sedang', 'Studio 2'),
      studio('sedang', 'Studio 3', { entrance: RIGHT }),
      studio('kecil', 'Studio 5'),
      studio('kecil', 'Studio 6', { entrance: RIGHT, rowBlocks: { A: [0, 10, 0] } }),
    ],
  },
  {
    id: 'kcm-wisma-asri',
    brand: 'KCM',
    name: 'KCM Wisma Asri',
    city: 'Bekasi',
    province: 'Jawa Barat',
    address: 'Jl. Jembatan Besi, Teluk Pucung, Bekasi Utara, Bekasi 17121',
    verified: false,
    studios: [
      studio('besar', 'Studio 1', { entrance: FRONT_LEFT }),
      studio('sedang', 'Studio 2', { entrance: FRONT_RIGHT }),
      studio('sedang', 'Studio 3', { rows: 'ABCDEFGH' }),
      studio('kecil', 'Studio 5', { entrance: RIGHT }),
      studio('mini', 'Studio 6'),
    ],
  },

  // ───────── Kalimantan Selatan ─────────
  {
    id: 'kcm-banjarmasin',
    brand: 'KCM',
    name: 'KCM Banjarmasin',
    city: 'Banjarmasin',
    province: 'Kalimantan Selatan',
    address: 'Jl. Belitung Darat No. 187, Kuin Selatan, Banjarmasin Barat, Banjarmasin 70128',
    verified: false,
    studios: [
      studio('sedang', 'Studio 1'),
      studio('sedang', 'Studio 2', { entrance: RIGHT }),
      studio('kecil', 'Studio 3'),
      studio('suites', 'Suites'),
    ],
  },
  {
    id: 'kcm-tabalong',
    brand: 'KCM',
    name: 'KCM Tabalong',
    city: 'Tabalong',
    province: 'Kalimantan Selatan',
    address: "Jl. A. Yani, Mabu'un, Murung Pudak, Tabalong 71571",
    verified: false,
    studios: [
      studio('kecil', 'Studio 1'),
      studio('mini', 'Studio 2', { entrance: RIGHT }),
    ],
  },
];
