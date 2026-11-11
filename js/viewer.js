import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { createFilm } from './film.js';
import { Walker } from './walker.js';
import { walkPath, polyline } from './layout.js';

RectAreaLightUniformsLib.init();

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;
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

let _box;
const box1 = () => (_box ||= new THREE.BoxGeometry(1, 1, 1));

function canvasTexture(w, h, paint, { repeat = false, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function makeTextures(maxAniso) {
  const speckle = (g, w, h, base, light, dark, n, seed0) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    let seed = seed0;
    const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < n; i++) {
      g.fillStyle = r() > 0.6 ? light : dark;
      g.fillRect(r() * w, r() * h, 1.4, 1.4);
    }
  };
  const carpet = canvasTexture(
    512,
    512,
    (g, w, h) => {
      speckle(g, w, h, '#1c1a20', 'rgba(92,72,98,0.35)', 'rgba(0,0,0,0.35)', 10400, 3);
      g.strokeStyle = 'rgba(140,96,60,0.12)';
      g.lineWidth = 2;
      for (let i = -w; i < w * 2; i += 128) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + h, h);
        g.stroke();
      }
    },
    { repeat: true }
  );
  carpet.anisotropy = maxAniso;

  const runner = canvasTexture(
    256,
    256,
    (g, w, h) => {
      speckle(g, w, h, '#4a1519', 'rgba(150,60,60,0.35)', 'rgba(0,0,0,0.4)', 5000, 9);
    },
    { repeat: true }
  );
  runner.anisotropy = maxAniso;

  const glow = canvasTexture(128, 128, (g, w, h) => {
    const rg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
  });

  // bayangan lembut berbentuk persegi panjang (di bawah deretan kursi)
  const shadow = canvasTexture(
    128,
    64,
    (g, w, h) => {
      const img = g.createImageData(w, h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const dx = Math.min(x, w - 1 - x) / (w * 0.12);
          const dy = Math.min(y, h - 1 - y) / (h * 0.35);
          const a = smooth(0, 1, Math.min(dx, 1)) * smooth(0, 1, Math.min(dy, 1));
          const i = (y * w + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(a * 255);
          img.data[i + 3] = 255;
        }
      g.putImageData(img, 0, 0);
    },
    { srgb: false }
  );

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

  const grille = canvasTexture(64, 96, (g, w, h) => {
    g.fillStyle = '#17171a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#0a0a0b';
    for (let y = 4; y < h; y += 4) for (let x = 4; x < w; x += 4) g.fillRect(x, y, 2, 2);
  });

  return { carpet, runner, glow, shadow, exit, lobby, grille };
}

function makeMaterials(tex) {
  const additive = (color, opacity) =>
    new THREE.MeshBasicMaterial({ map: tex.glow, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  return {
    carpet: new THREE.MeshStandardMaterial({ map: tex.carpet, roughness: 1 }),
    runner: new THREE.MeshStandardMaterial({ map: tex.runner, roughness: 1 }),
    riser: new THREE.MeshStandardMaterial({ color: 0x141217, roughness: 0.95 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x17151a, roughness: 1 }),
    panel: new THREE.MeshPhysicalMaterial({ color: 0x2e2528, roughness: 1, sheen: 0.6, sheenColor: new THREE.Color(0x6a4a50), sheenRoughness: 0.8 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 1 }),
    baffle: new THREE.MeshStandardMaterial({ color: 0x18171b, roughness: 1 }),
    black: new THREE.MeshBasicMaterial({ color: 0x030303 }),
    stage: new THREE.MeshStandardMaterial({ color: 0x0f0e11, roughness: 0.9 }),
    curtain: new THREE.MeshPhysicalMaterial({
      color: 0x3d0b12,
      roughness: 0.92,
      sheen: 1,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(0xa83a42),
      side: THREE.DoubleSide,
    }),
    speaker: new THREE.MeshStandardMaterial({ map: tex.grille, roughness: 0.7 }),
    fabric: new THREE.MeshPhysicalMaterial({
      color: 0x8e121b,
      roughness: 0.8,
      sheen: 1,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color(0xff6a6a),
    }),
    leather: new THREE.MeshPhysicalMaterial({ color: 0x6a141a, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.5 }),
    seatDark: new THREE.MeshStandardMaterial({ color: 0x1c1517, roughness: 0.65 }),
    shell: new THREE.MeshStandardMaterial({ color: 0x1a1315, roughness: 0.45, metalness: 0.05 }),
    cup: new THREE.MeshStandardMaterial({ color: 0x0c0b0c, roughness: 0.4 }),
    led: new THREE.MeshBasicMaterial({ color: 0xffc58a }),
    downlight: new THREE.MeshBasicMaterial({ color: 0xffe2b8 }),
    sconce: new THREE.MeshBasicMaterial({ color: 0xffd2a0 }),
    glow: additive(0xff9c55, 0.3),
    aisleGlow: additive(0xffb070, 0.5),
    halo: additive(0xffb987, 0.16),
    spill: additive(0xffc69a, 0.1),
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: tex.shadow, transparent: true, opacity: 0.6, depthWrite: false }),
    exit: new THREE.MeshBasicMaterial({ map: tex.exit }),
    lobby: new THREE.MeshBasicMaterial({ map: tex.lobby }),
    projector: new THREE.MeshBasicMaterial({ color: 0xdfe6ff }),
    marker: new THREE.MeshBasicMaterial({ color: 0xe9b35a, transparent: true }),
    markerGlow: additive(0xe9b35a, 0.45),
  };
}

