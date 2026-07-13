import { supabase } from './supabase-client.js';
import { RB_CONFIG } from './config.js';

const $=(id)=>document.getElementById(id);
const routes=Object.values(RB_CONFIG.routes).filter((value,index,all)=>value&&all.indexOf(value)===index&&value!=='/admin.html');
const set=(id,value)=>{const node=$(id);if(node)node.textContent=value;};
const row=(name,status,detail)=>`<article class="health-row"><b>${name}</b><span data-ok="${status?'true':'false'}">${status?'ONLINE':'CHECK'}</span><small>${detail}</small></article>`;

async function checkRoute(route){
  const started=performance.now();
  try{
    const response=await fetch(route,{method:'GET',cache:'no-store',redirect:'follow'});
    return {route,ok:response.ok,status:response.status,ms:Math.round(performance.now()-started)};
  }catch(error){return {route,ok:false,status:0,ms:Math.round(performance.now()-started),error:error.message};}
}

async function run(){
  set('healthStatus','RUNNING PRODUCTION CHECKS');
  $('routeList').innerHTML='<p>Checking routes...</p>';
  const results=await Promise.all(routes.map(checkRoute));
  const passed=results.filter((item)=>item.ok).length;
  set('routeMetric',`${passed}/${results.length}`);
  $('routeList').innerHTML=results.map((item)=>row(item.route,item.ok,`${item.status||'ERR'} · ${item.ms}ms`)).join('');

  let db=false;
  let realtime=false;
  const services=[];
  if(supabase){
    const started=performance.now();
    const {error}=await supabase.from(RB_CONFIG.tables.profiles).select('id',{head:true,count:'exact'}).limit(1);
    db=!error;
    services.push(row('Supabase API',db,error?.message||`${Math.round(performance.now()-started)}ms response`));
    realtime=Boolean(supabase.channel);
    services.push(row('Realtime client',realtime,realtime?'Client available':'Client unavailable'));
  }else{
    services.push(row('Supabase API',false,'Environment is not configured'));
    services.push(row('Realtime client',false,'Environment is not configured'));
  }
  set('dbMetric',db?'ONLINE':'CHECK');
  set('rtMetric',realtime?'READY':'CHECK');
  const overall=passed===results.length&&db&&realtime;
  set('overallMetric',overall?'HEALTHY':'ATTENTION');
  $('serviceList').innerHTML=services.join('');
  set('healthStatus',overall?'PRODUCTION HEALTHY':'PRODUCTION CHECK COMPLETE');
}

$('runChecks')?.addEventListener('click',run);
run();
