# KCM · Lihat dari Kursi

Website visualisasi kursi bioskop. Pengunjung memilih bioskop (cabang/kota),
memilih studio, lalu mengetuk kursi dan diajak "berjalan" dari pintu masuk
sampai duduk untuk melihat layar dari posisi itu, lengkap dengan jarak ke
layar, luas pandangan, dan posisi dari tengah.

Website statis murni (HTML + CSS + JavaScript, tanpa server dan tanpa build).

## Menambah bioskop & menyesuaikan studio

Semua data ada di **`js/cinemas.js`**. Tiap bioskop berisi nama, kota,
provinsi, alamat, dan daftar studionya. Tiap studio punya ukurannya sendiri:
jumlah baris, jumlah kursi per blok, lebar kursi, jarak antar baris, lebar
lorong, jarak layar ke baris pertama, tinggi undakan, ukuran layar, posisi
pintu, dan harga.

- **Menambah bioskop:** salin satu blok `{ id, name, ... }`, ubah isinya.
- **Menyesuaikan studio:** ukur studio asli dengan meteran laser (lebar layar,
  jarak layar ke baris A, jarak antar baris, tinggi undakan), ganti angkanya,
  lalu set `verified: true` agar label "Tata letak perkiraan" hilang.

Nama, alamat, dan jumlah studio cabang KCM diambil dari Wikipedia
("Kota Cinema Mall"). Susunan kursi enam studio (Banjarmasin Studio 3,
Wisma Asri Studio 1, Greenland Studio 2, Jember Studio 2, Situbondo Studio 2,
Tabalong Studio 2) sudah disalin dari denah aplikasi KCM; ukuran ruangannya
dan studio lain masih perkiraan.

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
