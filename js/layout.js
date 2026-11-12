// Geometri studio, metrik pandangan, dan jalur jalan ke kursi.
// Sistem koordinat (meter): layar di z = 0 menghadap +z, x = 0 tengah layar,
// x positif = kanan (dilihat penonton yang menghadap layar), y = 0 lantai depan.

import { UNIC } from './standar.js';

// tinggi mata duduk mengikuti pedoman UNIC (lihat standar.js)
const SEAT_SPEC = {
  regular: { eyeSeated: UNIC.regular.eye, eyeZ: 0.1, depth: 0.52 },
  recliner: { eyeSeated: UNIC.recliner.eye, eyeZ: 0.2, depth: 0.64 },
};

export const STAND_EYE = 1.6;
const CROSS_DEPTH = 1.6;
const LAST_ROW_EXTRA = 0.2;
const WALKABLE = 0.8;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const deg = (r) => (r * 180) / Math.PI;

export function buildLayout(studio) {
  const sw = studio.seatWidth;
  const pitch = studio.rowPitch;
  const spec = SEAT_SPEC[studio.seat] || SEAT_SPEC.regular;
  const nAisles = studio.blocks.length - 1;
  const aisleW = Array.isArray(studio.aisleWidth)
    ? studio.blocks.slice(1).map((_, i) => studio.aisleWidth[i] ?? studio.aisleWidth.at(-1))
    : new Array(nAisles).fill(studio.aisleWidth);

  const seatsW = studio.blocks.reduce((a, b) => a + b, 0) * sw + aisleW.reduce((a, b) => a + b, 0);
  const halfSeats = seatsW / 2;
  const halfW = halfSeats + studio.sideAisle;

  // Batas tiap blok (x awal & akhir)
  const blockSpans = [];
  let cursor = -halfSeats;
  studio.blocks.forEach((n, k) => {
    blockSpans.push({ x0: cursor, x1: cursor + n * sw, n });
    cursor += n * sw + (aisleW[k] || 0);
  });

  // Lorong
  const aisles = [
    { x: -halfSeats - studio.sideAisle / 2, width: studio.sideAisle, kind: 'side' },
  ];
  aisleW.forEach((w, k) => {
    aisles.push({ x: blockSpans[k].x1 + w / 2, width: w, kind: 'inner' });
  });
  aisles.push({ x: halfSeats + studio.sideAisle / 2, width: studio.sideAisle, kind: 'side' });
  aisles.forEach((a) => (a.walkable = a.width >= WALKABLE));

  const rowLetters = studio.rows.split('');
  const rows = rowLetters.map((letter, i) => ({
    letter,
    index: i,
    z: studio.firstRow + i * pitch,
    floor: studio.floors ? studio.floors[i] : Math.max(0, i - (studio.flatRows - 1)) * studio.riser,
    seats: [],
  }));

  // jumlah kolom penuh (untuk penomoran tetap per posisi)
  const slotBase = [];
  let totalSlots = 0;
  blockSpans.forEach((span) => {
    slotBase.push(totalSlots);
    totalSlots += span.n;
  });

  const seats = [];
  rows.forEach((row) => {
    const counts = studio.rowBlocks?.[row.letter] || studio.blocks;
    const rowSeats = [];
    counts.forEach((n, k) => {
      const span = blockSpans[k];
      if (!span || n <= 0) return;
      const nn = Math.min(n, span.n);
      // blok kiri rapat ke lorong kanan, blok kanan rapat ke lorong kiri, tengah di tengah
      let offset = ((span.n - nn) * sw) / 2;
      if (counts.length > 1 && k === 0) offset = (span.n - nn) * sw;
      if (counts.length > 1 && k === counts.length - 1) offset = 0;
      const firstSlot = slotBase[k] + Math.round(offset / sw);
      for (let j = 0; j < nn; j++) {
        rowSeats.push({ x: span.x0 + offset + (j + 0.5) * sw, slot: firstSlot + j, block: k, edgeLeft: j === 0, edgeRight: j === nn - 1 });
      }
    });
    const N = studio.fixedNumbers ? totalSlots : rowSeats.length;
    rowSeats.forEach((s, idx) => {
      const pos = studio.fixedNumbers ? s.slot : idx;
      const num = studio.numbering === 'rtl' ? N - pos : pos + 1;
      const seat = {
        id: `${row.letter}${num}`,
        row: row.letter,
        rowIndex: row.index,
        num,
        idx,
        x: s.x,
        z: row.z,
        floor: row.floor,
        block: s.block,
        edgeLeft: s.edgeLeft,
        edgeRight: s.edgeRight,
        eye: { x: s.x, y: row.floor + spec.eyeSeated, z: row.z + spec.eyeZ },
      };
      row.seats.push(seat);
      seats.push(seat);
    });
  });

  const last = rows[rows.length - 1];
  const frontEdge = rows[0].z - pitch / 2;
  const ent = studio.entrance || { side: 'left', end: 'back' };
  // pintu belakang butuh lorong melintang di belakang baris terakhir; tanpa itu
  // dinding belakang hanya 150–200 mm di belakang baris terakhir (UNIC §7.1.2)
  const backGap = ent.end === 'back' ? CROSS_DEPTH : LAST_ROW_EXTRA;
  const crossZ = last.z + pitch / 2 + backGap / 2;
  const backZ = last.z + pitch / 2 + backGap;
  const scr = studio.screen;
  const ceil = Math.max(scr.bottom + scr.height + 1.5, last.floor + 3.3);

  const doorSide = ent.side === 'right' ? 1 : -1;
  const door =
    ent.end === 'front'
      ? { x: doorSide * halfW, z: Math.max(1.2, frontEdge * 0.55), y: 0, side: doorSide, end: 'front', width: 1.3 }
      : { x: doorSide * halfW, z: crossZ, y: last.floor, side: doorSide, end: 'back', width: 1.3 };

  const layout = {
    studio,
    spec,
    seats,
    rows,
    aisles,
    blockSpans,
    byId: new Map(seats.map((s) => [s.id, s])),
    room: { halfW, width: halfW * 2, backZ, crossZ, frontEdge, ceil, seatsHalf: halfSeats },
    screen: { ...scr, cy: scr.bottom + scr.height / 2, top: scr.bottom + scr.height },
    door,
    // Titik acuan S (SMPTE ST 202:2010, Gambar 4): 2/3 panjang ruangan dari
    // layar, di tengah. Di titik inilah sistem suara bioskop diukur & disetel.
    ref: { x: 0, z: (2 / 3) * backZ },
  };

  // lantai dengan transisi tangga yang halus (untuk jalan)
  layout.floorAt = (z, soft = 0.1) => {
    let y = 0;
    let prev = 0;
    for (const r of rows) {
      const b = r.z - pitch / 2;
      if (r.floor !== prev) y += (r.floor - prev) * smooth(b - soft, b + soft, z);
      prev = r.floor;
    }
    return y;
  };

  seats.forEach((s) => {
    s.m = metrics(s, layout);
    s.m.grade = grade(s.m);
    // skor (untuk peta warna & urutan rekomendasi) = kedekatan ke titik acuan S;
    // kursi di luar batas UNIC/THX selalu diberi skor rendah
    if (['close', 'side', 'far'].includes(s.m.grade.key)) s.m.score = Math.min(s.m.score, 20);
  });
  return layout;
}

