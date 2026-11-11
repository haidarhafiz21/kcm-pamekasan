import { STUDIOS, CINEMA } from './studios.js';
import { buildLayout, fmt1, fmtRp, offsetText, describe } from './layout.js';

const $ = (id) => document.getElementById(id);
const SVGNS = 'http://www.w3.org/2000/svg';
const html = document.documentElement;

const el = {
  tabs: $('tabs'),
  studioName: $('studioName'),
  studioMeta: $('studioMeta'),
  heat: $('heatToggle'),
  mapCard: document.querySelector('.map-card'),
  scroll: $('mapScroll'),
  map: $('map'),
  labelsL: $('labelsL'),
  labelsR: $('labelsR'),
  preview: $('preview'),
  best: $('bestChips'),
  viewer: $('viewer'),
  canvas: $('scene'),
  fade: $('vFade'),
  fallback: $('vFallback'),
  pill: $('vPill'),
  walk: $('vWalk'),
  walkMini: $('walkMini'),
  walkText: $('walkText'),
  skip: $('vSkip'),
  hint: $('vHint'),
  sheet: $('sheet'),
  grab: $('grab'),
  sGrade: $('sGrade'),
  sTitle: $('sTitle'),
  sSub: $('sSub'),
  sheetMini: $('sheetMini'),
  stDist: $('stDist'),
  stFov: $('stFov'),
  stOff: $('stOff'),
  stOffL: $('stOffL'),
  note: $('sNote'),
  prev: $('prevSeat'),
  next: $('nextSeat'),
  back: $('vBack'),
  change: $('vChange'),
  share: $('vShare'),
  toast: $('toast'),
};

const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* abaikan */
    }
  },
};

const layouts = new Map();
const getLayout = (i) => {
  if (!layouts.has(i)) layouts.set(i, buildLayout(STUDIOS[i]));
  return layouts.get(i);
};

const state = {
  idx: 0,
  L: null,
  heat: store.get('kcm-heat') === '1',
  hover: null,
  unit: 0,
  open: false,
  pushed: false,
  current: null,
  seated: false,
  hintShown: false,
  shown: null,
};

// ───────── util ─────────
const seatCount = (i) => getLayout(i).seats.length;
const hashFor = (L, seat) => `#/${L.studio.id}/${seat.id}`;
function parseHash() {
  const m = location.hash.match(/^#\/([\w-]+)(?:\/([A-Z]\d+))?/i);
  if (!m) return null;
  const idx = STUDIOS.findIndex((s) => s.id === m[1]);
  if (idx < 0) return null;
  return { idx, seatId: m[2] ? m[2].toUpperCase() : null };
}

const HEAT = [
  [0, [43, 37, 35]],
  [45, [109, 58, 38]],
  [75, [184, 116, 46]],
  [100, [241, 192, 98]],
];
function heatColor(score) {
  for (let i = 1; i < HEAT.length; i++) {
    if (score <= HEAT[i][0]) {
      const [a, ca] = HEAT[i - 1];
      const [b, cb] = HEAT[i];
      const t = (score - a) / (b - a);
      return `rgb(${ca.map((v, k) => Math.round(v + (cb[k] - v) * t)).join(',')})`;
    }
  }
  return 'rgb(241,192,98)';
}

let toastTimer;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
}

function svg(tag, attrs = {}, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

const subtitle = (st) => `${st.name} · ${st.type}${st.price ? ' · ' + fmtRp(st.price) : ''}`;
const bestSeats = (L, n = 6) =>
  [...L.seats].sort((a, b) => b.m.score - a.m.score || Math.abs(a.x) - Math.abs(b.x)).slice(0, n);

// ───────── tab studio ─────────
function renderTabs() {
  el.tabs.innerHTML = '';
  STUDIOS.forEach((st, i) => {
    const b = document.createElement('button');
    b.className = 'tab';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(i === state.idx));
    b.innerHTML = `<b>${st.name}</b><span>${st.type} · ${seatCount(i)} kursi</span>`;
    b.addEventListener('click', () => selectStudio(i));
    el.tabs.appendChild(b);
  });
}

