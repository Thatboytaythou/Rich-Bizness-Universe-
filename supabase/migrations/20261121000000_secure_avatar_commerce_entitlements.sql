-- Bind paid digital avatar drops to their buyer's private closet.
-- This migration mirrors the verified database hardening applied to the project.

alter table public.products
  add column if not exists avatar_item_key text;

create index if not exists products_avatar_item_key_idx
  on public.products (avatar_item_key)
  where avatar_item_key is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_avatar_item_key_fkey'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_avatar_item_key_fkey
      foreign key (avatar_item_key)
      references public.avatar_items(item_key)
      on update cascade on delete restrict;
  end if;
end $$;

create unique index if not exists user_product_unlocks_user_product_uidx
  on public.user_product_unlocks(user_id, product_id);

alter table public.user_product_unlocks enable row level security;
drop policy if exists user_product_unlocks_owner_read on public.user_product_unlocks;
create policy user_product_unlocks_owner_read
  on public.user_product_unlocks
  for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.rb_avatar_runtime_snapshot()
returns jsonb
language sql
security invoker
set search_path = public
as $function$
select jsonb_build_object(
  'profile',to_jsonb(p),
  'avatar',to_jsonb(a),
  'loadout',to_jsonb(l),
  'model',to_jsonb(m),
  'controller',to_jsonb(c),
  'motion',to_jsonb(s),
  'inventory',coalesce((
    select jsonb_agg(jsonb_build_object('item',to_jsonb(i),'equipped',inv.equipped))
    from public.avatar_inventory inv
    join public.avatar_items i on i.item_key=inv.item_key
    where inv.user_id=auth.uid()
  ),'[]'::jsonb),
  'product_unlocks',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',u.id,'product_id',u.product_id,'order_id',u.order_id,
      'unlocked_at',u.unlocked_at,'expires_at',u.expires_at,'metadata',u.metadata,
      'product',jsonb_build_object('title',pr.title,'image_url',pr.image_url,'cover_url',pr.cover_url,'avatar_item_key',pr.avatar_item_key)
    ) order by u.unlocked_at desc)
    from public.user_product_unlocks u
    join public.products pr on pr.id=u.product_id
    where u.user_id=auth.uid() and (u.expires_at is null or u.expires_at>now())
  ),'[]'::jsonb),
  'presets',coalesce((
    select jsonb_agg(to_jsonb(ap) order by ap.title)
    from public.avatar_character_presets ap where ap.is_active
  ),'[]'::jsonb),
  'items',coalesce((
    select jsonb_agg(to_jsonb(ai) order by ai.item_type,ai.title)
    from public.avatar_items ai where ai.is_active
  ),'[]'::jsonb),
  'clips',coalesce((
    select jsonb_agg(to_jsonb(ac) order by ac.state_group,ac.title)
    from public.avatar_animation_clips ac where ac.is_active
  ),'[]'::jsonb)
)
from public.profiles p
left join public.meta_avatars a on a.user_id=p.id
left join public.user_avatar_loadouts l on l.user_id=p.id
left join public.avatar_models m on m.id=l.model_id
left join public.avatar_controller_profiles c on c.id=l.controller_profile_id
left join public.avatar_motion_state s on s.user_id=p.id
where p.id=auth.uid();
$function$;
revoke all on function public.rb_avatar_runtime_snapshot() from public, anon;
grant execute on function public.rb_avatar_runtime_snapshot() to authenticated;

