import {getAuthSnapshot,subscribeAuth} from '../auth/auth-store';

// An optional-auth section is still bound to the identity that loaded it.
// A token refresh for the same identity is harmless; a changed identity is not.
export function bindSectionIdentity(root:HTMLElement){
 const captured=getAuthSnapshot().user?.id??null;
 const epoch=root.dataset.pageEpoch;
 let closed=false,leaving=false;
 const current=()=>!closed&&!leaving&&(getAuthSnapshot().user?.id??null)===captured;
 const stop=subscribeAuth(state=>{
  if(closed||leaving||root.dataset.pageEpoch!==epoch||!state.ready)return;
  if((state.user?.id??null)===captured)return;
  leaving=true;root.hidden=true;root.inert=true;
  root.querySelectorAll<HTMLMediaElement>('audio,video').forEach(media=>{media.pause();media.srcObject=null;media.removeAttribute('src');media.load();});
  // Use the normal page lifecycle and do not transfer the previous user's state.
  location.reload();
 });
 const dispose=()=>{if(closed)return;closed=true;stop();window.removeEventListener('pagehide',dispose);};
 window.addEventListener('pagehide',dispose,{once:true});
 return {current,dispose};
}
