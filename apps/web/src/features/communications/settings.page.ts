import { supabase } from '../../core/supabase/client';
import './communications.css';
import './settings-universe.css';

type JsonMap=Record<string,unknown>;
type UserSettings={profile_visibility?:string;dm_privacy?:string;motion_level?:string;notification_level?:string;accent_color?:string;cinema_mode?:boolean;tv_mode?:boolean;metadata?:JsonMap};
type ThemeSettings={background_style?:string;profile_layout?:string;avatar_frame?:string;button_style?:string;smoke_fx?:boolean;glow_fx?:boolean;depth_3d?:boolean;metadata?:JsonMap};
function bool(obj:JsonMap,key:string,fallback:boolean){return typeof obj[key]==='boolean'?obj[key] as boolean:fallback;}
function selected(value:unknown,expected:string){return String(value??'')===expected?' selected':'';}

export async function mount():Promise<void>{
 const root=document.querySelector<HTMLElement>('#app');if(!root)throw new Error('Missing #app mount');
 const {data:{session}}=await supabase.auth.getSession();if(!session){location.replace('/tap-in.html?next=%2Fsettings.html');return;}
 const [{data:profileData,error:profileError},{data:userSettingsData,error:userSettingsError},{data:themeData,error:themeError}]=await Promise.all([
  supabase.from('profiles').select('privacy_config,notification_config,online_status').eq('id',session.user.id).single(),
  supabase.from('user_settings').select('profile_visibility,dm_privacy,motion_level,notification_level,accent_color,cinema_mode,tv_mode,metadata').eq('user_id',session.user.id).maybeSingle(),
  supabase.from('profile_theme_settings').select('background_style,profile_layout,avatar_frame,button_style,smoke_fx,glow_fx,depth_3d,metadata').eq('user_id',session.user.id).maybeSingle()
 ]);
 if(profileError)throw profileError;if(userSettingsError)throw userSettingsError;if(themeError)throw themeError;
 const privacy=((profileData as any)?.privacy_config??{}) as JsonMap;const notify=((profileData as any)?.notification_config??{}) as JsonMap;
 const userSettings=(userSettingsData??{}) as UserSettings;const theme=(themeData??{}) as ThemeSettings;
 root.innerHTML=`<main class="comm-shell"><div class="comm-wrap"><header class="comm-head"><a href="/profile.html">←</a><div><p>RICH BIZNESS CONTROL CENTER</p><h1>Settings</h1></div><span id="saveState" class="comm-pill">READY</span></header><form id="settingsForm" class="comm-card comm-form">
 <section><h2>Notifications</h2>
 <label class="toggle-row"><span><strong>Direct messages</strong><br/>Alert me when Rich-DM’s arrive.</span><input type="checkbox" name="dm" ${bool(notify,'dm',true)?'checked':''}></label>
 <label class="toggle-row"><span><strong>Live alerts</strong><br/>Creators, VIP rooms, and broadcasts.</span><input type="checkbox" name="live" ${bool(notify,'live',true)?'checked':''}></label>
 <label class="toggle-row"><span><strong>Music + podcast</strong><br/>Drops, releases, comments, and plays.</span><input type="checkbox" name="music" ${bool(notify,'music',true)?'checked':''}></label>
 <label class="toggle-row"><span><strong>Store alerts</strong><br/>Orders, sales, comments, and drops.</span><input type="checkbox" name="store" ${bool(notify,'store',true)?'checked':''}></label>
 <label class="toggle-row"><span><strong>Sports alerts</strong><br/>Picks, broadcasts, and team activity.</span><input type="checkbox" name="sports" ${bool(notify,'sports',true)?'checked':''}></label>
 <label class="toggle-row"><span><strong>Game alerts</strong><br/>Challenges, rewards, and tournaments.</span><input type="checkbox" name="gaming" ${bool(notify,'gaming',true)?'checked':''}></label>
 <label><span>ALERT LEVEL</span><select name="notification_level"><option value="all"${selected(userSettings.notification_level,'all')}>ALL ACTIVITY</option><option value="important"${selected(userSettings.notification_level??'important','important')}>IMPORTANT ONLY</option><option value="silent"${selected(userSettings.notification_level,'silent')}>SILENT</option></select></label></section>
 <section><h2>Privacy & Presence</h2>
 <label><span>PROFILE VISIBILITY</span><select name="profile_visibility"><option value="public"${selected(userSettings.profile_visibility??'public','public')}>PUBLIC</option><option value="followers"${selected(userSettings.profile_visibility,'followers')}>FOLLOWERS ONLY</option><option value="private"${selected(userSettings.profile_visibility,'private')}>PRIVATE</option></select></label>
 <label><span>WHO CAN MESSAGE ME</span><select name="dm_privacy"><option value="everyone"${selected(userSettings.dm_privacy,'everyone')}>EVERYONE</option><option value="followers"${selected(userSettings.dm_privacy??'followers','followers')}>FOLLOWERS</option><option value="none"${selected(userSettings.dm_privacy,'none')}>NO ONE</option></select></label>
 <label class="toggle-row"><span><strong>Show online status</strong><br/>Let members see when you are active.</span><input type="checkbox" name="show_online" ${bool(privacy,'show_online',true)?'checked':''}></label>
 <label class="toggle-row"><span><strong>Allow messages</strong><br/>Members can start conversations with you.</span><input type="checkbox" name="allow_messages" ${bool(privacy,'allow_messages',true)?'checked':''}></label>
 <label class="toggle-row"><span><strong>Allow follows</strong><br/>Members can follow your profile.</span><input type="checkbox" name="allow_follows" ${bool(privacy,'allow_follows',true)?'checked':''}></label></section>
 <section><h2>Universe Experience</h2>
 <label><span>MOTION LEVEL</span><select name="motion_level"><option value="full"${selected(userSettings.motion_level??'full','full')}>FULL CINEMATIC</option><option value="balanced"${selected(userSettings.motion_level,'balanced')}>BALANCED</option><option value="reduced"${selected(userSettings.motion_level,'reduced')}>REDUCED</option></select></label>
 <label><span>ACCENT COLOR</span><input name="accent_color" type="color" value="${String(userSettings.accent_color??'#31ff63')}"></label>
 <label class="toggle-row"><span><strong>Cinema mode</strong><br/>Use full Rich Bizness visual depth.</span><input type="checkbox" name="cinema_mode" ${userSettings.cinema_mode!==false?'checked':''}></label>
 <label class="toggle-row"><span><strong>TV mode</strong><br/>Use expanded layouts on large screens.</span><input type="checkbox" name="tv_mode" ${userSettings.tv_mode===true?'checked':''}></label>
 <label class="toggle-row"><span><strong>Smoke FX</strong><br/>Enable profile atmosphere effects.</span><input type="checkbox" name="smoke_fx" ${theme.smoke_fx!==false?'checked':''}></label>
 <label class="toggle-row"><span><strong>Glow FX</strong><br/>Enable neon profile lighting.</span><input type="checkbox" name="glow_fx" ${theme.glow_fx!==false?'checked':''}></label>
 <label class="toggle-row"><span><strong>3D depth</strong><br/>Enable layered cinematic profile depth.</span><input type="checkbox" name="depth_3d" ${theme.depth_3d!==false?'checked':''}></label></section>
 <p id="status" class="status-line" role="status"></p><button id="saveButton" class="comm-button primary" type="submit">SAVE SETTINGS</button></form></div></main>`;
 const form=document.querySelector<HTMLFormElement>('#settingsForm')!;const status=document.querySelector<HTMLElement>('#status')!;const saveState=document.querySelector<HTMLElement>('#saveState')!;const saveButton=document.querySelector<HTMLButtonElement>('#saveButton')!;
 const accentInput=form.elements.namedItem('accent_color') as HTMLInputElement|null;
 if(accentInput){document.documentElement.style.setProperty('--rb-user-accent',accentInput.value);accentInput.addEventListener('input',()=>document.documentElement.style.setProperty('--rb-user-accent',accentInput.value));}
 let dirty=false;
 form.addEventListener('input',()=>{dirty=true;saveState.textContent='UNSAVED';status.textContent='';});
 const guard=(event:BeforeUnloadEvent)=>{if(!dirty)return;event.preventDefault();event.returnValue='';};
 window.addEventListener('beforeunload',guard);
 form.addEventListener('submit',async e=>{e.preventDefault();saveButton.disabled=true;saveState.textContent='SAVING';status.textContent='';const fd=new FormData(form);const now=new Date().toISOString();
  const notification_config={...notify,dm:fd.has('dm'),live:fd.has('live'),music:fd.has('music'),store:fd.has('store'),sports:fd.has('sports'),gaming:fd.has('gaming')};
  const privacy_config={...privacy,show_online:fd.has('show_online'),allow_messages:fd.has('allow_messages'),allow_follows:fd.has('allow_follows')};
  const userPayload={user_id:session.user.id,profile_visibility:String(fd.get('profile_visibility')??'public'),dm_privacy:String(fd.get('dm_privacy')??'followers'),motion_level:String(fd.get('motion_level')??'full'),notification_level:String(fd.get('notification_level')??'important'),accent_color:String(fd.get('accent_color')??'#31ff63'),cinema_mode:fd.has('cinema_mode'),tv_mode:fd.has('tv_mode'),metadata:{...(userSettings.metadata??{}),source:'settings-page'},updated_at:now};
  const themePayload={user_id:session.user.id,background_style:theme.background_style??'cinematic',profile_layout:theme.profile_layout??'universe',avatar_frame:theme.avatar_frame??'emerald-gold',button_style:theme.button_style??'glass',smoke_fx:fd.has('smoke_fx'),glow_fx:fd.has('glow_fx'),depth_3d:fd.has('depth_3d'),metadata:{...(theme.metadata??{}),source:'settings-page'},updated_at:now};
  const [{error:profileUpdateError},{error:settingsUpdateError},{error:themeUpdateError}]=await Promise.all([
   supabase.from('profiles').update({notification_config,privacy_config,online_status:fd.has('show_online')?'online':'hidden',updated_at:now}).eq('id',session.user.id),
   supabase.from('user_settings').upsert(userPayload,{onConflict:'user_id'}),
   supabase.from('profile_theme_settings').upsert(themePayload,{onConflict:'user_id'})
  ]);
  const updateError=profileUpdateError??settingsUpdateError??themeUpdateError;if(updateError){saveState.textContent='ERROR';status.textContent=updateError.message;saveButton.disabled=false;return;}
  dirty=false;saveState.textContent='SAVED';status.textContent='Universe settings saved across Profile, Rich-DM, notifications, and visual experience.';saveButton.disabled=false;
 });
 window.addEventListener('pagehide',()=>{window.removeEventListener('beforeunload',guard);},{once:true});
}