function selectStudio(i, { instant = false } = {}) {
  if (i === state.idx && state.L) return;
  state.idx = i;
  state.L = getLayout(i);
  state.hover = null;
  [...el.tabs.children].forEach((b, k) => b.setAttribute('aria-selected', String(k === i)));
  const st = state.L.studio;
  el.studioName.textContent = st.name;
  const sc = st.screen;
  el.studioMeta.textContent = `${st.type} · ${state.L.seats.length} kursi · layar ${fmt1(sc.width)} m`;
  const apply = () => {
    renderMap(true);
    renderBest();
    setPreview(bestSeats(state.L, 1)[0], 'Rekomendasi');
  };
  if (instant) apply();
  else {
    el.map.classList.add('swap');
    setTimeout(() => {
      apply();
      requestAnimationFrame(() => el.map.classList.remove('swap'));
    }, 180);
  }
}

// ───────── peta kursi ─────────
const Z_MIN = -0.45;
function unitFor(L) {
  const avail = el.scroll.clientWidth || 600;
  const minU = 21 / L.studio.seatWidth;
  return Math.max(minU, Math.min(44, avail / L.room.width));
}

function renderMap(recenter = false) {
  const L = state.L;
  const u = unitFor(L);
  state.unit = u;
  const { room, screen, door, rows, spec, studio } = L;
  const X = (x) => (x + room.halfW) * u;
  const Y = (z) => (z - Z_MIN) * u;
  const W = room.width * u;
  const H = (room.backZ - Z_MIN + 0.1) * u;

  el.map.innerHTML = '';
  el.map.style.width = `${W}px`;
  el.map.style.height = `${H}px`;
  el.map.classList.toggle('heat', state.heat);

  // denah dasar
  const plan = svg('svg', { class: 'plan', width: W, height: H, viewBox: `0 0 ${W} ${H}` }, el.map);
  const wall = { stroke: '#34302d', 'stroke-width': 1.5, fill: 'none', 'stroke-linecap': 'round' };
  const dz0 = Y(door.z - door.width / 2);
  const dz1 = Y(door.z + door.width / 2);
  for (const side of [-1, 1]) {
    const x = side < 0 ? 0.75 : W - 0.75;
    if (door.side === side) {
      svg('path', { d: `M${x} ${Y(Z_MIN)} V${dz0} M${x} ${dz1} V${Y(room.backZ)}`, ...wall }, plan);
      const tx = side < 0 ? 8 : W - 8;
      const t = svg('text', { x: tx, y: (dz0 + dz1) / 2 + 4, 'text-anchor': side < 0 ? 'start' : 'end', fill: '#8f8983', 'font-size': 11, 'font-weight': 500 }, plan);
      t.textContent = 'Pintu';
    } else {
      svg('path', { d: `M${x} ${Y(Z_MIN)} V${Y(room.backZ)}`, ...wall }, plan);
    }
  }
  svg('path', { d: `M0.75 ${Y(room.backZ)} H${W - 0.75}`, ...wall }, plan);

  // undakan
  rows.forEach((r, i) => {
    const prev = i ? rows[i - 1].floor : 0;
    if (r.floor > prev + 0.001) {
      const y = Y(r.z - studio.rowPitch / 2);
      svg('line', { x1: 6, x2: W - 6, y1: y, y2: y, stroke: '#211f1d', 'stroke-width': 1, 'stroke-dasharray': '2 4' }, plan);
    }
  });

  // layar
  const sx0 = X(-screen.width / 2);
  const sx1 = X(screen.width / 2);
  const sy = Y(0);
  const curve = `M${sx0} ${sy + 4} Q${(sx0 + sx1) / 2} ${sy - 6} ${sx1} ${sy + 4}`;
  svg('path', { d: curve, stroke: '#e9b35a', 'stroke-opacity': 0.18, 'stroke-width': 12, fill: 'none', 'stroke-linecap': 'round' }, plan);
  svg('path', { d: curve, stroke: '#f0ebe4', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, plan);
  const lt = svg('text', { x: W / 2, y: sy + 26, 'text-anchor': 'middle', fill: '#5e5853', 'font-size': 10.5, 'letter-spacing': '0.24em', 'font-weight': 600 }, plan);
  lt.textContent = `LAYAR · ${fmt1(screen.width)} M`;

  // kursi
  const sw = studio.seatWidth * u;
  const d = Math.max(12, spec.depth * u * 0.86);
  const frag = document.createDocumentFragment();
  L.seats.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'seat' + (s.m.grade.key === 'sweet' ? ' best' : '');
    b.dataset.i = i;
    b.style.left = `${X(s.x) - sw / 2 + 1.5}px`;
    b.style.top = `${Y(s.z) - d / 2}px`;
    b.style.width = `${sw - 3}px`;
    b.style.height = `${d}px`;
    if (state.heat) b.style.setProperty('--c', heatColor(s.m.score));
    b.setAttribute('aria-label', `Baris ${s.row} kursi ${s.num}, ${s.m.grade.label}, ${fmt1(s.m.d)} meter ke layar`);
    frag.appendChild(b);
  });
  el.map.appendChild(frag);

  // label baris
  for (const [box, side] of [
    [el.labelsL, 0],
    [el.labelsR, 1],
  ]) {
    box.innerHTML = '';
    box.style.height = `${H}px`;
    rows.forEach((r) => {
      if (!r.seats.length) return;
      const s = document.createElement('span');
      s.textContent = r.letter;
      s.style.top = `${Y(r.z)}px`;
      box.appendChild(s);
    });
    void side;
  }

  el.mapCard.classList.toggle('heat-on', state.heat);
  requestAnimationFrame(() => {
    const over = el.scroll.scrollWidth - el.scroll.clientWidth;
    el.mapCard.classList.toggle('scrollable', over > 2);
    if (recenter) el.scroll.scrollLeft = over / 2;
  });
}

