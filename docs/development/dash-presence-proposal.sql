begin;
create table public.rb_dash_presence(
 listing_id uuid primary key references public.rb_dash_listings(id) on delete cascade,
 lat numeric(5,2) not null check(lat between -90 and 90),
 lon numeric(5,2) not null check(lon between -180 and 180),
 expires_at timestamptz not null
);
alter table public.rb_dash_presence enable row level security;
revoke all on public.rb_dash_presence from public,anon,authenticated;
grant select,insert,update,delete on public.rb_dash_presence to authenticated;
create policy presence_owner on public.rb_dash_presence for all to authenticated using(exists(select 1 from public.rb_dash_listings l join public.rb_orgs o on o.id=l.org_id where l.id=listing_id and o.owner_id=auth.uid())) with check(exists(select 1 from public.rb_dash_listings l join public.rb_orgs o on o.id=l.org_id where l.id=listing_id and o.owner_id=auth.uid()) and expires_at<=now()+interval '5 minutes' and expires_at>now());
create function public.rb_dash_nearby(p_lat numeric,p_lon numeric,p_service text,p_city text)
returns table(listing_id uuid,title text,distance_km integer) language sql stable security definer set search_path='' as $$
 select l.id,l.title,round(d.km/5)::integer*5
 from public.rb_dash_presence p join public.rb_dash_listings l on l.id=p.listing_id
 cross join lateral (select 6371*acos(least(1.0,greatest(-1.0,sin(radians(p_lat::double precision))*sin(radians(p.lat::double precision))+cos(radians(p_lat::double precision))*cos(radians(p.lat::double precision))*cos(radians((p.lon-p_lon)::double precision))))) as km) d
 where auth.uid() is not null and coalesce(auth.jwt()->>'is_anonymous','false')='false' and p_lat between -90 and 90 and p_lon between -180 and 180 and l.online and p.expires_at>now() and l.service=p_service and lower(l.city)=lower(p_city) and d.km<=50
 order by round(d.km/5),l.id limit 20
$$;
revoke all on function public.rb_dash_nearby(numeric,numeric,text,text) from public,anon;
grant execute on function public.rb_dash_nearby(numeric,numeric,text,text) to authenticated;
commit;
