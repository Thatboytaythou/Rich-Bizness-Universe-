begin;
CREATE OR REPLACE FUNCTION public.rb_award_xp(p_event_key text, p_section text DEFAULT 'global'::text, p_source_table text DEFAULT NULL::text, p_source_id uuid DEFAULT NULL::uuid, p_amount integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth', 'storage', 'pg_temp'
AS $function$
declare v_user uuid:=auth.uid(); e public.xp_events%rowtype; vx int; vc int; vp int; vt int; vl int; vcur int; vr text;
begin
  if v_user is null then return jsonb_build_object('ok',false,'reason','not_signed_in'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rb-xp:'||v_user::text,0));
  select * into e from public.xp_events where event_key=p_event_key and is_active=true limit 1;
  if not found then return jsonb_build_object('ok',false,'reason','unknown_event'); end if;
  if not public.rb_xp_event_allowed(v_user,p_event_key) then return jsonb_build_object('ok',false,'reason','cooldown_or_daily_limit'); end if;
  if e.section<>'global' then p_section:=e.section; elsif p_section is null or p_section !~ '^[a-z][a-z0-9_-]{0,39}$' then p_section:='global'; end if;
  vx:=greatest(coalesce(e.xp_amount,0),0); vc:=greatest(coalesce(e.coins_amount,0),0); vp:=greatest(coalesce(e.rich_points_amount,vx),0);
  insert into public.user_xp_ledger(user_id,event_key,section,xp_amount,coins_amount,rich_points_amount,source_table,source_id,metadata)
  values(v_user,p_event_key,coalesce(nullif(p_section,''),e.section,'global'),vx,vc,vp,p_source_table,p_source_id,jsonb_build_object('source','rb_award_xp','requested_amount_ignored',p_amount));
  insert into public.user_levels(user_id,level,xp_total,xp_current,xp_next,rich_points,coins,rank_title) values(v_user,1,0,0,1000,0,0,'Rookie Rich') on conflict(user_id) do nothing;
  update public.user_levels set xp_total=coalesce(xp_total,0)+vx,rich_points=coalesce(rich_points,0)+vp,coins=coalesce(coins,0)+vc,updated_at=now() where user_id=v_user returning xp_total into vt;
  vl:=greatest(1,floor(vt/1000.0)::int+1); vcur:=mod(vt,1000); vr:=public.rb_rank_for_level(vl);
  update public.user_levels set level=vl,xp_current=vcur,xp_next=1000,rank_title=vr,updated_at=now() where user_id=v_user;
  insert into public.xp_section_progress(user_id,section,xp_total,level,current_streak,longest_streak,achievements,counters,last_event_at,updated_at)
  values(v_user,coalesce(nullif(p_section,''),e.section,'global'),vx,greatest(1,floor(vx/1000.0)::int+1),0,0,'[]','{}',now(),now())
  on conflict(user_id,section) do update set xp_total=public.xp_section_progress.xp_total+excluded.xp_total,level=greatest(1,floor((public.xp_section_progress.xp_total+excluded.xp_total)/1000.0)::int+1),last_event_at=now(),updated_at=now();
  update public.profiles set rich_points=vp+coalesce(rich_points,0),rich_level=vl,rank_title=vr,online_status='online',last_seen_at=now(),updated_at=now() where id=v_user;
  update public.meta_avatars set xp=coalesce(xp,0)+vx,level=vl,rank=vr,updated_at=now() where user_id=v_user;
  return jsonb_build_object('ok',true,'xp',vx,'coins',vc,'points',vp,'total',vt,'level',vl,'rank',vr,'current',vcur,'next',1000);
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
          set order_id=excluded.order_id,unlocked_at=now(),
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
CREATE OR REPLACE FUNCTION public.rb_settle_live_payment(p_kind text, p_reference_id uuid, p_payment_intent_id text, p_checkout_session_id text DEFAULT NULL::text, p_amount_cents integer DEFAULT NULL::integer, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth', 'storage', 'pg_temp'
AS $function$
declare
  v_purchase public.live_stream_purchases%rowtype;
  v_tip public.live_tips%rowtype;
  v_stream public.live_streams%rowtype;
  v_fee integer;
  v_creator integer;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  if p_payment_intent_id is null or trim(p_payment_intent_id)='' then raise exception 'payment_intent_required'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rb-stripe-settlement-v1',0));
  if p_amount_cents is null or p_amount_cents<=0 or coalesce(p_metadata->>'stripe_currency','')='' then raise exception 'verified_amount_currency_required'; end if;
  if exists(select 1 from public.store_orders where stripe_payment_intent_id=p_payment_intent_id) or exists(select 1 from public.live_tips where stripe_payment_intent_id=p_payment_intent_id and (p_kind<>'tip' or id<>p_reference_id)) or exists(select 1 from public.live_stream_purchases where stripe_payment_intent_id=p_payment_intent_id and (p_kind<>'purchase' or id<>p_reference_id)) then raise exception 'payment_intent_already_linked'; end if;
  if p_kind='purchase' then
    select * into v_purchase from public.live_stream_purchases where id=p_reference_id for update;
    if not found then raise exception 'purchase_not_found'; end if;
    if v_purchase.amount_cents is distinct from p_amount_cents or lower(v_purchase.currency) is distinct from lower(p_metadata->>'stripe_currency') or v_purchase.status not in ('pending','paid') or (v_purchase.stripe_payment_intent_id is not null and v_purchase.stripe_payment_intent_id<>p_payment_intent_id) then raise exception 'live_payment_mismatch'; end if;
    if v_purchase.status='paid' then return jsonb_build_object('ok',true,'idempotent',true,'purchase_id',v_purchase.id); end if;
    select * into v_stream from public.live_streams where id=v_purchase.stream_id for update;
    if not found then raise exception 'stream_not_found'; end if;
    if exists(select 1 from public.creator_available_balances where artist_user_id=v_stream.creator_id and lower(currency) is distinct from lower(p_metadata->>'stripe_currency')) then raise exception 'creator_balance_currency_mismatch'; end if;
    v_fee:=coalesce(v_purchase.platform_fee_cents,round(coalesce(p_amount_cents,v_purchase.amount_cents)*0.15)::integer);
    v_creator:=coalesce(v_purchase.creator_amount_cents,coalesce(p_amount_cents,v_purchase.amount_cents)-v_fee);
    update public.live_stream_purchases set
      status='paid', stripe_payment_intent_id=p_payment_intent_id,
      stripe_checkout_session_id=coalesce(p_checkout_session_id,stripe_checkout_session_id),
      amount_cents=coalesce(p_amount_cents,amount_cents), platform_fee_cents=v_fee,
      creator_amount_cents=v_creator, purchased_at=coalesce(purchased_at,now()),
      metadata=coalesce(metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb), updated_at=now()
    where id=v_purchase.id;
    insert into public.vip_live_access(stream_id,user_id,access_source,access_status,metadata)
    values(v_purchase.stream_id,v_purchase.user_id,'purchase','active',jsonb_build_object('purchase_id',v_purchase.id))
    on conflict (stream_id,user_id) where access_status='active'
    do update set access_source='purchase',updated_at=now(),metadata=coalesce(public.vip_live_access.metadata,'{}'::jsonb)||excluded.metadata;
    update public.live_streams set
      total_revenue_cents=coalesce(total_revenue_cents,0)+coalesce(p_amount_cents,v_purchase.amount_cents),
      platform_fee_cents=coalesce(platform_fee_cents,0)+v_fee,
      creator_amount_cents=coalesce(creator_amount_cents,0)+v_creator,
      updated_at=now()
    where id=v_purchase.stream_id;
    insert into public.creator_available_balances(artist_user_id,earned_cents,pending_cents,available_cents,currency)
    values(v_stream.creator_id,v_creator,v_creator,0,coalesce(v_purchase.currency,'usd'))
    on conflict (artist_user_id) do update set
      earned_cents=coalesce(public.creator_available_balances.earned_cents,0)+v_creator,
      pending_cents=coalesce(public.creator_available_balances.pending_cents,0)+v_creator,
      updated_at=now();
    return jsonb_build_object('ok',true,'idempotent',false,'purchase_id',v_purchase.id,'creator_amount_cents',v_creator);

  elsif p_kind='tip' then
    select * into v_tip from public.live_tips where id=p_reference_id for update;
    if not found then raise exception 'tip_not_found'; end if;
    if v_tip.amount_cents is distinct from p_amount_cents or lower(v_tip.currency) is distinct from lower(p_metadata->>'stripe_currency') or v_tip.status not in ('pending','paid') or (v_tip.stripe_payment_intent_id is not null and v_tip.stripe_payment_intent_id<>p_payment_intent_id) then raise exception 'live_payment_mismatch'; end if;
    if v_tip.status='paid' then return jsonb_build_object('ok',true,'idempotent',true,'tip_id',v_tip.id); end if;
    select * into v_stream from public.live_streams where id=v_tip.stream_id for update;
    if not found then raise exception 'stream_not_found'; end if;
    if exists(select 1 from public.creator_available_balances where artist_user_id=v_stream.creator_id and lower(currency) is distinct from lower(p_metadata->>'stripe_currency')) then raise exception 'creator_balance_currency_mismatch'; end if;
    v_fee:=coalesce(v_tip.platform_fee_cents,round(coalesce(p_amount_cents,v_tip.amount_cents)*0.15)::integer);
    v_creator:=coalesce(v_tip.creator_amount_cents,coalesce(p_amount_cents,v_tip.amount_cents)-v_fee);
    update public.live_tips set
      status='paid',stripe_payment_intent_id=p_payment_intent_id,
      stripe_checkout_session_id=coalesce(p_checkout_session_id,stripe_checkout_session_id),
      amount_cents=coalesce(p_amount_cents,amount_cents),platform_fee_cents=v_fee,
      creator_amount_cents=v_creator,paid_at=coalesce(paid_at,now()),
      metadata=coalesce(metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb)
    where id=v_tip.id;
    update public.live_streams set
      total_revenue_cents=coalesce(total_revenue_cents,0)+coalesce(p_amount_cents,v_tip.amount_cents),
      platform_fee_cents=coalesce(platform_fee_cents,0)+v_fee,
      creator_amount_cents=coalesce(creator_amount_cents,0)+v_creator,
      last_activity_at=now(),updated_at=now()
    where id=v_tip.stream_id;
    insert into public.creator_available_balances(artist_user_id,earned_cents,pending_cents,available_cents,currency)
    values(v_stream.creator_id,v_creator,v_creator,0,coalesce(v_tip.currency,'usd'))
    on conflict (artist_user_id) do update set
      earned_cents=coalesce(public.creator_available_balances.earned_cents,0)+v_creator,
      pending_cents=coalesce(public.creator_available_balances.pending_cents,0)+v_creator,
      updated_at=now();
    insert into public.rich_notifications(user_id,actor_id,type,title,body,target_table,target_type,target_id,target_url,emoji,priority,metadata)
    values(v_stream.creator_id,v_tip.from_user_id,'live_tip','NEW LIVE TIP',coalesce(v_tip.message,'Somebody showed love in your live.'),'live_streams','live',v_stream.id,'/live.html?stream='||v_stream.id,'💸','high',jsonb_build_object('tip_id',v_tip.id,'amount_cents',coalesce(p_amount_cents,v_tip.amount_cents)));
    return jsonb_build_object('ok',true,'idempotent',false,'tip_id',v_tip.id,'creator_amount_cents',v_creator);
  else
    raise exception 'unsupported_payment_kind';
  end if;
end;
$function$;
revoke insert,update,delete,truncate,references,trigger on public.api_webhook_events,public.creator_available_balances,public.live_stream_purchases,public.live_tips,public.store_orders,public.user_levels,public.user_xp_ledger,public.xp_events from anon,authenticated;
create or replace function public.rb_process_stripe_event(p_event jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare eid text:=p_event->>'id'; et text:=p_event->>'type'; obj jsonb:=p_event#>'{data,object}'; meta jsonb; intent text; sess text; amt integer; cur text; prior public.api_webhook_events%rowtype; outcome jsonb; final_status text:='ignored';
begin
 if auth.role() is distinct from 'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
 if eid is null or eid !~ '^evt_[A-Za-z0-9_]+$' or et is null or p_event->'livemode' is distinct from 'true'::jsonb or jsonb_typeof(obj) is distinct from 'object' then raise exception 'invalid_live_stripe_event'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rb-stripe-event:'||eid,0));
 select * into prior from public.api_webhook_events where provider='stripe' and event_id=eid for update;
 if found and prior.status in ('processed','ignored') and prior.payload->>'processor'='rb_stripe_atomic_v1' then return jsonb_build_object('ok',true,'status',prior.status,'duplicate',true); end if;
 insert into public.api_webhook_events(provider,event_id,event_type,status,payload) values('stripe',eid,et,'processing',jsonb_build_object('processor','rb_stripe_atomic_v1','stripe_event',p_event)) on conflict(provider,event_id) do update set status='processing',payload=excluded.payload,error_message=null,updated_at=now();
 begin
  meta:=coalesce(obj->'metadata','{}'::jsonb);
  if et in ('checkout.session.completed','checkout.session.async_payment_succeeded') and obj->>'payment_status'='paid' then intent:=obj->>'payment_intent';sess:=obj->>'id';amt:=(obj->>'amount_total')::integer;
  elsif et='payment_intent.succeeded' and obj->>'status'='succeeded' then intent:=obj->>'id';amt:=(obj->>'amount_received')::integer;
  end if;
  cur:=lower(obj->>'currency');
  if intent is not null and (meta ? 'checkout_key' or meta ? 'live_kind' or meta ? 'reference_id') then
   if intent !~ '^pi_[A-Za-z0-9_]+$' or amt is null or amt<=0 or cur is null or cur !~ '^[a-z]{3}$' then raise exception 'invalid_verified_payment_fields'; end if;
   if meta ? 'checkout_key' and not (meta ? 'live_kind' or meta ? 'reference_id') then outcome:=public.rb_settle_store_payment(meta->>'checkout_key',intent,sess,amt,cur,jsonb_build_object('stripe_event_id',eid));
   elsif not (meta ? 'checkout_key') and meta ? 'live_kind' and meta ? 'reference_id' then outcome:=public.rb_settle_live_payment(meta->>'live_kind',(meta->>'reference_id')::uuid,intent,sess,amt,jsonb_build_object('stripe_event_id',eid,'stripe_currency',cur));
   else raise exception 'ambiguous_payment_metadata'; end if;
   if outcome->'ok' is distinct from 'true'::jsonb then raise exception 'settlement_not_confirmed'; end if;
   final_status:='processed';
  end if;
  update public.api_webhook_events set status=final_status,processed_at=now(),updated_at=now(),error_message=null where provider='stripe' and event_id=eid;
  return jsonb_build_object('ok',true,'status',final_status);
 exception when others then
  update public.api_webhook_events set status='failed',error_message=left(sqlerrm,500),updated_at=now() where provider='stripe' and event_id=eid;
  return jsonb_build_object('ok',false,'status','failed');
 end;
end $$;
revoke all on function public.rb_process_stripe_event(jsonb) from public,anon,authenticated;
grant execute on function public.rb_process_stripe_event(jsonb) to service_role;
commit;
