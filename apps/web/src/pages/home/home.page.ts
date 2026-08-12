import { getAuthSnapshot } from '../../core/auth/auth-store';
import './home.css';

const BACKGROUND = '/images/0E886281-8F03-4288-B3CA-C45369B7B58E.png';
const HOME_OWNER = 'rich-bizness-home-v1';

export async function mountHomePage(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('Missing #app mount');
  const mountEpoch = app.dataset.pageEpoch ?? '';
  let disposed = false;
  const isCurrent = () => !disposed && app.dataset.pageEpoch === mountEpoch && app.dataset.pageOwner === HOME_OWNER;
  if (!isCurrent()) return;

  const signedIn = Boolean(getAuthSnapshot().user);
  const primaryHref = signedIn ? '/portal.html' : '/tap-in.html?next=%2Fportal.html';
  const primaryLabel = signedIn ? 'ENTER UNIVERSE' : 'TAP IN';

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
          <p class="rb-home__kicker">RICH BIZNESS UNIVERSE</p>
          <h1>BUILD IT.<br><span>OWN IT.</span><br>LIVE RICH.</h1>
          <p class="rb-home__lead">One identity. One avatar. One portal into creators, live rooms, music, games, store, sports and Meta.</p>
          <div class="rb-home__actions">
            <a class="primary" href="${primaryHref}">${primaryLabel}</a>
            <a href="/profile.html">PROFILE</a>
            <a href="/avatar.html">AVATAR</a>
          </div>
          <div class="rb-home__status" aria-label="Universe shortcuts">
            <a href="/live.html"><b>WE LIT 🔥</b><span>LIVE</span></a>
            <a href="/music.html"><b>MUSIC</b><span>LISTEN</span></a>
            <a href="/gaming.html"><b>GAMING</b><span>PLAY</span></a>
            <a href="/store.html"><b>STORE</b><span>SHOP</span></a>
          </div>
        </div>

        <div class="rb-home__portal-stack">
          <a class="rb-home__portal" href="${primaryHref}" aria-label="${primaryLabel}">
            <i></i><i></i><i></i><i></i><span>RB</span><small>${primaryLabel}</small>
          </a>
          <div class="rb-home__orbit" aria-hidden="true"><span>PROFILE</span><span>AVATAR</span><span>LIVE</span><span>GAMING</span><span>STORE</span></div>
        </div>
      </section>
    </main>`;

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
  };
  (window as Window & { __rbPageCleanup?: (() => void | Promise<void>) | null }).__rbPageCleanup = cleanup;
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });
}
