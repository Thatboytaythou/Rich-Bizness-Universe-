begin;
CREATE OR REPLACE FUNCTION public.rb_store_checkout(p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth', 'storage', 'pg_temp'
AS $function$
declare
  v_user uuid:=auth.uid();
  v_key text:=coalesce(nullif(trim(p_idempotency_key),''),gen_random_uuid()::text);
  v_existing jsonb;
  v_order_ids uuid[]:='{}';
  v_total integer:=0;
  v_currency text:='usd';
  v_cart_count integer:=0;
  v_item record;
  v_order_id uuid;
  v_status text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rb-store-checkout:'||v_user::text,0));
  select jsonb_build_object(
    'ok',true,
    'idempotent',true,
    'checkout_key',v_key,
    'order_ids',coalesce(array_agg(id),'{}'::uuid[]),
    'amount_total',coalesce(sum(amount_total),0),
    'currency',coalesce(max(currency),'usd'),
    'payment_status',coalesce(max(payment_status),'pending')
  ) into v_existing
  from public.store_orders
  where buyer_id=v_user and metadata->>'checkout_key'=v_key;

  if coalesce(jsonb_array_length(coalesce(v_existing->'order_ids','[]'::jsonb)),0)>0 then
    return v_existing;
  end if;

  select count(*) into v_cart_count from public.store_cart_items where user_id=v_user;
  if v_cart_count=0 then raise exception 'Cart is empty'; end if;

  for v_item in
    select c.product_id,c.quantity,c.price_cents,c.currency,c.seller_id,p.price_cents as catalog_price,p.currency as catalog_currency,p.seller_id as catalog_seller,p.title,p.inventory_count,p.quantity as legacy_quantity,p.is_digital,p.fulfillment_type,p.status,p.is_public
    from public.store_cart_items c
    join public.products p on p.id=c.product_id
    where c.user_id=v_user
    order by c.created_at
    for update of p
  loop
    if v_item.quantity is null or v_item.quantity<=0 or v_item.catalog_price is null or v_item.catalog_price<0 or v_item.price_cents is distinct from v_item.catalog_price or v_item.seller_id is distinct from v_item.catalog_seller or lower(coalesce(v_item.currency,'usd')) is distinct from lower(coalesce(v_item.catalog_currency,'usd')) then raise exception 'Cart catalog changed; refresh item before checkout'; end if;
    if cardinality(v_order_ids)>0 and lower(coalesce(v_item.currency,'usd'))<>lower(v_currency) then raise exception 'Mixed currency checkout is not supported'; end if;
    if v_item.status<>'active' or coalesce(v_item.is_public,true)=false then raise exception 'Product unavailable: %',v_item.title; end if;
    if coalesce(v_item.inventory_count,v_item.legacy_quantity,0)<v_item.quantity and coalesce(v_item.is_digital,false)=false then raise exception 'Insufficient inventory: %',v_item.title; end if;

    insert into public.store_orders(
      buyer_id,seller_id,product_id,product_name,quantity,price_cents,amount_total,currency,
      order_status,payment_status,fulfillment_status,metadata
    ) values(
      v_user,v_item.seller_id,v_item.product_id,v_item.title,v_item.quantity,v_item.price_cents,
      v_item.price_cents*v_item.quantity,coalesce(v_item.currency,'usd'),
      'pending','pending','pending',jsonb_build_object('checkout_key',v_key,'source','store-ui','contract','rb_store_checkout_v1')
    ) returning id,payment_status into v_order_id,v_status;

    v_order_ids:=array_append(v_order_ids,v_order_id);
    v_total:=v_total+(v_item.price_cents*v_item.quantity);
    v_currency:=coalesce(v_item.currency,v_currency);
  end loop;

  delete from public.store_cart_items where user_id=v_user;

  return jsonb_build_object(
    'ok',true,
    'idempotent',false,
    'checkout_key',v_key,
    'order_ids',v_order_ids,
    'amount_total',v_total,
    'currency',v_currency,
    'payment_status','pending',
    'requires_payment',v_total>0
  );
end;
$function$;
-- Retain the original failure reason and never award retired session-start XP.
update public.xp_event_queue q set status='rejected',processed_at=now(),error_message=left('retired_session_start_reward; previous: '||coalesce(q.error_message,''),500) where q.status='failed' and q.event_key='game_played' and q.source_table='game_sessions' and not exists(select 1 from public.user_xp_ledger l where l.user_id=q.user_id and l.event_key=q.event_key and l.source_id=q.source_id and l.source_table=q.source_table);
commit;
