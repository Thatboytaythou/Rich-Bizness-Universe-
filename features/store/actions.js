import { supabase } from '../../src/supabase-client.js';
import { getAuthoritativeIdentity } from '../../src/rb-identity.js?v=profile-avatar-separate-1';

export const storeActionsFeature = {
  key: 'store-actions',
  status: 'commerce-ready'
};

async function currentIdentity() {
  const state = await getAuthoritativeIdentity({ fresh: true });
  return { user: state.user || null, profile: state.profile || null };
}

export async function likeProduct(productId) {
  const { user } = await currentIdentity();
  if (!user?.id || !productId) return null;
  return supabase.from('product_likes').upsert({ product_id: productId, user_id: user.id, reaction: 'like' }, { onConflict: 'product_id,user_id' });
}

export async function viewProduct(productId) {
  const { user } = await currentIdentity();
  if (!productId) return null;
  return supabase.from('product_views').insert({ product_id: productId, user_id: user?.id || null, anonymous_id: user ? null : crypto.randomUUID() });
}

export async function addToCart(product, quantity = 1) {
  const { user } = await currentIdentity();
  if (!user?.id || !product?.id) return null;
  return supabase.from('store_cart_items').upsert({
    user_id: user.id,
    product_id: product.id,
    seller_id: product.seller_id,
    quantity,
    price_cents: Number(product.price_cents || 0),
    currency: product.currency || 'usd',
    metadata: { source: 'store-page' }
  }, { onConflict: 'user_id,product_id' });
}

export async function commentProduct(productId, body) {
  const { user } = await currentIdentity();
  const text = String(body || '').trim();
  if (!user?.id || !productId || !text) return null;
  return supabase.from('store_comments').insert({ product_id: productId, user_id: user.id, body: text });
}

export async function createOrder(product, quantity = 1) {
  const { user, profile } = await currentIdentity();
  if (!user?.id || !product?.id) return null;
  const total = Number(product.price_cents || 0) * quantity;
  return supabase.from('store_orders').insert({
    buyer_id: user.id,
    seller_id: product.seller_id,
    product_id: product.id,
    product_name: product.title || 'Store Product',
    quantity,
    amount_total: total,
    platform_fee_cents: 0,
    seller_amount_cents: total,
    currency: product.currency || 'usd',
    payment_status: 'pending',
    order_status: 'pending',
    customer_email: user.email || null,
    shipping_name: profile?.display_name || null,
    fulfillment_type: product.is_digital || product.product_type === 'digital' ? 'digital' : 'shipping',
    metadata: { source: 'store-page' }
  });
}

window.RB_STORE_ACTIONS = { likeProduct, viewProduct, addToCart, commentProduct, createOrder };
