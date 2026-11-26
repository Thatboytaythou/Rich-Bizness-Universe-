create table public.elite_creator_designs (
 owner_id uuid primary key references public.profiles(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 60),
 recipe jsonb not null check (
   jsonb_typeof(recipe)='object' and recipe - array['collection','designerCut','designerPalette','designerAccent','designerFootwear','signature','wings'] = '{}'::jsonb
   and coalesce(recipe->>'collection','') in ('none','emerald-legacy','onyx-executive','omni-phantom','heritage-crown','midnight-motion')
   and coalesce(recipe->>'designerCut','') in ('collection','street','executive','techwear')
   and coalesce(recipe->>'designerPalette','') in ('collection','emerald','midnight','ivory','burgundy','cobalt')
   and coalesce(recipe->>'designerAccent','') in ('collection','gold','silver','jade','copper')
   and coalesce(recipe->>'designerFootwear','') in ('collection','sneakers','boots','oxfords')
   and coalesce(recipe->>'signature','') in ('none','gold-crown','silver-crown')
   and coalesce(recipe->>'wings','') in ('none','celestial-aegis','shadow-aegis')
 ),
 published boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.elite_creator_designs enable row level security;
revoke all on public.elite_creator_designs from anon,authenticated;
grant select,insert,update,delete on public.elite_creator_designs to authenticated;
create policy elite_design_read on public.elite_creator_designs for select to authenticated using (published or owner_id=(select auth.uid()));
create policy elite_design_insert on public.elite_creator_designs for insert to authenticated with check (owner_id=(select auth.uid()));
create policy elite_design_update on public.elite_creator_designs for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy elite_design_delete on public.elite_creator_designs for delete to authenticated using (owner_id=(select auth.uid()));
create index elite_design_published_idx on public.elite_creator_designs(updated_at desc) where published;