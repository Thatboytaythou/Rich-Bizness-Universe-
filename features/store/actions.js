import { supabase } from '../../src/supabase-client.js';
import { getAuthoritativeIdentity } from '../../src/rb-identity.js?v=profile-avatar-separate-1';

export const storeActionsFeature = { key: 'store-actions', status: 'phase-2-complete' };

async function currentIdentity() {
  const state = await getAuthoritativeIdentity({ fresh: true });
  return { user: state.user || null, profile: state.profile || null };
}

export async function likeProduct(productId) {
  const { user } = await currentIdentity();
  if (!user?.id || !productId) throw new Error('Sign in to like products.');
  const { data, error } = await supabase.from('product_likes').upsert(
    { product_id: productId, user_id: user.id, reaction: 'like' },
    { onConflict: 'product_id,user_id' }
  ).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function viewProduct(productId) {
  const { user } = await currentIdentity();
  if (!productId) return null;
  const { data, error } = await supabase.from('product_views').insert({
    product_id: productId,
    user_id: user?.id || null,
    anonymous_id: user ? null : crypto.randomUUID()
  }).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function addToCart(product, quantity = 1) {
  const { user } = await currentIdentity();
  if (!user?.id || !product?.id) throw new Error('Sign in to use your cart.');
  const { data, error } = await supabase.from('store_cart_items').upsert({
    user_id: user.id,
    product_id: product.id,
    seller_id: product.seller_id,
    quantity: Math.max(1, Number(quantity || 1)),
    price_cents: Number(product.price_cents || 0),
    currency: product.currency || 'usd',
    metadata: { source: 'store-page' },
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,product_id' }).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function listCart() {
  const { user } = await currentIdentity();
  if (!user?.id) return [];
  const { data, error } = await supabase.from('store_cart_items')
    .select('*, product:products(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateCartQuantity(itemId, quantity) {
  const { user } = await currentIdentity();
  if (!user?.id || !itemId) return null;
  const qty = Math.max(1, Number(quantity || 1));
  const { data, error } = await supabase.from('store_cart_items')
    .update({ quantity: qty, updated_at: new Date().toISOString() })
    .eq('id', itemId).eq('user_id', user.id).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function removeCartItem(itemId) {
  const { user } = await currentIdentity();
  if (!user?.id || !itemId) return;
  const { error } = await supabase.from('store_cart_items').delete().eq('id', itemId).eq('user_id', user.id);
  if (error) throw error;
}

export async function listProductCounts(productIds = []) {
  if (!productIds.length) return {};
  const [likes, comments, views] = await Promise.all([
    supabase.from('product_likes').select('product_id').in('product_id', productIds),
    supabase.from('store_comments').select('product_id').in('product_id', productIds),
    supabase.from('product_views').select('product_id').in('product_id', productIds)
  ]);
  for (const result of [likes, comments, views]) if (result.error) throw result.error;
  const counts = Object.fromEntries(productIds.map((id) => [id, { likes: 0, comments: 0, views: 0 }]));
  (likes.data || []).forEach((row) => counts[row.product_id].likes++);
  (comments.data || []).forEach((row) => counts[row.product_id].comments++);
  (views.data || []).forEach((row) => counts[row.product_id].views++);
  return counts;
}

export async function listProductComments(productId) {
  if (!productId) return [];
  const { data, error } = await supabase.from('store_comments')
    .select('*, profile:profiles(id,username,display_name,avatar_url)')
    .eq('product_id', productId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function commentProduct(productId, body) {
  const { user } = await currentIdentity();
  const text = String(body || '').trim();
  if (!user?.id || !productId || !text) throw new Error('Sign in and enter a comment.');
  const { data, error } = await supabase.from('store_comments').insert({
    product_id: productId,
    user_id: user.id,
    body: text
  }).select('*, profile:profiles(id,username,display_name,avatar_url)').maybeSingle();
  if (error) throw error;
  return data;
}

export async function createOrder(product, quantity = 1) {
  const { user, profile } = await currentIdentity();
  if (!user?.id || !product?.id) throw new Error('Sign in to place an order.');
  const qty = Math.max(1, Number(quantity || 1));
  const total = Number(product.price_cents || 0) * qty;
  const { data, error } = await supabase.from('store_orders').insert({
    buyer_id: user.id,
    seller_id: product.seller_id,
    product_id: product.id,
    product_name: product.title || 'Store Product',
    quantity: qty,
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
  }).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function listOrders() {
  const { user } = await currentIdentity();
  if (!user?.id) return [];
  const { data, error } = await supabase.from('store_orders')
    .select('*, product:products(id,title,image_url,cover_url,media_url,preview_url)')
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listSellerNotifications() {
  const { user } = await currentIdentity();
  if (!user?.id) return [];
  const { data, error } = await supabase.from('store_notifications')
    .select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data || [];
}

export async function markStoreNotificationRead(id) {
  const { user } = await currentIdentity();
  if (!user?.id || !id) return;
  const { error } = await supabase.from('store_notifications').update({ is_read: true }).eq('id', id).eq('user_id', user.id);
  if (error) throw error;
}

window.RB_STORE_ACTIONS = {
  likeProduct, viewProduct, addToCart, listCart, updateCartQuantity, removeCartItem,
  listProductCounts, listProductComments, commentProduct, createOrder, listOrders,
  listSellerNotifications, markStoreNotificationRead
};