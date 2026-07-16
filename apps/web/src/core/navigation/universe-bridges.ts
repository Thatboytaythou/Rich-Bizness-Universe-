import './universe-bridges.css';

type Bridge = Readonly<{
  key: string;
  label: string;
  kicker: string;
  icon: string;
  href: string;
}>;

const MEDIA_BRIDGES: readonly Bridge[] = Object.freeze([
  { key: 'feed', label: 'FEED', kicker: 'SOCIAL', icon: '✦', href: '/feed.html' },
  { key: 'watch', label: 'WATCH', kicker: 'VIDEO', icon: '▶', href: '/watch.html' },
  { key: 'podcast', label: 'PODCAST', kicker: 'TALK', icon: '◉', href: '/podcast.html' },
  { key: 'radio', label: 'RADIO', kicker: 'AIR', icon: '⌁', href: '/radio.html' }
]);

function mountPortalMediaConstellation(): void {
  const world = document.querySelector<HTMLElement>('.portal-world');
  if (!world || document.querySelector('#rbPortalMediaRing')) return;

  const ring = document.createElement('nav');
  ring.id = 'rbPortalMediaRing';
  ring.className = 'rb-media-ring';
  ring.setAttribute('aria-label', 'Rich Bizness media constellation');
  ring.innerHTML = MEDIA_BRIDGES.map((bridge, index) => `
    <a class="rb-media-ring__node rb-media-ring__node--${bridge.key}" href="${bridge.href}" style="--media-index:${index}" aria-label="Open ${bridge.label}">
      <span>${bridge.icon}</span>
      <small>${bridge.kicker}</small>
      <strong>${bridge.label}</strong>
    </a>`).join('');

  world.append(ring);
}

function mountLiveUniverseBridge(): void {
  const header = document.querySelector<HTMLElement>('.media-ultimate__head');
  if (!header || document.querySelector('#rbLiveUniverseBridge')) return;

  const bridge = document.createElement('nav');
  bridge.id = 'rbLiveUniverseBridge';
  bridge.className = 'rb-live-bridge';
  bridge.setAttribute('aria-label', 'Live universe connections');
  bridge.innerHTML = `
    <span class="rb-live-bridge__label"><small>LIVE CONNECT</small><strong>KEEP THE UNIVERSE FLOWING</strong></span>
    <div class="rb-live-bridge__links">
      ${MEDIA_BRIDGES.map((item) => `<a href="${item.href}" aria-label="Open ${item.label}"><i>${item.icon}</i><span>${item.label}</span></a>`).join('')}
    </div>`;

  header.insertAdjacentElement('afterend', bridge);
}

export function mountUniverseBridges(): void {
  const page = document.body.dataset.page ?? '';
  if (page === 'portal') mountPortalMediaConstellation();
  if (page === 'live') mountLiveUniverseBridge();
}
