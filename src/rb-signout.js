import { signOutAndGoHome } from './rb-identity.js?v=tap-in-foundation-1';

document.addEventListener('click', async (event) => {
  const trigger = event.target.closest?.('[data-local-signout],[data-rb-signout]');
  if (!trigger) return;
  event.preventDefault();
  trigger.disabled = true;
  trigger.textContent = 'IM OUT ✌🏽';
  await signOutAndGoHome();
});