const HOUSE_LIGHT = 34; // intensitas lampu ruangan saat menyala

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
    this.scene.fog = new THREE.FogExp2(0x09080a, 0.012);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 140);
    this.camera.rotation.order = 'YXZ';

    this.tex = makeTextures(this.renderer.capabilities.getMaxAnisotropy());
    this.mat = makeMaterials(this.tex);
    this.film = createFilm(this.renderer);
    this.screenMat = this.film.material;

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.studioTex = [];
    this.houseLights = [];

    // tokoh & penanda kursi tetap ada walau studio berganti
    this.walker = new Walker(this.tex.glow);
    this.scene.add(this.walker.group);
    this.marker = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 24), this.mat.marker);
    cone.rotation.x = Math.PI;
    this.marker.add(cone);
    this.markerGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), this.mat.markerGlow);
    this.marker.add(this.markerGlow);
    this.marker.visible = false;
    this.scene.add(this.marker);

    this.pose = { x: 0, y: 1.6, z: 10, yaw: 0, pitch: 0 };
    this.look = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, idle: 0, drag: null };
    this.inset = 0;
    this.insetTarget = 0;
    this.house = 1;
    this.houseTarget = 1;
    this.screenBright = 1;
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
    this._hl = null;
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.studioTex.forEach((t) => t.dispose());
    this.studioTex = [];
    this.root.clear();
    this.houseLights = [];
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

  _instanced(geo, mat, items, set) {
    if (!items.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    const o = new THREE.Object3D();
    items.forEach((it, k) => {
      o.position.set(0, 0, 0);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      set(o, it);
      o.updateMatrix();
      im.setMatrixAt(k, o.matrix);
    });
    this.root.add(im);
    return im;
  }

  _build(L) {
    const { room, rows, screen, door, aisles, studio } = L;
    const M = this.mat;
    const p = studio.rowPitch;
    const W = room.width;
    const zFront = -0.45;
    const ceil = room.ceil;
    const depthAll = room.backZ - zFront;
    const walk = aisles.filter((a) => a.walkable);
    const box = box1();

    // ── lantai & undakan
    const frontDepth = room.frontEdge - zFront;
    this._plane(W, frontDepth, M.carpet, [0, 0, zFront + frontDepth / 2], [-HALF_PI, 0, 0], 0.45);
    rows.forEach((r, i) => {
      const z0 = r.z - p / 2;
      const z1 = i === rows.length - 1 ? room.backZ : r.z + p / 2;
      this._plane(W, z1 - z0, M.carpet, [0, r.floor, (z0 + z1) / 2], [-HALF_PI, 0, 0], 0.45);
      // karpet merah di lorong
      for (const a of walk) {
        this._plane(a.width * 0.86, z1 - z0, M.runner, [a.x, r.floor + 0.002, (z0 + z1) / 2], [-HALF_PI, 0, 0], 0.9);
      }
      const prev = i === 0 ? 0 : rows[i - 1].floor;
      if (r.floor > prev + 0.001) {
        const hgt = r.floor - prev;
        this._plane(W, hgt, M.riser, [0, prev + hgt / 2, z0], [0, Math.PI, 0]);
      }
    });

    // anak tangga di lorong + lampu LED tepi tangga
    const steps = [];
    const leds = [];
    rows.forEach((r, i) => {
      const prev = i === 0 ? 0 : rows[i - 1].floor;
      const rise = r.floor - prev;
      if (rise <= 0.001) return;
      const zb = r.z - p / 2;
      for (const a of walk) {
        if (rise > 0.24) {
          const depth = Math.min(0.45, p * 0.42);
          steps.push({ x: a.x, y: prev + rise / 4, z: zb - depth / 2, sx: a.width * 0.86, sy: rise / 2, sz: depth });
          leds.push({ x: a.x, y: prev + rise / 2 - 0.03, z: zb - depth - 0.006, sx: a.width * 0.7 });
        }
        leds.push({ x: a.x, y: r.floor - 0.03, z: zb - 0.006, sx: a.width * 0.7 });
      }
    });
    this._instanced(box, M.runner, steps, (o, s) => {
      o.position.set(s.x, s.y, s.z);
      o.scale.set(s.sx, s.sy, s.sz);
    });
    this._instanced(box, M.led, leds, (o, s) => {
      o.position.set(s.x, s.y, s.z);
      o.scale.set(s.sx, 0.016, 0.012);
    });

    // ── panggung kecil di bawah layar
    const stageH = Math.min(0.32, screen.bottom * 0.3);
    const stageD = 1.0;
    this._instanced(box, M.stage, [0], (o) => {
      o.position.set(0, stageH / 2, zFront + stageD / 2);
      o.scale.set(W, stageH, stageD);
    });
    this._instanced(box, M.led, [0], (o) => {
      o.position.set(0, stageH + 0.004, zFront + stageD - 0.01);
      o.scale.set(W - 0.4, 0.008, 0.012);
    });

    // ── dinding samping (dengan pintu)
    for (const side of [-1, 1]) {
      const x = side * room.halfW;
      const ry = side < 0 ? HALF_PI : -HALF_PI;
      if (door.side === side) {
        const dz0 = door.z - door.width / 2;
        const dz1 = door.z + door.width / 2;
        const dTop = door.y + 2.3;
        for (const [a, b, y0, y1] of [
          [zFront, dz0, 0, ceil],
          [dz1, room.backZ, 0, ceil],
          [dz0, dz1, dTop, ceil],
          [dz0, dz1, 0, door.y],
        ]) {
          if (b - a < 0.01 || y1 - y0 < 0.01) continue;
          this._plane(b - a, y1 - y0, M.wall, [x, (y0 + y1) / 2, (a + b) / 2], [0, ry, 0]);
        }
        this._plane(door.width, 2.3, M.lobby, [x + side * 0.9, door.y + 1.15, door.z], [0, ry, 0]);
        this._instanced(box, M.black, [dz0, dz1], (o, zz) => {
          o.position.set(x + side * 0.45, (door.y + dTop) / 2, zz);
          o.scale.set(0.9, dTop - door.y, 0.04);
        });
        this._instanced(box, M.black, [0], (o) => {
          o.position.set(x + side * 0.45, dTop, door.z);
          o.scale.set(0.9, 0.04, door.width);
        });
        this._plane(0.62, 0.23, M.exit, [x - side * 0.02, dTop + 0.32, door.z], [0, ry, 0]);
      } else {
        this._plane(depthAll, ceil, M.wall, [x, ceil / 2, zFront + depthAll / 2], [0, ry, 0]);
      }

      // panel akustik, lampu dinding, speaker surround
      const panels = [];
      const sconces = [];
      const speakers = [];
      let k = 0;
      for (let z = 1.2; z < room.backZ - 0.7; z += 1.3, k++) {
        if (door.side === side && Math.abs(z - door.z) < door.width / 2 + 0.75) continue;
        const fy = L.floorAt(z, 0.01);
        const y0 = fy + 1.05;
        const y1 = ceil - 0.6;
        if (y1 - y0 > 0.6) panels.push({ z, y0, y1 });
        if (k % 2 === 1 && fy + 2.2 < ceil - 0.5) sconces.push({ z: z + 0.65, y: fy + 2.2 });
        if (k % 3 === 1 && z > 2.5) speakers.push({ z, y: Math.min(ceil - 0.9, fy + 3.1) });
      }
      this._instanced(box, M.panel, panels, (o, pn) => {
        o.position.set(x - side * 0.03, (pn.y0 + pn.y1) / 2, pn.z);
        o.scale.set(0.06, pn.y1 - pn.y0, 1.18);
      });
      this._instanced(box, M.speaker, speakers, (o, s) => {
        o.position.set(x - side * 0.2, s.y, s.z);
        o.rotation.set(0, 0, side * 0.18);
        o.scale.set(0.24, 0.42, 0.3);
      });
      this._instanced(box, M.sconce, sconces, (o, s) => {
        o.position.set(x - side * 0.07, s.y, s.z);
        o.scale.set(0.04, 0.32, 0.07);
      });
      const glows = this._instanced(new THREE.PlaneGeometry(1.5, 2.6), M.glow, sconces, (o, s) => {
        o.position.set(x - side * 0.075, s.y, s.z);
        o.rotation.y = ry;
      });
      if (glows) glows.renderOrder = 2;
    }

    // dinding depan & belakang, plafon, panel plafon
    this._plane(W, ceil, M.black, [0, ceil / 2, zFront], null);
    this._plane(W, ceil, M.wall, [0, ceil / 2, room.backZ], [0, Math.PI, 0]);
    this._plane(W, depthAll, M.ceiling, [0, ceil, zFront + depthAll / 2], [HALF_PI, 0, 0]);
    const baffles = [];
    for (let z = 1.6; z < room.backZ - 0.4; z += 1.7) baffles.push(z);
    this._instanced(box, M.baffle, baffles, (o, z) => {
      o.position.set(0, ceil - 0.14, z);
      o.scale.set(W - 0.3, 0.26, 0.14);
    });
    const projPos = new THREE.Vector3(0.6, ceil - 0.95, room.backZ - 0.02);
    this._plane(0.55, 0.32, M.projector, [projPos.x, projPos.y, projPos.z], [0, Math.PI, 0]);
    this._plane(0.32, 0.2, M.projector, [-1.3, projPos.y, projPos.z], [0, Math.PI, 0]);

    const dl = [];
    for (let z = 2.45; z < room.backZ - 0.5; z += 1.7) for (let x = -room.halfW + 1.2; x < room.halfW - 0.9; x += 2.2) dl.push([x, z]);
    this._instanced(new THREE.CircleGeometry(0.075, 20), M.downlight, dl, (o, [x, z]) => {
      o.rotation.x = HALF_PI;
      o.position.set(x, ceil - 0.005, z);
    });

    // ── tirai di samping layar & di atas
    const cw = room.halfW - (screen.width / 2 + 0.3);
    if (cw > 0.25) {
      for (const side of [-1, 1]) {
        const c = this._curtain(cw, ceil - stageH, 0.32, 0.055);
        c.position.set(side * (screen.width / 2 + 0.3 + cw / 2), stageH + (ceil - stageH) / 2, -0.22);
        this.root.add(c);
      }
    }
    const val = this._curtain(W, 0.9, 0.22, 0.03);
    val.position.set(0, ceil - 0.45, -0.12);
    this.root.add(val);

    // ── layar
    this._plane(screen.width + 0.5, screen.height + 0.4, M.black, [0, screen.cy, -0.02], null);
    const halo = this._plane(screen.width + 3.2, screen.height + 2.6, M.halo, [0, screen.cy, -0.01], null);
    halo.renderOrder = 1;
    this.screenMesh = this._plane(screen.width, screen.height, this.screenMat, [0, screen.cy, 0], null);
    const spill = this._plane(screen.width * 1.2, 4.2, M.spill, [0, 0.006, zFront + stageD + 1.6], [-HALF_PI, 0, 0]);
    spill.renderOrder = 2;
    this._beam(projPos, screen);

    // ── kursi
    this._seats(L);

    // ── cahaya
    const area = new THREE.RectAreaLight(0xffd0a8, 5.5, screen.width, screen.height);
    area.position.set(0, screen.cy, 0.05);
    area.lookAt(0, screen.cy, 5);
    this.root.add(area);
    this.areaLight = area;
    this.hemi = new THREE.HemisphereLight(0x8a92b0, 0x2a1d18, 0.6);
    this.root.add(this.hemi);
    for (const f of [0.3, 0.75]) {
      const pl = new THREE.PointLight(0xffc797, HOUSE_LIGHT, 0, 2);
      pl.position.set(0, ceil - 0.45, room.backZ * f);
      this.root.add(pl);
      this.houseLights.push(pl);
    }
    this._applyHouse();
  }

  _curtain(w, h, period, amp) {
    const seg = Math.max(24, Math.round((w / period) * 8));
    const g = new THREE.PlaneGeometry(w, h, seg, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin((x / period) * TAU) * amp + Math.sin((x / period) * TAU * 2.3) * amp * 0.25);
    }
    g.computeVertexNormals();
    return new THREE.Mesh(g, this.mat.curtain);
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
      uniforms: { uColor: { value: new THREE.Color(0xfff0dc) }, uOpacity: { value: 0.02 } },
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

  _letter(ch) {
    const t = canvasTexture(64, 48, (g, w, h) => {
      g.fillStyle = '#16110f';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffdcae';
      g.font = '700 34px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(ch, w / 2, h / 2 + 2);
    });
    this.studioTex.push(t);
    const m = new THREE.MeshBasicMaterial({ map: t });
    this.studioTex.push(m);
    return m;
  }

  _seats(L) {
    const { seats, rows, studio, aisles } = L;
    const sw = studio.seatWidth;
    const rec = studio.seat === 'recliner';
    const M = this.mat;
    const n = seats.length;
    const o = new THREE.Object3D();

    const cushionGeo = rec ? new RoundedBoxGeometry(sw - 0.16, 0.2, 0.62, 3, 0.07) : new RoundedBoxGeometry(sw - 0.08, 0.14, 0.5, 3, 0.05);
    const backGeo = rec ? new RoundedBoxGeometry(sw - 0.16, 0.8, 0.2, 3, 0.08) : new RoundedBoxGeometry(sw - 0.08, 0.66, 0.12, 3, 0.05);
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

    // cangkang belakang sandaran (plastik)
    this._instanced(
      rec ? new RoundedBoxGeometry(sw - 0.14, 0.5, 0.06, 2, 0.025) : new RoundedBoxGeometry(sw - 0.07, 0.46, 0.05, 2, 0.02),
      M.shell,
      seats,
      (ob, s) => {
        if (rec) {
          ob.position.set(s.x, s.floor + 0.7, s.z + 0.43);
          ob.rotation.x = 0.2;
        } else {
          ob.position.set(s.x, s.floor + 0.64, s.z + 0.335);
          ob.rotation.x = 0.13;
        }
      }
    );

    // sandaran tangan, panel samping, tempat gelas
    const arms = [];
    const ends = [];
    rows.forEach((r) => {
      if (!r.seats.length) return;
      const byBlock = new Map();
      r.seats.forEach((s) => {
        if (!byBlock.has(s.block)) byBlock.set(s.block, []);
        byBlock.get(s.block).push(s);
      });
      const blocks = [...byBlock.values()];
      blocks.forEach((list, bi) => {
        const xs = list.map((s) => s.x).sort((a, b) => a - b);
        const bounds = [xs[0] - sw / 2, ...xs.map((x) => x + sw / 2)];
        bounds.forEach((x, j) => {
          const end = j === 0 || j === bounds.length - 1;
          arms.push({ x, h: r.floor, z: r.z, end });
          if (end) {
            const dir = j === 0 ? -1 : 1;
            const outer = (bi === 0 && j === 0) || (bi === blocks.length - 1 && j === bounds.length - 1);
            ends.push({ x, h: r.floor, z: r.z, dir, outer, letter: r.letter });
          }
        });
      });
    });
    this._instanced(
      rec ? new RoundedBoxGeometry(0.15, 0.1, 0.78, 2, 0.04) : new RoundedBoxGeometry(0.07, 0.06, 0.5, 2, 0.025),
      M.seatDark,
      arms,
      (ob, a) => ob.position.set(a.x, a.h + (rec ? 0.62 : 0.65), a.z + (rec ? 0.02 : 0))
    );
    this._instanced(box1(), M.seatDark, arms, (ob, a) => {
      const w = rec ? 0.13 : a.end ? 0.06 : 0.045;
      ob.position.set(a.x, a.h + (rec ? 0.29 : 0.31), a.z + 0.03);
      ob.scale.set(w, rec ? 0.58 : 0.62, rec ? 0.82 : 0.56);
    });
    this._instanced(
      new THREE.CylinderGeometry(0.043, 0.038, 0.075, 18),
      M.cup,
      arms.filter((a) => !a.end),
      (ob, a) => ob.position.set(a.x, a.h + (rec ? 0.64 : 0.66), a.z - (rec ? 0.3 : 0.21))
    );

    if (rec) {
      this._instanced(new RoundedBoxGeometry(sw - 0.2, 0.26, 0.3, 2, 0.05), M.seatDark, seats, (ob, s) =>
        ob.position.set(s.x, s.floor + 0.2, s.z - 0.47)
      );
    }

    // bayangan lembut di bawah tiap deret kursi
    const shadowSpans = [];
    rows.forEach((r) => {
      const byBlock = new Map();
      r.seats.forEach((s) => {
        const b = byBlock.get(s.block) || { x0: Infinity, x1: -Infinity };
        b.x0 = Math.min(b.x0, s.x - sw / 2);
        b.x1 = Math.max(b.x1, s.x + sw / 2);
        byBlock.set(s.block, b);
      });
      for (const b of byBlock.values()) shadowSpans.push({ x: (b.x0 + b.x1) / 2, w: b.x1 - b.x0 + 0.25, h: r.floor, z: r.z });
    });
    this._instanced(new THREE.PlaneGeometry(1, 1), M.shadow, shadowSpans, (ob, s) => {
      ob.rotation.x = -HALF_PI;
      ob.position.set(s.x, s.h + 0.004, s.z + 0.04);
      ob.scale.set(s.w, rec ? 1.25 : 0.95, 1);
    });

    // lampu kecil di panel ujung kursi + pendarnya di lantai lorong
    const walkAisles = aisles.filter((a) => a.walkable);
    const lit = ends.filter((e) => walkAisles.some((a) => Math.abs(a.x - (e.x + (e.dir * a.width) / 2)) < a.width / 2 + 0.05));
    const ledOff = rec ? 0.07 : 0.035;
    this._instanced(box1(), M.led, lit, (ob, e) => {
      ob.position.set(e.x + e.dir * ledOff, e.h + 0.16, e.z + 0.08);
      ob.scale.set(0.012, 0.03, 0.12);
    });
    const pools = this._instanced(new THREE.PlaneGeometry(1, 1), M.aisleGlow, lit, (ob, e) => {
      ob.rotation.x = -HALF_PI;
      ob.position.set(e.x + e.dir * 0.32, e.h + 0.006, e.z + 0.05);
      ob.scale.set(0.75, 0.6, 1);
    });
    if (pools) pools.renderOrder = 2;

    // papan huruf baris di ujung luar deret
    const byLetter = new Map();
    for (const e of ends.filter((x) => x.outer)) {
      if (!byLetter.has(e.letter)) byLetter.set(e.letter, this._letter(e.letter));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.075), byLetter.get(e.letter));
      m.position.set(e.x + e.dir * (rec ? 0.068 : 0.032), e.h + (rec ? 0.42 : 0.47), e.z + 0.03);
      m.rotation.y = e.dir * HALF_PI;
      this.root.add(m);
    }
  }

  _highlight(seat) {
    if (!this.cushions) return;
    if (this._hl != null && this._hl >= 0) {
      this.cushions.setColorAt(this._hl, this.baseColors[this._hl]);
      this.backs.setColorAt(this._hl, this.baseColors[this._hl]);
    }
    this._hl = seat ? this.layout.seats.indexOf(seat) : null;
    if (this._hl != null && this._hl >= 0) {
      const c = new THREE.Color(1.7, 1.35, 1.0);
      this.cushions.setColorAt(this._hl, c);
      this.backs.setColorAt(this._hl, c);
    }
    this.cushions.instanceColor.needsUpdate = true;
    this.backs.instanceColor.needsUpdate = true;
  }

  _applyHouse() {
    const h = this.house;
    const M = this.mat;
    if (this.hemi) this.hemi.intensity = 0.1 + 0.55 * h;
    for (const l of this.houseLights) l.intensity = HOUSE_LIGHT * h;
    M.downlight.color.setRGB(0.22 + 0.78 * h, 0.17 + 0.71 * h, 0.12 + 0.6 * h);
    M.glow.opacity = 0.1 + 0.22 * h;
    const bright = 0.5 + 0.5 * (1 - h);
    this.film.setBright(bright);
    this.screenBright = bright;
    M.halo.opacity = 0.16 * bright;
    if (this.beamMat) this.beamMat.uniforms.uOpacity.value = 0.008 + 0.028 * (1 - h);
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

  _setPoseLook(pos, look) {
    const P = this.pose;
    P.x = pos.x;
    P.y = pos.y;
    P.z = pos.z;
    const dx = look.x - pos.x;
    const dy = look.y - pos.y;
    const dz = look.z - pos.z;
    P.yaw = Math.atan2(-dx, -dz);
    P.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }

  // Kamera jauh: tokoh kecil berjalan dari pintu ke kursi lalu duduk,
  // kemudian kamera meluncur masuk ke posisi mata dan menghadap layar.
  walkTo(seat) {
    const L = this.layout;
    const { room, door, rows, screen } = L;
    const path = walkPath(L, seat, { toLane: true });
    const pl = polyline(path.points);
    const len = pl.length;
    const T = clamp(1.8 + len * 0.16, 3.0, 6.2);
    const ta = 0.6;
    const td = 0.8;
    const vmax = len / (T - ta / 2 - td / 2);
    const S = (t) => {
      if (t <= 0) return 0;
      if (t < ta) return (0.5 * vmax * t * t) / ta;
      if (t < T - td) return (vmax * ta) / 2 + vmax * (t - ta);
      if (t < T) return len - (0.5 * vmax * (T - t) * (T - t)) / td;
      return len;
    };
    const V = (t) => (t < ta ? (vmax * t) / ta : t < T - td ? vmax : t < T ? (vmax * (T - t)) / td : 0);
    const SIT = 1.4;
    const SWOOP = 1.9;
    const row = rows[seat.rowIndex];
    const aisleX = path.aisle.x;
    const aisleHalf = path.aisle.width / 2;
    const floorFor = (x, z) => {
      const k = smooth(aisleHalf * 0.6, aisleHalf + 0.25, Math.abs(x - aisleX));
      const lane = Math.abs(z - path.laneZ) < 0.6 ? k : 0;
      return L.floorAt(z, 0.3) * (1 - lane) + row.floor * lane;
    };

    const V3 = THREE.Vector3;
    const eye = new V3(seat.eye.x, seat.eye.y, seat.eye.z);
    const screenC = new V3(0, screen.cy, 0);
    const side = -door.side;
    const O = new V3(side * (room.halfW - 0.9), room.ceil - 0.5, room.backZ - 0.45);
    const near = new V3(
      clamp(seat.x * 0.85 + side * 0.5, -room.halfW + 0.5, room.halfW - 0.5),
      Math.min(room.ceil - 0.55, row.floor + 2.7),
      Math.min(room.backZ - 0.4, seat.z + 2.7)
    );
    const hall = new V3(0, 1.0, room.backZ * 0.45);
    const ctrl = new V3(seat.eye.x, seat.eye.y + 0.6, seat.eye.z + 0.6);

    const Wk = this.walker;
    const g = Wk.group;
    Wk.reset();
    Wk.setOpacity(1);
    g.visible = true;
    const p0 = pl.at(0);
    g.position.set(p0.x, floorFor(p0.x, p0.z), p0.z);
    g.rotation.y = Math.atan2(-p0.dx, -p0.dz);
    this.marker.position.set(seat.x, seat.floor + 1.55, seat.z);
    this.marker.visible = true;
    this.mat.marker.opacity = 1;
    this.mat.markerGlow.opacity = 0.45;
    this.house = this.houseTarget = 1;
    this._applyHouse();

    const head = new V3();
    const getHead = () => head.set(g.position.x, g.position.y + 0.95, g.position.z);
    const look = getHead().clone().lerp(hall, 0.4);
    this._setPoseLook(O, look);
    this.look.tYaw = this.look.tPitch = this.look.yaw = this.look.pitch = 0;
    this.seat = seat;
    this._highlight(seat);

    const pos = new V3();
    const tgt = new V3();
    let t = 0;
    let laneEnd = null;
    let swoop = null;
    this.anim = {
      kind: 'walk',
      update: (dt) => {
        t += dt;
        // ── tokoh
        if (t <= T) {
          const s = S(t);
          const p = pl.at(s);
          g.position.set(p.x, floorFor(p.x, p.z), p.z);
          g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(-p.dx, -p.dz), damp(9, dt));
          Wk.walk((s / Wk.stride) * TAU, V(t) / vmax);
          // penanda memudar ketika tokoh sudah dekat kursinya
          const near2 = Math.hypot(p.x - seat.x, p.z - seat.z);
          this.mat.marker.opacity = this.mat.markerGlow.opacity = smooth(1.0, 2.2, near2);
          this.mat.markerGlow.opacity *= 0.45;
          this.marker.visible = near2 > 1.0;
          this.hooks.onWalk?.({ x: p.x, z: p.z, yaw: g.rotation.y, progress: s / len });
        } else if (t <= T + SIT) {
          if (!laneEnd) laneEnd = { x: g.position.x, z: g.position.z, yaw: g.rotation.y };
          const u = (t - T) / SIT;
          g.rotation.y = lerpAngle(laneEnd.yaw, 0, easeInOut(smooth(0, 0.45, u)));
          const k = easeInOut(smooth(0.25, 1, u));
          g.position.set(laneEnd.x + (seat.x - laneEnd.x) * k, row.floor, laneEnd.z + (seat.z + 0.03 - laneEnd.z) * k);
          Wk.sit(k);
          this.marker.visible = false;
          this.hooks.onWalk?.({ x: g.position.x, z: g.position.z, yaw: g.rotation.y, progress: 1 });
        }

        // ── kamera
        if (t <= T + SIT) {
          const m = easeInOut(clamp(t / (T + SIT), 0, 1));
          pos.copy(O).lerp(near, m);
          tgt.copy(getHead()).lerp(hall, 0.4 * (1 - m));
          look.lerp(tgt, damp(5, dt));
          this._setPoseLook(pos, look);
          return false;
        }
        if (!swoop) {
          swoop = { from: new V3(this.pose.x, this.pose.y, this.pose.z), look: look.clone() };
          this.houseTarget = 0;
          this.marker.visible = false;
        }
        const u = clamp((t - T - SIT) / SWOOP, 0, 1);
        const e = easeInOut(u);
        // kurva Bezier: turun dari belakang-atas, melewati sandaran, masuk ke posisi mata
        const a = (1 - e) * (1 - e);
        const b = 2 * (1 - e) * e;
        const c = e * e;
        pos.set(
          a * swoop.from.x + b * ctrl.x + c * eye.x,
          a * swoop.from.y + b * ctrl.y + c * eye.y,
          a * swoop.from.z + b * ctrl.z + c * eye.z
        );
        tgt.copy(swoop.look).lerp(screenC, easeInOut(smooth(0, 0.75, u)));
        Wk.setOpacity(1 - smooth(0.3, 0.7, u));
        if (u >= 1) {
          Object.assign(this.pose, this.seatedPose(seat));
          Wk.setOpacity(0);
          return true;
        }
        this._setPoseLook(pos, tgt);
        return false;
      },
      onDone: () => this.hooks.onSeated?.(seat),
    };
    return { path: path.points, duration: T + SIT + SWOOP };
  }

  glideTo(seat, duration = 0.95) {
    const from = { ...this.pose };
    const to = this.seatedPose(seat);
    const walkerFrom = this.walker.group.visible ? this.walker.opacity : 0;
    const rowJump = this.seat ? Math.abs(this.seat.rowIndex - seat.rowIndex) : 0;
    const arc = walkerFrom ? 0.3 : rowJump ? 0.25 + rowJump * 0.06 : 0.04;
    this.seat = seat;
    this.marker.visible = false;
    this.houseTarget = 0;
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
        P.yaw = lerpAngle(from.yaw, to.yaw, u);
        P.pitch = from.pitch + (to.pitch - from.pitch) * u;
        if (walkerFrom) this.walker.setOpacity(walkerFrom * (1 - smooth(0, 0.5, u)));
        if (t >= duration) {
          Object.assign(P, to);
          this.walker.setOpacity(0);
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

    // lampu ruangan meredup perlahan saat sudah duduk
    if (Math.abs(this.house - this.houseTarget) > 0.001) {
      this.house += (this.houseTarget - this.house) * (dt ? damp(1.3, dt) : 1);
      this._applyHouse();
    }

    const P = this.pose;
    const breathe = !this.anim ? Math.sin(this.time * 1.5) * 0.004 : 0;
    this.camera.position.set(P.x, P.y + breathe, P.z);
    this.camera.rotation.set(P.pitch + L.pitch, P.yaw + L.yaw, 0);

    this.walker.tick(this.time);
    if (this.marker.visible && this.seat) {
      this.marker.position.y = this.seat.floor + 1.55 + Math.sin(this.time * 3) * 0.06;
      this.marker.children[0].rotation.y += dt * 1.5;
      this.camera.updateMatrixWorld();
      this.markerGlow.lookAt(this.camera.position);
    }

    if (this.areaLight) {
      const f = 0.92 + 0.08 * Math.sin(this.time * 0.9) * Math.sin(this.time * 0.37);
      this.areaLight.intensity = 5.5 * f * this.screenBright;
    }
  }

  get busyWalking() {
    return !!(this.anim && this.anim.kind === 'walk');
  }
}
