import { addToCart, likeProduct, viewProduct, commentProduct, createOrder } from './actions.js';

const $ = (selector) => document.querySelector(selector);
const state = { products: [] };

function enhanceCards() {
  const cards = [...document.querySelectorAll('#sectionCards .market-card')];
  cards.forEach((card, index) => {
    const product = state.products[index];
    if (!product || card.dataset.storeEnhanced === 'true') return;
    card.dataset.storeEnhanced = 'true';
    card.dataset.productId = product.id;
    card.insertAdjacentHTML('beforeend', `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px"><button class="identity-pill" data-store-action="like">LIKE</button><button class="identity-pill" data-store-action="cart">CART</button><button class="identity-pill primary" data-store-action="buy">ORDER</button><button class="identity-pill" data-store-action="comment">COMMENT</button></div>`);
    card.addEventListener('click', () => viewProduct(product.id).catch(() => {}), { once: true });
  });
}

function watchCards() {
  const host = $('#sectionCards');
  if (!host) return;
  new MutationObserver(enhanceCards).observe(host, { childList: true, subtree: true });
  enhanceCards();
}

window.addEventListener('rb:store-products', (event) => {
  state.products = event.detail?.products || [];
  enhanceCards();
});

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-store-action]');
  const card = event.target.closest('[data-product-id]');
  if (!button || !card) return;
  event.preventDefault();
  event.stopPropagation();
  const product = state.products.find((item) => item.id === card.dataset.productId);
  if (!product) return;
  if (button.dataset.storeAction === 'like') await likeProduct(product.id);
  if (button.dataset.storeAction === 'cart') await addToCart(product);
  if (button.dataset.storeAction === 'buy') await createOrder(product);
  if (button.dataset.storeAction === 'comment') {
    const body = prompt('Store comment');
    if (body) await commentProduct(product.id, body);
  }
});

watchCards();
