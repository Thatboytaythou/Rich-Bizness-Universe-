import type {SupabaseClient} from '@supabase/supabase-js';
import {supabase} from '../../core/supabase/client';
import {subscribeAuth,getAuthSnapshot} from '../../core/auth/auth-store';
const db=supabase as unknown as SupabaseClient;
const services=['rides','food','packages','groceries','local','business','roadside','moving','errands'];
export function mountDashBookings(app:HTMLElement){
 const root=document.createElement('section');app.append(root);
 root.innerHTML='<h2>Business marketplace</h2><p role="status">Development backend not yet activated.</p><label>City<input maxlength="100"></label><label>Service<select></select></label><label>Schedule (optional)<input type="datetime-local"></label><button disabled>Search available businesses</button><div class="results"></div><h2>My bookings</h2><div class="bookings"></div><h2>Provider workspace</h2><div class="providers"></div>';
 const status=root.querySelector('p')!,city=root.querySelector('input')!,category=root.querySelector('select')!,schedule=root.querySelector<HTMLInputElement>('input[type=datetime-local]')!,search=root.querySelector('button')!,results=root.querySelector('.results')!,bookings=root.querySelector('.bookings')!,providers=root.querySelector('.providers')!;
 for(const key of services){const o=document.createElement('option');o.value=key;o.textContent=key;category.append(o);}
 let epoch=0;
 const uid=()=>getAuthSnapshot().ready?getAuthSnapshot().user?.id:null;
 const button=(label:string,action:()=>Promise<void>)=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>{b.disabled=true;void action().catch(()=>{status.textContent='Request failed; no success confirmed.';}).finally(()=>{b.disabled=false;});};return b;};
 const card=(parent:Element,label:string)=>{const a=document.createElement('article');a.textContent=label;parent.append(a);return a;};
 async function refresh(){const user=uid(),v=++epoch;search.disabled=true;bookings.replaceChildren();providers.replaceChildren();results.replaceChildren();if(!user)return;
 const [org,list,requests]=await Promise.all([db.from('rb_orgs').select('id,name').eq('owner_id',user),db.from('rb_dash_listings').select('id,org_id,title,online').limit(100),db.from('rb_dash_bookings').select('id,listing_id,customer_id,status').limit(100)]);
 if(v!==epoch||uid()!==user)return;if(org.error||list.error||requests.error){status.textContent='Development database unavailable; booking disabled.';return;}
 search.disabled=false;status.textContent='Development marketplace available. No payments collected.';
 const owned=new Set((org.data??[]).map(o=>o.id));
 const listings=(list.data??[]).filter(l=>owned.has(l.org_id));
 for(const o of org.data??[]){const a=card(providers,o.name);a.append(button('Publish quote listing for selected city and service',async()=>{if(uid()!==user)return;const r=await db.from('rb_dash_listings').insert({org_id:o.id,title:o.name,city:city.value.trim(),service:category.value,price_mode:'quote',online:false});if(r.error)throw r.error;await refresh();}));}
 for(const l of listings){const a=card(providers,l.title);a.append(button(l.online?'Go offline':'Go online',async()=>{if(uid()!==user)return;const r=await db.from('rb_dash_listings').update({online:!l.online}).eq('id',l.id).select('id').single();if(r.error)throw r.error;await refresh();}));}
 for(const r of requests.data??[]){const a=card(bookings,r.status+' • '+r.id.slice(0,8));if(listings.some(l=>l.id===r.listing_id)){for(const next of r.status==='requested'?['accepted','cancelled']:r.status==='accepted'?['completed','cancelled']:[]){a.append(button(next,async()=>{if(uid()!==user)return;const z=await db.from('rb_dash_bookings').update({status:next}).eq('id',r.id).eq('status',r.status).select('id').single();if(z.error)throw z.error;await refresh();}));}}}
 }
 search.onclick=()=>{const user=uid(),v=epoch;if(!user)return;void (async()=>{const r=await db.from('rb_dash_listings').select('id,title,price_mode,price_cents').eq('online',true).eq('city',city.value.trim()).eq('service',category.value).limit(50);if(uid()!==user||epoch!==v)return;results.replaceChildren();if(r.error){status.textContent='Search unavailable';return;}for(const l of r.data??[]){const a=card(results,l.title+' • '+l.price_mode);a.append(button('Request booking (no payment)',async()=>{if(uid()!==user||epoch!==v)return;const when=schedule.value?new Date(schedule.value).toISOString():null;const z=await db.from('rb_dash_bookings').insert({listing_id:l.id,customer_id:user,scheduled_at:when});if(z.error)throw z.error;await refresh();}));}})().catch(()=>{status.textContent='Search failed';});};
 subscribeAuth(()=>{void refresh().catch(()=>{status.textContent='Backend unavailable';});});
}
