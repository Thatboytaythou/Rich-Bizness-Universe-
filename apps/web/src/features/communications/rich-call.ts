import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';

type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };
type CallRow = { id:string; thread_id:string; started_by:string; call_type:string|null; call_status:string|null; livekit_room_name:string|null };

const isUuid=(value:string|null)=>Boolean(value&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));

export async function mountRichCall():Promise<void>{
  const callId=new URLSearchParams(location.search).get('call');
  if(!isUuid(callId))return;
  const user=getAuthSnapshot().user;
  if(!user)return;

  const host=window as CleanupHost;
  const previousCleanup=host.__rbPageCleanup;
  let disposed=false;
  let room:any=null;
  let overlay:HTMLElement|null=null;
  let micEnabled=true;
  let cameraEnabled=false;
  let call:CallRow|null=null;

  const removeCallParam=()=>{
    const url=new URL(location.href);
    url.searchParams.delete('call');
    history.replaceState({},'',`${url.pathname}${url.search}${url.hash}`);
  };

  const updateParticipant=async(status:'joined'|'left')=>{
    if(!call)return;
    const patch:Record<string,unknown>={status,audio_enabled:status==='joined'?micEnabled:false,video_enabled:status==='joined'?cameraEnabled:false};
    if(status==='joined'){patch.joined_at=new Date().toISOString();patch.left_at=null;}
    else patch.left_at=new Date().toISOString();
    await supabase.from('dm_call_participants').update(patch).eq('call_id',call.id).eq('user_id',user.id);
  };

  const setCallStatus=async(status:'active'|'ended')=>{
    if(!call||call.started_by!==user.id)return;
    const patch:Record<string,unknown>={call_status:status};
    if(status==='active')patch.started_at=new Date().toISOString();
    if(status==='ended')patch.ended_at=new Date().toISOString();
    await supabase.from('dm_call_sessions').update(patch).eq('id',call.id).eq('started_by',user.id);
  };

  const stopMedia=()=>{
    overlay?.querySelectorAll<HTMLMediaElement>('audio,video').forEach(node=>{try{node.pause();node.srcObject=null;}catch{}});
  };

  const cleanupCall=async(endForEveryone=false)=>{
    if(disposed)return;
    disposed=true;
    try{await updateParticipant('left');}catch{}
    if(endForEveryone){try{await setCallStatus('ended');}catch{}}
    try{await room?.disconnect();}catch{}
    room=null;
    stopMedia();
    overlay?.remove();overlay=null;
    removeCallParam();
  };

  try{
    const{data,error}=await supabase.from('dm_call_sessions').select('id,thread_id,started_by,call_type,call_status,livekit_room_name').eq('id',callId).maybeSingle();
    if(error)throw error;
    call=(data??null) as CallRow|null;
    if(!call||!call.livekit_room_name)throw new Error('Rich Call is unavailable.');
    if(['ended','missed','declined','cancelled'].includes(String(call.call_status||'').toLowerCase()))throw new Error('This Rich Call has ended.');

    cameraEnabled=String(call.call_type||'audio')==='video';
    overlay=document.createElement('section');
    overlay.className='rich-call-overlay';
    overlay.innerHTML=`<div class="rich-call-stage"><header><div><small>RICH CALL</small><strong>${esc(String(call.call_type||'audio').toUpperCase())}</strong></div><span id="richCallState">CONNECTING…</span></header><div id="richCallRemote" class="rich-call-remote"><div class="rich-call-wait"><b>◉</b><strong>CONNECTING ROOM</strong><span>Securing realtime media…</span></div></div><div id="richCallLocal" class="rich-call-local"></div><footer><button id="richCallMic" type="button">MIC ON</button><button id="richCallCam" type="button" ${cameraEnabled?'':'hidden'}>CAM ON</button><button id="richCallEnd" class="danger" type="button">${call.started_by===user.id?'END CALL':'LEAVE'}</button></footer></div>`;
    document.body.append(overlay);

    const state=overlay.querySelector<HTMLElement>('#richCallState')!;
    const remote=overlay.querySelector<HTMLElement>('#richCallRemote')!;
    const local=overlay.querySelector<HTMLElement>('#richCallLocal')!;
    const micButton=overlay.querySelector<HTMLButtonElement>('#richCallMic')!;
    const camButton=overlay.querySelector<HTMLButtonElement>('#richCallCam')!;
    const endButton=overlay.querySelector<HTMLButtonElement>('#richCallEnd')!;

    const{data:functionData,error:functionError}=await supabase.functions.invoke('livekit-token',{body:{roomName:call.livekit_room_name}});
    if(functionError)throw functionError;
    const token=String((functionData as any)?.token||'');
    const url=String((functionData as any)?.url||'');
    if(!token||!url)throw new Error('Rich Call token unavailable.');

    const{Room,RoomEvent,Track}=await import('livekit-client');
    if(disposed)return;
    room=new Room({adaptiveStream:true,dynacast:true});

    const attachTrack=(track:any,participant:any)=>{
      if(disposed||!overlay)return;
      const element=track.attach();
      element.autoplay=true;
      if(track.kind===Track.Kind.Video){
        element.setAttribute('playsinline','true');
        const shell=document.createElement('article');shell.className='rich-call-participant';
        const label=document.createElement('span');label.textContent=participant?.name||participant?.identity||'Rich Member';
        shell.append(element,label);remote.querySelector('.rich-call-wait')?.remove();remote.append(shell);
      }else{
        element.style.display='none';overlay.append(element);
      }
    };

    room.on(RoomEvent.TrackSubscribed,(track:any,_publication:any,participant:any)=>attachTrack(track,participant));
    room.on(RoomEvent.TrackUnsubscribed,(track:any)=>{try{track.detach().forEach((node:HTMLElement)=>node.remove());}catch{}});
    room.on(RoomEvent.Disconnected,()=>{if(!disposed){state.textContent='DISCONNECTED';void cleanupCall(false);}});

    await room.connect(url,token);
    if(disposed)return;
    state.textContent='CONNECTED';
    await room.localParticipant.setMicrophoneEnabled(true);
    if(cameraEnabled)await room.localParticipant.setCameraEnabled(true);

    for(const publication of room.localParticipant.videoTrackPublications.values()){
      const track=(publication as any).track;
      if(!track)continue;
      const element=track.attach();element.muted=true;element.autoplay=true;element.setAttribute('playsinline','true');local.append(element);
    }

    await updateParticipant('joined');
    await setCallStatus('active');

    micButton.onclick=async()=>{if(disposed||!room)return;micEnabled=!micEnabled;await room.localParticipant.setMicrophoneEnabled(micEnabled);micButton.textContent=micEnabled?'MIC ON':'MIC OFF';await updateParticipant('joined');};
    camButton.onclick=async()=>{if(disposed||!room)return;cameraEnabled=!cameraEnabled;await room.localParticipant.setCameraEnabled(cameraEnabled);camButton.textContent=cameraEnabled?'CAM ON':'CAM OFF';if(cameraEnabled&&!local.querySelector('video')){for(const publication of room.localParticipant.videoTrackPublications.values()){const track=(publication as any).track;if(track){const el=track.attach();el.muted=true;el.autoplay=true;el.setAttribute('playsinline','true');local.append(el);}}}if(!cameraEnabled)local.querySelectorAll('video').forEach(el=>el.remove());await updateParticipant('joined');};
    endButton.onclick=()=>void cleanupCall(call?.started_by===user.id);
  }catch(error){
    if(disposed)return;
    overlay?.remove();overlay=null;
    removeCallParam();
    const app=document.querySelector<HTMLElement>('#app');
    if(app){const notice=document.createElement('p');notice.className='rich-call-error';notice.textContent=error instanceof Error?error.message:'Unable to join Rich Call.';app.prepend(notice);window.setTimeout(()=>notice.remove(),4500);}
  }

  const ownCleanup=host.__rbPageCleanup;
  host.__rbPageCleanup=async()=>{
    await cleanupCall(false);
    if(typeof ownCleanup==='function'&&ownCleanup!==host.__rbPageCleanup)await ownCleanup();
    else if(typeof previousCleanup==='function'&&previousCleanup!==host.__rbPageCleanup)await previousCleanup();
  };
}
