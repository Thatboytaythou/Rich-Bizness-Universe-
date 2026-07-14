create unique index if not exists store_cart_user_product_uidx on public.store_cart_items(user_id,product_id);
create unique index if not exists product_likes_user_product_uidx on public.product_likes(user_id,product_id);
create index if not exists products_store_discovery_idx on public.products(status,is_public,is_featured,created_at desc);
create index if not exists store_comments_product_recent_idx on public.store_comments(product_id,created_at desc);
create index if not exists store_orders_buyer_recent_idx on public.store_orders(buyer_id,created_at desc);

alter table public.store_cart_items enable row level security;
alter table public.product_likes enable row level security;
alter table public.product_views enable row level security;
alter table public.store_comments enable row level security;
alter table public.store_orders enable row level security;

do $$ begin create policy store_cart_owner_all on public.store_cart_items for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy product_likes_public_read on public.product_likes for select to public using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy product_likes_owner_insert on public.product_likes for insert to authenticated with check (user_id=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy product_likes_owner_delete on public.product_likes for delete to authenticated using (user_id=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy product_views_safe_insert on public.product_views for insert to public with check ((user_id=auth.uid()) or (auth.uid() is null and user_id is null and nullif(anonymous_id,'') is not null)); exception when duplicate_object then null; end $$;
do $$ begin create policy store_comments_public_read on public.store_comments for select to public using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy store_comments_owner_insert on public.store_comments for insert to authenticated with check (user_id=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy store_comments_owner_update on public.store_comments for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy store_comments_owner_delete on public.store_comments for delete to authenticated using (user_id=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy store_orders_buyer_read on public.store_orders for select to authenticated using (buyer_id=auth.uid() or seller_id=auth.uid()); exception when duplicate_object then null; end $$;

create or replace function public.rb_store_catalog(p_limit integer default 80)
returns table(id uuid,seller_id uuid,title text,description text,category text,product_type text,fulfillment_type text,price_cents integer,currency text,image_url text,cover_url text,media_url text,preview_url text,inventory_count integer,is_digital boolean,is_local boolean,is_featured boolean,city text,state text,location_label text,views integer,likes integer,sales_count integer,marketing_emoji text,created_at timestamptz,seller_name text,seller_avatar_url text,seller_rank text)
language sql security invoker set search_path=public as $$
 select p.id,p.seller_id,p.title,p.description,p.category,p.product_type,p.fulfillment_type,p.price_cents,p.currency,p.image_url,p.cover_url,p.media_url,p.preview_url,coalesce(p.inventory_count,p.quantity,0),coalesce(p.is_digital,false),coalesce(p.is_local,false),coalesce(p.is_featured,false),p.city,p.state,p.location_label,coalesce(p.views,0),coalesce(p.likes,0),coalesce(p.sales_count,0),coalesce(p.marketing_emoji,'💨'),p.created_at,coalesce(s.seller_name,s.display_name,s.username,'Rich Seller'),coalesce(s.avatar_url,'/images/brand/Avatar-hero-Banner.png.jpeg'),coalesce(s.seller_rank,'Rookie Seller') from public.products p left join public.store_seller_profiles s on s.user_id=p.seller_id where p.status='active' and coalesce(p.is_public,true)=true order by p.is_featured desc,p.created_at desc limit greatest(1,least(coalesce(p_limit,80),120));
$$;
grant execute on function public.rb_store_catalog(integer) to anon,authenticated;

create or replace function public.rb_store_cart_set(p_product_id uuid,p_quantity integer default 1)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_product public.products%rowtype; v_row public.store_cart_items%rowtype;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select * into v_product from public.products where id=p_product_id and status='active' and coalesce(is_public,true)=true;
 if not found then raise exception 'Product unavailable'; end if;
 if p_quantity<=0 then delete from public.store_cart_items where user_id=v_user and product_id=p_product_id; return jsonb_build_object('removed',true); end if;
 insert into public.store_cart_items(user_id,product_id,seller_id,quantity,price_cents,currency,metadata) values(v_user,p_product_id,v_product.seller_id,least(p_quantity,99),v_product.price_cents,v_product.currency,jsonb_build_object('source','store-ui')) on conflict(user_id,product_id) do update set quantity=excluded.quantity,price_cents=excluded.price_cents,currency=excluded.currency,updated_at=now() returning * into v_row;
 return to_jsonb(v_row);
end $$;
revoke execute on function public.rb_store_cart_set(uuid,integer) from public,anon;
grant execute on function public.rb_store_cart_set(uuid,integer) to authenticated;

create or replace function public.rb_store_toggle_like(p_product_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_liked boolean;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if exists(select 1 from public.product_likes where user_id=v_user and product_id=p_product_id) then delete from public.product_likes where user_id=v_user and product_id=p_product_id; v_liked:=false; else insert into public.product_likes(user_id,product_id,reaction) values(v_user,p_product_id,'💸') on conflict do nothing; v_liked:=true; end if;
 update public.products set likes=(select count(*) from public.product_likes where product_id=p_product_id),updated_at=now() where id=p_product_id;
 return jsonb_build_object('liked',v_liked,'count',(select count(*) from public.product_likes where product_id=p_product_id));
end $$;
revoke execute on function public.rb_store_toggle_like(uuid) from public,anon;
grant execute on function public.rb_store_toggle_like(uuid) to authenticated;

create or replace function public.rb_store_record_view(p_product_id uuid,p_anonymous_id text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();
begin
 insert into public.product_views(product_id,user_id,anonymous_id) values(p_product_id,v_user,case when v_user is null then nullif(p_anonymous_id,'') else null end);
 update public.products set views=coalesce(views,0)+1,updated_at=now() where id=p_product_id;
end $$;
grant execute on function public.rb_store_record_view(uuid,text) to anon,authenticated;

do $$ begin alter publication supabase_realtime add table public.store_cart_items; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.store_comments; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.product_likes; exception when duplicate_object then null; end $$;