create or replace function public.rb_avatar_set_item(
  p_item_key text,
  p_equipped boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth, storage, pg_temp
as $function$
declare
  v_user uuid := auth.uid();
  v_type text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select item_type into v_type
  from public.avatar_items
  where item_key = p_item_key and is_active;

  if v_type is null then raise exception 'Avatar item unavailable'; end if;

  if p_equipped and not exists (
    select 1 from public.avatar_inventory
    where user_id = v_user and item_key = p_item_key
  ) then
    raise exception 'Unlock this item before equipping it';
  end if;

  if p_equipped then
    update public.avatar_inventory
    set equipped = false
    where user_id = v_user
      and item_key in (
        select item_key from public.avatar_items where item_type = v_type
      );

    update public.avatar_inventory
    set equipped = true
    where user_id = v_user and item_key = p_item_key;
  else
    update public.avatar_inventory
    set equipped = false
    where user_id = v_user and item_key = p_item_key;
  end if;

  return public.rb_avatar_runtime_snapshot();
end
$function$;

revoke all on function public.rb_avatar_set_item(text,boolean) from public, anon;
grant execute on function public.rb_avatar_set_item(text,boolean) to authenticated;

revoke all on function public.rb_avatar_runtime_snapshot() from public, anon;
grant execute on function public.rb_avatar_runtime_snapshot() to authenticated;

create or replace function public.rb_settle_store_payment(
  p_checkout_key text,
  p_payment_intent_id text,
  p_checkout_session_id text default null,
  p_amount_cents integer default null,
  p_currency text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth, storage, pg_temp
as $function$
declare
  v_order public.store_orders%rowtype;
  v_expected_total integer := 0;
  v_currency text := 'usd';
  v_count integer := 0;
  v_platform_fee integer;
  v_seller_amount integer;
  v_granted integer := 0;
  v_item_key text;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  if nullif(trim(coalesce(p_checkout_key,'')),'') is null then raise exception 'checkout_key_required'; end if;
  if nullif(trim(coalesce(p_payment_intent_id,'')),'') is null then raise exception 'payment_intent_required'; end if;

  if exists (
    select 1 from public.store_orders
    where stripe_payment_intent_id = p_payment_intent_id
      and metadata->>'checkout_key' <> p_checkout_key
  ) then raise exception 'payment_intent_already_linked'; end if;

  select count(*), coalesce(sum(amount_total),0), coalesce(max(currency),'usd')
    into v_count, v_expected_total, v_currency
  from public.store_orders where metadata->>'checkout_key' = p_checkout_key;

  if v_count = 0 then raise exception 'checkout_not_found'; end if;
  if p_amount_cents is not null and p_amount_cents <> v_expected_total then raise exception 'amount_mismatch'; end if;
  if p_currency is not null and lower(p_currency) <> lower(v_currency) then raise exception 'currency_mismatch'; end if;

  if not exists (
    select 1 from public.store_orders
    where metadata->>'checkout_key' = p_checkout_key and payment_status <> 'paid'
  ) then
    return jsonb_build_object('ok',true,'idempotent',true,'checkout_key',p_checkout_key,
      'payment_intent_id',p_payment_intent_id,'amount_total',v_expected_total,
      'currency',v_currency,'avatar_items_granted',0);
  end if;

  for v_order in
    select * from public.store_orders
    where metadata->>'checkout_key' = p_checkout_key
    order by created_at,id
    for update
  loop
    if v_order.payment_status = 'paid' then continue; end if;

    if v_order.product_id is not null then
      update public.products
      set inventory_count = case when coalesce(is_digital,false) then inventory_count else greatest(coalesce(inventory_count,quantity,0)-v_order.quantity,0) end,
          quantity = case when coalesce(is_digital,false) then quantity else greatest(coalesce(quantity,inventory_count,0)-v_order.quantity,0) end,
          sales_count = coalesce(sales_count,0)+v_order.quantity,
          updated_at = now()
      where id = v_order.product_id
        and (coalesce(is_digital,false) or coalesce(inventory_count,quantity,0) >= v_order.quantity);
      if not found then raise exception 'inventory_settlement_failed:%',v_order.product_id; end if;

      select avatar_item_key into v_item_key
      from public.products
      where id = v_order.product_id
        and coalesce(is_digital,false)
        and avatar_item_key is not null;

      if v_item_key is not null and v_order.buyer_id is not null then
        insert into public.avatar_inventory(user_id,item_key,equipped)
        values(v_order.buyer_id,v_item_key,false)
        on conflict(user_id,item_key) do nothing;

        insert into public.user_product_unlocks(user_id,product_id,order_id,metadata)
        values(v_order.buyer_id,v_order.product_id,v_order.id,
          jsonb_build_object('source','verified-store-settlement','checkout_key',p_checkout_key,'avatar_item_key',v_item_key))
        on conflict(user_id,product_id) do update
          set order_id=excluded.order_id, unlocked_at=now(),
              metadata=coalesce(public.user_product_unlocks.metadata,'{}'::jsonb)||excluded.metadata;
        v_granted := v_granted+1;
      end if;
    end if;

    v_platform_fee := round(v_order.amount_total*0.15)::integer;
    v_seller_amount := v_order.amount_total-v_platform_fee;

    update public.store_orders
    set payment_status='paid',
        order_status=case when coalesce(order_status,'pending')='pending' then 'confirmed' else order_status end,
        stripe_payment_intent_id=p_payment_intent_id,
        stripe_checkout_session_id=coalesce(p_checkout_session_id,stripe_checkout_session_id),
        platform_fee_cents=v_platform_fee,
        seller_amount_cents=v_seller_amount,
        paid_at=coalesce(paid_at,now()),
        metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('settlement_contract','rb_settle_store_payment_v2')||coalesce(p_metadata,'{}'::jsonb),
        updated_at=now()
    where id=v_order.id;

    if v_order.seller_id is not null then
      insert into public.creator_available_balances(artist_user_id,earned_cents,pending_cents,available_cents,currency)
      values(v_order.seller_id,v_seller_amount,v_seller_amount,0,v_order.currency)
      on conflict (artist_user_id) do update set
        earned_cents=coalesce(public.creator_available_balances.earned_cents,0)+excluded.earned_cents,
        pending_cents=coalesce(public.creator_available_balances.pending_cents,0)+excluded.pending_cents,
        updated_at=now();

      insert into public.rich_notifications(user_id,actor_id,type,title,body,target_table,target_type,target_id,target_url,emoji,priority,metadata)
      values(v_order.seller_id,v_order.buyer_id,'store_order_paid','STORE ORDER PAID',
        coalesce(v_order.product_name,'A product')||' payment cleared.','store_orders','store',v_order.id,
        '/store.html?order='||v_order.id,'💸','high',
        jsonb_build_object('amount_total',v_order.amount_total,'payment_intent_id',p_payment_intent_id));
    end if;

    insert into public.rich_notifications(user_id,actor_id,type,title,body,target_table,target_type,target_id,target_url,emoji,priority,metadata)
    values(v_order.buyer_id,v_order.seller_id,'store_purchase_paid','PURCHASE CONFIRMED',
      coalesce(v_order.product_name,'Your order')||' is confirmed.','store_orders','store',v_order.id,
      '/store.html?order='||v_order.id,'✅','normal',
      jsonb_build_object('amount_total',v_order.amount_total,'payment_intent_id',p_payment_intent_id));
  end loop;

  return jsonb_build_object('ok',true,'idempotent',false,'checkout_key',p_checkout_key,
    'payment_intent_id',p_payment_intent_id,'checkout_session_id',p_checkout_session_id,
    'amount_total',v_expected_total,'currency',v_currency,'orders_settled',v_count,
    'avatar_items_granted',v_granted);
end
$function$;

revoke all on function public.rb_settle_store_payment(text,text,text,integer,text,jsonb) from public, anon, authenticated;
grant execute on function public.rb_settle_store_payment(text,text,text,integer,text,jsonb) to service_role;
