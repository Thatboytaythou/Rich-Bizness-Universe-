/** One pending frame, no hidden/off-screen wakeups, terminal stop. */
export function renderScheduler(draw:(now:number)=>void,request:(cb:(now:number)=>void)=>number,cancel:(id:number)=>void){
 let pending:number|null=null,visible=false,stopped=false;
 const schedule=()=>{if(stopped||!visible||pending!==null)return;pending=request(now=>{pending=null;if(stopped||!visible)return;draw(now);schedule();});};
 const setVisible=(value:boolean)=>{if(stopped)return;visible=value;if(!visible&&pending!==null){cancel(pending);pending=null;}if(visible)schedule();};
 const stop=()=>{setVisible(false);stopped=true;};
 return {setVisible,stop};
}
export function boundedCanvasPixels(width:number,height:number,dpr:number,maxPixels:number,maxSide:number){
 if(![width,height,dpr,maxPixels,maxSide].every(Number.isFinite)||width<=0||height<=0||dpr<=0||maxPixels<1||maxSide<1)return {width:1,height:1,scale:1};
 const scale=Math.min(dpr,Math.sqrt(maxPixels/(width*height)),maxSide/Math.max(width,height));
 return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale)),scale};
}
