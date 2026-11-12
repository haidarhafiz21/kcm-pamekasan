/*
 * ─────────────────────────────────────────────────────────────
 *  DAFTAR BIOSKOP & STUDIO
 * ─────────────────────────────────────────────────────────────
 *  Sumber data:
 *   - Nama, alamat, tanggal buka, dan jumlah studio: Wikipedia
 *     "Kota Cinema Mall". Seluruh bioskop KCM tidak memakai Studio 4
 *     (tetrafobia), jadi cabang 5 studio bernomor 1, 2, 3, 5, 6.
 *   - Susunan kursi bertanda `seatMap`: disalin dari denah "Pilih Bangku"
 *     aplikasi KCM (screenshot 12 November 2026).
 *   - Kapasitas bertanda `capacity`: dari pemberitaan (sumber ditulis).
 *     Susunan kursinya masih perkiraan, tetapi jumlahnya sesuai sumber.
 *   - Studio tanpa keduanya: susunan kursi PERKIRAAN memakai pola yang
 *     paling umum di denah resmi KCM (205 kursi).
 *   - Ukuran ruangan & layar SEMUA studio dihitung dari pedoman desain
 *     bioskop UNIC (lihat standar.js), karena ukuran asli tidak
 *     dipublikasikan. Setelah mengukur studio asli, tulis angkanya di
 *     studio itu (seatWidth, rowPitch, firstRow, screen, floors, ...) lalu
 *     ubah `verified: true` agar labelnya hilang.
 *
 *  `id` dipakai di tautan (contoh #/kcm-pamekasan/studio-1/F8), jadi
 *  gunakan huruf kecil dan tanda hubung, dan jangan diganti setelah
 *  website dibagikan.
 *
 *  Kolom studio (semua ukuran dalam METER):
 *    rows        huruf baris, dari yang PALING DEKAT layar
 *    blocks      jumlah kursi per blok kiri → kanan (dilihat dari kursi);
 *                di antara blok ada lorong
 *    rowBlocks   jumlah kursi khusus per baris, mis. { F: [8, 7] }
 *    numbering   'rtl' = kursi 1 paling kanan (seperti KCM) | 'ltr'
 *    fixedNumbers true = nomor kursi mengikuti posisi kolom, jadi kursi
 *                yang ditiadakan tetap "memakai" nomornya (Banjarmasin:
 *                baris F berhenti di F3, tanpa F2 & F1)
 *    seatMap     true = susunan kursi sesuai aplikasi resmi
 *    capacity    { seats, source } = jumlah kursi menurut pemberitaan
 *    entrance    { side: 'left' | 'right', end: 'back' | 'front' }
 *    seat        'regular' | 'recliner'
 *    price       angka (mis. 35000) atau null untuk disembunyikan
 *    Ukuran yang boleh diisi hasil ukur: seatWidth, rowPitch, aisleWidth,
 *    sideAisle, firstRow, screen { width, height, bottom }, floors [..]
 */

import { applyStandard } from './standar.js';

