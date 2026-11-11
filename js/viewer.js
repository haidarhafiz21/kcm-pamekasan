import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { createFilm } from './film.js';
import { walkPath, polyline, STAND_EYE } from './layout.js';

RectAreaLightUniformsLib.init();

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrap = (a) => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};
const lerpAngle = (a, b, t) => a + wrap(b - a) * t;

function canvasTexture(w, h, paint, repeat = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function makeTextures() {
  const carpet = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#1d1a20';
    g.fillRect(0, 0, w, h);
    let seed = 3;
    const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 10400; i++) {
      const v = r();
      g.fillStyle = v > 0.6 ? 'rgba(90,70,95,0.35)' : 'rgba(0,0,0,0.35)';
      g.fillRect(r() * w, r() * h, 1.4, 1.4);
    }
    // motif garis halus
    g.strokeStyle = 'rgba(140,96,60,0.12)';
    g.lineWidth = 2;
    for (let i = -w; i < w * 2; i += 128) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + h, h);
      g.stroke();
    }
  }, true);
  carpet.anisotropy = 8;

  const glow = canvasTexture(128, 128, (g, w, h) => {
    const rg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
  });

  const exit = canvasTexture(256, 96, (g, w, h) => {
    g.fillStyle = '#062a17';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#5dffa4';
    g.font = '600 50px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('KELUAR', w / 2, h / 2 + 2);
  });

  const lobby = canvasTexture(64, 128, (g, w, h) => {
    const lg = g.createLinearGradient(0, 0, 0, h);
    lg.addColorStop(0, '#5a3b22');
    lg.addColorStop(1, '#c9874a');
    g.fillStyle = lg;
    g.fillRect(0, 0, w, h);
  });

  return { carpet, glow, exit, lobby };
}

