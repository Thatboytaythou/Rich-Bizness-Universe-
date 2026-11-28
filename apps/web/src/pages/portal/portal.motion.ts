import {renderScheduler,boundedCanvasPixels} from '../../core/experience/render-scheduler';
type MotionOptions = { reduced: boolean };

type Particle = {
  x: number;
  y: number;
  z: number;
  r: number;
  s: number;
  h: number;
};

export function mountPortalMotion(options: MotionOptions): () => void {
  const canvas = document.querySelector<HTMLCanvasElement>('#portalMotionCanvas');
  const world = document.querySelector<HTMLElement>('.portal-world');
  const stage = world;
  if (!canvas || !world || !stage) return () => {};

  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return () => {};

  const lifecycle = new AbortController();
  const particles: Particle[] = Array.from({ length: options.reduced ? 20 : 52 }, (_, index) => ({
    x: Math.random(),
    y: Math.random(),
    z: 0.25 + Math.random() * 0.75,
    r: 0.4 + Math.random() * 1.7,
    s: 0.08 + Math.random() * 0.28,
    h: index % 5 === 0 ? 46 : 135
  }));

  let width = 0;
  let height = 0;
  let dpr = 1;
  let inView = true;
  const mobile=matchMedia('(any-pointer:coarse),(max-width:860px)').matches;
  let time = 0;
  let lastPaint = 0;
  let pointerX = 0.5;
  let pointerY = 0.5;
  let disposed = false;

  const resize = () => {
    width = Math.max(1, stage.clientWidth);
    height = Math.max(1, stage.clientHeight);
    const budget=boundedCanvasPixels(width,height,Math.min(window.devicePixelRatio||1,2),mobile?900000:1800000,mobile?1080:1600);
    dpr=budget.scale;const pixelWidth=budget.width,pixelHeight=budget.height;
    if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const paint = (advance: boolean) => {
    if (disposed) return;
    if (advance) time += 0.008;
    context.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;

    for (const particle of particles) {
      if (advance) {
        particle.y -= particle.s / height;
        if (particle.y < -0.02) {
          particle.y = 1.02;
          particle.x = Math.random();
        }
      }

      const drift = Math.sin(time * 2 + particle.z * 8) * 18 * particle.z;
      const x = particle.x * width + drift + (pointerX - 0.5) * 30 * particle.z;
      const y = particle.y * height + (pointerY - 0.5) * 20 * particle.z;
      const alpha = 0.12 + 0.5 * particle.z;

      context.beginPath();
      context.fillStyle = `hsla(${particle.h},95%,70%,${alpha})`;
      context.arc(x, y, particle.r * particle.z, 0, Math.PI * 2);
      context.fill();
    }

    const pulse = options.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(time * 3);
    const gradient = context.createRadialGradient(
      centerX,
      centerY,
      8,
      centerX,
      centerY,
      Math.min(width, height) * 0.31
    );
    gradient.addColorStop(0, `rgba(49,255,99,${0.08 + 0.08 * pulse})`);
    gradient.addColorStop(0.45, `rgba(247,201,72,${0.035 + 0.025 * pulse})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  };

  const frames=renderScheduler(now=>{if(!lastPaint||now-lastPaint>=32){lastPaint=now;paint(true);}},cb=>window.requestAnimationFrame(cb),id=>window.cancelAnimationFrame(id));
  const visibility=()=>{lastPaint=0;const visible=inView&&!document.hidden;stage.dataset.rbCanvasVisible=String(visible);frames.setVisible(visible&&!options.reduced);};
  const viewport=new IntersectionObserver(entries=>{inView=entries[0]?.isIntersecting??true;visibility();},{threshold:.02});
  viewport.observe(stage);

  const move = (event: PointerEvent) => {
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointerX = (event.clientX - rect.left) / rect.width;
    pointerY = (event.clientY - rect.top) / rect.height;
    const x = pointerX - 0.5;
    const y = pointerY - 0.5;
    world.style.setProperty('--tilt-x', `${-y * 7}deg`);
    world.style.setProperty('--tilt-y', `${x * 8}deg`);
    world.style.setProperty('--shift-x', `${x * 14}px`);
    world.style.setProperty('--shift-y', `${y * 12}px`);
  };

  const resetTilt = () => {
    world.style.setProperty('--tilt-x', '0deg');
    world.style.setProperty('--tilt-y', '0deg');
    world.style.setProperty('--shift-x', '0px');
    world.style.setProperty('--shift-y', '0px');
  };

  const resizeObserver = new ResizeObserver(() => {
    resize();
    if (options.reduced) paint(false);
  });

  resizeObserver.observe(stage);
  resize();

  if (options.reduced) {
    paint(false);
  } else {
    if(matchMedia('(hover:hover) and (pointer:fine)').matches)stage.addEventListener('pointermove', move, { signal: lifecycle.signal, passive: true });
    stage.addEventListener('pointerleave', resetTilt, { signal: lifecycle.signal });
    document.addEventListener('visibilitychange',visibility,{signal:lifecycle.signal});
    visibility();
  }

  return () => {
    disposed = true;
    lifecycle.abort();
    resizeObserver.disconnect();
    frames.stop();viewport.disconnect();
    resetTilt();
    context.clearRect(0, 0, width, height);
  };
}
