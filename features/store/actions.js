import { supabase } from '../../src/supabase-client.js';
import { getAuthoritativeIdentity } from '../../src/rb-identity.js?v=profile-avatar-separate-1';

export const storeActionsFeature = {
  key: 'store-actions',
  status: 'commerce-ready'
};

async function userId() {
  const state = await getAuthoritativeIdentity({ fresh: true });
  return state.user?.id || null;
}

export async function likeProduct(productId) {
  const uid = await userId();
  if (!uid || !productId) return null;
  return supabase.from('product_likes').upsert({ product_id: productId, user_id: uid }, { onConflict: 'product_id,user_id' });
}

export async function viewProduct(productId) {
  const uid = await userId();
  if (!productId) return null;
  return supabase.from('product_views').insert({ product_id: productId, user_id: uid });
}

export async function addToCart(productId, quantity = 1) {
  const uid = await userId();
  if (!uid || !productId) return null;
  return supabase.from('store_cart_items').upsert({ product_id: productId, user_id: uid, quantity }, { onConflict: 'user_id,product_id' });
}

export async function commentProduct(productId, body) {
  const uid = await userId();
  const text = String(body || '').trim();
  if (!uid || !productId || !text) return null;
  return supabase.from('store_comments').insert({ product_id: productId, user_id: uid, body: text });
}

export async function createOrder(product) {
  const uid = await userId();
  if (!uid || !product?.id) return null;
  return supabase.from('store_orders').insert({ buyer_id: uid, seller_id: product.seller_id, product_id: product.id, total_cents: product.price_cents || 0, status: 'pending', currency: product.currency || 'usd' });
}

window.RB_STORE_ACTIONS = { likeProduct, viewProduct, addToCart, commentProduct, createOrder };
