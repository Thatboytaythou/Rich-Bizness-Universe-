create or replace function public.rb_profiles_identity_foundation_trigger()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.user_levels(user_id,level,xp_total,xp_current,xp_next,rank_title,rich_points,metadata,created_at,updated_at)
  values(new.id,coalesce(new.rich_level,1),0,0,100,coalesce(new.rank_title,'Biz Legend'),coalesce(new.rich_points,0),jsonb_build_object('source','identity-foundation'),now(),now())
  on conflict(user_id) do update set
    level=greatest(public.user_levels.level,excluded.level),
    rank_title=coalesce(public.user_levels.rank_title,excluded.rank_title),
    rich_points=greatest(public.user_levels.rich_points,excluded.rich_points),
    updated_at=now();
  return new;
end;
$$;

revoke execute on function public.rb_profiles_identity_foundation_trigger() from public,anon,authenticated;

drop trigger if exists trg_profiles_identity_foundation on public.profiles;
create trigger trg_profiles_identity_foundation
after insert on public.profiles
for each row execute function public.rb_profiles_identity_foundation_trigger();

insert into public.user_levels(user_id,level,xp_total,xp_current,xp_next,rank_title,rich_points,metadata,created_at,updated_at)
select id,coalesce(rich_level,1),0,0,100,coalesce(rank_title,'Biz Legend'),coalesce(rich_points,0),jsonb_build_object('source','identity-backfill'),now(),now()
from public.profiles
on conflict(user_id) do nothing;