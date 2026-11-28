import {supabase} from '../../core/supabase/client';
import {startGameSession,finishGameSession,saveGameCheckpoint} from './game-runtime-client';
export function readArcadeSave(key:string):Record<string,unknown>{
 try{const value=JSON.parse(localStorage.getItem(key)??'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}
}
export function writeArcadeSave(key:string,value:Record<string,unknown>):boolean{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
export function createArcadePersistence(slug:string){
 let tail:Promise<unknown>=Promise.resolve();
 let started:Promise<string|null>|null=null;
 const identity=async(id:string)=>{const {data,error}=await supabase.auth.getSession();if(error||data.session?.user.id!==id)throw Error('Rich ID changed or session unavailable');};
 const begin=(id:unknown)=>{
   if(typeof id!=='string'||!id){started=null;return;}
   started=tail.then(async()=>{await identity(id);const result=await startGameSession(slug,{source:'arcade-v1'});if(!result.ok)throw Error('Cloud game start rejected');return id;}).catch(()=>null);
   tail=started;
 };
 const complete=(score:number,mode:string,result:string,checkpoint:Record<string,unknown>)=>{
   const own=started;started=null;
   if(!own)return Promise.resolve('local' as const);
   const job=tail.then(async()=>{
      const id=await own;if(!id)return 'local' as const;await identity(id);
      const finished=await finishGameSession(slug,{score,mode,result});if(!finished.ok)throw Error('Cloud game completion rejected');
      if(Object.keys(checkpoint).length){await identity(id);const saved=await saveGameCheckpoint(slug,checkpoint,{mirrorLocal:false,metadata:{source:'arcade-v1'}});if(!saved.ok)throw Error('Cloud checkpoint rejected');}
      return 'synced' as const;
   }).catch(()=> 'unconfirmed' as const);
   tail=job;return job;
 };
 return {begin,complete};
}
