// Adegan "film" untuk layar: senja di pesisir Madura.
// Latar statis (langit, matahari, pulau, laut) digambar SEKALI ke tekstur
// beresolusi tinggi. Bagian yang bergerak (riak air, kilau matahari, perahu,
// burung) dihitung di GPU lewat shader, jadi tidak ada unggah tekstur per
// frame — lebih tajam dan jauh lebih ringan.
import * as THREE from 'three';

const W = 2048;
const H = 858; // rasio 2,39 : 1 (layar bioskop)
const HORIZON = 0.6; // dari atas
const SUN_X = 0.64;

function drawPlate() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const hz = H * HORIZON;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  const sky = g.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#18213c');
  sky.addColorStop(0.42, '#5f4561');
  sky.addColorStop(0.78, '#df8a5d');
  sky.addColorStop(1, '#f7c47f');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, hz + 1);

  // awan tipis memanjang
  for (let i = 0; i < 14; i++) {
    const cy = hz * (0.18 + rnd() * 0.6);
    const cx = rnd() * W;
    const cw = W * (0.14 + rnd() * 0.28);
    const ch = 2 + rnd() * 6;
    const cg = g.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
    const a = 0.12 + rnd() * 0.18;
    cg.addColorStop(0, 'rgba(255,190,150,0)');
    cg.addColorStop(0.5, `rgba(255,192,152,${a})`);
    cg.addColorStop(1, 'rgba(255,190,150,0)');
    g.fillStyle = cg;
    g.beginPath();
    g.ellipse(cx, cy, cw / 2, ch, 0, 0, Math.PI * 2);
    g.fill();
  }

  // laut
  const sea = g.createLinearGradient(0, hz, 0, H);
  sea.addColorStop(0, '#c88a6b');
  sea.addColorStop(0.1, '#5a4a5d');
  sea.addColorStop(1, '#12162a');
  g.fillStyle = sea;
  g.fillRect(0, hz, W, H - hz);

  // matahari + pendar
  const sx = W * SUN_X;
  const sy = hz - H * 0.035;
  const halo = g.createRadialGradient(sx, sy, 4, sx, sy, H * 0.5);
  halo.addColorStop(0, 'rgba(255,228,172,0.9)');
  halo.addColorStop(0.14, 'rgba(255,190,120,0.36)');
  halo.addColorStop(1, 'rgba(255,160,110,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, W, hz);
  g.fillStyle = '#ffeac2';
  g.beginPath();
  g.arc(sx, sy, H * 0.045, 0, Math.PI * 2);
  g.fill();

  // pulau di kejauhan (dua lapis)
  const ridge = (base, amp, step, color, scale = 1, shift = 0) => {
    g.beginPath();
    g.moveTo(-20, hz + 1);
    for (let x = -20; x <= W + 20; x += step) {
      const y = base - amp * (0.5 + 0.5 * Math.sin(x * 0.0025 + rnd() * 0.5)) - rnd() * amp * 0.3;
      g.lineTo(x * scale + shift, y);
    }
    g.lineTo(W + 20, hz + 1);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  };
  ridge(hz, H * 0.07, 22, 'rgba(78,52,72,0.88)');
  ridge(hz + 2, H * 0.035, 14, 'rgba(44,30,46,0.96)', 0.55, -W * 0.05);
  return c;
}

