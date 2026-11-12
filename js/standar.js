/*
 * ─────────────────────────────────────────────────────────────
 *  UKURAN STUDIO MENURUT STANDAR DESAIN BIOSKOP
 * ─────────────────────────────────────────────────────────────
 *  Ukuran asli studio KCM (lebar layar, jarak layar, jarak antar baris,
 *  tinggi undakan) tidak dipublikasikan. Karena itu ukuran ruangan dihitung
 *  dari JUMLAH & SUSUNAN KURSI memakai angka pedoman industri:
 *
 *    UNIC (International Union of Cinemas), "Cinema Auditorium Design" v1.0
 *    https://unic-cinemas.org/fileadmin/CinemaAuditoriumDesign_v1.0.pdf
 *
 *  Nomor § di bawah merujuk ke bab pedoman itu. Hasilnya adalah studio
 *  "sesuai standar", BUKAN hasil ukur. Kalau sebuah studio sudah diukur
 *  langsung, tulis angkanya di cinemas.js — angka yang ditulis di sana
 *  selalu dipakai dan tidak ditimpa hitungan ini.
 */

export const UNIC = {
  regular: {
    seatWidth: 0.55, // §7.2.2 lebar kursi 500–750 mm (sandaran tangan bersama)
    rowPitch: 1.2, // §7.1 jarak baris (sandaran ke sandaran) 1200 mm atau lebih
    eye: 1.2, // §6.7 tinggi mata penonton duduk 1200 mm dari lantai
  },
  recliner: {
    seatWidth: 0.8, // §7.2.2 kursi rebah 650–900 mm
    rowPitch: 1.85, // §7.2.1 kedalaman kursi rebah s.d. 1400 mm + §7.1.1 celah evakuasi 450 mm
    eye: 1.1, // §7.8 sandaran rebah menurunkan mata 50–150 mm
  },
  aisle: 1.2, // §7.6 lebar lorong evakuasi minimal 1200 mm
  wallGap: 0.45, // §7.6 celah 400–500 mm antara kursi terluar dan dinding
  firstRow: 0.6, // §6.1 jarak layar → mata baris terdepan ≥ 0,6 × lebar gambar
  aspect: 2.39, // §3.1 format Scope 2,39:1 sebagai format terlebar
  sideSpace: (w) => 0.3 + 0.05 * w, // §3.8.3 ruang di samping layar ≥ 0,3 + 0,05 × lebar
  clearance: 0.2, // §6.7 jarak bebas garis pandang ≥ 200 mm (kategori "baik")
};

const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Lengkapi ukuran studio yang belum diisi dengan hitungan standar UNIC.
 *  - lebar ruangan  = lebar semua kursi + lorong + celah dinding
 *  - lebar layar    = sisa lebar ruangan setelah ruang samping layar (§3.8.3)
 *  - baris terdepan = 0,6 × lebar layar (§6.1)
 *  - tepi bawah layar setinggi mata baris terdepan; tinggi tiap undakan
 *    dihitung agar setiap baris punya jarak bebas garis pandang 200 mm (§6.7)
 */
export function applyStandard(st) {
  const k = UNIC[st.seat] || UNIC.regular;
  const s = { ...st };
  s.seatWidth ??= k.seatWidth;
  s.rowPitch ??= k.rowPitch;
  s.aisleWidth ??= UNIC.aisle;
  s.sideAisle ??= UNIC.wallGap;

  const aisles = Array.isArray(s.aisleWidth)
    ? s.blocks.slice(1).map((_, i) => s.aisleWidth[i] ?? s.aisleWidth.at(-1))
    : new Array(s.blocks.length - 1).fill(s.aisleWidth);
  const seatsW = s.blocks.reduce((a, b) => a + b, 0) * s.seatWidth + aisles.reduce((a, b) => a + b, 0);
  const roomW = seatsW + 2 * s.sideAisle;

  // roomW = W + 2 × (0,3 + 0,05 W)  →  W = (roomW − 0,6) / 1,1
  const width = s.screen?.width ?? r2((roomW - 0.6) / 1.1);
  const height = s.screen?.height ?? r2(width / UNIC.aspect);
  const bottom = s.screen?.bottom ?? k.eye;
  s.screen = { width, height, bottom };

  const eyeZ = s.seat === 'recliner' ? 0.2 : 0.1; // mata sedikit di belakang garis kursi
  s.firstRow ??= r2(UNIC.firstRow * width - eyeZ);

  if (!s.floors && s.riser == null) {
    // §6.7: Y(n) = (Y(n−1) + c) × X(n) / X(n−1), Y = tinggi mata di atas tepi bawah layar
    const n = s.rows.length;
    const floors = [0];
    let y = k.eye - bottom;
    for (let i = 1; i < n; i++) {
      const x0 = s.firstRow + eyeZ + (i - 1) * s.rowPitch;
      const x1 = x0 + s.rowPitch;
      y = ((y + UNIC.clearance) * x1) / x0;
      floors.push(r2(y + bottom - k.eye));
    }
    s.floors = floors;
  }
  return s;
}