export function metrics(seat, layout) {
  const { screen } = layout;
  const e = seat.eye;
  const d = e.z;
  const W = screen.width;
  const hfov = deg(Math.atan((W / 2 - e.x) / d) + Math.atan((W / 2 + e.x) / d));
  const vCenter = deg(Math.atan((screen.cy - e.y) / d));
  const vTop = deg(Math.atan((screen.top - e.y) / d));
  const vBottom = deg(Math.atan((screen.bottom - e.y) / d));
  const off = deg(Math.atan(e.x / d));
  const dist = Math.hypot(d, e.x, screen.cy - e.y);

  // jarak (mendatar) ke titik acuan S, dalam meter dan dalam jumlah baris
  const { ref, room, studio } = layout;
  const refDist = Math.hypot(e.x - ref.x, e.z - ref.z);
  const refRows = refDist / studio.rowPitch;
  const score = Math.round(100 * Math.exp(-((refDist / (room.backZ / 3)) ** 2)));

  return { d, hfov, vCenter, vTop, vBottom, off, offX: e.x, dist, refDist, refRows, score };
}

// Label kursi, masing-masing berdasarkan sumber:
//  - UNIC §6.1: layar > 80° pandangan → terlalu dekat
//  - UNIC §6.3: sudut ke tengah layar ≥ 25° → terlalu dekat (mendongak)
//  - UNIC §6.2: sudut miring ke tengah layar > 35° (di atas 45° tidak layak)
//  - THX: layar < 26° pandangan berada di bawah batas minimum
//  - SMPTE ST 202: titik acuan S di 2/3 panjang ruangan, di tengah
function grade(m) {
  if (m.hfov > 80 || m.vCenter >= 25) return { key: 'close', label: 'Terlalu dekat' };
  if (Math.abs(m.off) > 35) return { key: 'side', label: 'Sudut miring' };
  if (m.hfov < 26) return { key: 'far', label: 'Terlalu jauh' };
  if (m.refRows <= 1) return { key: 'sweet', label: 'Titik terbaik' };
  if (m.refRows <= 2) return { key: 'great', label: 'Dekat titik terbaik' };
  return { key: 'good', label: 'Sesuai standar' };
}

// ───────── format ─────────
const nf1 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const fmt1 = (n) => nf1.format(n);
export const fmtRp = (n) => 'Rp' + new Intl.NumberFormat('id-ID').format(n);