function drawBoat() {
  // siluet perahu; garis air di 15% dari bawah, lebar = 2× tinggi
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.translate(256, 256 * 0.85);
  g.scale(2.2, 2.2);
  g.fillStyle = '#000';
  g.beginPath();
  g.moveTo(-60, -6);
  g.quadraticCurveTo(-64, -16, -72, -20);
  g.lineTo(-50, -4);
  g.lineTo(48, -4);
  g.lineTo(70, -22);
  g.quadraticCurveTo(66, -10, 58, -4);
  g.quadraticCurveTo(40, 8, 0, 8);
  g.quadraticCurveTo(-42, 8, -60, -6);
  g.fill();
  g.fillRect(-2, -84, 2.6, 80);
  g.beginPath();
  g.moveTo(1, -82);
  g.quadraticCurveTo(32, -48, 42, -10);
  g.lineTo(1, -10);
  g.closePath();
  g.fill();
  g.fillRect(-28, -22, 5, 16);
  g.beginPath();
  g.arc(-25.5, -25, 3.6, 0, Math.PI * 2);
  g.fill();
  return c;
}

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = /* glsl */ `
uniform sampler2D uPlate;
uniform sampler2D uBoat;
uniform float uTime;
uniform float uAspect;
uniform float uHorizon;
uniform float uSunX;
uniform vec3 uBoatPos;   // x, y garis air (uv), tinggi sprite (satuan tinggi layar)
uniform float uRock;
uniform float uBright;
varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
float boat(vec2 uv, bool mirror) {
  vec2 p = uv - uBoatPos.xy;
  p.x *= uAspect;
  if (mirror) p.y = -p.y / 0.55;
  float c = cos(uRock), s = sin(uRock);
  p = mat2(c, s, -s, c) * p;
  vec2 q = p / uBoatPos.z;
  vec2 st = vec2(q.x * 0.5 + 0.5, q.y + 0.15);
  if (st.x < 0.0 || st.x > 1.0 || st.y < 0.0 || st.y > 1.0) return 0.0;
  return texture2D(uBoat, st).a;
}

void main() {
  vec2 uv = vUv;
  float t = uTime;
  vec3 col = texture2D(uPlate, uv).rgb;

  if (uv.y < uHorizon) {
    float depth = (uHorizon - uv.y) / uHorizon;      // 0 di cakrawala, 1 di bawah
    float pz = 1.0 / (depth + 0.045);                  // perspektif
    vec2 wp = vec2(uv.x * uAspect * pz * 0.8, pz * 5.0);
    float n = noise(wp + vec2(t * 0.12, -t * 0.45)) * 0.6 + noise(wp * 2.3 + vec2(-t * 0.2, -t * 0.7)) * 0.4;
    col *= 0.9 + 0.2 * n;

    float spread = 0.012 + depth * 0.15;
    float column = exp(-pow((uv.x - uSunX) / spread, 2.0));
    float g = noise(vec2(uv.x * uAspect * pz * 2.4, pz * 13.0) + vec2(t * 0.35, -t * 1.1));
    float sparkle = smoothstep(0.6, 0.92, g) * column * pow(1.0 - depth, 0.7);
    col += vec3(1.0, 0.72, 0.42) * sparkle * 1.5;
    col += vec3(1.0, 0.62, 0.38) * column * 0.05 * (1.0 - depth);
  }

  // pantulan perahu (bergelombang) lalu perahunya
  if (uv.y < uBoatPos.y) {
    vec2 ru = uv + vec2(sin(uv.y * 420.0 + t * 3.0) * 0.0016, 0.0);
    col = mix(col, col * 0.4, boat(ru, true) * 0.6);
  }
  col = mix(col, vec3(0.006, 0.004, 0.008), boat(uv, false));

  // burung
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float sx = hash(vec2(fi, 1.7));
    float sy = hash(vec2(fi, 9.1));
    float sc = 0.7 + hash(vec2(fi, 4.3)) * 0.6;
    float ph = hash(vec2(fi, 6.2)) * 6.283;
    float v = 0.006 + hash(vec2(fi, 2.9)) * 0.004 + fi * 0.0006;
    vec2 b = vec2(mod(sx + t * v, 1.2) - 0.1, 1.0 - (0.16 + sy * 0.18) + sin(t * 0.7 + ph) * 0.007);
    vec2 p = (uv - b) * vec2(uAspect, 1.0);
    float s = 0.0095 * sc;
    float flap = sin(t * 7.0 * sc + ph) * 0.0055;
    float d = min(
      min(sdSeg(p, vec2(0.0), vec2(-0.45 * s, 0.0025)), sdSeg(p, vec2(-0.45 * s, 0.0025), vec2(-s, flap))),
      min(sdSeg(p, vec2(0.0), vec2(0.45 * s, 0.0025)), sdSeg(p, vec2(0.45 * s, 0.0025), vec2(s, flap))));
    float a = 1.0 - smoothstep(0.0007, 0.0019, d);
    col = mix(col, vec3(0.012, 0.008, 0.014), a * 0.85);
  }

  vec2 cv = (uv - 0.5) * vec2(uAspect, 1.0);
  col *= mix(1.0, 0.66, smoothstep(0.35, 1.3, length(cv)));

  gl_FragColor = vec4(col * uBright, 1.0);
  #include <colorspace_fragment>
}`;

export function createFilm(renderer) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const plate = new THREE.CanvasTexture(drawPlate());
  plate.colorSpace = THREE.SRGBColorSpace;
  plate.anisotropy = maxAniso;
  const boat = new THREE.CanvasTexture(drawBoat());
  boat.anisotropy = maxAniso;

  const uniforms = {
    uPlate: { value: plate },
    uBoat: { value: boat },
    uTime: { value: 0 },
    uAspect: { value: W / H },
    uHorizon: { value: 1 - HORIZON },
    uSunX: { value: SUN_X },
    uBoatPos: { value: new THREE.Vector3(0.3, 0.18, 0.2) },
    uRock: { value: 0 },
    uBright: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, toneMapped: false });

  return {
    material,
    setBright(b) {
      uniforms.uBright.value = b;
    },
    update(t) {
      uniforms.uTime.value = t;
      const cycle = 70;
      const p = ((t + 18) % cycle) / cycle;
      uniforms.uBoatPos.value.set(-0.15 + p * 1.3, 0.18 + Math.sin(t * 1.4) * 0.0045, 0.2);
      uniforms.uRock.value = Math.sin(t * 1.1) * 0.03;
    },
  };
}
