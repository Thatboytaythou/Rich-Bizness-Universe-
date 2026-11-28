import {supabase} from '../../core/supabase/client';
import type {Json} from '../../core/supabase/database.types';
type Room=Record<string,any>;
export async function enterGameRoom(slug:string,action:'create'|'join',payload:Record<string,unknown>,signal?:AbortSignal):Promise<Room>{
 const request=supabase.rpc('rb_game_room_action',{p_action:action,p_game_slug:slug,p_payload:JSON.parse(JSON.stringify(payload)) as Json});
 const {data,error}=await (signal?request.abortSignal(signal):request);
 if(error)throw Error(error.message);const result=data as {ok?:boolean;room?:Room}|null;
 if(!result?.ok||typeof result.room?.id!=='string'||typeof result.room.room_code!=='string'||result.room.game_key!==slug)throw Error('Canonical game room unavailable');
 return result.room;
}
export async function exitGameRoom(slug:string,id:string){const {error}=await supabase.rpc('rb_game_room_action',{p_action:'leave',p_game_slug:slug,p_payload:{room_id:id}});if(error)throw Error(error.message);}
