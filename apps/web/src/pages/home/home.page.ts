import { getAuthSnapshot } from '../../core/auth/auth-store';
import './home.css';

const BACKGROUND='/images/0E886281-8F03-4288-B3CA-C45369B7B58E.png';
const HOME_OWNER='rich-bizness-home-v1';

export async function mountHomePage():Promise<void>{
  const app=document.querySelector<HTMLDivElement>('#app');
  if(!app)throw new Error('Missing #app mount');
  const mountEpoch=app.dataset.pageEpoch??'';
  let disposed=false;
  const isCurrent=()=>!disposed&&app.dataset.pageEpoch===mountEpoch&&app.dataset.pageOwner===HOME_OWNER;
  if(!isCurrent())return;

  const signedIn=Boolean(getAuthSnapshot().user);
  const primaryHref=signedIn?'/portal.html':'/tap-in.html?next=%2Fportal.html';
  const primaryLabel=signedIn?'ENTER UNIVERSE':'TAP IN';

  app.innerHTML=`<main class="rb-home" style="--rb-home-bg:url('${BACKGROUND}')">
    <div class="rb-home__bg" aria-hidden="true"></div>
    <div class="rb-home__shade" aria-hidden="true"></div>

    <header class="rb-home__topbar">
      <a class="rb-home__brand" href="/" aria-label="Rich Bizness home">
        <small>RICH BIZNESS LLC</small>
        <strong>UNIVERSE</strong>
      </a>
      <a class="rb-home__enter" href="${primaryHref}">${primaryLabel}</a>
    </header>

    <section class="rb-home__stage">
      <div class="rb-home__copy">
        <p class="rb-home__eyebrow">ONE IDENTITY • ONE UNIVERSE</p>
        <h1>BUILD IT.<br><span>OWN IT.</span><br>LIVE RICH.</h1>
        <p class="rb-home__lead">Your creator identity, 3D avatar, live rooms, music, gaming, store, sports and Meta all connect through one Rich Bizness universe.</p>
        <div class="rb-home__actions">
          <a class="primary" href="${primaryHref}">${primaryLabel}</a>
          <a href="/profile.html">PROFILE</a>
          <a href="/avatar.html">AVATAR</a>
        </div>
      </div>

      <a class="rb-home__gateway" href="${primaryHref}" aria-label="${primaryLabel}">
        <span class="rb-home__gateway-glow" aria-hidden="true"></span>
        <strong>RB</strong>
        <small>${primaryLabel}</small>
      </a>
    </section>
  </main>`;

  const cleanup=()=>{if(disposed)return;disposed=true;};
  (window as Window&{__rbPageCleanup?:(()=>void|Promise<void>)|null}).__rbPageCleanup=cleanup;
  window.addEventListener('pagehide',cleanup,{once:true});
  window.addEventListener('beforeunload',cleanup,{once:true});
}
