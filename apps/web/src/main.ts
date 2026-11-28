import './styles/tokens.css';
import './styles/base.css';
import './styles/cinematic.css';
import './styles/identity.css';
import './styles/xp-runtime.css';
import './styles/media-containment.css';
import { bootstrap } from './bootstrap';
import { mountXpRuntime } from './core/xp/xp-runtime';

const ADMIN_SECRET_DOOR_PAGES = new Set([
  'portal',
  'profile',
  'settings',
  'notifications',
  'messages',
  'creator',
  'admin'
]);

const GLOBAL_RUNTIME_EPOCH_KEY='rbGlobalRuntimeEpoch';
let globalRuntimeCleanup:(()=>void|Promise<void>)|null=null;
let globalRuntimeRoute='';

function blurActiveField():void{
  const active=document.activeElement;
  if(active instanceof HTMLInputElement||active instanceof HTMLTextAreaElement)active.blur();
}

async function clearGlobalRuntime():Promise<void>{
  const cleanup=globalRuntimeCleanup;
  globalRuntimeCleanup=null;
  if(typeof cleanup==='function')await cleanup();
  globalRuntimeRoute='';
}

async function mountGlobalRuntime(page:string):Promise<void>{
  const body=document.body;
  const route=`${page}:${location.pathname}${location.search}`;
  if(globalRuntimeRoute===route)return;

  await clearGlobalRuntime();

  const epoch=String(Number(body.dataset[GLOBAL_RUNTIME_EPOCH_KEY]??'0')+1);
  body.dataset[GLOBAL_RUNTIME_EPOCH_KEY]=epoch;

  if(page==='home'||page==='tap-in')return;
  if(page==='search'&&matchMedia('(max-width: 760px)').matches)blurActiveField();
  if(page==='portal')blurActiveField();

  const cleanups:Array<()=>void|Promise<void>>=[];
  const tasks:Promise<unknown>[]=[];
  if(page==='live'){
    tasks.push(import('./core/navigation/universe-bridge').then(({mountUniverseBridge})=>{
      const cleanup=mountUniverseBridge();
      if(typeof cleanup==='function')cleanups.push(cleanup);
    }));
  }
  if(ADMIN_SECRET_DOOR_PAGES.has(page)){
    tasks.push(import('./core/admin/secret-door').then(async ({mountAdminSecretDoor})=>{
      const cleanup=await mountAdminSecretDoor();
      if(typeof cleanup==='function')cleanups.push(cleanup);
    }));
  }
  if(page!=='home'&&page!=='portal'){
    tasks.push(import('./core/section-update/runtime').then(({mountSectionUpdates})=>{cleanups.push(mountSectionUpdates(page));}).catch(error=>console.warn('[Rich Bizness Section Update]',error)));
  }
  tasks.push(Promise.resolve(mountXpRuntime()).then((cleanup)=>{
    if(typeof cleanup==='function')cleanups.push(cleanup);
  }));

  const results=await Promise.allSettled(tasks);
  if(body.dataset[GLOBAL_RUNTIME_EPOCH_KEY]!==epoch){
    await Promise.allSettled(cleanups.map((cleanup)=>Promise.resolve(cleanup())));
    return;
  }
  const rejected=results.find((result):result is PromiseRejectedResult=>result.status==='rejected');
  if(rejected){
    await Promise.allSettled(cleanups.map((cleanup)=>Promise.resolve(cleanup())));
    throw rejected.reason;
  }

  globalRuntimeRoute=route;
  globalRuntimeCleanup=async()=>{
    if(globalRuntimeRoute!==route)return;
    globalRuntimeRoute='';
    const pending=[...cleanups].reverse();
    cleanups.length=0;
    await Promise.allSettled(pending.map((cleanup)=>Promise.resolve(cleanup())));
  };
}

const cleanupOnExit=()=>{const body=document.body;body.dataset[GLOBAL_RUNTIME_EPOCH_KEY]=String(Number(body.dataset[GLOBAL_RUNTIME_EPOCH_KEY]??'0')+1);void clearGlobalRuntime();};
window.addEventListener('pagehide',cleanupOnExit,{once:true});
// A cached document must not resume a disposed page or an obsolete Rich ID.
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});

void bootstrap().then(async(mounted)=>{
  if(!mounted)return;
  const page=document.body.dataset.page??'';
  if(page==='home'||page==='tap-in')return;
  if(page!=='portal'){
    await import('./core/navigation/omni-mini').then(({mountOmniMini})=>mountOmniMini(page)).catch(error=>console.warn('[Rich Bizness Mini Omni]',error));
  }
  await mountGlobalRuntime(page);
}).catch(error=>console.error('[Rich Bizness bootstrap]',error));
