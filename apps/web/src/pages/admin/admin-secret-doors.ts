import { ROUTES } from '../../core/config/routes';

const DOORS = [
  { href: ROUTES.onTheGoDay, icon: '🚦', kicker: 'SECRET 01', title: 'On The Go Day', copy: 'Local rides, delivery runs, pickup missions, driver activity, dispatch and neighborhood movement.' },
  { href: ROUTES.businesses, icon: '🏙️', kicker: 'SECRET 02', title: 'Businesses', copy: 'Local business discovery, merchant command tools, services, storefront identity and trusted operations.' },
  { href: ROUTES.movies, icon: '🎬', kicker: 'SECRET 03', title: 'Movies', copy: 'Premium movie rooms, creator premieres, watch sessions, cinematic releases and protected playback.' },
  { href: ROUTES.privateWorld, icon: '🗝️', kicker: 'SECRET 04', title: 'Private World', copy: 'Founder-controlled private spaces, invitation gates, elite rooms, private inventory and world access.' }
] as const;

export function mountAdminSecretDoors(root: HTMLElement): void {
  if (root.querySelector('[data-admin-secret-grid]')) return;
  const hero = root.querySelector('.deep-hero');
  if (!hero) return;
  const section = document.createElement('section');
  section.className = 'admin-secret-grid';
  section.dataset.adminSecretGrid = 'mounted';
  section.setAttribute('aria-label', 'Admin secret doors');
  section.innerHTML = DOORS.map((door) => `<a class="admin-secret-door" href="${door.href}"><span aria-hidden="true">${door.icon}</span><small>${door.kicker}</small><h3>${door.title}</h3><p>${door.copy}</p></a>`).join('');
  hero.insertAdjacentElement('afterend', section);
}