function makeMaterials(tex) {
  return {
    carpet: new THREE.MeshStandardMaterial({ map: tex.carpet, roughness: 1 }),
    riser: new THREE.MeshStandardMaterial({ color: 0x141217, roughness: 0.95 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x151417, roughness: 1 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x2c2427, roughness: 1 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 1 }),
    black: new THREE.MeshBasicMaterial({ color: 0x030303 }),
    fabric: new THREE.MeshPhysicalMaterial({
      color: 0x8e121b,
      roughness: 0.8,
      sheen: 1,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color(0xff6a6a),
    }),
    leather: new THREE.MeshPhysicalMaterial({
      color: 0x6a141a,
      roughness: 0.45,
      clearcoat: 0.25,
      clearcoatRoughness: 0.55,
    }),
    seatDark: new THREE.MeshStandardMaterial({ color: 0x1c1517, roughness: 0.65 }),
    led: new THREE.MeshBasicMaterial({ color: 0xffc58a }),
    downlight: new THREE.MeshBasicMaterial({ color: 0x8a6d4c }),
    sconce: new THREE.MeshBasicMaterial({ color: 0xffd2a0 }),
    glow: new THREE.MeshBasicMaterial({
      map: tex.glow,
      color: 0xff9c55,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    exit: new THREE.MeshBasicMaterial({ map: tex.exit }),
    lobby: new THREE.MeshBasicMaterial({ map: tex.lobby }),
    projector: new THREE.MeshBasicMaterial({ color: 0xdfe6ff }),
  };
}

export class SeatViewer {
  constructor(canvas, hooks = {}) {
    this.canvas = canvas;
    this.hooks = hooks;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    // resolusi adaptif: mulai setajam mungkin (maks 2x), turun otomatis bila
    // perangkat tidak sanggup 60 fps, naik lagi bila kembali lancar
    this.prMax = Math.min(window.devicePixelRatio || 1, 2);
    this.prMin = Math.min(1, this.prMax);
    this.pr = this.prMax;
    this.perf = { acc: 0, frames: 0, good: 0, warm: 0 };
    this.renderer.setPixelRatio(this.pr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x040405);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 140);
    this.camera.rotation.order = 'YXZ';

    this.tex = makeTextures();
    this.mat = makeMaterials(this.tex);
    this.film = createFilm(this.renderer);
    this.screenMat = this.film.material;

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.pose = { x: 0, y: 1.6, z: 10, yaw: 0, pitch: 0 };
    this.look = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, idle: 0, drag: null };
    this.inset = 0;
    this.insetTarget = 0;
    this.anim = null;
    this.seat = null;
    this.running = false;
    this.time = 0;
    this.size = { w: 0, h: 0 };
    this.clock = new THREE.Clock(false);

    this._loop = this._loop.bind(this);
    this._bindInput();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(canvas);
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
  }

  // ───────────────────────── scene ─────────────────────────
  setStudio(layout) {
    if (this.layout === layout) return;
    this.layout = layout;
    this.seat = null;
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.root.clear();
    this._build(layout);
  }

  _plane(w, h, mat, pos, rot, uv) {
    const g = new THREE.PlaneGeometry(w, h);
    if (uv) {
      const a = g.attributes.uv;
      for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * w * uv, a.getY(i) * h * uv);
    }
    const m = new THREE.Mesh(g, mat);
    m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    this.root.add(m);
    return m;
  }

  _build(L) {
    const { room, rows, screen, door, aisles, studio, spec } = L;
    const M = this.mat;
    const p = studio.rowPitch;
    const W = room.width;
    const zFront = -0.45;
    const HALF_PI = Math.PI / 2;

    // ── lantai & undakan
    const frontDepth = room.frontEdge - zFront;
    this._plane(W, frontDepth, M.carpet, [0, 0, zFront + frontDepth / 2], [-HALF_PI, 0, 0], 0.45);
    rows.forEach((r, i) => {
      const z0 = r.z - p / 2;
      const z1 = i === rows.length - 1 ? room.backZ : r.z + p / 2;
      this._plane(W, z1 - z0, M.carpet, [0, r.floor, (z0 + z1) / 2], [-HALF_PI, 0, 0], 0.45);
      const prev = i === 0 ? 0 : rows[i - 1].floor;
      if (r.floor > prev + 0.001) {
        const hgt = r.floor - prev;
        this._plane(W, hgt, M.riser, [0, prev + hgt / 2, z0], [0, Math.PI, 0]);
      }
    });

    // anak tangga di lorong + lampu LED
    const walk = aisles.filter((a) => a.walkable);
    const ledGeo = new THREE.BoxGeometry(1, 1, 1);
    const ledMats = [];
    const stepGeo = new THREE.BoxGeometry(1, 1, 1);
    const steps = [];
    rows.forEach((r, i) => {
      const prev = i === 0 ? 0 : rows[i - 1].floor;
      const rise = r.floor - prev;
      if (rise <= 0.001) return;
      const zb = r.z - p / 2;
      for (const a of walk) {
        const half = rise > 0.24;
        if (half) {
          const depth = Math.min(0.45, p * 0.42);
          steps.push({ x: a.x, y: prev + rise / 4, z: zb - depth / 2, sx: a.width, sy: rise / 2, sz: depth });
          ledMats.push({ x: a.x, y: prev + rise / 2 - 0.03, z: zb - depth - 0.006, sx: a.width * 0.78 });
        }
        ledMats.push({ x: a.x, y: r.floor - 0.03, z: zb - 0.006, sx: a.width * 0.78 });
      }
    });
    if (steps.length) {
      const im = new THREE.InstancedMesh(stepGeo, M.carpet, steps.length);
      const o = new THREE.Object3D();
      steps.forEach((s, k) => {
        o.position.set(s.x, s.y, s.z);
        o.scale.set(s.sx, s.sy, s.sz);
        o.updateMatrix();
        im.setMatrixAt(k, o.matrix);
      });
      this.root.add(im);
    }
    if (ledMats.length) {
      const im = new THREE.InstancedMesh(ledGeo, M.led, ledMats.length);
      const o = new THREE.Object3D();
      ledMats.forEach((s, k) => {
        o.position.set(s.x, s.y, s.z);
        o.scale.set(s.sx, 0.018, 0.012);
        o.updateMatrix();
        im.setMatrixAt(k, o.matrix);
      });
      this.root.add(im);
    }

    // ── dinding
    const ceil = room.ceil;
    const depthAll = room.backZ - zFront;
    for (const side of [-1, 1]) {
      const x = side * room.halfW;
      const ry = side < 0 ? HALF_PI : -HALF_PI;
      if (door.side === side) {
        const dz0 = door.z - door.width / 2;
        const dz1 = door.z + door.width / 2;
        const dTop = door.y + 2.3;
        const segs = [
          [zFront, dz0, 0, ceil],
          [dz1, room.backZ, 0, ceil],
          [dz0, dz1, dTop, ceil],
          [dz0, dz1, 0, door.y],
        ];
        for (const [a, b, y0, y1] of segs) {
          if (b - a < 0.01 || y1 - y0 < 0.01) continue;
          this._plane(b - a, y1 - y0, M.wall, [x, (y0 + y1) / 2, (a + b) / 2], [0, ry, 0]);
        }
        // lorong luar (cahaya lobi) & kusen
        this._plane(door.width, 2.3, M.lobby, [x + side * 0.9, door.y + 1.15, door.z], [0, ry, 0]);
        for (const [a, b, y0, y1] of [
          [dz0, dz0, door.y, dTop],
          [dz1, dz1, door.y, dTop],
        ]) {
          const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.9, y1 - y0, 0.04), M.black);
          jamb.position.set(x + side * 0.45, (y0 + y1) / 2, a);
          this.root.add(jamb);
        }
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, door.width), M.black);
        lintel.position.set(x + side * 0.45, dTop, door.z);
        this.root.add(lintel);
        const sign = this._plane(0.62, 0.23, M.exit, [x - side * 0.02, dTop + 0.32, door.z], [0, ry, 0]);
        sign.renderOrder = 1;
      } else {
        this._plane(depthAll, ceil, M.wall, [x, ceil / 2, zFront + depthAll / 2], [0, ry, 0]);
      }

      // panel akustik & lampu dinding
      const panels = [];
      const sconces = [];
      let k = 0;
      for (let z = 1.2; z < room.backZ - 0.7; z += 1.3, k++) {
        if (door.side === side && Math.abs(z - door.z) < door.width / 2 + 0.75) continue;
        const fy = L.floorAt(z, 0.01);
        const y0 = fy + 1.05;
        const y1 = ceil - 0.6;
        if (y1 - y0 > 0.6) panels.push({ z, y0, y1 });
        if (k % 2 === 1) sconces.push({ z: z + 0.65, y: fy + 2.25 });
      }
      if (panels.length) {
        const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.panel, panels.length);
        const o = new THREE.Object3D();
        panels.forEach((pn, j) => {
          o.position.set(x - side * 0.03, (pn.y0 + pn.y1) / 2, pn.z);
          o.scale.set(0.06, pn.y1 - pn.y0, 1.18);
          o.updateMatrix();
          im.setMatrixAt(j, o.matrix);
        });
        this.root.add(im);
      }
      for (const s of sconces) {
        if (s.y > ceil - 0.5) continue;
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.07), M.sconce);
        b.position.set(x - side * 0.07, s.y, s.z);
        this.root.add(b);
        const g = this._plane(1.5, 2.3, M.glow, [x - side * 0.075, s.y, s.z], [0, ry, 0]);
        g.renderOrder = 2;
      }
    }

    // dinding depan, belakang, plafon
    this._plane(W, ceil, M.black, [0, ceil / 2, zFront], null);
    this._plane(W, ceil, M.wall, [0, ceil / 2, room.backZ], [0, Math.PI, 0]);
    this._plane(W, depthAll, M.ceiling, [0, ceil, zFront + depthAll / 2], [HALF_PI, 0, 0]);
    const projPos = new THREE.Vector3(0.6, ceil - 0.95, room.backZ - 0.02);
    this._plane(0.55, 0.32, M.projector, [projPos.x, projPos.y, projPos.z], [0, Math.PI, 0]);

    // lampu plafon kecil
    const dl = [];
    for (let z = 2; z < room.backZ - 0.5; z += 2.4) for (let x = -room.halfW + 1.4; x < room.halfW - 1; x += 2.4) dl.push([x, z]);
    if (dl.length) {
      const im = new THREE.InstancedMesh(new THREE.CircleGeometry(0.07, 16), M.downlight, dl.length);
      const o = new THREE.Object3D();
      o.rotation.x = HALF_PI;
      dl.forEach(([x, z], j) => {
        o.position.set(x, ceil - 0.005, z);
        o.updateMatrix();
        im.setMatrixAt(j, o.matrix);
      });
      this.root.add(im);
    }

    // ── layar
    const mask = this._plane(screen.width + 0.5, screen.height + 0.4, M.black, [0, screen.cy, -0.02], null);
    mask.renderOrder = 0;
    this.screenMesh = this._plane(screen.width, screen.height, this.screenMat, [0, screen.cy, 0], null);

    // berkas cahaya proyektor
    this._beam(projPos, screen);

    // ── kursi
    this._seats(L);

    // ── cahaya
    const area = new THREE.RectAreaLight(0xffd0a8, 5.5, screen.width, screen.height);
    area.position.set(0, screen.cy, 0.05);
    area.lookAt(0, screen.cy, 5);
    this.root.add(area);
    this.areaLight = area;
    const hemi = new THREE.HemisphereLight(0x8a92b0, 0x2a1d18, 0.22);
    this.root.add(hemi);
    const back = new THREE.PointLight(0xffb070, 1.2, 9, 1.6);
    back.position.set(0, ceil - 0.4, room.backZ - 1.2);
    this.root.add(back);
  }

  _beam(apex, screen) {
    const hw = screen.width / 2;
    const corners = [
      [-hw, screen.bottom],
      [hw, screen.bottom],
      [hw, screen.top],
      [-hw, screen.top],
    ];
    const pos = [];
    const fade = [];
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      pos.push(apex.x, apex.y, apex.z, a[0], a[1], 0.03, b[0], b[1], 0.03);
      fade.push(1, 0, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('fade', new THREE.Float32BufferAttribute(fade, 1));
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0xfff0dc) }, uOpacity: { value: 0.022 } },
      vertexShader: 'attribute float fade; varying float vF; void main(){ vF = fade; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying float vF; void main(){ float a = uOpacity * (0.25 + 0.75 * smoothstep(0.0, 1.0, vF)); gl_FragColor = vec4(uColor * a, 1.0); }',
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const m = new THREE.Mesh(g, this.beamMat);
    m.renderOrder = 3;
    this.root.add(m);
  }

  _seats(L) {
    const { seats, rows, studio, blockSpans } = L;
    const sw = studio.seatWidth;
    const rec = studio.seat === 'recliner';
    const M = this.mat;
    const o = new THREE.Object3D();
    const n = seats.length;

    const cushionGeo = rec
      ? new RoundedBoxGeometry(sw - 0.16, 0.2, 0.62, 3, 0.07)
      : new RoundedBoxGeometry(sw - 0.08, 0.14, 0.5, 3, 0.05);
    const backGeo = rec
      ? new RoundedBoxGeometry(sw - 0.16, 0.8, 0.2, 3, 0.08)
      : new RoundedBoxGeometry(sw - 0.08, 0.66, 0.12, 3, 0.05);
    const fabric = rec ? M.leather : M.fabric;
    const cushions = new THREE.InstancedMesh(cushionGeo, fabric, n);
    const backs = new THREE.InstancedMesh(backGeo, fabric, n);
    const color = new THREE.Color();
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

    seats.forEach((s, i) => {
      const h = s.floor;
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      if (rec) o.position.set(s.x, h + 0.42, s.z - 0.04);
      else o.position.set(s.x, h + 0.43, s.z - 0.03);
      o.updateMatrix();
      cushions.setMatrixAt(i, o.matrix);
      if (rec) {
        o.position.set(s.x, h + 0.86, s.z + 0.33);
        o.rotation.x = 0.2;
      } else {
        o.position.set(s.x, h + 0.8, s.z + 0.27);
        o.rotation.x = 0.13;
      }
      o.updateMatrix();
      backs.setMatrixAt(i, o.matrix);
      const v = 0.94 + rnd() * 0.1;
      color.setRGB(v, v, v);
      cushions.setColorAt(i, color);
      backs.setColorAt(i, color);
    });
    this.root.add(cushions, backs);
    this.cushions = cushions;
    this.backs = backs;
    this.baseColors = Array.from({ length: n }, (_, i) => {
      const c = new THREE.Color();
      cushions.getColorAt(i, c);
      return c;
    });

    // sandaran tangan / panel samping
    const arms = [];
    rows.forEach((r) => {
      if (!r.seats.length) return;
      const byBlock = new Map();
      r.seats.forEach((s) => {
        if (!byBlock.has(s.block)) byBlock.set(s.block, []);
        byBlock.get(s.block).push(s);
      });
      for (const list of byBlock.values()) {
        const xs = list.map((s) => s.x).sort((a, b) => a - b);
        const bounds = [xs[0] - sw / 2, ...xs.map((x) => x + sw / 2)];
        bounds.forEach((x, j) => arms.push({ x, h: r.floor, z: r.z, end: j === 0 || j === bounds.length - 1 }));
      }
    });
    void blockSpans;
    const armTop = new THREE.InstancedMesh(
      rec ? new RoundedBoxGeometry(0.15, 0.1, 0.78, 2, 0.04) : new RoundedBoxGeometry(0.07, 0.06, 0.5, 2, 0.025),
      M.seatDark,
      arms.length
    );
    const side = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.seatDark, arms.length);
    arms.forEach((a, j) => {
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      o.position.set(a.x, a.h + (rec ? 0.62 : 0.65), a.z + (rec ? 0.02 : 0.0));
      o.updateMatrix();
      armTop.setMatrixAt(j, o.matrix);
      const w = rec ? 0.13 : a.end ? 0.06 : 0.045;
      o.position.set(a.x, a.h + (rec ? 0.29 : 0.31), a.z + 0.03);
      o.scale.set(w, rec ? 0.58 : 0.62, rec ? 0.82 : 0.56);
      o.updateMatrix();
      side.setMatrixAt(j, o.matrix);
    });
    this.root.add(armTop, side);

    if (rec) {
      const foot = new THREE.InstancedMesh(new RoundedBoxGeometry(sw - 0.2, 0.26, 0.3, 2, 0.05), M.seatDark, n);
      seats.forEach((s, i) => {
        o.rotation.set(0, 0, 0);
        o.scale.set(1, 1, 1);
        o.position.set(s.x, s.floor + 0.2, s.z - 0.47);
        o.updateMatrix();
        foot.setMatrixAt(i, o.matrix);
      });
      this.root.add(foot);
    }
  }

  _highlight(seat) {
    if (!this.cushions) return;
    const c = new THREE.Color();
    if (this._hl != null) {
      this.cushions.setColorAt(this._hl, this.baseColors[this._hl]);
      this.backs.setColorAt(this._hl, this.baseColors[this._hl]);
    }
    this._hl = seat ? this.layout.seats.indexOf(seat) : null;
    if (this._hl != null && this._hl >= 0) {
      c.setRGB(1.55, 1.3, 1.05);
      this.cushions.setColorAt(this._hl, c);
      this.backs.setColorAt(this._hl, c);
    }
    this.cushions.instanceColor.needsUpdate = true;
    this.backs.instanceColor.needsUpdate = true;
  }

  // ───────────────────────── kamera ─────────────────────────
  _screenLook(e) {
    const s = this.layout.screen;
    return { yaw: Math.atan2(e.x, e.z), pitch: Math.atan2(s.cy - e.y, Math.hypot(e.x, e.z)) };
  }

  seatedPose(seat) {
    const l = this._screenLook(seat.eye);
    return { x: seat.eye.x, y: seat.eye.y, z: seat.eye.z, yaw: l.yaw, pitch: l.pitch };
  }

  walkTo(seat) {
    const L = this.layout;
    const path = walkPath(L, seat);
    const pl = polyline(path.points);
    const len = pl.length;
    const T = clamp(2.3 + len * 0.17, 3.2, 6.6);
    const ta = 0.75;
    const td = 0.95;
    const vmax = len / (T - ta / 2 - td / 2);
    const S = (t) => {
      if (t <= 0) return 0;
      if (t < ta) return (0.5 * vmax * t * t) / ta;
      if (t < T - td) return (vmax * ta) / 2 + vmax * (t - ta);
      if (t < T) return len - (0.5 * vmax * (T - t) * (T - t)) / td;
      return len;
    };
    const V = (t) => (t < ta ? (vmax * t) / ta : t < T - td ? vmax : t < T ? (vmax * (T - t)) / td : 0);
    const last = path.raw[path.raw.length - 1];
    const prev = path.raw[path.raw.length - 2];
    const lastLen = Math.hypot(last.x - prev.x, last.z - prev.z);
    const lookMax = Math.max(0, len - lastLen);
    const row = L.rows[seat.rowIndex];
    const aisleX = path.aisle.x;
    const aisleHalf = path.aisle.width / 2;
    const SIT = 1.15;
    const target = this.seatedPose(seat);

    const floorFor = (x, z) => {
      const k = smooth(aisleHalf * 0.6, aisleHalf + 0.25, Math.abs(x - aisleX));
      const lane = Math.abs(z - path.laneZ) < 0.6 ? k : 0;
      return L.floorAt(z, 0.3) * (1 - lane) + row.floor * lane;
    };

    const desired = (s, p) => {
      const q = pl.at(Math.min(lookMax, s + 1.7));
      let yaw = this.pose.yaw;
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      if (Math.hypot(dx, dz) > 0.05) yaw = Math.atan2(-dx, -dz);
      else if (Math.hypot(p.dx, p.dz) > 0) yaw = Math.atan2(-p.dx, -p.dz);
      const ahead = pl.at(Math.min(len, s + 0.6));
      const slope = (floorFor(ahead.x, ahead.z) - floorFor(p.x, p.z)) / 0.6;
      let pitch = -0.1 + clamp(slope, -0.6, 0.6) * 0.35;
      const eye = { x: p.x, y: floorFor(p.x, p.z) + STAND_EYE, z: p.z };
      const sl = this._screenLook(eye);
      const b = smooth(lookMax - 0.9, lookMax + Math.min(0.25, lastLen * 0.5), s);
      // saat berjalan, pandangan sedikit condong ke arah layar
      const away = Math.abs(wrap(sl.yaw - yaw)) > 2.0; // berjalan membelakangi layar
      const bias = away ? 0 : 0.3 * (1 - b);
      return { yaw: lerpAngle(yaw, sl.yaw, Math.max(b, bias)), pitch: pitch + (sl.pitch - pitch) * b };
    };

    // pose awal
    const p0 = pl.at(0);
    const d0 = desired(0, p0);
    Object.assign(this.pose, { x: p0.x, y: floorFor(p0.x, p0.z) + STAND_EYE, z: p0.z, yaw: d0.yaw, pitch: d0.pitch });
    this.look.tYaw = this.look.tPitch = this.look.yaw = this.look.pitch = 0;
    this.seat = seat;
    this._highlight(seat);

    let t = 0;
    let standEnd = null;
    this.anim = {
      kind: 'walk',
      duration: T + SIT,
      path: pl,
      update: (dt) => {
        t += dt;
        const P = this.pose;
        if (t <= T) {
          const s = S(t);
          const p = pl.at(s);
          const spd = V(t) / vmax;
          const phase = (s / 0.74) * Math.PI;
          const nx = -p.dz;
          const nz = p.dx;
          const sway = Math.sin(phase) * 0.008 * spd;
          P.x = p.x + nx * sway;
          P.z = p.z + nz * sway;
          P.y = floorFor(p.x, p.z) + STAND_EYE + Math.sin(phase * 2) * 0.016 * spd;
          const d = desired(s, p);
          const k = damp(7, dt);
          P.yaw = lerpAngle(P.yaw, d.yaw, k);
          P.pitch += (d.pitch - P.pitch) * k;
          this.hooks.onWalk?.({ x: p.x, z: p.z, yaw: P.yaw, progress: s / len });
        } else {
          if (!standEnd) standEnd = { ...P };
          const u = easeInOut(clamp((t - T) / SIT, 0, 1));
          P.x = standEnd.x + (target.x - standEnd.x) * u;
          P.z = standEnd.z + (target.z - standEnd.z) * u - Math.sin(Math.PI * u) * 0.06;
          P.y = standEnd.y + (target.y - standEnd.y) * u;
          const k = damp(6, dt);
          P.yaw = lerpAngle(P.yaw, target.yaw, Math.max(k, u * u));
          P.pitch += (target.pitch - P.pitch) * Math.max(k, u * u);
          this.hooks.onWalk?.({ x: target.x, z: target.z, yaw: P.yaw, progress: 1 });
        }
        if (t >= T + SIT) {
          Object.assign(P, target);
          return true;
        }
        return false;
      },
      onDone: () => this.hooks.onSeated?.(seat),
    };
    return { path: path.points, duration: T + SIT };
  }

  glideTo(seat, duration = 0.95) {
    const from = { ...this.pose };
    const to = this.seatedPose(seat);
    const rowJump = this.seat ? Math.abs(this.seat.rowIndex - seat.rowIndex) : 0;
    const arc = rowJump ? 0.25 + rowJump * 0.06 : 0.04;
    const yawFrom = from.yaw;
    this.seat = seat;
    this._highlight(null);
    let t = 0;
    this.anim = {
      kind: 'glide',
      update: (dt) => {
        t += dt;
        const u = easeInOut(clamp(t / duration, 0, 1));
        const P = this.pose;
        P.x = from.x + (to.x - from.x) * u;
        P.z = from.z + (to.z - from.z) * u;
        P.y = from.y + (to.y - from.y) * u + Math.sin(Math.PI * u) * arc;
        P.yaw = lerpAngle(yawFrom, to.yaw, u);
        P.pitch = from.pitch + (to.pitch - from.pitch) * u;
        if (t >= duration) {
          Object.assign(P, to);
          return true;
        }
        return false;
      },
      onDone: () => this.hooks.onSeated?.(seat),
    };
  }

  setInset(px) {
    this.insetTarget = Math.max(0, px);
  }

  // ───────────────────────── input ─────────────────────────
  _bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (this.anim && this.anim.kind === 'walk') return;
      this.look.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: this.look.tYaw, pitch: this.look.tPitch };
      c.setPointerCapture(e.pointerId);
      this.hooks.onLook?.();
    });
    c.addEventListener('pointermove', (e) => {
      const d = this.look.drag;
      if (!d || d.id !== e.pointerId) return;
      const s = 2.2 / Math.max(320, this.size.w);
      this.look.tYaw = clamp(d.yaw + (e.clientX - d.x) * s * 1.4, -1.1, 1.1);
      this.look.tPitch = clamp(d.pitch + (e.clientY - d.y) * s, -0.5, 0.5);
      this.look.idle = 0;
    });
    const end = (e) => {
      if (this.look.drag && this.look.drag.id === e.pointerId) this.look.drag = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('dblclick', () => {
      this.look.tYaw = this.look.tPitch = 0;
    });
  }

  // ───────────────────────── loop ─────────────────────────
  _resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    if (w !== this.size.w || h !== this.size.h) {
      this.size = { w, h };
      this.renderer.setSize(w, h, false);
    }
    this._projection();
  }

  _projection() {
    const { w, h } = this.size;
    if (!w) return;
    const inset = Math.round(this.inset);
    const fullH = h + inset;
    const aspect = w / fullH;
    const hf = (aspect >= 1 ? 74 : 80) * (Math.PI / 180);
    let vf = 2 * Math.atan(Math.tan(hf / 2) / aspect);
    vf = clamp(vf, 0.75, 2.15);
    this.camera.fov = (vf * 180) / Math.PI;
    this.camera.aspect = aspect;
    this.camera.setViewOffset(w, fullH, 0, inset, w, h);
    this.camera.updateProjectionMatrix();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.perf.warm = this.perf.acc = this.perf.frames = 0;
    this.clock.start();
    this._resize();
    requestAnimationFrame(this._loop);
  }

  stop() {
    this.running = false;
    this.clock.stop();
  }

  // kompilasi shader & unggah tekstur sebelum animasi dimulai,
  // agar langkah pertama tidak tersendat
  async prepare() {
    this._resize();
    this._apply(0);
    this.film.update(this.time);
    try {
      if (this.renderer.compileAsync) await this.renderer.compileAsync(this.scene, this.camera);
      else this.renderer.compile(this.scene, this.camera);
    } catch {
      /* lanjut saja */
    }
    this.renderer.render(this.scene, this.camera);
  }

  _governor(raw) {
    const P = this.perf;
    if (P.warm < 0.8) {
      P.warm += raw;
      return;
    }
    P.acc += raw;
    P.frames++;
    if (P.acc < 1) return;
    const avg = P.acc / P.frames;
    P.acc = 0;
    P.frames = 0;
    let next = this.pr;
    if (avg > 1 / 45 && this.pr > this.prMin) {
      next = Math.max(this.prMin, this.pr - 0.25);
      P.good = 0;
    } else if (avg < 1 / 56) {
      if (++P.good >= 3 && this.pr < this.prMax) {
        next = Math.min(this.prMax, this.pr + 0.25);
        P.good = 0;
      }
    } else P.good = 0;
    if (next !== this.pr) {
      this.pr = next;
      this.renderer.setPixelRatio(next);
      this.renderer.setSize(this.size.w, this.size.h, false);
    }
  }

  _loop() {
    if (!this.running) return;
    requestAnimationFrame(this._loop);
    const raw = this.clock.getDelta();
    const dt = Math.min(raw, 1 / 15);
    this.time += dt;
    this._governor(raw);
    this.film.update(this.time);

    if (this.anim) {
      if (this.anim.update(dt)) {
        const a = this.anim;
        this.anim = null;
        a.onDone?.();
      }
    }
    this._apply(dt);
    this.renderer.render(this.scene, this.camera);
  }

  _apply(dt) {
    const L = this.look;
    if (!L.drag) {
      L.idle += dt;
      if (L.idle > 1.6) {
        const k = damp(2.2, dt);
        L.tYaw -= L.tYaw * k;
        L.tPitch -= L.tPitch * k;
      }
    }
    const k = dt ? damp(12, dt) : 1;
    L.yaw += (L.tYaw - L.yaw) * k;
    L.pitch += (L.tPitch - L.pitch) * k;

    if (Math.abs(this.inset - this.insetTarget) > 0.5) {
      this.inset += (this.insetTarget - this.inset) * (dt ? damp(7, dt) : 1);
      this._projection();
    } else if (this.inset !== this.insetTarget) {
      this.inset = this.insetTarget;
      this._projection();
    }

    const P = this.pose;
    const breathe = !this.anim ? Math.sin(this.time * 1.5) * 0.004 : 0;
    this.camera.position.set(P.x, P.y + breathe, P.z);
    this.camera.rotation.set(P.pitch + L.pitch, P.yaw + L.yaw, 0);

    if (this.areaLight) {
      const f = 0.92 + 0.08 * Math.sin(this.time * 0.9) * Math.sin(this.time * 0.37);
      this.areaLight.intensity = 5.5 * f;
    }
  }

  get busyWalking() {
    return !!(this.anim && this.anim.kind === 'walk');
  }
}
