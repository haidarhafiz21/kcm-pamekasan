// Tokoh kecil bergaya chibi yang berjalan ke kursi sambil membawa popcorn.
// Kepala besar, kaos belang merah-putih khas Madura, jalan melenggak-lenggok,
// melompat naik ke kursi, dan kakinya berayun karena tidak sampai lantai.
import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;

function stripes(colors, vertical, count) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const n = colors.length * count;
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[i % colors.length];
    if (vertical) g.fillRect((i * 64) / n, 0, 64 / n + 1, 64);
    else g.fillRect(0, (i * 64) / n, 64, 64 / n + 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function toonRamp() {
  const t = new THREE.DataTexture(new Uint8Array([90, 175, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

export class Walker {
  constructor(glowTexture) {
    this.stride = 0.9; // jarak satu siklus langkah (m)
    const g = (this.group = new THREE.Group());
    g.visible = false;
    const ramp = toonRamp();
    this.mats = [];
    const toon = (opts) => {
      const m = new THREE.MeshToonMaterial({ gradientMap: ramp, transparent: true, ...opts });
      m.userData.base = 1;
      this.mats.push(m);
      return m;
    };
    const basic = (opts, base = 1) => {
      const m = new THREE.MeshBasicMaterial({ transparent: true, ...opts });
      m.userData.base = base;
      m.opacity = base;
      this.mats.push(m);
      return m;
    };
    const skin = toon({ color: 0xf2c6a0, emissive: 0x3a2014, emissiveIntensity: 0.5 });
    const shirt = toon({ map: stripes(['#d8343c', '#f6f0e6'], false, 4), emissive: 0x2a1010, emissiveIntensity: 0.5 });
    const pants = toon({ color: 0x23252d, emissive: 0x0b0c12, emissiveIntensity: 0.6 });
    const hair = toon({ color: 0x2a1c16, emissive: 0x0a0605, emissiveIntensity: 0.6 });
    const shoe = toon({ color: 0xf0b545, emissive: 0x3a2508, emissiveIntensity: 0.5 });
    const bucketMat = toon({ map: stripes(['#d8343c', '#fbf6ec'], true, 6), emissive: 0x2a1010, emissiveIntensity: 0.4 });
    const corn = toon({ color: 0xfff0c4, emissive: 0x3a3018, emissiveIntensity: 0.6 });
    const ink = basic({ color: 0x15100e });
    const shine = basic({ color: 0xffffff });
    const blush = basic({ color: 0xff8a9a }, 0.75);

    const cap = (r, len, mat) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 16), mat);
    const ball = (r, mat, seg = 20) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), mat);

    // badan (semua di dalam "body" agar bisa melenggak & melompat bersama)
    this.body = new THREE.Group();
    g.add(this.body);

    const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.18, 0.15, 24), pants);
    shorts.position.y = 0.44;
    this.body.add(shorts);
    const torso = cap(0.17, 0.15, shirt);
    torso.position.y = 0.63;
    torso.scale.set(1, 1, 0.88);
    this.body.add(torso);

    // kepala
    this.head = new THREE.Group();
    this.head.position.y = 0.98;
    this.body.add(this.head);
    const skull = ball(0.22, skin, 32);
    skull.scale.set(1.04, 0.96, 1);
    this.head.add(skull);
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.232, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    hairCap.rotation.x = 0.38;
    hairCap.scale.set(1.04, 0.98, 1.02);
    this.head.add(hairCap);
    const curl = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.013, 8, 16, Math.PI * 1.3), hair);
    curl.position.set(0.02, 0.235, -0.02);
    curl.rotation.set(0, Math.PI / 2, 0.4);
    this.head.add(curl);

    this.eyes = [];
    for (const s of [-1, 1]) {
      const eye = ball(0.034, ink, 16);
      eye.position.set(s * 0.078, 0.005, -0.198);
      eye.scale.set(0.85, 1.25, 0.5);
      this.head.add(eye);
      this.eyes.push(eye);
      const hl = ball(0.011, shine, 10);
      hl.position.set(s * 0.078 + 0.012, 0.022, -0.214);
      this.head.add(hl);
      this.eyes.push(hl);
      const cheek = ball(0.036, blush, 14);
      cheek.position.set(s * 0.13, -0.06, -0.165);
      cheek.scale.set(1, 0.62, 0.35);
      this.head.add(cheek);
    }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 6, 16, Math.PI), ink);
    smile.position.set(0, -0.07, -0.205);
    smile.rotation.z = Math.PI;
    this.head.add(smile);

    // kaki
    this.legs = [-1, 1].map((side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.078, 0.4, 0);
      this.body.add(hip);
      const thigh = cap(0.062, 0.1, pants);
      thigh.position.y = -0.09;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.18;
      hip.add(knee);
      const shin = cap(0.055, 0.08, skin);
      shin.position.y = -0.07;
      knee.add(shin);
      const foot = ball(0.07, shoe, 18);
      foot.position.set(0, -0.172, -0.035);
      foot.scale.set(0.95, 0.62, 1.4);
      knee.add(foot);
      return { hip, knee };
    });

    // lengan memeluk ember popcorn
    this.arms = [-1, 1].map((side) => {
      const sh = new THREE.Group();
      sh.position.set(side * 0.19, 0.8, 0);
      this.body.add(sh);
      const arm = cap(0.05, 0.13, shirt);
      arm.position.y = -0.11;
      sh.add(arm);
      const hand = ball(0.055, skin, 16);
      hand.position.y = -0.24;
      sh.add(hand);
      return { sh, side };
    });

    this.bucket = new THREE.Group();
    this.bucket.position.set(0, 0.62, -0.2);
    this.body.add(this.bucket);
    const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.084, 0.2, 24), bucketMat);
    this.bucket.add(tub);
    let seed = 5;
    const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const kernels = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), corn, 16);
    const o = new THREE.Object3D();
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * 0.085;
      o.position.set(Math.cos(a) * d, 0.1 + (0.09 - d) * 0.6 + r() * 0.02, Math.sin(a) * d);
      const s = 0.026 + r() * 0.014;
      o.scale.set(s, s * 0.9, s);
      o.rotation.set(r() * 3, r() * 3, 0);
      o.updateMatrix();
      kernels.setMatrixAt(i, o.matrix);
    }
    this.bucket.add(kernels);

    // bayangan & cincin penanda di kaki
    this.blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false, map: glowTexture })
    );
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.006;
    g.add(this.blob);
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.27, 0.32, 48),
      new THREE.MeshBasicMaterial({ color: 0xe9b35a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.012;
    g.add(this.ring);

    this.opacity = 1;
    this.phase = 0;
    this.spd = 0;
    this.nextBlink = 1.5;
    this.reset();
  }

  reset() {
    this.sitK = 0;
    this.walk(0, 0);
  }

  // phase: fase langkah (radian), spd: 0..1
  walk(phase, spd) {
    this.phase = phase;
    this.spd = spd;
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    const k = this.sitK;
    const [L, R] = this.legs;
    const sw = 0.6 * spd;
    L.hip.rotation.x = lerp(sw * s, Math.PI / 2, k);
    R.hip.rotation.x = lerp(-sw * s, Math.PI / 2, k);
    L.knee.rotation.x = lerp(-0.75 * spd * Math.max(0, c), -1.35, k);
    R.knee.rotation.x = lerp(-0.75 * spd * Math.max(0, -c), -1.35, k);

    // melenggak-lenggok & memantul di tiap langkah
    const hop = Math.sin(Math.PI * k) * 0.16; // lompatan kecil saat naik ke kursi
    this.body.position.y = Math.abs(s) * 0.045 * spd * (1 - k) + lerp(0, 0.16, k) + hop;
    this.body.position.z = lerp(0, 0.04, k);
    this.body.rotation.z = s * 0.09 * spd * (1 - k);
    this.body.rotation.x = lerp(-0.05 * spd, -0.06, k);
    this.head.rotation.z = -s * 0.07 * spd;
    this.head.position.y = 0.98 + Math.abs(c) * 0.012 * spd;
    this.bucket.position.y = 0.62 + Math.abs(s) * 0.012 * spd;

    for (const a of this.arms) {
      a.sh.rotation.x = 0.9 + s * 0.06 * spd;
      a.sh.rotation.z = -a.side * 0.3;
    }
  }

  sit(k) {
    this.sitK = k;
    this.walk(this.phase, 0);
  }

  setOpacity(o) {
    if (o === this.opacity) return;
    this.opacity = o;
    for (const m of this.mats) m.opacity = o * m.userData.base;
    this.blob.material.opacity = 0.45 * o;
    this.ring.material.opacity = 0.85 * o * (1 - this.sitK);
    this.group.visible = o > 0.01;
  }

  tick(time) {
    if (!this.group.visible) return;
    const pulse = 0.6 + 0.4 * Math.sin(time * 4);
    this.ring.material.opacity = 0.85 * this.opacity * pulse * (1 - this.sitK);
    const sc = 1 + 0.08 * Math.sin(time * 4);
    this.ring.scale.set(sc, sc, sc);

    // berkedip sesekali
    const blink = time > this.nextBlink && time < this.nextBlink + 0.13;
    if (time > this.nextBlink + 0.13) this.nextBlink = time + 2 + Math.random() * 2.5;
    for (const e of this.eyes) e.scale.y = blink ? 0.12 : e === this.eyes[0] || e === this.eyes[2] ? 1.25 : 1;

    // kaki berayun saat duduk (tidak sampai lantai)
    if (this.sitK > 0.95) {
      const [L, R] = this.legs;
      L.knee.rotation.x = -1.35 + Math.sin(time * 5) * 0.28;
      R.knee.rotation.x = -1.35 + Math.sin(time * 5 + Math.PI) * 0.28;
      this.head.rotation.z = Math.sin(time * 2.5) * 0.06;
    }
  }
}
