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
  let w = 0, h = 0, dpr = 1, running = true;
  const rand = (a, b) => a + Math.random() * (b - a);
  const particles = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), z: rand(.18, 1), s: rand(.4, 2.2), v: rand(.05, .35) }));
  const towers = Array.from({ length: 34 }, (_, i) => ({ x: i / 33, height: rand(.18, .62), width: rand(.012, .035), glow: rand(.2, 1), phase: rand(0, 6.28) }));

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
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
    const portal = Math.min(w, h) * (w > 900 ? .23 : .38);
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, portal * 1.75);
    glow.addColorStop(0, 'rgba(99,255,93,.34)');
    glow.addColorStop(.42, 'rgba(14,90,42,.22)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, portal * 1.75, 0, Math.PI * 2);
    ctx.fill();

    particles.forEach((p) => {
      p.y += p.v * .0007;
      p.x += Math.sin(time * p.v + p.z * 9) * .00008;
      if (p.y > 1.08) p.y = -.04;
      const x = p.x * w;
      const y = p.y * h;
      ctx.fillStyle = `rgba(120,255,170,${.18 + p.z * .45})`;
      ctx.fillRect(x, y, p.s, p.s);
    });

    ctx.save();
    ctx.globalAlpha = .74;
    for (let r = 0; r < 3; r++) {
      ctx.strokeStyle = `rgba(99,255,93,${.24 - r * .05})`;
      ctx.lineWidth = 2 + r;
      ctx.beginPath();
      ctx.ellipse(cx, cy, portal * (1.18 + r * .22), portal * (.54 + r * .09), Math.sin(time * .18) * .16, 0, Math.PI * 2);
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
      const flicker = .25 + Math.sin(time * 2 + tw.phase) * .13 + tw.glow * .2;
      ctx.fillStyle = 'rgba(1,8,5,.92)';
      ctx.strokeStyle = `rgba(99,255,93,${.16 + flicker})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(x - twW / 2, y, twW, twH);
      ctx.fill();
      ctx.stroke();
      if (i % 4 === 0) {
        ctx.beginPath();
        ctx.moveTo(x - twW * .32, y);
        ctx.lineTo(x, y - twH * .18);
        ctx.lineTo(x + twW * .32, y);
        ctx.stroke();
      }
      for (let k = 0; k < 5; k++) {
        const wy = y + twH * (.18 + k * .13);
        line(x - twW * .32, wy, x + twW * .32, wy, `rgba(99,255,93,${.07 + flicker * .16})`, 1);
      }
    });

    const floorY = h * .82;
    ctx.save();
    ctx.globalAlpha = .38;
    for (let i = 0; i < 18; i++) {
      const yy = floorY + i * 22;
      line(0, yy, w, yy, 'rgba(99,255,93,.12)', 1);
    }
    for (let i = -16; i <= 16; i++) {
      const x = cx + i * 70;
      line(x, floorY, cx + i * 260, h, 'rgba(99,255,93,.1)', 1);
    }
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * .12);
    ctx.strokeStyle = 'rgba(99,255,93,.82)';
    ctx.lineWidth = Math.max(5, portal * .035);
    ctx.beginPath();
    ctx.arc(0, 0, portal, 0, Math.PI * 1.72);
    ctx.stroke();
    ctx.rotate(-time * .32);
    ctx.strokeStyle = 'rgba(247,201,72,.42)';
    ctx.lineWidth = Math.max(2, portal * .012);
    ctx.beginPath();
    ctx.arc(0, 0, portal * .72, Math.PI * .2, Math.PI * 1.44);
    ctx.stroke();
    ctx.restore();

    if (!reduceMotion) requestAnimationFrame(draw);
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((el) => { el.textContent = value.toLocaleString(); });
  }
  let live = 1248;
  let online = 24893;
  setInterval(() => {
    live = Math.max(900, live + Math.round(rand(-4, 9)));
    online = Math.max(18000, online + Math.round(rand(-80, 140)));
    setText('[data-live-count]', live);
    setText('[data-online-count]', online);
  }, 1800);

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running && !reduceMotion) requestAnimationFrame(draw);
  });

  resize();
  requestAnimationFrame(draw);
})();
