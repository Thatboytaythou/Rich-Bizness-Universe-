// Development feature: production schema is NOT modified by this UI.
// Supabase RLS and authenticated RPCs remain the authorization boundary.
import type {SupabaseClient} from '@supabase/supabase-js';
import {supabase} from '../../core/supabase/client';
import {getAuthSnapshot} from '../../core/auth/auth-store';

type Org = {id:string;name:string;kind:string;owner_id:string};
type Invite = {id:string;org_id:string;role:string};
type Member = {user_id:string;role:string};
const db = supabase as unknown as SupabaseClient;
const KINDS = [
  ['enterprise','Enterprise'],['corporation','Corporation'],['franchise','Franchise'],
  ['cooperative','Cooperative'],['union','Union'],['foundation','Foundation'],
  ['fundraiser','Fundraiser'],['small-business','Small business'],['startup','Startup'],
  ['local-business','Local business'],['independent','Independent worker']
] as const;
const ROLES = ['member','employee','manager'] as const;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const node = <K extends keyof HTMLElementTagNameMap>(tag:K,text?:string):HTMLElementTagNameMap[K]=>{
  const element=document.createElement(tag);
  if(text!==undefined)element.textContent=text;
  return element;
};
const field=(title:string,input:HTMLInputElement|HTMLSelectElement)=>{
  const label=node('label',title);
  label.append(input);
  return label;
};
const selection=(values:readonly (readonly [string,string])[])=>{
  const select=node('select');
  for(const [value,title] of values){
    const option=node('option',title);
    option.value=value;select.append(option);
  }
  return select;
};

export function mountOrganizationDirectory(root:HTMLElement):void {
  const heading=node('h2','Organization registration & membership');
  const description=node('p','Owner-only registration. Membership invitations require the recipient’s Rich ID and explicit acceptance. No payment or booking is started here.');
  const message=node('p','Checking registration service…');message.className='org-status';message.setAttribute('role','status');
  const form=node('form'), name=node('input'),kind=selection(KINDS);
  name.name='organization-name';name.required=true;name.minLength=2;name.maxLength=120;
  name.autocomplete='organization';name.placeholder='Registered display name';
  const create=node('button','Register organization');create.type='submit';
  form.append(field('Organization name',name),field('Type',kind),create);
  const own=node('div'),invitations=node('div');
  root.replaceChildren(heading,description,message,form,node('h2','Your organizations'),own,node('h2','Membership invitations'),invitations);
  let busy=false,loadVersion=0;
  const sessionUser=()=>getAuthSnapshot().ready?getAuthSnapshot().user?.id:null;
  const active=(id:string,version:number)=>root.isConnected&&sessionUser()===id&&version===loadVersion;
  const status=(value:string)=>{if(root.isConnected)message.textContent=value;};
  const protectedAction=async (operation:()=>Promise<{error:unknown}>,done:string)=>{
    if(busy||!sessionUser())return;
    busy=true;create.disabled=true;
    try{
      const result=await operation();
      if(result.error){status('The action was not saved. Check your permissions and development schema.');return;}
      status(done);await refresh();
    }catch{status('The authorization service could not be reached. Nothing was confirmed.');}
    finally{busy=false;create.disabled=false;}
  };
  const refresh=async()=>{
    const uid=sessionUser(),version=++loadVersion;
    if(!uid){status('Tap In required for organization management.');own.replaceChildren();invitations.replaceChildren();return;}
    try{
      const [orgResult,inviteResult]=await Promise.all([
        db.from('rb_orgs').select('id,name,kind,owner_id').eq('owner_id',uid).order('created_at',{ascending:false}).limit(30),
        db.from('rb_org_invites').select('id,org_id,role').eq('invited_user_id',uid).eq('status','pending').limit(30)
      ]);
      if(!active(uid,version))return;
      if(orgResult.error||inviteResult.error){
        status('Registration is not enabled on this backend yet. Development schema must be reviewed and applied to a non-production project.');
        own.replaceChildren(node('p','No registration changes have been made.'));
        invitations.replaceChildren();
        create.disabled=true;return;
      }
      create.disabled=busy;
      own.replaceChildren();
      const orgs=(orgResult.data??[]) as Org[];
      if(!orgs.length)own.append(node('p','No organizations registered under this Rich ID.'));
      for(const org of orgs){
        const card=node('article');
        card.append(node('h3',org.name),node('p',org.kind+' • Owner-controlled'));
        const invitation=node('form'),target=node('input'),role=selection(ROLES.map(r=>[r,r] as const));
        target.required=true;target.placeholder='Member Rich ID (UUID)';target.setAttribute('aria-label','Member Rich ID');target.maxLength=36;
        const send=node('button','Send membership invitation');send.type='submit';
        invitation.append(field('Invite existing Rich ID',target),field('Member role',role),send);
        invitation.addEventListener('submit',event=>{
          event.preventDefault();const recipient=target.value.trim();
          if(!UUID.test(recipient)){status('Enter a valid member Rich ID.');return;}
          if(recipient===uid){status('An organization owner already has access.');return;}
          void protectedAction(()=>db.rpc('rb_org_invite',{p_org_id:org.id,p_user_id:recipient,p_role:role.value}), 'Invitation sent. The recipient must accept.');
        });
        card.append(invitation);
        own.append(card);
        void db.from('rb_org_members').select('user_id,role').eq('org_id',org.id).limit(50).then(({data,error})=>{
          if(!active(uid,version)||!card.isConnected||error)return;
          const members=(data??[]) as Member[];
          for(const member of members){
            const row=node('div');row.className='org-actions';
            row.append(node('span',member.role+' • Rich ID …'+member.user_id.slice(-8)));
            const remove=node('button','Remove member');remove.type='button';
            remove.addEventListener('click',()=>void protectedAction(()=>db.rpc('rb_org_remove_member',{p_org_id:org.id,p_user_id:member.user_id}),'Membership removed.'));
            row.append(remove);card.append(row);
          }
        });
      }
      invitations.replaceChildren();
      const invites=(inviteResult.data??[]) as Invite[];
      if(!invites.length)invitations.append(node('p','No pending membership invitations.'));
      for(const invite of invites){
        const card=node('article');
        card.append(node('p','Organization '+invite.org_id.slice(0,8)+'… • '+invite.role));
        const actions=node('div');actions.className='org-actions';
        for(const [label,accept] of [['Accept',true],['Decline',false]] as const){
          const button=node('button',label);button.type='button';
          button.addEventListener('click',()=>void protectedAction(()=>db.rpc('rb_org_respond',{p_invite_id:invite.id,p_accept:accept}),accept?'Membership accepted.':'Invitation declined.'));
          actions.append(button);
        }
        card.append(actions);invitations.append(card);
      }
      if(!busy)status('Organization workspace synchronized with Rich ID.');
    }catch{
      if(active(uid,version))status('Organization service unavailable. No data was modified.');
    }
  };
  form.addEventListener('submit',event=>{
    event.preventDefault();const uid=sessionUser(),title=name.value.trim();
    if(!uid){status('Tap In required.');return;}
    if(title.length<2||title.length>120||!KINDS.some(([value])=>value===kind.value)){status('Use a name of 2–120 characters and a valid organization type.');return;}
    void protectedAction(()=>db.from('rb_orgs').insert({owner_id:uid,name:title,kind:kind.value}),'Organization registered for your Rich ID.');
  });
  void refresh();
}
