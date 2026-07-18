import { ROUTES } from '../../core/config/routes';

const DOORS = [
  { href: ROUTES.onTheGoDay, icon: '🚦', kicker: 'CREATOR SECRET 01', title: 'On The Go Day', copy: 'Local rides, delivery runs, pickup missions, driver sessions, dispatch and neighborhood earning tools.' },
  { href: ROUTES.businesses, icon: '🏙️', kicker: 'CREATOR SECRET 02', title: 'Businesses', copy: 'Merchant identity, local discovery, storefront operations, services, inventory, trust and paid growth tools.' },
  { href: ROUTES.movies, icon: '🎬', kicker: 'CREATOR SECRET 03', title: 'Movies', copy: 'Premium screenings, creator premieres, synchronized watch rooms, releases and protected playback.' },
  { href: ROUTES.privateWorld, icon: '🗝️', kicker: 'CREATOR SECRET 04', title: 'Private World', copy: 'Approved-member rooms, private events, invitation gates, inventory and premium Meta experiences.' }
] as const;

export function mountCreatorSecretDoors(root: HTMLElement): void {
  if (root.querySelector('[data-creator-secret-grid]')) return;
  const hero = root.querySelector('.creator-hero');
  if (!hero) return;
  const section = document.createElement('section');
  section.className = 'creator-secret-grid';
  section.dataset.creatorSecretGrid = 'mounted';
  section.setAttribute('aria-label', 'Creator secret doors');
  section.innerHTML = DOORS.map((door) => `<a class="creator-secret-door" href="${door.href}"><span aria-hidden="true">${door.icon}</span><small>${door.kicker}</small><h3>${door.title}</h3><p>${door.copy}</p></a>`).join('');
  hero.insertAdjacentElement('afterend', section);
}
