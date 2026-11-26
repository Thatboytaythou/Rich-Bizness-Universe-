import { createClient } from '@supabase/supabase-js';
import { ENV } from '../../config/env';
import type { Database } from './database.types';

// Tap In only: bounded Auth network calls and non-sensitive connection stages.
const accessFetch:typeof fetch=async(input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input),location.origin);
  if(url.origin!==new URL(ENV.supabaseUrl).origin||!url.pathname.startsWith('/auth/v1/'))return fetch(input,init);
  const path=url.pathname.slice('/auth/v1/'.length);
  const stage=path==='token'?(url.searchParams.get('grant_type')==='password'?'password':'session-refresh'):path==='user'?'user-verification':path==='signup'?'signup':path==='recover'?'recovery':'auth-request';
  const report=(state:string)=>{document.body.dataset.rbAccessNetwork=stage+': '+state;window.dispatchEvent(new Event('rb-access-network'));};
  const controller=new AbortController();
  const original=init?.signal??(input instanceof Request?input.signal:undefined);
  const cancel=()=>controller.abort();
  if(original?.aborted)cancel();else original?.addEventListener('abort',cancel,{once:true});
  const timer=window.setTimeout(cancel,10000);
  report('request sent');
  try{const response=await fetch(input,{...init,signal:controller.signal});report('HTTP '+response.status);return response;}
  catch(error){report(controller.signal.aborted?'request timed out or cancelled':'network error');throw error;}
  finally{window.clearTimeout(timer);original?.removeEventListener('abort',cancel);}
};

export const supabase = createClient<Database>(ENV.supabaseUrl, ENV.supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'rich-bizness-auth'
  },
  realtime: {
    params: { eventsPerSecond: 20 },
    timeout: 20_000
  },
  global: {
    ...(typeof document!=='undefined'&&document.body?.dataset.page==='tap-in'?{fetch:accessFetch}:{}),
    headers: { 'x-application-name': 'rich-bizness-universe-web' }
  }
});
