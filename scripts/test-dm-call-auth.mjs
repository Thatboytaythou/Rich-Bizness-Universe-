import assert from 'node:assert/strict';
import {authorizeDmCall} from '../api/live/token.js';
const base={id:'call',thread_id:'thread',started_by:'owner',call_type:'audio',call_status:'ringing',livekit_room_name:'rich-call-fixture',ended_at:null};
function db(call=base,member={status:'active'},participant={status:'invited'},fail=''){
 const rows={dm_call_sessions:call,dm_thread_members:member,dm_call_participants:participant};
 return {from(table){let row=rows[table];return {select(){return this;},eq(key,value){if(row&&key==='status'&&row.status!==value)row=null;return this;},in(key,values){if(row&&!values.includes(row[key]))row=null;return this;},async maybeSingle(){return {data:row,error:fail===table?{message:'fixture error'}:null};}};}};
}
assert.equal((await authorizeDmCall(db(),'call','owner')).role,'host');
assert.equal((await authorizeDmCall(db(),'call','other')).role,'participant');
assert.equal((await authorizeDmCall(db({...base,call_status:'ended'}),'call','owner')).status,403);
assert.equal((await authorizeDmCall(db({...base,ended_at:'now'}),'call','owner')).status,403);
assert.equal((await authorizeDmCall(db(base,null),'call','owner')).status,403);
assert.equal((await authorizeDmCall(db(base,{status:'left'}),'call','owner')).status,403);
assert.equal((await authorizeDmCall(db(base,{status:'active'},{status:'declined'}),'call','owner')).status,403);
assert.equal((await authorizeDmCall(db(base,{status:'active'},null),'call','other')).status,403);
assert.equal((await authorizeDmCall(db(base,{status:'active'},{status:'invited'},'dm_thread_members'),'call','owner')).status,503);
assert.equal((await authorizeDmCall(db({...base,livekit_room_name:'some-other-room'}),'call','owner')).status,403);
console.log('Rich-DM call authorization: active membership, explicit participant, call lifecycle and backend failures passed.');
