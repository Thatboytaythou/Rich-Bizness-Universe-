(() => {
  const root = document.querySelector('.rb-universe');
  if (!root || document.getElementById('cinemaCanvas')) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'cinemaCanvas';
  canvas.className = 'cinema-canvas';
  root.prepend(canvas);

  const vignette = document.createElement('div');
  vignette.className = 'cinema-vignette';
  root.prepend(vignette);

  const scan = document.createElement('div');
  scan.className = 'cinema-scan';
  root.prepend(scan);

  document.querySelectorAll('.graph').forEach((g) => {
    if (!g.querySelector('span')) g.appendChild(document.createElement('span'));
  });
  document.querySelectorAll('.avatar-stand').forEach((a) => {
    if (!a.querySelector('span')) a.appendChild(Object.assign(document.createElement('span'), { textContent: 'RB' }));
  });

  const ctx = canvas.getContext('2d', { alpha: true });
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(hover:none), (max-width:700px)').matches;
  let w = 0, h = 0, dpr = 1, running = true, last = 0;
  const rand = (a, b) => a + Math.random() * (b - a);
  const particleCount = mobile ? 52 : 130;
  const towerCount = mobile ? 18 : 34;
  const particles = Array.from({ length: particleCount }, () => ({ x: Math.random(), y: Math.random(), z: rand(.18, 1), s: rand(.4, 1.8), v: rand(.05, .3) }));
  const towers = Array.from({ length: towerCount }, (_, i) => ({ x: i / Math.max(1, towerCount - 1), height: rand(.18, .58), width: rand(.012, .033), glow: rand(.2, 1), phase: rand(0, 6.28) }));

  function resize() {
    dpr = mobile ? 1 : Math.min(devicePixelRatio || 1, 2);
    w = innerWidth;
    h = innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function line(x1, y1, x2, y2, color, width = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function draw(t) {
    if (!running) return;
    if (mobile && t - last < 66) {
      requestAnimationFrame(draw);
      return;
    }
    last = t;
    const time = t * .001;
    ctx.clearRect(0, 0, w, h);

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#07131a');
    sky.addColorStop(.55, '#020604');
    sky.addColorStop(1, '#000000');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const cx = w * .5;
    const cy = h * (w > 900 ? .44 : .34);
    const portal = Math.min(w, h) * (w > 900 ? .23 : .36);
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, portal * 1.65);
    glow.addColorStop(0, 'rgba(99,255,93,.3)');
    glow.addColorStop(.42, 'rgba(14,90,42,.18)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, portal * 1.65, 0, Math.PI * 2);
    ctx.fill();

    particles.forEach((p) => {
      p.y += p.v * .0009;
      if (p.y > 1.08) p.y = -.04;
      ctx.fillStyle = `rgba(120,255,170,${.16 + p.z * .38})`;
      ctx.fillRect(p.x * w, p.y * h, p.s, p.s);
    });

    ctx.save();
    ctx.globalAlpha = .6;
    const orbitLoops = mobile ? 2 : 3;
    for (let r = 0; r < orbitLoops; r++) {
      ctx.strokeStyle = `rgba(99,255,93,${.21 - r * .05})`;
      ctx.lineWidth = 2 + r;
      ctx.beginPath();
      ctx.ellipse(cx, cy, portal * (1.18 + r * .22), portal * (.54 + r * .09), Math.sin(time * .14) * .16, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    const base = h * (w > 900 ? .76 : .68);
    towers.forEach((tw, i) => {
      const x = tw.x * w;
      const perspective = 1 - Math.abs(tw.x - .5) * .42;
      const twH = h * tw.height * perspective;
      const twW = Math.max(8, w * tw.width);
      const y = base - twH;
      const flicker = mobile ? .26 : .25 + Math.sin(time * 2 + tw.phase) * .13 + tw.glow * .2;
      ctx.fillStyle = 'rgba(1,8,5,.9)';
      ctx.strokeStyle = `rgba(99,255,93,${.14 + flicker})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(x - twW / 2, y, twW, twH);
      ctx.fill();
      ctx.stroke();
      if (!mobile && i % 4 === 0) {
        ctx.beginPath();
        ctx.moveTo(x - twW * .32, y);
        ctx.lineTo(x, y - twH * .18);
        ctx.lineTo(x + twW * .32, y);
        ctx.stroke();
      }
    });

    if (!mobile) {
      const floorY = h * .82;
      ctx.save();
      ctx.globalAlpha = .38;
      for (let i = 0; i < 18; i++) line(0, floorY + i * 22, w, floorY + i * 22, 'rgba(99,255,93,.12)', 1);
      for (let i = -16; i <= 16; i++) line(cx + i * 70, floorY, cx + i * 260, h, 'rgba(99,255,93,.1)', 1);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * .08);
    ctx.strokeStyle = 'rgba(99,255,93,.76)';
    ctx.lineWidth = Math.max(4, portal * .028);
    ctx.beginPath();
    ctx.arc(0, 0, portal, 0, Math.PI * 1.72);
    ctx.stroke();
    ctx.restore();

    if (!reduceMotion) requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running && !reduceMotion) requestAnimationFrame(draw);
  });

  resize();
  requestAnimationFrame(draw);
})();
