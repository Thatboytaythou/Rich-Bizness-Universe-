/** Single frame and heartbeat owner for standalone arcade game pages. */
export function createArcadeLifecycle(){
 let frameId:number|null=null,intervalId:number|null=null,disposed=false;
 const clearFrame=()=>{if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;};
 const clearRepeat=()=>{if(intervalId!==null)window.clearInterval(intervalId);intervalId=null;};
 const frame=(callback:FrameRequestCallback)=>{if(disposed)return;clearFrame();frameId=requestAnimationFrame(time=>{frameId=null;if(!disposed)callback(time);});};
 const repeat=(callback:()=>unknown,ms:number)=>{if(disposed)return;clearRepeat();intervalId=window.setInterval(()=>{if(!disposed&&!document.hidden)callback();},ms);};
 const dispose=()=>{if(disposed)return;disposed=true;clearFrame();clearRepeat();};
 return {get disposed(){return disposed;},frame,repeat,clearFrame,clearRepeat,dispose};
}
export function escapeGameText(value:unknown){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));}
