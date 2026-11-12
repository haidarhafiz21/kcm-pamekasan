# KCM · Lihat dari Kursi

Website visualisasi kursi bioskop. Pengunjung memilih bioskop (cabang/kota),
memilih studio, lalu mengetuk kursi dan diajak "berjalan" dari pintu masuk
sampai duduk untuk melihat layar dari posisi itu, lengkap dengan jarak ke
layar, luas pandangan, dan posisi dari tengah.

Website statis murni (HTML + CSS + JavaScript, tanpa server dan tanpa build).

## Menambah bioskop & menyesuaikan studio

Semua data ada di **`js/cinemas.js`**. Tiap bioskop berisi nama, kota,
provinsi, alamat, dan daftar studionya.

- **Menambah bioskop:** salin satu blok `{ id, name, ... }`, ubah isinya.
- **Denah kursi:** salin dari halaman "Pilih Bangku" aplikasi KCM (huruf baris,
  nomor kursi, letak lorong), lalu tandai studionya dengan `seatMap`.
- **Ukuran ruangan & layar:** dihitung otomatis di **`js/standar.js`** dari
  jumlah kursi memakai pedoman desain bioskop
  [UNIC "Cinema Auditorium Design"](https://unic-cinemas.org/fileadmin/CinemaAuditoriumDesign_v1.0.pdf)
  (lebar kursi, jarak baris, lorong, jarak baris terdepan 0,6 × lebar layar,
  ruang samping layar, tinggi undakan dari garis pandang). Kalau studio sudah
  diukur langsung, tulis angkanya di studio itu (`screen`, `firstRow`,
  `rowPitch`, `floors`, ...) lalu set `verified: true`.

### Sumber data

| Data | Sumber |
| --- | --- |
| Nama, alamat, tanggal buka, jumlah studio | Wikipedia "Kota Cinema Mall" |
| Denah kursi 9 studio (Pamekasan 1 & 2, Banjarmasin 3, Wisma Asri 1, Greenland 2, Jember 2, Situbondo 2, Tabalong 2) | Aplikasi KCM, 12 November 2026 |
| Kapasitas Pamekasan (205/studio) | FaktualNews, 13 Februari 2020 |
| Kapasitas Banjarmasin (205/studio reguler, Suites 40) | ANTARA Kalsel, 12 Desember 2022 |
| Kapasitas Jember (180/studio) | Kompasiana, 2019 |
| Kapasitas Jati Asih (112/studio, 8 baris) | Fimela & matriphe.com, 2017 |
| Kapasitas Situbondo (±460 total) | TIMES Indonesia, Februari 2026 |
| Ukuran ruangan & layar | Pedoman UNIC (bukan hasil ukur) |

Studio lain belum punya data; susunan kursinya memakai pola yang paling
umum di denah resmi KCM dan diberi label "Tata letak perkiraan".

## Menjalankan di komputer

```
python -m http.server 8000
```

Lalu buka http://localhost:8000. (Membuka `index.html` langsung lewat
klik dua kali tidak bisa, karena modul JavaScript butuh server.)

## Struktur

| File | Isi |
| --- | --- |
| `index.html` | Kerangka halaman |
| `css/style.css` | Tampilan |
| `js/cinemas.js` | **Data bioskop & studio — edit di sini** |
| `js/standar.js` | Ukuran ruangan & layar menurut pedoman UNIC |
| `js/layout.js` | Posisi kursi, jarak, sudut pandang, skor kenyamanan, jalur jalan |
| `js/viewer.js` | Ruang studio 3D, lampu, kamera sinematik |
| `js/walker.js` | Tokoh kecil yang berjalan | `js/viewer.js` | Ruang studio 3D, animasi berjalan & duduk | duduk |
| `js/film.js` | Adegan di layar (senja di pantai Madura), dihitung di GPU |
| `js/main.js` | Peta kursi, panel, navigasi |
| `vendor/three/` | Three.js r160 (lisensi MIT) |

## Memperbarui website yang sudah online

Website di-hosting gratis di GitHub Pages. Setelah mengubah file:

```
git add -A
git commit -m "Perbarui data bioskop"
git push
```

Website akan diperbarui otomatis dalam 1–2 menit.
