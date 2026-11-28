import {supabase} from '../supabase/client';
import type {Room, RemoteTrack} from 'livekit-client';

export type PrivateCallSession={close:()=>Promise<void>};
type CallOptions={callId:string;kind:'audio'|'video';surface:HTMLElement;valid:()=>boolean;onStatus:(message:string)=>void};
export async function connectPrivateCall({callId,kind,surface,valid,onStatus}:CallOptions):Promise<PrivateCallSession>{
  const {data:{session},error}=await supabase.auth.getSession();
  if(error||!session||!valid())throw Error('Verified Rich ID required.');
  const response=await fetch('/api/live/token',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({kind:'dm_call',callId}),signal:AbortSignal.timeout(12000)});
  const payload=await response.json();
  if(!response.ok||payload.ok!==true||payload.callType!==kind||typeof payload.token!=='string'||typeof payload.url!=='string'||!payload.url.startsWith('wss://')||typeof payload.roomName!=='string'||!valid())throw Error('Verified call access unavailable.');
  const {Room,RoomEvent,Track}=await import('livekit-client');
  if(!valid())throw Error('Call cancelled.');
  const room:Room=new Room({adaptiveStream:true,dynacast:true});
  const tracks=new Map<RemoteTrack,HTMLElement>();
  let closed=false;
  const close=async()=>{if(closed)return;closed=true;for(const [track,element] of tracks){track.detach(element as HTMLMediaElement);element.remove();}tracks.clear();await room.disconnect().catch(()=>undefined);surface.replaceChildren();};
  room.on(RoomEvent.TrackSubscribed,track=>{if(closed||!valid())return;const element=track.attach();element.autoplay=true;if(track.kind===Track.Kind.Video){(element as HTMLVideoElement).playsInline=true;element.style.maxWidth='100%';}tracks.set(track,element);surface.append(element);});
  room.on(RoomEvent.TrackUnsubscribed,track=>{const el=tracks.get(track);if(el){track.detach(el as HTMLMediaElement);el.remove();tracks.delete(track);}});
  room.on(RoomEvent.Reconnecting,()=>{if(!closed&&valid())onStatus('Reconnecting media transport…');});
  room.on(RoomEvent.Reconnected,()=>{if(!closed&&valid())onStatus('Media transport connected · microphone and camera controlled separately');});
  room.on(RoomEvent.Disconnected,()=>{if(!closed){onStatus('Media transport disconnected');void close();}});
  try{
    onStatus('Connecting media transport…');
    await room.connect(payload.url,payload.token,{autoSubscribe:true});
    if(!valid()){await close();throw Error('Call cancelled.');}
    // Joining is receive-only. Each local device is enabled only by explicit user action.
    onStatus('Media transport connected · microphone and camera off');
    const controls=document.createElement('div');controls.className='deep-actions';
    const action=(label:string,handler:()=>Promise<void>)=>{const b=document.createElement('button');b.type='button';b.className='comm-button';b.textContent=label;b.onclick=async()=>{if(closed||!valid())return;b.disabled=true;try{await handler();}catch{onStatus('Device permission or media action unavailable.');}finally{if(b.isConnected)b.disabled=false;}};controls.append(b);return b;};
    action('Enable audio playback',()=>room.startAudio());
    const mic=action('Microphone off',async()=>{await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled);mic.textContent=room.localParticipant.isMicrophoneEnabled?'Microphone on':'Microphone off';});
    if(kind==='video'){const cam=action('Camera off',async()=>{await room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled);cam.textContent=room.localParticipant.isCameraEnabled?'Camera on':'Camera off';});}
    action('Leave call',async()=>{await close();onStatus('Call left');});
    surface.prepend(controls);
    return {close};
  }catch(error){await close();throw error;}
}
