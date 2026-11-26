// Local-only silent recording of the WebGL canvas. Never accesses camera or microphone.
export function mountPerformanceCapture(root:HTMLElement,getCanvas:()=>HTMLCanvasElement,ready:()=>boolean,signal:AbortSignal){
 const start=root.querySelector<HTMLButtonElement>('#acRecordStart')!,stop=root.querySelector<HTMLButtonElement>('#acRecordStop')!,status=root.querySelector<HTMLElement>('#acRecordStatus')!,download=root.querySelector<HTMLAnchorElement>('#acRecordDownload')!;
 let recorder:MediaRecorder|null=null,stream:MediaStream|null=null,url='',timer=0,chunks:Blob[]=[];
 const supported=typeof MediaRecorder!=='undefined'&&typeof HTMLCanvasElement.prototype.captureStream==='function';
 const cleanStream=()=>{clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());stream=null;};
 const finish=()=>{if(recorder?.state==='recording')recorder.stop();};
 const clear=()=>{if(url)URL.revokeObjectURL(url);url='';download.hidden=true;download.removeAttribute('href');};
 const release=()=>{if(recorder?.state==='recording')recorder.stop();cleanStream();clear();};
 start.disabled=!supported;stop.disabled=true;
 if(!supported)status.textContent='Canvas video recording is unavailable in this browser.';
 start.onclick=()=>{if(!supported||recorder?.state==='recording')return;if(!ready()){status.textContent='Enable 3D and wait until your selected character renders.';return;}
  clear();chunks=[];try{getCanvas().scrollIntoView({block:'center',behavior:'auto'});stream=getCanvas().captureStream(24);const mime=['video/mp4','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));recorder=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:2500000}:{videoBitsPerSecond:2500000});
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorder.onstop=()=>{const type=recorder?.mimeType||chunks[0]?.type||'video/webm';cleanStream();start.disabled=!supported;stop.disabled=true;if(signal.aborted)return;const blob=new Blob(chunks,{type});chunks=[];if(!blob.size){status.textContent='No video frames recorded.';return;}url=URL.createObjectURL(blob);download.href=url;download.download='rich-bizness-performance.'+(type.includes('mp4')?'mp4':'webm');download.hidden=false;status.textContent='Silent performance recording ready. Saved locally only.';};
   recorder.onerror=()=>{cleanStream();start.disabled=!supported;stop.disabled=true;status.textContent='Recording failed in this browser.';};
   recorder.start(250);start.disabled=true;stop.disabled=false;status.textContent='Recording live canvas · maximum 30 seconds';timer=window.setTimeout(finish,30000);
  }catch(e){cleanStream();status.textContent=e instanceof Error?e.message:'Recording unavailable';}
 };
 stop.onclick=finish;document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();},{signal});
 signal.addEventListener('abort',release,{once:true});
 return {finish};
}