const BASE = {
  type: 'Reguler',
  seat: 'regular',
  price: null,
  rowBlocks: {},
  numbering: 'rtl',
  fixedNumbers: true,
  // pintu masuk di depan, samping kanan layar (dilihat dari kursi)
  entrance: { side: 'right', end: 'front' },
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const studio = (name, pattern, extra = {}) =>
  applyStandard({ ...BASE, ...pattern, id: slug(name), name, ...extra });
const only = (letters, counts) => Object.fromEntries([...letters].map((r) => [r, counts]));

// Huruf baris KCM: tanpa I; di aplikasi, huruf terakhir paling dekat layar
// dan baris A paling belakang.
const rows = (n) => [...'ABCDEFGHJKLMN'.slice(0, n)].reverse().join('');
const NEAR = 'FGHJKLMN'; // 8 baris terdepan pada studio 13 baris

// ───────── Pola denah dari aplikasi KCM ─────────
// 205 kursi, 13 baris: A–E 17 kursi, F–N 15 kursi karena 2 kursi di tepi
// KIRI ditiadakan. `left` = jumlah kursi blok kiri pada baris A–E.
const P205_KIRI = (left) => ({ rows: rows(13), blocks: [left, 17 - left], rowBlocks: only(NEAR, [left - 2, 17 - left]) });
// sama, tetapi 2 kursi di tepi KANAN yang ditiadakan
const P205_KANAN = (left) => ({ rows: rows(13), blocks: [left, 17 - left], rowBlocks: only(NEAR, [left, 15 - left]) });
// 180 kursi: 12 baris × 15 kursi (15–8 | 7–1)
const P180 = { rows: rows(12), blocks: [8, 7] };
// 143 kursi: 11 baris × 13 kursi (13–6 | 5–1)
const P143 = { rows: rows(11), blocks: [8, 5] };

const APP = { seatMap: true };
// Studio tanpa data: pola yang paling sering muncul di denah resmi
// (5 dari 8 studio yang sudah ada denahnya berkapasitas 205 kursi).
const DUGA = P205_KIRI(10);

// sumber kapasitas
const SRC = {
  pamekasan: 'FaktualNews, 13 Februari 2020 (manajer KCM Pamekasan)',
  jember: 'Kompasiana, Juli 2019 (tiga studio awal @180 kursi)',
  jatiasih: 'Fimela, 2017 & blog matriphe.com, 2017 (dua studio @112 kursi, 8 baris)',
  banjarmasin: 'ANTARA Kalsel, 12 Desember 2022',
  situbondo: 'TIMES Indonesia, Februari 2026 (3 studio, total ±460 kursi)',
};
const cap = (seats, source) => ({ capacity: { seats, source } });

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
    studios: [
      // KOTA 1: bentuk sama dengan Banjarmasin Studio 3, tetapi baris F–N
      // dinomori ulang 15–8 | 7–1 (bukan 17–10 | 9–3)
      studio('Studio 1', P205_KANAN(8), { ...APP, fixedNumbers: false, ...cap(205, SRC.pamekasan) }),
      // KOTA 2: 17–9 | 8–1; baris F–N tanpa kursi 17 & 16
      studio('Studio 2', P205_KIRI(9), { ...APP, ...cap(205, SRC.pamekasan) }),
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
    // total ±460 kursi: Studio 2 = 143 (aplikasi), sisa ±317 untuk Studio 1 & 3
    studios: [
      studio('Studio 1', P180),
      studio('Studio 2', P143, APP),
      studio('Studio 3', P143),
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
      studio('Studio 1', P180, cap(180, SRC.jember)),
      studio('Studio 2', P180, { ...APP, ...cap(180, SRC.jember) }),
      studio('Studio 3', P180, cap(180, SRC.jember)),
      studio('Studio 5', DUGA),
      studio('Studio 6', DUGA),
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
      studio('Studio 1', DUGA),
      studio('Studio 2', P205_KIRI(10), APP),
      studio('Studio 3', DUGA),
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
      // 112 kursi dalam 8 baris → 14 kursi per baris; pembagian blok perkiraan
      studio('Studio 1', { rows: rows(8), blocks: [8, 6] }, cap(112, SRC.jatiasih)),
      studio('Studio 2', { rows: rows(8), blocks: [8, 6] }, cap(112, SRC.jatiasih)),
      studio('Studio 3', DUGA),
      studio('Studio 5', DUGA),
      studio('Studio 6', DUGA),
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
      studio('Studio 1', P180, APP),
      studio('Studio 2', DUGA),
      studio('Studio 3', DUGA),
      studio('Studio 5', DUGA),
      studio('Studio 6', DUGA),
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
      // 205 kursi menurut ANTARA; susunan disamakan dengan Studio 3
      studio('Studio 1', P205_KANAN(8), cap(205, SRC.banjarmasin)),
      studio('Studio 2', P205_KANAN(8), cap(205, SRC.banjarmasin)),
      // baris F–N berhenti di kursi 3 (tanpa 2 & 1)
      studio('Studio 3', P205_KANAN(8), APP),
      // 40 kursi rebah menurut ANTARA; susunan berpasangan perkiraan
      studio(
        'Suites',
        { type: 'Suites', seat: 'recliner', rows: rows(5), blocks: [2, 2, 2, 2], aisleWidth: [0.4, 1.2, 0.4] },
        cap(40, SRC.banjarmasin)
      ),
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
      studio('Studio 1', DUGA),
      studio('Studio 2', P205_KIRI(10), APP),
    ],
  },
];