export function offsetText(m) {
  const a = Math.abs(m.offX);
  if (a < 0.15) return { value: 'Tengah', label: 'lurus dengan layar' };
  return { value: `${fmt1(a)} m`, label: m.offX > 0 ? 'kanan dari tengah' : 'kiri dari tengah' };
}

export function describe(m) {
  const parts = [];
  const f = Math.round(m.hfov);
  if (m.hfov > 80) parts.push(`Layar memenuhi ${f}° pandangan, melebihi batas nyaman 80° (UNIC); perlu menoleh untuk melihat tepinya.`);
  else if (m.hfov >= 26) parts.push(`Layar mengisi ${f}° pandangan; seluruh layar terlihat tanpa menoleh.`);
  else parts.push(`Layar hanya mengisi ${f}° pandangan, di bawah batas minimum 26° (THX).`);

  if (m.vCenter >= 25) parts.push(`Sudut ke tengah layar ${Math.round(m.vCenter)}°, melebihi batas 25° (UNIC): kepala mendongak.`);
  else if (Math.abs(m.off) > 35) parts.push(`Sudut ${Math.round(Math.abs(m.off))}° dari samping, melebihi batas 35° (UNIC): gambar terlihat miring.`);

  if (m.refRows <= 1) parts.push('Kursi ini dekat titik acuan suara (2/3 panjang ruangan, di tengah), tempat sistem suara bioskop disetel (SMPTE ST 202).');
  else parts.push(`Berjarak ${fmt1(m.refDist)} m dari titik acuan suara (2/3 panjang ruangan, di tengah).`);
  return parts.join(' ');
}

// ───────── jalur jalan ─────────
export function walkPath(layout, seat, { toLane = false } = {}) {
  const { door, aisles, rows, studio, spec } = layout;
  const row = rows[seat.rowIndex];
  const pitch = studio.rowPitch;
  const seatFront = row.z - spec.depth / 2;
  const laneZ = (row.z - pitch / 2 + seatFront) / 2 + 0.02;

  const walk = aisles.filter((a) => a.walkable);
  let aisle = walk[0];
  let bestCost = Infinity;
  for (const a of walk) {
    // melewati kursi lebih "mahal" daripada jalan di lorong
    const cost = Math.abs(a.x - seat.x) * 1.6 + Math.abs(a.x - door.x) * 0.35;
    if (cost < bestCost) {
      bestCost = cost;
      aisle = a;
    }
  }

  const inX = door.x - door.side * 0.25;
  const pts = [
    { x: inX, z: door.z },
    { x: aisle.x, z: door.z },
    { x: aisle.x, z: laneZ },
    { x: seat.x, z: laneZ },
    { x: seat.x, z: seat.eye.z },
  ];
  // tokoh berhenti di depan kursi, lalu duduk dengan animasi sendiri
  if (toLane) pts.pop();
  return { points: fillet(dedupe(pts)), raw: pts, aisle, laneZ };
}

function dedupe(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    const q = out[out.length - 1];
    if (Math.hypot(p.x - q.x, p.z - q.z) > 0.05) out.push(p);
  }
  // buang titik segaris
  const res = [out[0]];
  for (let i = 1; i < out.length - 1; i++) {
    const a = res[res.length - 1], b = out[i], c = out[i + 1];
    const cross = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x);
    if (Math.abs(cross) > 1e-4) res.push(b);
  }
  if (out.length > 1) res.push(out[out.length - 1]);
  return res;
}

function fillet(pts) {
  if (pts.length < 3) return pts.slice();
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const lab = Math.hypot(a.x - b.x, a.z - b.z);
    const lbc = Math.hypot(c.x - b.x, c.z - b.z);
    const r = Math.min(0.75, lab / 2, lbc / 2);
    const p1 = { x: b.x + ((a.x - b.x) / lab) * r, z: b.z + ((a.z - b.z) / lab) * r };
    const p2 = { x: b.x + ((c.x - b.x) / lbc) * r, z: b.z + ((c.z - b.z) / lbc) * r };
    const N = 10;
    for (let k = 0; k <= N; k++) {
      const t = k / N, u = 1 - t;
      out.push({
        x: u * u * p1.x + 2 * u * t * b.x + t * t * p2.x,
        z: u * u * p1.z + 2 * u * t * b.z + t * t * p2.z,
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// polyline dengan parameter panjang
export function polyline(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
  }
  const length = cum[cum.length - 1];
  const at = (s) => {
    s = Math.min(length, Math.max(0, s));
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid; else hi = mid;
    }
    const seg = cum[hi] - cum[lo] || 1;
    const t = (s - cum[lo]) / seg;
    const a = points[lo], b = points[hi];
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dx: (b.x - a.x) / seg, dz: (b.z - a.z) / seg };
  };
  return { points, length, at };
}
