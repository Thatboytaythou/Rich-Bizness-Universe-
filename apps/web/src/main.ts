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

const GLOBAL_RUNTIME_KEY='rbGlobalRuntimeOwner';
const GLOBAL_RUNTIME_EPOCH_KEY='rbGlobalRuntimeEpoch';

function blurActiveField():void{
  const active=document.activeElement;
  if(active instanceof HTMLInputElement||active instanceof HTMLTextAreaElement)active.blur();
}

async function mountGlobalRuntime(page:string):Promise<void>{
  const body=document.body;
  const owner=`${page}:${location.pathname}${location.search}`;
  const previousOwner=body.dataset[GLOBAL_RUNTIME_KEY];
  if(previousOwner===owner&&body.dataset.rbGlobalRuntimeMounted==='true')return;

  const epoch=String(Number(body.dataset[GLOBAL_RUNTIME_EPOCH_KEY]??'0')+1);
  body.dataset[GLOBAL_RUNTIME_EPOCH_KEY]=epoch;
  body.dataset[GLOBAL_RUNTIME_KEY]=owner;
  body.dataset.rbGlobalRuntimeMounted='false';

  if(page==='search'&&matchMedia('(max-width: 760px)').matches)blurActiveField();
  if(page==='portal')blurActiveField();

  const tasks:Promise<unknown>[]=[];
  if(page==='live'){
    tasks.push(import('./core/navigation/universe-bridge').then(({mountUniverseBridge})=>mountUniverseBridge()));
  }
  if(ADMIN_SECRET_DOOR_PAGES.has(page)){
    tasks.push(import('./core/admin/secret-door').then(({mountAdminSecretDoor})=>mountAdminSecretDoor()));
  }
  tasks.push(mountXpRuntime());

  const results=await Promise.allSettled(tasks);
  if(body.dataset[GLOBAL_RUNTIME_EPOCH_KEY]!==epoch)return;
  const rejected=results.find((result):result is PromiseRejectedResult=>result.status==='rejected');
  if(rejected){
    delete body.dataset.rbGlobalRuntimeMounted;
    throw rejected.reason;
  }
  body.dataset.rbGlobalRuntimeMounted='true';
}

void bootstrap().then(async()=>{
  const page=document.body.dataset.page??'';
  await mountGlobalRuntime(page);
}).catch(error=>{
  console.error('[Rich Bizness bootstrap]',error);
  document.body.dataset.rbGlobalRuntimeMounted='error';
});