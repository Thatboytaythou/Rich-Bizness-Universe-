import { bootXp, awardXp } from './rb-xp.js';

bootXp();
const form = document.getElementById('avatarForm');
form?.addEventListener('submit', () => {
  setTimeout(() => awardXp('avatar_save', { section: 'avatar' }), 80);
});
