import {supabase} from '../../core/supabase/client';
import {GAMES} from '@rb/config/games';
type Entry={category:string;id:string;title:string;subtitle:string|null;image_url:string|null;target_url:string;score:number};
type Row=Record<string,unknown>;
const text=(v:unknown)=>typeof v==='string'?v:'';
const target=(page:string,key:string,id:string)=>'/'+page+'.html?'+key+'='+encodeURIComponent(id);
// Guest reads are explicit public projections under existing RLS, never privileged RPCs.
// Profiles and sports are intentionally excluded until their visibility rules are certified.
export async function publicDiscovery(query:string,category:string){
 const q=query.trim().slice(0,100), pattern='%'+q.replace(/[\\%_]/g,c=>'\\'+c)+'%';
 const rows:Entry[]=[];const inventory:Record<string,number>={};const unavailable:string[]=[];
 const add=(cat:string,r:Row,title:string,subtitle:string,image:string,url:string)=>{if(!title||!text(r.id))return;rows.push({category:cat,id:text(r.id),title,subtitle:subtitle||null,image_url:image||null,target_url:url,score:title.toLowerCase().startsWith(q.toLowerCase())?10:6});};
 const match=(cat:string)=>category==='all'||category===cat;
 const read=async(cat:string,request:PromiseLike<{data:unknown;error:unknown;count:number|null}>,render:(r:Row)=>void)=>{try{const {data,error,count}=await request;if(error)throw error;const items=Array.isArray(data)?data as Row[]:[];inventory[cat]=count??items.length;items.forEach(render);}catch{unavailable.push(cat);}};
 const jobs:Promise<void>[]=[];
 if(match('gaming')){let req=supabase.from('games').select('id,slug,title,game_type,thumbnail_url,cover_url',{count:'exact'}).eq('is_active',true);if(q.length>=2)req=req.ilike('title',pattern);jobs.push(read('gaming',req.order('title').limit(60),r=>{const game=GAMES.find(g=>g.slug===r.slug);if(game)add('gaming',r,text(r.title),text(r.game_type),text(r.thumbnail_url)||text(r.cover_url),game.route);}));}
 if(match('store')){let req=supabase.from('products').select('id,title,category,image_url,cover_url',{count:'exact'}).eq('is_public',true).eq('status','active');if(q.length>=2)req=req.ilike('title',pattern);jobs.push(read('store',req.order('title').limit(40),r=>add('store',r,text(r.title),text(r.category),text(r.image_url)||text(r.cover_url),target('store','product',text(r.id)))));}
 if(match('music')){let req=supabase.from('music_tracks').select('id,title,genre,cover_url',{count:'exact'}).eq('is_published',true).eq('visibility','public');if(q.length>=2)req=req.ilike('title',pattern);jobs.push(read('music',req.order('title').limit(40),r=>add('music',r,text(r.title),text(r.genre),text(r.cover_url),target('music','id',text(r.id)))));}
 if(match('podcast')){let req=supabase.from('podcast_episodes').select('id,title,cover_url,thumbnail_url',{count:'exact'}).eq('is_published',true).eq('visibility','public');if(q.length>=2)req=req.ilike('title',pattern);jobs.push(read('podcast',req.order('title').limit(40),r=>add('podcast',r,text(r.title),'Podcast',text(r.thumbnail_url)||text(r.cover_url),target('podcast','id',text(r.id)))));}
 if(match('radio')){let req=supabase.from('radio_stations').select('id,station_name,genre,cover_url',{count:'exact'}).eq('is_public',true);if(q.length>=2)req=req.ilike('station_name',pattern);jobs.push(read('radio',req.order('station_name').limit(40),r=>add('radio',r,text(r.station_name),text(r.genre),text(r.cover_url),target('radio','id',text(r.id)))));}
 if(match('live')){let req=supabase.from('live_streams').select('id,title,category,thumbnail_url,cover_url',{count:'exact'}).eq('status','live').eq('access_type','free');if(q.length>=2)req=req.ilike('title',pattern);jobs.push(read('live',req.order('title').limit(40),r=>add('live',r,text(r.title),text(r.category),text(r.thumbnail_url)||text(r.cover_url),target('live','stream',text(r.id)))));}
 if(match('meta')){let req=supabase.from('meta_worlds').select('id,slug,title,world_type,cover_url,background_url',{count:'exact'}).eq('status','active').eq('access_type','public');if(q.length>=2)req=req.ilike('title',pattern);jobs.push(read('meta',req.order('title').limit(40),r=>add('meta',r,text(r.title),text(r.world_type),text(r.cover_url)||text(r.background_url),target('meta','world',text(r.slug)))));}
 if(['all','feed','gallery','watch'].includes(category)){let req=supabase.from('feed_posts').select('id,title,section,post_type,media_type,thumbnail_url,cover_url',{count:'exact'}).eq('visibility','public').in('moderation_state',['clear','approved']);if(q.length>=2)req=req.ilike('title',pattern);jobs.push(read('feed',req.order('created_at',{ascending:false}).limit(80),r=>{const cat=text(r.section)==='gallery'?'gallery':text(r.section)==='watch'||text(r.post_type)==='video'||text(r.media_type).startsWith('video')?'watch':'feed';if(match(cat))add(cat,r,text(r.title),cat,text(r.thumbnail_url)||text(r.cover_url),cat==='watch'?'/watch.html?type=feed_video&id='+encodeURIComponent(text(r.id)):target(cat,cat==='feed'?'post':'id',text(r.id)));}));}
 await Promise.all(jobs);
 for(const cat of ['feed','gallery','watch'])inventory[cat]=rows.filter(r=>r.category===cat).length;
 const sorted=rows.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title)), selected=sorted.slice(0,120);
 return {query:q,category,results:q.length>=2?selected:[],featured:selected,inventory,counts:inventory,total:sorted.length,recent:[],trending:[],unavailable};
}
