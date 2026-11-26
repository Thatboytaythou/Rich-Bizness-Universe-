-- Protect future paid Elite inventory namespace, without changing legacy/free inventory.
create policy rb_elite_paid_no_client_insert on public.avatar_inventory as restrictive for insert to authenticated
with check (item_key not like 'rb-elite-paid-%');
create policy rb_elite_paid_no_client_update on public.avatar_inventory as restrictive for update to authenticated
using (item_key not like 'rb-elite-paid-%') with check (item_key not like 'rb-elite-paid-%');
-- Verified purchase proof comes from service-written order and unlock records, never client inventory.
create or replace function public.rb_elite_verified_purchases()
returns table(item_key text, product_id uuid, order_id uuid)
language sql stable security invoker set search_path = ''
as $$
 select distinct p.avatar_item_key,u.product_id,u.order_id
 from public.user_product_unlocks u
 join public.products p on p.id=u.product_id
 join public.store_orders o on o.id=u.order_id and o.product_id=u.product_id and o.buyer_id=u.user_id
 where u.user_id=(select auth.uid())
 and p.avatar_item_key like 'rb-elite-paid-%'
 and o.payment_status='paid'
 and (u.expires_at is null or u.expires_at>now())
$$;
revoke all on function public.rb_elite_verified_purchases() from public,anon;
grant execute on function public.rb_elite_verified_purchases() to authenticated;