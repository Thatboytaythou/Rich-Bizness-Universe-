import {supabase} from '../../core/supabase/client';
import {getAuthSnapshot} from '../../core/auth/auth-store';

export type Residence={lighting:'daylight'|'evening';furnishing:'emerald'|'onyx'|'cognac'};
export const defaultResidence:Residence={lighting:'daylight',furnishing:'emerald'};
export async function readResidence(userId:string,signal:AbortSignal):Promise<Residence>{
  const {data,error}=await supabase.from('rb_residence_settings').select('lighting,furnishing').eq('user_id',userId).abortSignal(signal).maybeSingle();
  if(error)throw Error(error.message);return data?data as Residence:{...defaultResidence};
}
export async function saveResidence(userId:string,value:Residence,signal:AbortSignal):Promise<Residence>{
  if(getAuthSnapshot().user?.id!==userId)throw Error('Rich ID changed');
  const {error}=await supabase.from('rb_residence_settings').upsert({user_id:userId,...value},{onConflict:'user_id'}).abortSignal(signal);if(error)throw Error(error.message);
  const saved=await readResidence(userId,signal);if(saved.lighting!==value.lighting||saved.furnishing!==value.furnishing)throw Error('Residence readback mismatch');return saved;
}
export function mountRecordingConsole(container:HTMLElement):()=>void{
  container.innerHTML='<h2>Recording console</h2><p>Record a voice take on this device. Nothing is uploaded automatically.</p><div class="al-record-actions"><button type="button" data-record>RECORD</button><button type="button" data-stop disabled>STOP</button></div><p data-record-status role="status">Ready for microphone permission.</p><audio controls hidden></audio><a data-export hidden>EXPORT TAKE</a><a href="/upload.html">OPEN PUBLISH STATION</a>';
  const record=container.querySelector<HTMLButtonElement>('[data-record]')!,stop=container.querySelector<HTMLButtonElement>('[data-stop]')!,status=container.querySelector<HTMLElement>('[data-record-status]')!,audio=container.querySelector<HTMLAudioElement>('audio')!,link=container.querySelector<HTMLAnchorElement>('[data-export]')!;
  let stream:MediaStream|null=null,recorder:MediaRecorder|null=null,url='',closed=false,pending=false,timer=0;
  const release=()=>{stream?.getTracks().forEach(t=>t.stop());stream=null;clearTimeout(timer);};
  const reset=()=>{if(url)URL.revokeObjectURL(url);url='';audio.removeAttribute('src');audio.hidden=true;link.hidden=true;};
  record.onclick=async()=>{if(closed||pending||recorder?.state==='recording')return;if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){status.textContent='Recording unavailable in this browser.';return;}pending=true;record.disabled=true;
    try{const granted=await navigator.mediaDevices.getUserMedia({audio:true});if(closed){granted.getTracks().forEach(t=>t.stop());return;}stream=granted;reset();const chunks:Blob[]=[];recorder=new MediaRecorder(stream);const active=recorder;active.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};active.onstop=()=>{release();if(closed)return;const type=active.mimeType||chunks[0]?.type||'audio/webm';const blob=new Blob(chunks,{type});if(!blob.size){status.textContent='No audio captured.';}else{url=URL.createObjectURL(blob);audio.src=url;audio.hidden=false;link.href=url;link.download='rich-bizness-take.'+(type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':'webm');link.hidden=false;status.textContent='Take ready for playback and export.';}record.disabled=false;stop.disabled=true;};active.onerror=()=>{release();status.textContent='Recording interrupted.';record.disabled=false;stop.disabled=true;};active.start(1000);stop.disabled=false;status.textContent='Recording • maximum 60 seconds';timer=window.setTimeout(()=>{if(active.state==='recording')active.stop();},60000);
    }catch{release();if(!closed){status.textContent='Microphone unavailable or permission denied.';record.disabled=false;}}finally{pending=false;}
  };
  stop.onclick=()=>{if(recorder?.state==='recording')recorder.stop();};
  return ()=>{closed=true;if(recorder?.state==='recording')recorder.stop();release();reset();};
}
