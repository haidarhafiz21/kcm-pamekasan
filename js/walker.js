// Tokoh kecil yang berjalan ke kursi (dilihat dari kamera jauh).
// Dibuat dari bentuk sederhana dengan sendi pinggul, lutut, bahu, dan siku
// agar bisa berjalan dan duduk secara prosedural.
import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;

export class Walker {
  constructor(glowTexture) {
    const g = (this.group = new THREE.Group());
    g.visible = false;
    const std = (color, extra = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.8, transparent: true, ...extra });
    this.mats = [
      (this.shirt = std(0xece4d6, { emissive: 0x4a3a2a, emissiveIntensity: 0.55 })),
      (this.pants = std(0x2f3a52, { roughness: 0.9, emissive: 0x0c1220, emissiveIntensity: 0.6 })),
      (this.skin = std(0xc99b73, { roughness: 0.65, emissive: 0x3a2214, emissiveIntensity: 0.45 })),
      (this.hair = std(0x16100e, { roughness: 0.9 })),
      (this.shoe = std(0x161616, { roughness: 0.55 })),
    ];
    const cap = (r, len, mat) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 5, 12), mat);

    this.hips = new THREE.Group();
    this.hips.position.y = 0.92;
    g.add(this.hips);

    this.torso = new THREE.Group();
    this.hips.add(this.torso);
    const chest = cap(0.15, 0.3, this.shirt);
    chest.position.y = 0.28;
    chest.scale.set(1, 1, 0.66);
    this.torso.add(chest);
    const neck = cap(0.045, 0.05, this.skin);
    neck.position.y = 0.55;
    this.torso.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 18), this.skin);
    head.position.y = 0.68;
    head.scale.set(0.92, 1.06, 1);
    this.torso.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.112, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), this.hair);
    hair.position.set(0, 0.705, 0.012);
    hair.rotation.x = 0.28;
    hair.scale.set(0.95, 1, 1.04);
    this.torso.add(hair);

    const pelvis = cap(0.125, 0.07, this.pants);
    pelvis.rotation.z = Math.PI / 2;
    pelvis.scale.set(1, 1, 0.74);
    this.hips.add(pelvis);

    this.legs = [-1, 1].map((side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.085, -0.02, 0);
      this.hips.add(hip);
      const thigh = cap(0.062, 0.3, this.pants);
      thigh.position.y = -0.22;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.44;
      hip.add(knee);
      const shin = cap(0.05, 0.31, this.pants);
      shin.position.y = -0.2;
      knee.add(shin);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.21), this.shoe);
      foot.position.set(0, -0.43, -0.05);
      knee.add(foot);
      return { hip, knee };
    });

    this.arms = [-1, 1].map((side) => {
      const sh = new THREE.Group();
      sh.position.set(side * 0.205, 0.47, 0);
      this.torso.add(sh);
      const upper = cap(0.046, 0.22, this.shirt);
      upper.position.y = -0.14;
      sh.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.29;
      sh.add(elbow);
      const fore = cap(0.04, 0.2, this.skin);
      fore.position.y = -0.13;
      elbow.add(fore);
      return { sh, elbow, side };
    });

    // bayangan lembut & cincin penanda di kaki
    this.blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.34, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false, map: glowTexture })
    );
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.006;
    g.add(this.blob);
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.36, 48),
      new THREE.MeshBasicMaterial({ color: 0xe9b35a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.012;
    g.add(this.ring);
    this.opacity = 1;
    this.reset();
  }

  reset() {
    this.sitK = 0;
    this.walk(0, 0);
  }

  // phase: fase langkah (radian), spd: 0..1
  walk(phase, spd) {
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    const sit = this.sitK;
    const sw = 0.48 * spd;
    const [L, R] = this.legs;
    const walkL = sw * s;
    const walkR = -sw * s;
    const kneeL = -(0.08 + 0.85 * Math.max(0, c)) * spd;
    const kneeR = -(0.08 + 0.85 * Math.max(0, -c)) * spd;
    L.hip.rotation.x = lerp(walkL, 1.25, sit);
    R.hip.rotation.x = lerp(walkR, 1.25, sit);
    L.knee.rotation.x = lerp(kneeL, -1.25, sit);
    R.knee.rotation.x = lerp(kneeR, -1.25, sit);
    this.hips.position.y = lerp(0.92 - 0.028 * spd * Math.abs(s), 0.6, sit);
    this.torso.rotation.x = lerp(0.04 * spd, -0.14, sit);
    this.torso.rotation.y = 0.07 * spd * s * (1 - sit);
    for (const a of this.arms) {
      const swing = -0.42 * spd * s * (a.side < 0 ? 1 : -1);
      a.sh.rotation.x = lerp(swing, 0.55, sit);
      a.sh.rotation.z = a.side * lerp(0.06, 0.12, sit);
      a.elbow.rotation.x = lerp(0.18 + 0.25 * spd, 0.75, sit);
    }
  }

  sit(k) {
    this.sitK = k;
    this.walk(0, 0);
  }

  setOpacity(o) {
    if (o === this.opacity) return;
    this.opacity = o;
    for (const m of this.mats) m.opacity = o;
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
  }
}
