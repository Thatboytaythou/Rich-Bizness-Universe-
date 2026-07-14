type MotionOptions={reduced:boolean};

export function mountPortalMotion(options:MotionOptions):()=>void{
 const canvas=document.querySelector<HTMLCanvasElement>('#portalMotionCanvas');
 const world=document.querySelector<HTMLElement>('.portal-world');
 const stage=document.querySelector<HTMLElement>('.portal-stage');
 if(!canvas||!world||!stage)return()=>{};
 const ctx=canvas.getContext('2d');if(!ctx)return()=>{};
 let width=0,height=0,dpr=1,raf=0,time=0,pointerX=.5,pointerY=.5;
 const particles=Array.from({length:options.reduced?24:90},(_,i)=>({x:Math.random(),y:Math.random(),z:.25+Math.random()*.75,r:.4+Math.random()*1.7,s:.08+Math.random()*.28,h:i%5===0?46:135}));
 const resize=()=>{dpr=Math.min(devicePixelRatio||1,2);width=stage.clientWidth;height=stage.clientHeight;canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;ctx.setTransform(dpr,0,0,dpr,0,0);};
 const draw=()=>{time+=.008;ctx.clearRect(0,0,width,height);const cx=width/2,cy=height/2;for(const p of particles){p.y-=p.s/height;if(p.y<-.02){p.y=1.02;p.x=Math.random();}const drift=Math.sin(time*2+p.z*8)*18*p.z;const x=p.x*width+drift+(pointerX-.5)*30*p.z;const y=p.y*height+(pointerY-.5)*20*p.z;const alpha=.12+.5*p.z;ctx.beginPath();ctx.fillStyle=`hsla(${p.h},95%,70%,${alpha})`;ctx.arc(x,y,p.r*p.z,0,Math.PI*2);ctx.fill();}const pulse=.5+.5*Math.sin(time*3);const gradient=ctx.createRadialGradient(cx,cy,8,cx,cy,Math.min(width,height)*.31);gradient.addColorStop(0,`rgba(49,255,99,${.08+.08*pulse})`);gradient.addColorStop(.45,`rgba(247,201,72,${.035+.025*pulse})`);gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);raf=requestAnimationFrame(draw);};
 const move=(event:PointerEvent)=>{const rect=stage.getBoundingClientRect();pointerX=(event.clientX-rect.left)/rect.width;pointerY=(event.clientY-rect.top)/rect.height;const x=(pointerX-.5),y=(pointerY-.5);world.style.setProperty('--tilt-x',`${-y*7}deg`);world.style.setProperty('--tilt-y',`${x*8}deg`);world.style.setProperty('--shift-x',`${x*14}px`);world.style.setProperty('--shift-y',`${y*12}px`);};
 const leave=()=>{world.style.setProperty('--tilt-x','0deg');world.style.setProperty('--tilt-y','0deg');world.style.setProperty('--shift-x','0px');world.style.setProperty('--shift-y','0px');};
 resize();window.addEventListener('resize',resize);if(!options.reduced){stage.addEventListener('pointermove',move);stage.addEventListener('pointerleave',leave);draw();}else draw();
 return()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',resize);stage.removeEventListener('pointermove',move);stage.removeEventListener('pointerleave',leave);};
}