function seatFromEvent(e) {
  const b = e.target.closest?.('.seat');
  if (!b || !el.map.contains(b)) return null;
  return state.L.seats[+b.dataset.i] || null;
}

function bindMap() {
  el.map.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const s = seatFromEvent(e);
    if (s) setPreview(s, 'Arahkan kursor ke kursi');
  });
  el.map.addEventListener('focusin', (e) => {
    const s = seatFromEvent(e);
    if (s) setPreview(s, 'Kursi dipilih');
  });
  el.map.addEventListener('click', (e) => {
    const s = seatFromEvent(e);
    if (s) openSeat(s);
  });
  el.heat.addEventListener('click', () => {
    state.heat = !state.heat;
    store.set('kcm-heat', state.heat ? '1' : '0');
    el.heat.setAttribute('aria-checked', String(state.heat));
    el.map.classList.toggle('heat', state.heat);
    el.mapCard.classList.toggle('heat-on', state.heat);
    el.map.querySelectorAll('.seat').forEach((b) => {
      const s = state.L.seats[+b.dataset.i];
      if (state.heat) b.style.setProperty('--c', heatColor(s.m.score));
      else b.style.removeProperty('--c');
    });
  });

  let raf = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (!state.L) return;
      const u = unitFor(state.L);
      if (Math.abs(u - state.unit) > 0.25) renderMap(true);
    });
  }).observe(el.scroll);
}

