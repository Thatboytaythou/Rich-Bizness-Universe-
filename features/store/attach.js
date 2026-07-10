import { addToCart, likeProduct, viewProduct, commentProduct, createOrder } from './actions.js';

function productId(card) {
  return card?.dataset?.productId || '';
}

function addControls(card) {
  if (!card || card.querySelector('[data-store-controls]')) return;
  const id = productId(card);
  if (!id) return;
  card.insertAdjacentHTML('beforeend', `<div data-store-controls style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px"><button data-store="like">LIKE</button><button data-store="cart">CART</button><button data-store="order">ORDER</button><button data-store="comment">COMMENT</button></div>`);
}

function scan() {
  document.querySelectorAll('[data-product-id]').forEach(addControls);
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-store]');
  const card = event.target.closest('[data-product-id]');
  if (!button || !card) return;
  const id = productId(card);
  await viewProduct(id).catch(() => {});
  if (button.dataset.store === 'like') await likeProduct(id).catch(() => {});
  if (button.dataset.store === 'cart') await addToCart(id).catch(() => {});
  if (button.dataset.store === 'comment') {
    const text = prompt('Store comment');
    if (text) await commentProduct(id, text).catch(() => {});
  }
  if (button.dataset.store === 'order') {
    const product = window.RB_STORE_PRODUCTS?.find((item) => item.id === id);
    if (product) await createOrder(product).catch(() => {});
  }
});

new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
scan();
