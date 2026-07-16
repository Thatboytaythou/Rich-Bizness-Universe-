import './universe-bridge.css';

type Link = Readonly<{ href: string; label: string; kicker: string; icon: string }>;

const MEDIA_LINKS: readonly Link[] = [
  { href: '/feed.html', label: 'FEED', kicker: 'SOCIAL', icon: '✦' },
  { href: '/watch.html', label: 'WATCH', kicker: 'VIDEO', icon: '▶' },
  { href: '/podcast.html', label: 'PODCAST', kicker: 'TALK', icon: '◉' },
  { href: '/radio.html', label: 'RADIO', kicker: 'LIVE AUDIO', icon: '⌁' }
];

function linkMarkup(link: Link): string {
  return `<a href="${link.href}" aria-label="Open ${link.label}"><span>${link.icon}</span><small>${link.kicker}</small><strong>${link.label}</strong></a>`;
}

function mountLiveBridge(): void {
  if ((document.body.dataset.page ?? '') !== 'live') return;
  const header = document.querySelector<HTMLElement>('.media-ultimate__head');
  if (!header || document.querySelector('#rbLiveNetworkBridge')) return;

  const bridge = document.createElement('nav');
  bridge.id = 'rbLiveNetworkBridge';
  bridge.className = 'rb-live-network-bridge';
  bridge.setAttribute('aria-label', 'Live network connections');
  bridge.innerHTML = `<small>LIVE NETWORK</small><div>${MEDIA_LINKS.map(linkMarkup).join('')}</div>`;
  header.insertAdjacentElement('afterend', bridge);
}

export function mountUniverseBridge(): void {
  mountLiveBridge();
}
