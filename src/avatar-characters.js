const cards = [...document.querySelectorAll('[data-character]')];
const status = document.getElementById('characterStatus');
const preview = document.getElementById('characterPreview');

function select(card) {
  cards.forEach((item) => item.classList.toggle('selected', item === card));
  const name = card.dataset.character || 'Boss Walk';
  const locked = card.classList.contains('locked');
  if (preview) preview.textContent = card.querySelector('.character-face')?.textContent || 'RB';
  if (status) status.textContent = locked ? `${name} is locked. Earn the unlock requirement first.` : `${name} selected. Tap USE CHARACTER to open Rich Avatar with this preset.`;
}

cards.forEach((card) => card.addEventListener('click', () => select(card)));
if (cards[0]) select(cards[0]);
