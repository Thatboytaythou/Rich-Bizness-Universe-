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
    tasks.push(import('./core/admin/secret-door').then(({mountAdminSecretDoor})=>{
      const cleanup=mountAdminSecretDoor();
      if(typeof cleanup==='function')cleanups.push(cleanup);
    }));
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

const cleanupOnExit=()=>{void clearGlobalRuntime();};
window.addEventListener('pagehide',cleanupOnExit,{once:true});
window.addEventListener('beforeunload',cleanupOnExit,{once:true});

void bootstrap().then(async()=>{
  const page=document.body.dataset.page??'';
  await mountGlobalRuntime(page);
}).catch(error=>{
  console.error('[Rich Bizness bootstrap]',error);
});