// ───────── panel samping ─────────
function sectionSvg(L, seat) {
  const k = 20;
  const { room, rows, screen, studio } = L;
  const zf = Z_MIN;
  const Wd = (room.backZ - zf) * k;
  const Hd = room.ceil * k;
  const X = (z) => (z - zf) * k;
  const Y = (y) => (room.ceil - y) * k;
  const root = svg('svg', { class: 'section-svg', viewBox: `-4 -4 ${Wd + 8} ${Hd + 8}`, role: 'img', 'aria-label': `Potongan samping studio, garis pandang dari baris ${seat.row}` });
  let d = `M${X(zf)} ${Y(0)} L${X(room.frontEdge)} ${Y(0)}`;
  let prev = 0;
  rows.forEach((r) => {
    const zb = r.z - studio.rowPitch / 2;
    d += ` L${X(zb)} ${Y(prev)} L${X(zb)} ${Y(r.floor)}`;
    prev = r.floor;
  });
  d += ` L${X(room.backZ)} ${Y(prev)} L${X(room.backZ)} ${Y(0)} Z`;
  svg('path', { d, fill: '#1f1d1b' }, root);
  svg('rect', { x: X(zf), y: Y(room.ceil), width: Wd, height: Hd, fill: 'none', stroke: '#272422' }, root);
  rows.forEach((r) => {
    const on = r.index === seat.rowIndex;
    svg('rect', { x: X(r.z) - 4, y: Y(r.floor + 0.5), width: 9, height: 4, rx: 1.5, fill: on ? '#e9b35a' : '#4a2025' }, root);
    svg('rect', { x: X(r.z) + 3, y: Y(r.floor + 1.05), width: 3, height: 11, rx: 1.5, fill: on ? '#e9b35a' : '#4a2025' }, root);
  });
  const e = seat.eye;
  const ex = X(e.z);
  const ey = Y(e.y);
  svg('polygon', { points: `${ex},${ey} ${X(0)},${Y(screen.top)} ${X(0)},${Y(screen.bottom)}`, fill: '#e9b35a', 'fill-opacity': 0.12 }, root);
  svg('line', { x1: ex, y1: ey, x2: X(0), y2: Y(screen.top), stroke: '#e9b35a', 'stroke-opacity': 0.7, 'stroke-width': 1 }, root);
  svg('line', { x1: ex, y1: ey, x2: X(0), y2: Y(screen.bottom), stroke: '#e9b35a', 'stroke-opacity': 0.7, 'stroke-width': 1 }, root);
  svg('line', { x1: X(0), y1: Y(screen.bottom), x2: X(0), y2: Y(screen.top), stroke: '#f0ebe4', 'stroke-width': 3, 'stroke-linecap': 'round' }, root);
  svg('circle', { cx: ex, cy: ey, r: 3.5, fill: '#e9b35a' }, root);
  return root;
}

function statHtml(m) {
  const off = offsetText(m);
  return `
    <div class="stat"><b>${fmt1(m.d)} m</b><span>ke layar</span></div>
    <div class="stat"><b>${Math.round(m.hfov)}°</b><span>luas pandangan</span></div>
    <div class="stat"><b>${off.value}</b><span>${off.label}</span></div>`;
}

function setPreview(seat, kicker) {
  if (!seat || state.hover === seat) return;
  state.hover = seat;
  el.map.querySelectorAll('.seat.is-hover').forEach((b) => b.classList.remove('is-hover'));
  const m = seat.m;
  el.preview.innerHTML = `
    <p class="pv-kicker">${kicker}</p>
    <div class="pv-id"><h3>${seat.id}</h3><span class="grade ${m.grade.key}">${m.grade.label}</span></div>
    <div class="stats">${statHtml(m)}</div>`;
  el.preview.appendChild(sectionSvg(state.L, seat));
  const cap = document.createElement('p');
  cap.className = 'pv-cap';
  cap.textContent = 'Potongan samping — garis pandang dari mata ke layar';
  const note = document.createElement('p');
  note.className = 'pv-note';
  note.textContent = describe(m);
  const btn = document.createElement('button');
  btn.className = 'btn solid pv-cta';
  btn.textContent = `Lihat dari kursi ${seat.id}`;
  btn.addEventListener('click', () => openSeat(seat));
  el.preview.append(cap, note, btn);
}

function renderBest() {
  el.best.innerHTML = '';
  bestSeats(state.L).forEach((s) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = s.id;
    b.addEventListener('click', () => openSeat(s));
    b.addEventListener('mouseenter', () => setPreview(s, 'Rekomendasi'));
    el.best.appendChild(b);
  });
}

