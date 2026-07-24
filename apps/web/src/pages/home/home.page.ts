import { getAuthSnapshot } from '../../core/auth/auth-store';
import './home.css';

const BACKGROUND = '/images/0E886281-8F03-4288-B3CA-C45369B7B58E.png';
const HOME_OWNER = 'rich-bizness-home-v2';

export async function mountHomePage(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('Missing #app mount');
  if (app.dataset.pageOwner === HOME_OWNER) return;

  const signedIn = Boolean(getAuthSnapshot().user);
  const primaryHref = signedIn ? '/portal.html' : '/tap-in.html?next=%2Fportal.html';
  const primaryLabel = signedIn ? 'ENTER UNIVERSE' : 'TAP IN';

  app.dataset.pageOwner = HOME_OWNER;
  app.replaceChildren();

  const network = [
    ['PROFILE','Universal identity, XP, avatar and creator status','/profile.html','ID'],
    ['AVATAR','Character selection and full 3D lobby','/avatar.html','3D'],
    ['META','Rooms, worlds, visits and connected identity','/meta.html','◎'],
    ['FEED','Community drops, comments and discovery','/feed.html','◫'],
    ['WE LIT 🔥','Live rooms, calls, reactions and VIP','/live.html','◉'],
    ['WE 🔥 📺','Watch network, cinema and synchronized viewing','/watch.html','▶'],
    ['MUSIC','Artists, tracks, podcasts and radio','/music.html','♪'],
    ['GAMING','28 connected games, sessions and XP','/gaming.html','🎮'],
    ['STORE','Creator products, orders and seller tools','/store.html','🛒']
  ];

  app.innerHTML = `
    <main class="rb-home" style="--rb-home-bg:url('${BACKGROUND}')">
      <div class="rb-home__background" aria-hidden="true"></div>
      <div class="rb-home__veil" aria-hidden="true"></div>
      <div class="rb-home__stars" aria-hidden="true"></div>
      <div class="rb-home__energy" aria-hidden="true"><i></i><i></i><i></i></div>

      <header class="rb-home__header">
        <a class="rb-home__brand" href="/" aria-label="Rich Bizness home">
          <small>RICH BIZNESS LLC</small>
          <strong>UNIVERSE</strong>
        </a>
        <nav aria-label="Primary navigation">
          <a href="/profile.html">PROFILE</a>
          <a href="/avatar.html">AVATAR</a>
          <a href="/live.html">WE LIT 🔥</a>
          <a href="/watch.html">WE 🔥 📺</a>
          <a class="rb-home__nav-cta" href="${primaryHref}">${primaryLabel}</a>
        </nav>
      </header>

      <section class="rb-home__hero">
        <div class="rb-home__copy">
          <p class="rb-home__kicker">GLOBAL CREATOR OPERATING SYSTEM</p>
          <h1>BUILD IT.<br><span>OWN IT.</span><br>LIVE RICH.</h1>
          <p class="rb-home__lead">One connected cinematic universe for identity, avatar, XP, creators, live rooms, music, podcasts, radio, games, sports, stores and ownership.</p>
          <div class="rb-home__actions">
            <a class="primary" href="${primaryHref}">${primaryLabel}</a>
            <a href="/profile.html">OPEN UNIVERSAL PROFILE</a>
          </div>
          <div class="rb-home__status" aria-label="Platform systems">
            <span><b>RICH ID</b> CONNECTED</span>
            <span><b>XP</b> REALTIME</span>
            <span><b>AVATAR</b> UNIVERSAL</span>
            <span><b>LIVEKIT</b> READY</span>
          </div>
        </div>

        <div class="rb-home__portal-stack">
          <a class="rb-home__portal" href="${primaryHref}" aria-label="${primaryLabel}">
            <i></i><i></i><i></i><i></i><span>RB</span><small>${primaryLabel}</small>
          </a>
          <div class="rb-home__orbit" aria-hidden="true"><span>PROFILE</span><span>AVATAR</span><span>LIVE</span><span>STORE</span></div>
        </div>
      </section>

      <section class="rb-home__command" aria-label="Rich Bizness command gateway">
        <header><div><small>UNIVERSE COMMAND DECK</small><h2>EVERY SYSTEM. ONE IDENTITY.</h2></div><a href="/portal.html">OPEN PORTAL →</a></header>
        <div class="rb-home__network">
          ${network.map(([title,copy,href,icon]) => `<a href="${href}"><i>${icon}</i><small>${copy}</small><strong>${title}</strong><span>OPEN SYSTEM →</span></a>`).join('')}
        </div>
      </section>
    </main>`;
}
