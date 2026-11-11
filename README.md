# KCM Pamekasan · Lihat dari Kursi

Website visualisasi kursi bioskop. Pengunjung mengetuk kursi, lalu diajak
"berjalan" dari pintu masuk sampai duduk dan melihat layar dari posisi itu,
lengkap dengan jarak ke layar, luas pandangan, dan posisi dari tengah.

Website statis murni (HTML + CSS + JavaScript, tanpa server dan tanpa build).

## Menyesuaikan ukuran studio

Semua data ada di **`js/studios.js`**: jumlah baris, jumlah kursi per blok,
lebar kursi, jarak antar baris, lebar lorong, jarak layar ke baris pertama,
tinggi undakan, ukuran layar, posisi pintu, dan harga.

Ukur studio asli dengan meteran laser (cukup beberapa angka: lebar layar,
jarak layar ke baris A, jarak antar baris, tinggi undakan), lalu ganti
angkanya. Peta, animasi 3D, dan semua perhitungan akan menyesuaikan
otomatis.

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
| `js/studios.js` | **Data studio — edit di sini** |
| `js/layout.js` | Posisi kursi, jarak, sudut pandang, skor kenyamanan, jalur jalan |
| `js/viewer.js` | Ruang studio 3D, animasi berjalan & duduk |
| `js/film.js` | Gambar bergerak di layar (senja di pantai Madura) |
| `js/main.js` | Peta kursi, panel, navigasi |
| `vendor/three/` | Three.js r160 (lisensi MIT) |

## Memperbarui website yang sudah online

Website di-hosting gratis di GitHub Pages. Setelah mengubah file:

```
git add -A
git commit -m "Perbarui data studio"
git push
```

Website akan diperbarui otomatis dalam 1–2 menit.
