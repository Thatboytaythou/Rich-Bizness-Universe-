begin;
create or replace function public.rb_guard_profile_server_fields() returns trigger language plpgsql security invoker set search_path='' as $$
declare protected_keys text[]:=array['rich_level','rich_points','rank_title','balance_cents','role','is_verified','secret_access_level','vault_unlocked','secret_room_keys','rb_secret_rank','trust_score','account_status','capability_flags']; k text; old_row jsonb; new_row jsonb;
begin
 if current_user not in ('anon','authenticated') then return new; end if;
 if tg_op='INSERT' then
  new.rich_level:=1;new.rich_points:=0;new.rank_title:=public.rb_rank_for_level(1);new.balance_cents:=0;new.role:='user';new.is_verified:=false;new.secret_access_level:='locked';new.vault_unlocked:=false;new.secret_room_keys:='{}';new.rb_secret_rank:='LOCKED';new.trust_score:=100;new.account_status:='active';new.capability_flags:='{}'::jsonb;
 else
  old_row:=to_jsonb(old);new_row:=to_jsonb(new);
  foreach k in array protected_keys loop
   if old_row->k is distinct from new_row->k then raise exception 'Server-managed Rich ID field: %',k using errcode='42501'; end if;
  end loop;
 end if;
 return new;
end $$;
revoke all on function public.rb_guard_profile_server_fields() from public,anon,authenticated;
create trigger rb_zz_guard_profile_server_fields before insert or update on public.profiles for each row execute function public.rb_guard_profile_server_fields();
create or replace function public.rb_reconcile_full_store_refund(p_intent text,p_amount integer,p_currency text) returns integer language plpgsql security invoker set search_path='' as $$
declare affected integer; total bigint; valid boolean; rec record; replacement uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rb-stripe-settlement-v1',0));
 if not exists(select 1 from public.rb_stripe_refund_review r where r.payment_intent_id=p_intent and r.refunded_cents=r.amount_cents and r.amount_cents=p_amount and r.currency=p_currency) then raise exception 'verified_full_refund_required'; end if;
 select count(*),coalesce(sum(amount_total),0),coalesce(bool_and(payment_status in ('paid','refunded') and lower(currency)=p_currency and amount_total>0),false) into affected,total,valid from public.store_orders where stripe_payment_intent_id=p_intent;
 if affected=0 or total<>p_amount or not valid then return 0; end if;
 update public.store_orders set payment_status='refunded',order_status='refunded',updated_at=now() where stripe_payment_intent_id=p_intent and payment_status='paid';
 for rec in select u.id,u.user_id,u.product_id,u.order_id,p.avatar_item_key from public.user_product_unlocks u join public.store_orders o on o.id=u.order_id join public.products p on p.id=u.product_id where o.stripe_payment_intent_id=p_intent and o.buyer_id=u.user_id and o.product_id=u.product_id loop
  select id into replacement from public.store_orders where buyer_id=rec.user_id and product_id=rec.product_id and payment_status='paid' order by paid_at desc nulls last,id limit 1;
  if replacement is not null then
   update public.user_product_unlocks set order_id=replacement,expires_at=null where id=rec.id;
  else
   update public.user_product_unlocks set expires_at=least(coalesce(expires_at,now()),now()) where id=rec.id;
   if rec.avatar_item_key is not null and not exists(select 1 from public.user_product_unlocks u join public.products p on p.id=u.product_id join public.store_orders o on o.id=u.order_id and o.buyer_id=u.user_id and o.product_id=u.product_id where u.user_id=rec.user_id and p.avatar_item_key=rec.avatar_item_key and o.payment_status='paid' and (u.expires_at is null or u.expires_at>now())) then
    update public.avatar_inventory set equipped=false where user_id=rec.user_id and item_key=rec.avatar_item_key;
   end if;
  end if;
 end loop;
 return affected;
