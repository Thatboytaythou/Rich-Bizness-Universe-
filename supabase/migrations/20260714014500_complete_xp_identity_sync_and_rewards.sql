update public.profiles set role='member' where role is null or role not in ('user','member','creator','artist','seller','founder','admin');

insert into public.xp_rule_bindings(source_table,source_action,event_key,section,user_column,is_active,metadata)
values ('user_avatar_loadouts','insert','avatar_save','avatar','user_id',true,'{}')
on conflict(source_table,source_action,event_key) do update set is_active=true,section=excluded.section,user_column=excluded.user_column;

drop trigger if exists rb_xp_queue_user_avatar_loadouts on public.user_avatar_loadouts;
create trigger rb_xp_queue_user_avatar_loadouts after insert on public.user_avatar_loadouts for each row execute function public.rb_queue_bound_xp_event();

create or replace function public.rb_sync_level_identity()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.profiles set rich_level=new.level,rich_points=new.rich_points,rank_title=new.rank_title,metadata=coalesce(metadata,'{}')||jsonb_build_object('xp_total',new.xp_total,'xp_current',new.xp_current,'xp_next',new.xp_next,'coins',new.coins,'xp_synced_at',now()),updated_at=now() where id=new.user_id;
  update public.meta_avatars set level=new.level,xp=new.xp_total,rank=new.rank_title,metadata=coalesce(metadata,'{}')||jsonb_build_object('rich_points',new.rich_points,'coins',new.coins,'xp_current',new.xp_current,'xp_next',new.xp_next),updated_at=now() where user_id=new.user_id;
  return new;
end $$;

drop trigger if exists trg_user_levels_identity_sync on public.user_levels;
create trigger trg_user_levels_identity_sync after insert or update of level,xp_total,xp_current,xp_next,rank_title,rich_points,coins on public.user_levels for each row execute function public.rb_sync_level_identity();

create or replace function public.rb_award_profile_completion()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce(old.has_profile_identity,false)=false and coalesce(new.has_profile_identity,false)=true then insert into public.xp_event_queue(user_id,event_key,section,source_table,source_id,status,metadata) values(new.id,'profile_complete','profile','profiles',new.id,'pending',jsonb_build_object('trigger','profile_completion')); end if;
  return new;
end $$;

drop trigger if exists trg_profiles_xp_completion on public.profiles;
create trigger trg_profiles_xp_completion after update of has_profile_identity on public.profiles for each row execute function public.rb_award_profile_completion();

create or replace function public.rb_award_watch_completion()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce(old.completed,false)=false and coalesce(new.completed,false)=true then insert into public.xp_event_queue(user_id,event_key,section,source_table,source_id,status,metadata) values(new.user_id,'watch_complete','watch','watch_progress',new.id,'pending',jsonb_build_object('source_type',new.source_type,'source_id',new.source_id)); end if;
  return new;
end $$;

drop trigger if exists trg_watch_progress_xp_completion on public.watch_progress;
create trigger trg_watch_progress_xp_completion after update of completed on public.watch_progress for each row execute function public.rb_award_watch_completion();

insert into public.user_levels(user_id,level,xp_total,xp_current,xp_next,rank_title,rich_points,coins,trust_score,metadata)
select p.id,greatest(coalesce(p.rich_level,1),1),greatest(coalesce(nullif(p.metadata->>'xp_total','')::int,0),0),greatest(coalesce(nullif(p.metadata->>'xp_current','')::int,0),0),1000,coalesce(p.rank_title,'Rookie Rich'),greatest(coalesce(p.rich_points,0),0),greatest(coalesce(nullif(p.metadata->>'coins','')::int,0),0),greatest(coalesce(p.trust_score,0),0),jsonb_build_object('source','full-parity-backfill') from public.profiles p
on conflict(user_id) do update set xp_next=1000,rich_points=greatest(public.user_levels.rich_points,excluded.rich_points),level=greatest(public.user_levels.level,excluded.level),trust_score=greatest(public.user_levels.trust_score,excluded.trust_score),updated_at=now();

update public.user_levels set updated_at=now();