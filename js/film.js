// Adegan "film" prosedural untuk layar: senja di pesisir Madura.
// Digambar di canvas 2D lalu dipakai sebagai tekstur layar 3D.

export function createFilm(w = 1280, h = 536) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const horizon = h * 0.6;

  // titik acak deterministik
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  const ridge = (base, amp, step) => {
    const pts = [];
    for (let x = -20; x <= w + 20; x += step) pts.push([x, base - amp * (0.5 + 0.5 * Math.sin(x * 0.004 + rnd() * 0.6)) - rnd() * amp * 0.35]);
    return pts;
  };
  const far = ridge(horizon, h * 0.07, 24);
  const near = ridge(horizon + 2, h * 0.035, 18).map(([x, y]) => [x * 0.55 - w * 0.05, y]);

  const glints = Array.from({ length: 70 }, () => ({
    y: horizon + 4 + Math.pow(rnd(), 1.6) * (h - horizon - 8),
    o: rnd() * Math.PI * 2,
    s: 0.6 + rnd() * 1.4,
  }));
  const birds = Array.from({ length: 5 }, (_, i) => ({ x: rnd(), y: 0.16 + rnd() * 0.18, s: 0.6 + rnd() * 0.6, p: rnd() * 6, v: 0.006 + rnd() * 0.004 + i * 0.0006 }));

  // langit statis dirender sekali agar ringan
  const sky = document.createElement('canvas');
  sky.width = w;
  sky.height = h;
  const s = sky.getContext('2d');
  const g = s.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, '#1b2440');
  g.addColorStop(0.45, '#6a4a63');
  g.addColorStop(0.78, '#e08a5c');
  g.addColorStop(1, '#f6c27e');
  s.fillStyle = g;
  s.fillRect(0, 0, w, horizon + 1);
  // awan tipis
  s.globalAlpha = 0.22;
  for (let i = 0; i < 9; i++) {
    const cy = horizon * (0.25 + rnd() * 0.5);
    const cx = rnd() * w;
    const cw = w * (0.18 + rnd() * 0.25);
    const cg = s.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
    cg.addColorStop(0, 'rgba(255,190,150,0)');
    cg.addColorStop(0.5, 'rgba(255,190,150,1)');
    cg.addColorStop(1, 'rgba(255,190,150,0)');
    s.fillStyle = cg;
    s.fillRect(cx - cw / 2, cy, cw, 2 + rnd() * 4);
  }
  s.globalAlpha = 1;
  const sea = s.createLinearGradient(0, horizon, 0, h);
  sea.addColorStop(0, '#c98a6a');
  sea.addColorStop(0.12, '#5b4a5c');
  sea.addColorStop(1, '#141826');
  s.fillStyle = sea;
  s.fillRect(0, horizon, w, h - horizon);

  const sunX = w * 0.64;
  const tint = { r: 0.95, g: 0.62, b: 0.45 };

  function poly(pts, color, bottom) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], bottom);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(pts[pts.length - 1][0], bottom);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function boat(x, y, scale, rock) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rock);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#120d14';
    // lambung perahu
    ctx.beginPath();
    ctx.moveTo(-60, -6);
    ctx.quadraticCurveTo(-64, -16, -72, -20);
    ctx.lineTo(-50, -4);
    ctx.lineTo(48, -4);
    ctx.lineTo(70, -22);
    ctx.quadraticCurveTo(66, -10, 58, -4);
    ctx.quadraticCurveTo(40, 8, 0, 8);
    ctx.quadraticCurveTo(-42, 8, -60, -6);
    ctx.fill();
    // tiang & layar
    ctx.fillRect(-2, -78, 2.4, 74);
    ctx.beginPath();
    ctx.moveTo(1, -76);
    ctx.quadraticCurveTo(30, -44, 40, -10);
    ctx.lineTo(1, -10);
    ctx.closePath();
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.globalAlpha = 1;
    // nelayan
    ctx.fillRect(-28, -22, 5, 16);
    ctx.beginPath();
    ctx.arc(-25.5, -25, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw(t) {
    ctx.drawImage(sky, 0, 0);

    // matahari
    const sunY = horizon - h * 0.035 + Math.sin(t * 0.05) * 2;
    const halo = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, h * 0.45);
    halo.addColorStop(0, 'rgba(255,226,170,0.85)');
    halo.addColorStop(0.15, 'rgba(255,190,120,0.35)');
    halo.addColorStop(1, 'rgba(255,160,110,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, horizon);
    ctx.fillStyle = '#ffe9bf';
    ctx.beginPath();
    ctx.arc(sunX, sunY, h * 0.045, 0, Math.PI * 2);
    ctx.fill();

    // pulau jauh
    poly(far, 'rgba(78,52,72,0.85)', horizon + 1);
    poly(near, 'rgba(46,32,48,0.95)', horizon + 1);

    // pantulan matahari di laut
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizon, w, h - horizon);
    ctx.clip();
    for (const gl of glints) {
      const depth = (gl.y - horizon) / (h - horizon);
      const spread = 18 + depth * 220;
      const x = sunX + Math.sin(t * gl.s + gl.o) * spread * 0.5;
      const len = (10 + depth * 70) * (0.6 + 0.4 * Math.sin(t * 1.3 + gl.o));
      ctx.globalAlpha = (1 - depth) * 0.75 * (0.5 + 0.5 * Math.sin(t * 2 * gl.s + gl.o));
      ctx.fillStyle = '#ffd9a0';
      ctx.fillRect(x - len / 2, gl.y, len, 1.5 + depth * 2);
    }
    ctx.globalAlpha = 1;
    // garis ombak halus
    ctx.strokeStyle = 'rgba(255,200,170,0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const y = horizon + 8 + Math.pow(i / 14, 1.7) * (h - horizon);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + t * 0.8 + i) * (1 + i * 0.3));
      ctx.stroke();
    }
    ctx.restore();

    // perahu bergerak perlahan
    const cycle = 70;
    const p = (t % cycle) / cycle;
    const bx = -w * 0.15 + p * w * 1.3;
    const by = horizon + h * 0.22 + Math.sin(t * 1.4) * 2.5;
    boat(bx, by, 1.15, Math.sin(t * 1.1) * 0.03);
    // pantulan perahu
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.translate(0, by * 2 + 14);
    ctx.scale(1, -0.55);
    boat(bx, by, 1.15, -Math.sin(t * 1.1) * 0.03);
    ctx.restore();

    // burung
    ctx.strokeStyle = 'rgba(20,14,22,0.85)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (const b of birds) {
      const bxp = ((b.x + t * b.v) % 1.2) * w - w * 0.1;
      const byp = b.y * h + Math.sin(t * 0.7 + b.p) * 6;
      const flap = Math.sin(t * 7 * b.s + b.p) * 4;
      ctx.beginPath();
      ctx.moveTo(bxp - 7 * b.s, byp - flap);
      ctx.quadraticCurveTo(bxp - 3 * b.s, byp - 2, bxp, byp);
      ctx.quadraticCurveTo(bxp + 3 * b.s, byp - 2, bxp + 7 * b.s, byp - flap);
      ctx.stroke();
    }

    // vinyet tipis
    const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  draw(0);
  return { canvas, draw, tint };
}