// ───────── mini map ─────────
function drawMini(root, L, seat, path) {
  root.innerHTML = '';
  const { room, screen, studio, spec } = L;
  const pad = 0.35;
  root.setAttribute('viewBox', `${-room.halfW - pad} ${Z_MIN - pad} ${room.width + pad * 2} ${room.backZ - Z_MIN + pad * 2}`);
  svg('rect', { x: -room.halfW, y: Z_MIN, width: room.width, height: room.backZ - Z_MIN, rx: 0.4, fill: '#161514', stroke: '#2c2927', 'stroke-width': 0.08 }, root);
  svg('line', { x1: -screen.width / 2, x2: screen.width / 2, y1: 0.1, y2: 0.1, stroke: '#f0ebe4', 'stroke-width': 0.28, 'stroke-linecap': 'round' }, root);
  const sw = studio.seatWidth * 0.78;
  const dd = spec.depth * 0.8;
  const g = svg('g', {}, root);
  for (const s of L.seats) {
    const on = s === seat;
    svg('rect', { x: s.x - sw / 2, y: s.z - dd / 2, width: sw, height: dd, rx: 0.08, fill: on ? '#e9b35a' : s.m.grade.key === 'sweet' ? '#6e3a2a' : '#45201f', 'data-id': s.id }, g);
  }
  if (path) {
    const pts = path.map((p) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`).join(' ');
    svg('polyline', { points: pts, fill: 'none', stroke: '#f0ebe4', 'stroke-opacity': 0.18, 'stroke-width': 0.14, 'stroke-linejoin': 'round' }, root);
    root._trail = svg('polyline', { points: pts, fill: 'none', stroke: '#e9b35a', 'stroke-width': 0.16, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, root);
    const w = svg('g', { transform: `translate(${path[0].x} ${path[0].z})` }, root);
    svg('circle', { r: 0.55, fill: '#e9b35a', 'fill-opacity': 0.18 }, w);
    svg('path', { d: 'M0 -0.62 L0.34 0.12 L-0.34 0.12 Z', fill: '#f0ebe4' }, w);
    svg('circle', { r: 0.2, fill: '#e9b35a' }, w);
    root._walker = w;
  } else {
    root._trail = root._walker = null;
  }
}

function setMiniSeat(root, seat) {
  root.querySelectorAll('rect[data-id]').forEach((r) => {
    const s = state.L.byId.get(r.getAttribute('data-id'));
    r.setAttribute('fill', s === seat ? '#e9b35a' : s.m.grade.key === 'sweet' ? '#6e3a2a' : '#45201f');
  });
}

// ───────── viewer ─────────
let viewerMod = null;
let viewer = null;
let viewerFailed = false;
const loadViewer = () => (viewerMod ||= import('./viewer.js'));

async function ensureViewer() {
  if (viewer) return viewer;
  if (viewerFailed) return null;
  try {
    const mod = await loadViewer();
    viewer = new mod.SeatViewer(el.canvas, {
      onWalk: ({ x, z, yaw, progress }) => {
        const w = el.walkMini._walker;
        if (w) w.setAttribute('transform', `translate(${x.toFixed(3)} ${z.toFixed(3)}) rotate(${((-yaw * 180) / Math.PI).toFixed(1)})`);
        if (el.walkMini._trail) el.walkMini._trail.setAttribute('stroke-dashoffset', (1 - progress).toFixed(4));
      },
      onSeated: () => onSeated(),
      onLook: () => hideHint(),
    });
  } catch (err) {
    console.warn('Tampilan 3D tidak tersedia:', err);
    viewerFailed = true;
    viewerMod = null;
    return null;
  }
  return viewer;
}

let hintTimer;
function hideHint() {
  el.hint.classList.remove('show');
  clearTimeout(hintTimer);
}

function showSheet() {
  el.sheet.classList.add('up');
  el.sheet.classList.remove('collapsed');
  updateInset();
}

function updateInset() {
  if (!viewer || !state.open) return;
  if (!el.sheet.classList.contains('up')) return viewer.setInset(0);
  const h = el.sheet.offsetHeight;
  const collapsed = el.sheet.classList.contains('collapsed');
  const head = el.grab.offsetHeight + el.sheet.querySelector('.sheet-head').offsetHeight + 8;
  const by = Math.max(0, h - head);
  el.sheet.style.setProperty('--collapse', `${by}px`);
  viewer.setInset(collapsed ? h - by : h);
}

function onSeated() {
  if (!state.open) return;
  state.seated = true;
  el.walk.classList.add('gone');
  if (!el.sheet.classList.contains('up')) showSheet();
  updateNav();
  if (!state.hintShown) {
    state.hintShown = true;
    setTimeout(() => {
      if (!state.open) return;
      el.hint.classList.add('show');
      hintTimer = setTimeout(hideHint, 3200);
    }, 700);
  }
}

const tweens = new WeakMap();
function tween(node, from, to, format, ms = 520) {
  cancelAnimationFrame(tweens.get(node));
  if (from == null || from === to) {
    node.textContent = format(to);
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - t, 3);
    node.textContent = format(from + (to - from) * e);
    if (t < 1) tweens.set(node, requestAnimationFrame(step));
  };
  tweens.set(node, requestAnimationFrame(step));
}

function fillSheet(seat, animate) {
  const L = state.L;
  const m = seat.m;
  const prev = animate ? state.shown : null;
  state.shown = m;
  el.pill.textContent = `Tampilan dari ${seat.id}`;
  el.sGrade.textContent = m.grade.label;
  el.sGrade.className = `grade ${m.grade.key}`;
  el.sTitle.textContent = `Baris ${seat.row}, Kursi ${seat.num}`;
  el.sSub.textContent = subtitle(L.studio);
  tween(el.stDist, prev?.d, m.d, (v) => `${fmt1(v)} m`);
  tween(el.stFov, prev?.hfov, m.hfov, (v) => `${Math.round(v)}°`);
  const off = offsetText(m);
  const prevOff = prev ? offsetText(prev) : null;
  el.stOffL.textContent = off.label;
  if (prevOff && off.value !== 'Tengah' && prevOff.value !== 'Tengah') {
    tween(el.stOff, Math.abs(prev.offX), Math.abs(m.offX), (v) => `${fmt1(v)} m`);
  } else {
    cancelAnimationFrame(tweens.get(el.stOff));
    el.stOff.textContent = off.value;
  }
  el.note.textContent = describe(m);
  setMiniSeat(el.sheetMini, seat);
  updateNav();
}

function neighbor(seat, dir) {
  return state.L.rows[seat.rowIndex].seats[seat.idx + dir] || null;
}
function rowNeighbor(seat, dr) {
  const r = state.L.rows[seat.rowIndex + dr];
  if (!r || !r.seats.length) return null;
  return r.seats.reduce((a, b) => (Math.abs(b.x - seat.x) < Math.abs(a.x - seat.x) ? b : a));
}
function updateNav() {
  const s = state.current;
  if (!s) return;
  el.prev.disabled = !neighbor(s, -1);
  el.next.disabled = !neighbor(s, 1);
}

async function openSeat(seat, { fromHash = false } = {}) {
  if (state.open) return;
  const L = state.L;
  state.open = true;
  state.current = seat;
  state.seated = false;
  state.shown = null;

  if (fromHash) state.pushed = false;
  else {
    history.pushState({ kcmSeat: true }, '', hashFor(L, seat));
    state.pushed = true;
  }

  html.classList.add('lock');
  el.viewer.hidden = false;
  el.fade.classList.remove('out');
  el.fallback.hidden = true;
  el.sheet.classList.remove('up', 'collapsed');
  el.walk.classList.remove('gone');
  el.walkText.textContent = `Menuju kursi ${seat.id}`;
  hideHint();
  drawMini(el.sheetMini, L, seat, null);
  drawMini(el.walkMini, L, seat, null);
  fillSheet(seat, false);
  requestAnimationFrame(() => el.viewer.classList.add('open'));

  const v = await ensureViewer();
  if (!state.open || state.current !== seat) return;

  if (!v) {
    el.fallback.hidden = false;
    el.fade.classList.add('out');
    el.walk.classList.add('gone');
    showSheet();
    state.seated = true;
    return;
  }

  v.setStudio(L);
  v.inset = 0;
  v.setInset(0);
  const { path } = v.walkTo(seat);
  drawMini(el.walkMini, L, seat, path);
  v.start();
  requestAnimationFrame(() => requestAnimationFrame(() => el.fade.classList.add('out')));
}

function closeViewer({ fromPop = false } = {}) {
  if (!state.open) return;
  state.open = false;
  const seat = state.current;
  el.viewer.classList.remove('open');
  hideHint();
  setTimeout(() => {
    if (state.open) return;
    el.viewer.hidden = true;
    viewer?.stop();
  }, 380);
  html.classList.remove('lock');
  if (!fromPop) {
    if (state.pushed) history.back();
    else history.replaceState(null, '', location.pathname + location.search);
  }
  state.pushed = false;

  if (seat) {
    state.hover = null;
    setPreview(seat, 'Terakhir dilihat');
    const b = el.map.querySelector(`.seat[data-i="${state.L.seats.indexOf(seat)}"]`);
    if (b) {
      b.classList.add('is-current');
      setTimeout(() => b.classList.remove('is-current'), 1600);
      const r = b.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) b.scrollIntoView({ block: 'center', behavior: 'instant' });
      const sr = el.scroll.getBoundingClientRect();
      if (r.left < sr.left || r.right > sr.right) el.scroll.scrollLeft += r.left - sr.left - sr.width / 2;
    }
  }
}

function moveTo(seat) {
  if (!seat || !state.open || seat === state.current || !viewer || !state.seated) return;
  state.current = seat;
  viewer.glideTo(seat);
  fillSheet(seat, true);
  history.replaceState(history.state, '', hashFor(state.L, seat));
}

function skipWalk() {
  if (!viewer || !viewer.busyWalking) return;
  viewer.glideTo(state.current, 0.75);
}

async function shareSeat() {
  const seat = state.current;
  if (!seat) return;
  const url = location.href;
  const text = `Aku lihat dari kursi ${seat.id} di ${state.L.studio.name} ${CINEMA.name}.`;
  if (navigator.share) {
    try {
      await navigator.share({ title: `${CINEMA.name} · ${seat.id}`, text, url });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Tautan kursi disalin');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      toast('Tautan kursi disalin');
    } catch {
      toast(url);
    }
    ta.remove();
  }
}

function bindViewer() {
  el.back.addEventListener('click', () => closeViewer());
  el.change.addEventListener('click', () => closeViewer());
  el.share.addEventListener('click', shareSeat);
  el.skip.addEventListener('click', skipWalk);
  el.prev.addEventListener('click', () => moveTo(neighbor(state.current, -1)));
  el.next.addEventListener('click', () => moveTo(neighbor(state.current, 1)));
  el.grab.addEventListener('click', () => {
    el.sheet.classList.toggle('collapsed');
    updateInset();
  });
  el.sheet.querySelector('.sheet-head').addEventListener('click', (e) => {
    if (el.sheet.classList.contains('collapsed') && !e.target.closest('svg')) {
      el.sheet.classList.remove('collapsed');
      updateInset();
    }
  });
  el.sheetMini.addEventListener('click', (e) => {
    const ctm = el.sheetMini.getScreenCTM();
    if (!ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    let best = null;
    let bd = 1.4;
    for (const s of state.L.seats) {
      const dd = Math.hypot(s.x - pt.x, s.z - pt.y);
      if (dd < bd) {
        bd = dd;
        best = s;
      }
    }
    moveTo(best);
  });
  new ResizeObserver(() => updateInset()).observe(el.sheet);

  document.addEventListener('keydown', (e) => {
    if (!state.open) return;
    if (e.key === 'Escape') return closeViewer();
    if (!state.seated) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        skipWalk();
      }
      return;
    }
    const s = state.current;
    const map = { ArrowLeft: () => neighbor(s, -1), ArrowRight: () => neighbor(s, 1), ArrowUp: () => rowNeighbor(s, -1), ArrowDown: () => rowNeighbor(s, 1) };
    if (map[e.key]) {
      e.preventDefault();
      moveTo(map[e.key]());
    }
  });

  window.addEventListener('popstate', () => {
    const h = parseHash();
    if (state.open && !(h && h.seatId)) closeViewer({ fromPop: true });
    else if (!state.open && h && h.seatId) {
      if (h.idx !== state.idx) selectStudio(h.idx, { instant: true });
      const seat = state.L.byId.get(h.seatId);
      if (seat) openSeat(seat, { fromHash: true });
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!viewer) return;
    if (document.hidden) viewer.stop();
    else if (state.open) viewer.start();
  });
}

// ───────── mulai ─────────
function init() {
  const h = parseHash();
  state.idx = h ? h.idx : 0;
  state.L = null;
  el.heat.setAttribute('aria-checked', String(state.heat));
  renderTabs();
  bindMap();
  bindViewer();
  const target = state.idx;
  state.idx = -1;
  selectStudio(target, { instant: true });

  if (h && h.seatId) {
    const seat = state.L.byId.get(h.seatId);
    if (seat) openSeat(seat, { fromHash: true });
    else history.replaceState(null, '', location.pathname + location.search);
  }

  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1200));
  idle(() => loadViewer().catch(() => (viewerMod = null)));
}

init();
