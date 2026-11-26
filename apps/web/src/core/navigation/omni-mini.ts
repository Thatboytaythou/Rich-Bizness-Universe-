import { ROUTES } from '../config/routes';
import { getAuthSnapshot, subscribeAuth } from '../auth/auth-store';

// The existing portal remains the destination authority. This control creates
// no WebGL context, network requests, auth client, or new route.
const destinations = [
  ['portal','Portal','◎',ROUTES.portal],
  ['profile','Profile','◉',ROUTES.profile],
  ['avatar-characters','Avatar Studio','◇',ROUTES.avatarCharacters],
  ['meta','Worlds','✧',ROUTES.meta],
  ['feed','Feed','✦',ROUTES.feed],
  ['messages','Messages','✉',ROUTES.messages],
  ['live','Live','●',ROUTES.live],
  ['music','Music','♪',ROUTES.music],
  ['watch','Watch','▶',ROUTES.watch],
  ['gallery','Gallery','▣',ROUTES.gallery],
  ['podcast','Podcast','◉',ROUTES.podcast],
  ['radio','Radio','⌁',ROUTES.radio],
  ['gaming','Gaming','♜',ROUTES.gaming],
  ['sports','Sports','★',ROUTES.sports],
  ['store','Store','▧',ROUTES.store],
  ['upload','Create','↑',ROUTES.upload],
  ['search','Search','⌕',ROUTES.search],
  ['notifications','Alerts','◌',ROUTES.notifications],
  ['settings','Settings','⚙',ROUTES.settings],
  ['edit-profile','Edit profile','✎',ROUTES.editProfile],
  ['avatar','Avatar lobby','◇',ROUTES.avatar],
  ['creator','Creator','✦',ROUTES.creator],
  ['creator-dimensions','Creator dimensions','◇',ROUTES.creatorDimensions]
] as const;
const pages = new Set<string>(destinations.map(([key]) => key));
pages.delete('portal');
const HOST_ID = 'rb-omni-mini';
const css = `
:host{all:initial;position:fixed;right:max(10px,env(safe-area-inset-right));bottom:calc(max(72px,env(safe-area-inset-bottom) + 56px));z-index:850;display:block;color:#f5f8f0;font:13px/1.4 system-ui,-apple-system,sans-serif;pointer-events:none}
*,*::before,*::after{box-sizing:border-box}
button,a{font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
button:focus-visible,a:focus-visible{outline:2px solid #f6d17d;outline-offset:3px}
.trigger{pointer-events:auto;width:58px;height:58px;float:right;border:1px solid #c6a050;border-radius:50%;background:radial-gradient(circle,#185b33 0,#071b13 45%,#080e0c 70%);box-shadow:0 0 0 4px #071810bb,0 0 20px #39ed7e55;display:grid;place-content:center;text-align:center}
.trigger b{font-size:21px;line-height:1;color:#e9d18f}.trigger small{font-size:8px;letter-spacing:.16em;color:#c8edce;font-weight:800}
.panel{pointer-events:auto;position:absolute;right:0;bottom:70px;width:min(330px,calc(100vw - 24px));max-height:min(68vh,530px);max-height:min(68dvh,530px);overflow:auto;overscroll-behavior:contain;padding:14px;border:1px solid #8e783d;border-radius:22px;background:linear-gradient(145deg,#122b20,#070e0b 60%);box-shadow:0 16px 50px #000c;animation:reveal .16s ease-out}
.panel[hidden]{display:none} @keyframes reveal{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.panel{animation:none}}
header{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}header small{display:block;letter-spacing:.16em;color:#dfc27b;font-size:9px;font-weight:800}h2{font-size:18px;margin:2px 0}
.close{border:1px solid #627668;background:#102119;border-radius:50%;height:36px;width:36px}
.identity{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;border:1px solid #31543b;border-radius:10px;color:#cbe4d1;font-size:11px}
.identity strong{color:#86e7aa}nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:12px 0}
a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:51px;text-decoration:none;text-align:center;border:1px solid #385243;background:#0e2018;border-radius:11px;font-size:10px}a span{font-size:18px;color:#a0edb8}a[aria-current=page]{border-color:#e8c875;background:#34402a;color:#ffe4a0}
details{border-top:1px solid #385243;padding-top:9px;color:#b8c7be}summary{cursor:pointer;font-weight:700;color:#d4e7d9}pre{font:11px/1.45 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0}
.copy{width:100%;border:1px solid #6f8c73;background:#142a1e;padding:8px;border-radius:9px}.feedback{display:block;font-size:11px;margin-top:4px}
`;
export function mountOmniMini(page: string, failure = false): void {
  if (!pages.has(page)) return;
  const existing = document.getElementById(HOST_ID);
  if (existing) { if (failure) existing.dataset.bootFailed = 'true'; return; }
  const host = document.createElement('div');
  host.id = HOST_ID;
  if (failure) host.dataset.bootFailed = 'true';
  const shadow = host.attachShadow({mode:'open'});
  const style = document.createElement('style'); style.textContent = css;
  const panel = document.createElement('section');
  panel.className='panel'; panel.id='omni-panel'; panel.hidden=true;
  panel.setAttribute('aria-label','Mini Omni navigation');
  panel.innerHTML='<header><div><small>RICH BIZNESS • OMNI CORE</small><h2>Choose your universe</h2></div><button class="close" type="button" aria-label="Close Omni">×</button></header><div class="identity"><strong id="identity"></strong><span id="section"></span></div><nav aria-label="Universe destinations"></nav><details><summary>Visual status / share with support</summary><pre id="report"></pre><button class="copy" type="button">Copy screen status</button><span class="feedback" role="status"></span></details>';
  const trigger = document.createElement('button');
  trigger.type='button'; trigger.className='trigger'; trigger.innerHTML='<b>◎</b><small>OMNI</small>';
  trigger.setAttribute('aria-label','Open Mini Omni Dial');trigger.setAttribute('aria-controls',panel.id);trigger.setAttribute('aria-expanded','false');
  const nav=panel.querySelector('nav')!;
  const section=panel.querySelector<HTMLElement>('#section')!;
  for (const [key,label,icon,href] of destinations) {
    const link=document.createElement('a');link.href=href;
    const glyph=document.createElement('span');glyph.textContent=icon;glyph.setAttribute('aria-hidden','true');
    link.append(glyph,document.createTextNode(label));
    if(key===page){link.setAttribute('aria-current','page');section.textContent=label;}
    nav.append(link);
  }
  const report=panel.querySelector<HTMLElement>('#report')!;
  const feedback=panel.querySelector<HTMLElement>('.feedback')!;
  const identity=panel.querySelector<HTMLElement>('#identity')!;
  const update=()=>{
    const auth=getAuthSnapshot();
    identity.textContent=!auth.ready?'Identity checking':auth.user?'Rich ID • signed in':'Guest • sign in at Portal';
    const app=document.querySelector<HTMLElement>('#app');
    const canvas=app?.querySelector<HTMLCanvasElement>('canvas');
    const render=canvas?.dataset.rbRenderState ?? (canvas?'Canvas present (not verified)':'No canvas on this page');
    report.textContent=[
      'Section: '+page,'Path: '+location.pathname,
      'Page: '+(host.dataset.bootFailed==='true'?'Bootstrap error':app?.dataset.pageMounted==='true'?'Controller mounted':'Not confirmed'),
      'Owner: '+(app?.dataset.pageOwner??'not assigned'),
      'Identity: '+(!auth.ready?'checking':auth.user?'signed in':'guest'),
      'Viewport: '+innerWidth+' × '+innerHeight+' CSS px',
      'Pixel ratio: '+devicePixelRatio,
      'Motion: '+(matchMedia('(prefers-reduced-motion: reduce)').matches?'reduced':'standard'),
      'Renderer: '+render,
      'Network: '+(navigator.onLine?'browser online (services not verified)':'offline')
    ].join('\n');
  };
  const setOpen=(open:boolean)=>{panel.hidden=!open;trigger.setAttribute('aria-expanded',String(open));trigger.setAttribute('aria-label',open?'Close Mini Omni Dial':'Open Mini Omni Dial');if(open){update();panel.querySelector<HTMLButtonElement>('.close')?.focus();}else trigger.focus();};
  trigger.onclick=()=>setOpen(panel.hidden);
  panel.querySelector<HTMLButtonElement>('.close')!.onclick=()=>setOpen(false);
  panel.querySelector('details')!.addEventListener('toggle',update);
  shadow.addEventListener('keydown',(event)=>{if((event as KeyboardEvent).key==='Escape'&&!panel.hidden)setOpen(false);});
  panel.querySelector<HTMLButtonElement>('.copy')!.onclick=async()=>{
    update();try{await navigator.clipboard.writeText(report.textContent??'');feedback.textContent='Screen status copied.';}
    catch{feedback.textContent='Clipboard unavailable. Select and copy the status text above.';}
  };
  const unsubscribe=subscribeAuth(update);
  const refresh=()=>{if(!panel.hidden)update();};
  window.addEventListener('resize',refresh);
  window.addEventListener('online',refresh);window.addEventListener('offline',refresh);
  window.addEventListener('pagehide',(event)=>{if(event.persisted)return;unsubscribe();window.removeEventListener('resize',refresh);window.removeEventListener('online',refresh);window.removeEventListener('offline',refresh);host.remove();});
  shadow.append(style,panel,trigger);document.body.append(host);update();
}
