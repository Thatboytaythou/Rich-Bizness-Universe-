insert into public.xp_events(event_key,title,section,xp_amount,coins_amount,rich_points_amount,cooldown_seconds,daily_limit,is_active,metadata)
values
('feed_comment','Feed Comment','feed',10,0,10,20,100,true,'{}'),
('gallery_drop','Gallery Drop','gallery',70,2,70,60,30,true,'{}'),
('sports_post','Sports Post','sports',60,2,60,60,30,true,'{}'),
('sports_upload','Sports Upload','sports',80,3,80,60,30,true,'{}'),
('meta_chat','Meta Chat','meta',8,0,8,15,150,true,'{}'),
('watch_comment','Watch Comment','watch',10,0,10,20,100,true,'{}'),
('watch_complete','Watch Completed','watch',25,1,25,60,60,true,'{}'),
('profile_complete','Profile Completed','profile',150,10,150,0,1,true,'{}'),
('avatar_save','Avatar Saved','avatar',75,3,75,120,20,true,'{}'),
('creator_publish','Creator Publish','creator',100,5,100,120,25,true,'{}')
on conflict(event_key) do update set title=excluded.title,section=excluded.section,xp_amount=excluded.xp_amount,coins_amount=excluded.coins_amount,rich_points_amount=excluded.rich_points_amount,cooldown_seconds=excluded.cooldown_seconds,daily_limit=excluded.daily_limit,is_active=true,updated_at=now();

update public.xp_events set is_active=true where event_key in ('feed_post_created','dm_sent','game_played','live_stream_started','meta_world_entered','music_uploaded','store_product_created','purchase_made','upload_created','sports_pick_created');

insert into public.xp_rule_bindings(source_table,source_action,event_key,section,user_column,is_active,metadata)
values
('feed_comments','insert','feed_comment','feed','user_id',true,'{}'),
('sports_posts','insert','sports_post','sports','user_id',true,'{}'),
('sports_uploads','insert','sports_upload','sports','user_id',true,'{}'),
('meta_chat_messages','insert','meta_chat','meta','user_id',true,'{}'),
('watch_comments','insert','watch_comment','watch','user_id',true,'{}')
on conflict(source_table,source_action,event_key) do update set section=excluded.section,user_column=excluded.user_column,is_active=true,metadata=excluded.metadata;

do $$
declare t text;
begin
  foreach t in array array['feed_comments','sports_posts','sports_uploads','meta_chat_messages','watch_comments'] loop
    execute format('drop trigger if exists rb_xp_queue_%I on public.%I',t,t);
    execute format('create trigger rb_xp_queue_%I after insert on public.%I for each row execute function public.rb_queue_bound_xp_event()',t,t);
  end loop;
end $$;

create or replace function public.rb_xp_snapshot(p_user_id uuid default auth.uid())
returns jsonb language sql security invoker set search_path=public as $$
select jsonb_build_object('user_id',u.user_id,'level',u.level,'xp_total',u.xp_total,'xp_current',u.xp_current,'xp_next',u.xp_next,'progress_percent',case when coalesce(u.xp_next,0)>0 then least(100,round((u.xp_current::numeric/u.xp_next::numeric)*100,1)) else 0 end,'rank_title',u.rank_title,'rank_style',u.rank_style,'rich_points',u.rich_points,'coins',u.coins,'trust_score',u.trust_score,'sections',coalesce((select jsonb_agg(jsonb_build_object('section',s.section,'xp_total',s.xp_total,'level',s.level,'current_streak',s.current_streak,'longest_streak',s.longest_streak) order by s.xp_total desc) from public.xp_section_progress s where s.user_id=u.user_id),'[]'::jsonb),'recent',coalesce((select jsonb_agg(jsonb_build_object('event_key',l.event_key,'section',l.section,'xp',l.xp_amount,'coins',l.coins_amount,'points',l.rich_points_amount,'created_at',l.created_at) order by l.created_at desc) from (select * from public.user_xp_ledger where user_id=u.user_id order by created_at desc limit 20) l),'[]'::jsonb)) from public.user_levels u where u.user_id=p_user_id and (p_user_id=auth.uid() or public.rb_is_admin(1));
$$;

grant execute on function public.rb_xp_snapshot(uuid) to authenticated;
revoke execute on function public.rb_xp_snapshot(uuid) from anon;

create or replace function public.rb_reconcile_xp_identity(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_total int; v_points int; v_coins int; v_level int; v_current int; v_rank text;
begin
  if auth.uid() is distinct from p_user_id and not public.rb_is_admin(1) then raise exception 'access_denied'; end if;
  select coalesce(sum(xp_amount),0),coalesce(sum(rich_points_amount),0),coalesce(sum(coins_amount),0) into v_total,v_points,v_coins from public.user_xp_ledger where user_id=p_user_id;
  v_level:=greatest(1,floor(v_total/1000.0)::int+1); v_current:=mod(v_total,1000); v_rank:=public.rb_rank_for_level(v_level);
  insert into public.user_levels(user_id,level,xp_total,xp_current,xp_next,rank_title,rich_points,coins,trust_score,metadata)
  values(p_user_id,v_level,v_total,v_current,1000,v_rank,v_points,v_coins,0,jsonb_build_object('reconciled_at',now()))
  on conflict(user_id) do update set level=excluded.level,xp_total=excluded.xp_total,xp_current=excluded.xp_current,xp_next=1000,rank_title=excluded.rank_title,rich_points=excluded.rich_points,coins=excluded.coins,metadata=coalesce(public.user_levels.metadata,'{}')||excluded.metadata,updated_at=now();
  update public.profiles set rich_level=v_level,rich_points=v_points,rank_title=v_rank,updated_at=now() where id=p_user_id;
  update public.meta_avatars set level=v_level,xp=v_total,rank=v_rank,updated_at=now() where user_id=p_user_id;
  return public.rb_xp_snapshot(p_user_id);
end $$;

grant execute on function public.rb_reconcile_xp_identity(uuid) to authenticated;
revoke execute on function public.rb_reconcile_xp_identity(uuid) from anon;

update public.user_levels set xp_next=1000 where xp_next is distinct from 1000;
create index if not exists user_xp_ledger_user_created_idx on public.user_xp_ledger(user_id,created_at desc);
create index if not exists xp_section_progress_user_xp_idx on public.xp_section_progress(user_id,xp_total desc);
create index if not exists xp_event_queue_user_status_idx on public.xp_event_queue(user_id,status,created_at desc);
do $$ begin alter publication supabase_realtime add table public.user_levels; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.xp_section_progress; exception when duplicate_object then null; end $$;