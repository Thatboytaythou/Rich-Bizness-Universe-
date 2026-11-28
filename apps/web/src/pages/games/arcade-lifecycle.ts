/** Single frame and heartbeat owner for standalone arcade game pages. */
export function createArcadeLifecycle(){
 let frameId:number|null=null,intervalId:number|null=null,disposed=false,pending:FrameRequestCallback|null=null;
 const cancelFrame=()=>{if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;};
 const clearFrame=()=>{cancelFrame();pending=null;};
 const clearRepeat=()=>{if(intervalId!==null)window.clearInterval(intervalId);intervalId=null;};
 const schedule=()=>{if(disposed||document.hidden||!pending||frameId!==null)return;frameId=requestAnimationFrame(time=>{frameId=null;if(disposed||document.hidden)return;const cb=pending;pending=null;cb?.(time);});};
 const visibility=()=>{if(document.hidden)cancelFrame();else schedule();};
 document.addEventListener?.('visibilitychange',visibility);
 const frame=(callback:FrameRequestCallback)=>{if(disposed)return;cancelFrame();pending=callback;schedule();};
 const repeat=(callback:()=>unknown,ms:number)=>{if(disposed)return;clearRepeat();intervalId=window.setInterval(()=>{if(!disposed&&!document.hidden)callback();},ms);};
 const dispose=()=>{if(disposed)return;disposed=true;clearFrame();clearRepeat();document.removeEventListener?.('visibilitychange',visibility);};
 return {get disposed(){return disposed;},frame,repeat,clearFrame,clearRepeat,dispose};
}
export function escapeGameText(value:unknown){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));}