end $$;
revoke all on function public.rb_reconcile_full_store_refund(text,integer,text) from public,anon,authenticated;
grant execute on function public.rb_reconcile_full_store_refund(text,integer,text) to service_role;
CREATE OR REPLACE FUNCTION public.rb_avatar_set_item(p_item_key text, p_equipped boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth', 'storage', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_type text;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select item_type into v_type
  from public.avatar_items
  where item_key = p_item_key and is_active;

  if v_type is null then
    raise exception 'Avatar item unavailable';
  end if;

  if p_equipped and (p_item_key like 'rb-elite-paid-%' or exists(select 1 from public.products where avatar_item_key=p_item_key and price_cents>0)) and not exists(
    select 1 from public.user_product_unlocks u join public.products p on p.id=u.product_id join public.store_orders o on o.id=u.order_id and o.product_id=u.product_id and o.buyer_id=u.user_id
    where u.user_id=v_user and p.avatar_item_key=p_item_key and o.payment_status='paid' and (u.expires_at is null or u.expires_at>now())
  ) then raise exception 'Verified paid entitlement required'; end if;
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
CREATE OR REPLACE FUNCTION public.rb_profiles_identity_foundation_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth', 'storage', 'pg_temp'
AS $function$
begin
  insert into public.user_levels(user_id,level,xp_total,xp_current,xp_next,rank_title,rich_points,metadata,created_at,updated_at)
  values(new.id,1,0,0,1000,public.rb_rank_for_level(1),0,jsonb_build_object('source','identity-foundation'),now(),now())
  on conflict(user_id) do nothing;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.rb_record_stripe_refund(p_event_id text, p_charge jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare pi text:=p_charge->>'payment_intent'; charge text:=p_charge->>'id'; gross integer:=(p_charge->>'amount')::integer; returned integer:=(p_charge->>'amount_refunded')::integer; cur text:=lower(p_charge->>'currency');
begin
 if auth.role() is distinct from 'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
 if pi is null or pi !~ '^pi_[A-Za-z0-9_]+$' or charge is null or charge !~ '^ch_[A-Za-z0-9_]+$' or gross is null or returned is null or returned<=0 or gross<returned or cur is null or cur !~ '^[a-z]{3}$' then raise exception 'invalid_refund_fields'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rb-stripe-settlement-v1',0));
 if exists(select 1 from public.rb_stripe_refund_review where payment_intent_id=pi and (charge_id<>charge or amount_cents<>gross or currency<>cur)) then raise exception 'refund_identity_mismatch'; end if;
 insert into public.rb_stripe_refund_review(payment_intent_id,charge_id,amount_cents,refunded_cents,currency,event_id)
 values(pi,charge,gross,returned,cur,p_event_id)
 on conflict(payment_intent_id) do update set refunded_cents=excluded.refunded_cents,event_id=excluded.event_id,review_status='pending',updated_at=now()
 where excluded.refunded_cents>public.rb_stripe_refund_review.refunded_cents;
 if returned=gross then perform public.rb_reconcile_full_store_refund(pi,gross,cur); end if;
 return jsonb_build_object('ok',true,'review_required',true);
end $function$;
CREATE OR REPLACE FUNCTION public.rb_settle_store_payment(p_checkout_key text, p_payment_intent_id text, p_checkout_session_id text DEFAULT NULL::text, p_amount_cents integer DEFAULT NULL::integer, p_currency text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth', 'storage', 'pg_temp'
AS $function$
declare
  v_order public.store_orders%rowtype;
  v_expected_total integer:=0;
  v_currency text:='usd';
  v_count integer:=0;
  v_platform_fee integer;
  v_seller_amount integer;
  v_granted integer:=0;
  v_item_key text;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  if nullif(trim(coalesce(p_checkout_key,'')),'') is null then raise exception 'checkout_key_required'; end if;
  if nullif(trim(coalesce(p_payment_intent_id,'')),'') is null then raise exception 'payment_intent_required'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rb-stripe-settlement-v1',0));
  if exists(select 1 from public.rb_stripe_refund_review where payment_intent_id=p_payment_intent_id) then raise exception 'refund_reconciliation_required'; end if;
  if p_amount_cents is null or p_amount_cents<=0 or p_currency is null then raise exception 'verified_amount_currency_required'; end if;
  if exists(select 1 from public.live_tips where stripe_payment_intent_id=p_payment_intent_id) or exists(select 1 from public.live_stream_purchases where stripe_payment_intent_id=p_payment_intent_id) then raise exception 'payment_intent_already_linked'; end if;
  if exists(
    select 1 from public.store_orders
    where stripe_payment_intent_id=p_payment_intent_id
      and (metadata->>'checkout_key') is distinct from p_checkout_key
  ) then raise exception 'payment_intent_already_linked'; end if;

  select count(*),coalesce(sum(amount_total),0),coalesce(max(currency),'usd')
  into v_count,v_expected_total,v_currency
  from public.store_orders where metadata->>'checkout_key'=p_checkout_key;

  if v_count=0 then raise exception 'checkout_not_found'; end if;
  if exists(select 1 from public.store_orders where metadata->>'checkout_key'=p_checkout_key and (payment_status not in ('pending','paid') or payment_status is null or lower(currency) is distinct from lower(p_currency) or (stripe_payment_intent_id is not null and stripe_payment_intent_id<>p_payment_intent_id))) then raise exception 'checkout_state_or_currency_mismatch'; end if;
  if exists(select 1 from public.store_orders o join public.creator_available_balances b on b.artist_user_id=o.seller_id where o.metadata->>'checkout_key'=p_checkout_key and lower(b.currency) is distinct from lower(p_currency)) then raise exception 'creator_balance_currency_mismatch'; end if;
  if p_amount_cents is not null and p_amount_cents<>v_expected_total then raise exception 'amount_mismatch'; end if;
  if p_currency is not null and lower(p_currency)<>lower(v_currency) then raise exception 'currency_mismatch'; end if;

  if not exists(select 1 from public.store_orders where metadata->>'checkout_key'=p_checkout_key and payment_status<>'paid') then
    return jsonb_build_object('ok',true,'idempotent',true,'checkout_key',p_checkout_key,'payment_intent_id',p_payment_intent_id,'amount_total',v_expected_total,'currency',v_currency,'avatar_items_granted',0);
  end if;

  for v_order in
    select * from public.store_orders
    where metadata->>'checkout_key'=p_checkout_key
    order by created_at,id
    for update
  loop
    if v_order.payment_status='paid' then continue; end if;

    if v_order.product_id is not null then
      update public.products
      set inventory_count=case when coalesce(is_digital,false) then inventory_count else greatest(coalesce(inventory_count,quantity,0)-v_order.quantity,0) end,
          quantity=case when coalesce(is_digital,false) then quantity else greatest(coalesce(quantity,inventory_count,0)-v_order.quantity,0) end,
          sales_count=coalesce(sales_count,0)+v_order.quantity,
          updated_at=now()
      where id=v_order.product_id
        and (coalesce(is_digital,false) or coalesce(inventory_count,quantity,0)>=v_order.quantity);
      if not found then raise exception 'inventory_settlement_failed:%',v_order.product_id; end if;

      select avatar_item_key into v_item_key
      from public.products
      where id=v_order.product_id
        and coalesce(is_digital,false)
        and avatar_item_key is not null;

      if v_item_key is not null and v_order.buyer_id is not null then
        insert into public.avatar_inventory(user_id,item_key,equipped)
        values(v_order.buyer_id,v_item_key,false)
        on conflict(user_id,item_key) do nothing;

        insert into public.user_product_unlocks(user_id,product_id,order_id,metadata)
        values(v_order.buyer_id,v_order.product_id,v_order.id,jsonb_build_object('source','verified-store-settlement','checkout_key',p_checkout_key,'avatar_item_key',v_item_key))
        on conflict(user_id,product_id) do update
          set order_id=excluded.order_id,unlocked_at=now(),expires_at=null,
              metadata=coalesce(public.user_product_unlocks.metadata,'{}'::jsonb)||excluded.metadata;
        v_granted:=v_granted+1;
      end if;
    end if;

    v_platform_fee:=round(v_order.amount_total*0.15)::integer;
    v_seller_amount:=v_order.amount_total-v_platform_fee;

    update public.store_orders
    set payment_status='paid',
        order_status=case when coalesce(order_status,'processing')='processing' then 'paid' else order_status end,
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
      values(v_order.seller_id,v_order.buyer_id,'store_order_paid','STORE ORDER PAID',coalesce(v_order.product_name,'A product')||' payment cleared.','store_orders','store',v_order.id,'/store.html?order='||v_order.id,'💸','high',jsonb_build_object('amount_total',v_order.amount_total,'payment_intent_id',p_payment_intent_id));
    end if;

    insert into public.rich_notifications(user_id,actor_id,type,title,body,target_table,target_type,target_id,target_url,emoji,priority,metadata)
    values(v_order.buyer_id,v_order.seller_id,'store_purchase_paid','PURCHASE CONFIRMED',coalesce(v_order.product_name,'Your order')||' is confirmed.','store_orders','store',v_order.id,'/store.html?order='||v_order.id,'✅','normal',jsonb_build_object('amount_total',v_order.amount_total,'payment_intent_id',p_payment_intent_id));
  end loop;

  return jsonb_build_object('ok',true,'idempotent',false,'checkout_key',p_checkout_key,'payment_intent_id',p_payment_intent_id,'checkout_session_id',p_checkout_session_id,'amount_total',v_expected_total,'currency',v_currency,'orders_settled',v_count,'avatar_items_granted',v_granted);
end;
$function$;
commit;
