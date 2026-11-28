CREATE OR REPLACE FUNCTION public.rb_game_room_action(p_action text, p_game_slug text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth', 'storage', 'pg_temp'
AS $function$
declare u uuid:=auth.uid(); g public.games%rowtype; p public.profiles%rowtype; r public.game_rooms%rowtype; code text; count_members int;
begin
 if u is null then raise exception 'Authentication required'; end if;
 select * into g from public.games where slug=p_game_slug and is_active=true and is_playable=true; if not found then raise exception 'Game unavailable'; end if;
 select * into p from public.profiles where id=u;
 if p_action='create' then
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rb-room-create:'||u::text||':'||g.id::text,0));
   select * into r from public.game_rooms where host_user_id=u and game_id=g.id and status in ('open','waiting','active') order by created_at desc limit 1;
   if found then
     insert into public.game_room_members(room_id,user_id,username,display_name,role,status,metadata) values(r.id,u,p.username,p.display_name,'host','active',jsonb_build_object('contract','rb-game-room-v2')) on conflict(room_id,user_id) do update set status='active',role='host',updated_at=now();
     return jsonb_build_object('ok',true,'room',to_jsonb(r),'reused',true); end if;
   code:=upper(coalesce(nullif(p_payload->>'room_code',''),'RB'||substr(replace(gen_random_uuid()::text,'-',''),1,6)));
   insert into public.game_rooms(room_code,game_id,game_key,host_user_id,status,max_players,room_type,board_state,game_state,metadata)
   values(code,g.id,g.slug,u,'waiting',greatest(2,least(coalesce((p_payload->>'max_players')::int,8),64)),coalesce(p_payload->>'room_type','realtime'),p_payload->'board_state',coalesce(p_payload->'game_state','{}'::jsonb),coalesce(p_payload->'metadata','{}'::jsonb)) returning * into r;
   insert into public.game_room_members(room_id,user_id,username,display_name,role,status,metadata) values(r.id,u,p.username,p.display_name,'host','active',jsonb_build_object('contract','rb-game-room-v2')) on conflict(room_id,user_id) do update set status='active',role='host',updated_at=now();
   return jsonb_build_object('ok',true,'room',to_jsonb(r),'reused',false);
 elsif p_action='join' then
   select * into r from public.game_rooms where room_code=upper(p_payload->>'room_code') and game_id=g.id and status in ('open','waiting','active') for update; if not found then raise exception 'Room unavailable'; end if;
   select count(*) into count_members from public.game_room_members where room_id=r.id and user_id<>u and status in ('active','ready'); if count_members>=r.max_players then raise exception 'Room full'; end if;
   insert into public.game_room_members(room_id,user_id,username,display_name,role,status,metadata) values(r.id,u,p.username,p.display_name,case when r.host_user_id=u then 'host' when p_payload->>'role'='spectator' then 'spectator' else 'player' end,'active',coalesce(p_payload->'metadata','{}'::jsonb)) on conflict(room_id,user_id) do update set status='active',updated_at=now();
   update public.game_rooms set status=case when status='waiting' then 'active' else status end,last_activity_at=now(),updated_at=now() where id=r.id returning * into r;
   return jsonb_build_object('ok',true,'room',to_jsonb(r));
 elsif p_action='leave' then
   select * into r from public.game_rooms where id=(p_payload->>'room_id')::uuid and game_id=g.id for update;
   if not found then raise exception 'Room unavailable'; end if;
   if r.host_user_id is distinct from u and not exists(select 1 from public.game_room_members m where m.room_id=r.id and m.user_id=u) then raise exception 'Room membership required'; end if;
   update public.game_room_members set status='left',updated_at=now() where room_id=(p_payload->>'room_id')::uuid and user_id=u;
   update public.game_rooms set status=case when host_user_id=u then 'closed' else status end,ended_at=case when host_user_id=u then now() else ended_at end,last_activity_at=now(),updated_at=now() where id=(p_payload->>'room_id')::uuid returning * into r;
   return jsonb_build_object('ok',true,'room',to_jsonb(r));
 else raise exception 'Unsupported room action'; end if;
end $function$;
revoke execute on function public.rb_game_room_action(text,text,jsonb) from public,anon;
grant execute on function public.rb_game_room_action(text,text,jsonb) to authenticated,service_role;
