import { getAuthSnapshot } from '../../core/auth/auth-store';
import './home.css';

const BACKGROUND = '/images/0E886281-8F03-4288-B3CA-C45369B7B58E.png';
const HOME_OWNER = 'rich-bizness-home-v1';

export async function mountHomePage(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('Missing #app mount');
  if (app.dataset.pageOwner === HOME_OWNER) return;

  const signedIn = Boolean(getAuthSnapshot().user);
  if (signedIn) {
    location.replace('/portal.html');
    return;
  }

  app.dataset.pageOwner = HOME_OWNER;
  app.replaceChildren();

  const primaryHref = '/tap-in.html?next=%2Fportal.html';
  const primaryLabel = 'TAP IN';

  app.innerHTML = `
    <main class="rb-home" style="--rb-home-bg:url('${BACKGROUND}')">
      <div class="rb-home__background" aria-hidden="true"></div>
      <div class="rb-home__veil" aria-hidden="true"></div>
      <div class="rb-home__stars" aria-hidden="true"></div>

      <header class="rb-home__header">
        <a class="rb-home__brand" href="/" aria-label="Rich Bizness home">
          <small>RICH BIZNESS LLC</small>
          <strong>UNIVERSE</strong>
        </a>
        <nav aria-label="Public navigation">
          <a href="/feed.html">FEED</a>
          <a href="/watch.html">WATCH</a>
          <a href="/podcast.html">PODCAST</a>
          <a href="/radio.html">RADIO</a>
          <a class="rb-home__nav-cta" href="${primaryHref}">${primaryLabel}</a>
        </nav>
      </header>

      <section class="rb-home__hero">
        <div class="rb-home__copy">
          <p>GLOBAL CREATOR OPERATING SYSTEM</p>
          <h1>BUILD IT.<br><span>OWN IT.</span><br>LIVE RICH.</h1>
          <p class="rb-home__lead">One cinematic universe for creators, live rooms, music, podcasts, radio, games, sports, stores, profiles and controllable avatars.</p>
          <div class="rb-home__actions">
            <a class="primary" href="${primaryHref}">${primaryLabel}</a>
            <a href="/profile.html">EXPLORE PROFILES</a>
          </div>
        </div>

        <div class="rb-home__portal" aria-hidden="true">
          <i></i><i></i><i></i><span>RB</span>
        </div>
      </section>

      <section class="rb-home__network" aria-label="Rich Bizness network">
        ${[
          ['FEED','Community + creator drops','/feed.html'],
          ['WATCH','Cinematic video network','/watch.html'],
          ['LIVE','Broadcast + rooms','/live.html'],
          ['MUSIC','Tracks + artists','/music.html'],
          ['PODCAST','Shows + episodes','/podcast.html'],
          ['RADIO','Stations + live audio','/radio.html'],
          ['GAMING','Playable Rich worlds','/gaming.html'],
          ['STORE','Products + creator commerce','/store.html']
        ].map(([title,copy,href]) => `<a href="${href}"><small>${copy}</small><strong>${title}</strong><span>OPEN →</span></a>`).join('')}
      </section>
    </main>`;
}