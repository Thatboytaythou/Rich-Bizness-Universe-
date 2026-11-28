/** Original paint helpers: no hitbox, physics, progression or extra canvas allocation. */
export function metalSphere(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,color:string){
 if(!Number.isFinite(r)||r<=0)return;
 const g=ctx.createRadialGradient(x-r*.36,y-r*.38,r*.08,x,y,r);
 g.addColorStop(0,'#fff6df');g.addColorStop(.27,color);g.addColorStop(.75,color);g.addColorStop(1,'#061013');
 ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
}
export function metalPanel(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string){
 if(w<=0||h<=0)return;
 const g=ctx.createLinearGradient(x,y,x,y+h);g.addColorStop(0,'#fff6df');g.addColorStop(.16,color);g.addColorStop(.72,color);g.addColorStop(1,'#071713');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
}
export function arenaLight(ctx:CanvasRenderingContext2D,w:number,h:number,color:string){
 if(w<=0||h<=0)return;const g=ctx.createRadialGradient(w*.5,h*.14,0,w*.5,h*.14,Math.max(w,h)*.7);
 g.addColorStop(0,color);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
}
