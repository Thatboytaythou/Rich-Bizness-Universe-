begin;
create table public.rb_elite_progress (
 user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
 career_path text not null check (career_path in ('creator','evolution','luxury','executive','empire','leadership')),
 enterprise_name text not null default '' check (char_length(enterprise_name)<=60 and enterprise_name=btrim(enterprise_name) and enterprise_name !~ '[[:cntrl:]]'),
 updated_at timestamptz not null default now(),
 check (enterprise_name='' or career_path in ('executive','empire'))
);
alter table public.rb_elite_progress enable row level security;
revoke all on public.rb_elite_progress from public,anon,authenticated;
grant select,insert,update on public.rb_elite_progress to authenticated;
grant all on public.rb_elite_progress to service_role;
CREATE OR REPLACE FUNCTION public.rb_elite_minimum_level(p_path text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select case p_path when 'creator' then 1 when 'evolution' then 5 when 'luxury' then 8 when 'executive' then 10 when 'empire' then 15 when 'leadership' then 20 else 2147483647 end
$function$
;
revoke all on function public.rb_elite_minimum_level(text) from public,anon;
grant execute on function public.rb_elite_minimum_level(text) to authenticated,service_role;
create policy rb_elite_own_read on public.rb_elite_progress for select to authenticated using (user_id=(select auth.uid()));
create policy rb_elite_own_insert on public.rb_elite_progress for insert to authenticated with check (user_id=(select auth.uid()) and public.rb_elite_minimum_level(career_path)<=coalesce((select level from public.user_levels where user_id=(select auth.uid())),1));
create policy rb_elite_own_update on public.rb_elite_progress for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()) and public.rb_elite_minimum_level(career_path)<=coalesce((select level from public.user_levels where user_id=(select auth.uid())),1));
CREATE OR REPLACE FUNCTION public.rb_elite_capabilities()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid(); lvl integer; xp bigint; virtual_coins bigint; selected text; enterprise text; paid_orders bigint; real_balances jsonb;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select level,xp_total,coins into lvl,xp,virtual_coins from public.user_levels where user_id=uid;
 select career_path,enterprise_name into selected,enterprise from public.rb_elite_progress where user_id=uid;
 select count(*) into paid_orders from public.store_orders where seller_id=uid and payment_status='paid';
 select coalesce(jsonb_agg(jsonb_build_object('currency',currency,'available_cents',available_cents,'pending_cents',pending_cents,'paid_out_cents',paid_out_cents)),'[]'::jsonb) into real_balances from public.creator_available_balances where artist_user_id=uid;
 return jsonb_build_object('level',coalesce(lvl,1),'xp',coalesce(xp,0),'coins',coalesce(virtual_coins,0),'career',selected,'enterprise',coalesce(enterprise,''),'paths',(select jsonb_agg(jsonb_build_object('key',k,'minimum_level',public.rb_elite_minimum_level(k),'eligible',coalesce(lvl,1)>=public.rb_elite_minimum_level(k)) order by public.rb_elite_minimum_level(k)) from unnest(array['creator','evolution','luxury','executive','empire','leadership']) k),'real',jsonb_build_object('paid_orders',paid_orders,'recorded_balances',real_balances),'virtual_cash_redemption',false,'grants_platform_permissions',false);
end $function$
;
revoke all on function public.rb_elite_capabilities() from public,anon;
grant execute on function public.rb_elite_capabilities() to authenticated,service_role;
CREATE OR REPLACE FUNCTION public.rb_elite_choose_career(p_path text, p_enterprise_name text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid(); lvl integer; name text:=btrim(coalesce(p_enterprise_name,''));
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_path is null or p_path not in ('creator','evolution','luxury','executive','empire','leadership') then raise exception 'Unknown career'; end if;
 select level into lvl from public.user_levels where user_id=uid;
 if coalesce(lvl,1)<public.rb_elite_minimum_level(p_path) then raise exception 'Reach the required Rich Level first' using errcode='42501'; end if;
 if char_length(name)>60 or name ~ '[[:cntrl:]]' or (name<>'' and p_path not in ('executive','empire')) then raise exception 'Invalid virtual enterprise name'; end if;
 insert into public.rb_elite_progress(user_id,career_path,enterprise_name,updated_at) values(uid,p_path,name,now()) on conflict(user_id) do update set career_path=excluded.career_path,enterprise_name=excluded.enterprise_name,updated_at=now();
 return public.rb_elite_capabilities();
end $function$
;
revoke all on function public.rb_elite_choose_career(text,text) from public,anon;
grant execute on function public.rb_elite_choose_career(text,text) to authenticated,service_role;
commit;
