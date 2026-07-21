import { getAuthSnapshot } from '../auth/auth-store';
import { ROUTES } from '../config/routes';
import { supabase } from '../supabase/client';

const REQUIRED_TAPS = 5;
const HOLD_MS = 900;
const TAP_WINDOW_MS = 2400;
const STYLE_ID = 'rbAdminSecretDoorStyle';
const DOOR_ID = 'rbAdminSecretDoor';

const APPROVED_PAGES = new Set([
  'portal',
  'profile',
  'settings',
  'notifications',
  'messages',
  'creator',
  'admin'
]);

const TRIGGER_SELECTORS = [
  '[data-admin-secret-door]',
  '.portal-brand',
  '.profile-brand',
  '.settings-brand',
  '.notifications-brand',
  '.messages-brand',
  '.creator-brand',
  '.deep-top h1',
  'header h1',
  'header [class*="brand"]'
] as const;

function ensureDoorStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#${DOOR_ID}{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;overflow:hidden;isolation:isolate;background:
radial-gradient(circle at 50% 44%,rgba(57,255,105,.28),transparent 24%),
radial-gradient(circle at 50% 50%,rgba(247,201,72,.12),transparent 46%),
linear-gradient(150deg,#071109 0%,#010201 58%,#000 100%);color:#fff;font-family:inherit;animation:rbAdminIn .42s cubic-bezier(.2,.8,.2,1) both}
#${DOOR_ID}::before{content:"";position:absolute;inset:-25%;background:conic-gradient(from 0deg,transparent 0 18%,rgba(49,255,99,.12) 23%,transparent 30% 48%,rgba(247,201,72,.1) 53%,transparent 60%);filter:blur(18px);animation:rbAdminOrbit 14s linear infinite}
#${DOOR_ID} .rb-admin-core{position:absolute;width:min(84vw,500px);aspect-ratio:1;border-radius:50%;border:1px solid rgba(247,201,72,.72);box-shadow:0 0 90px rgba(49,255,99,.46),inset 0 0 110px rgba(49,255,99,.2);animation:rbAdminSpin 9s linear infinite}
#${DOOR_ID} .rb-admin-core::before,#${DOOR_ID} .rb-admin-core::after{content:"";position:absolute;border-radius:50%}
#${DOOR_ID} .rb-admin-core::before{inset:10%;border:1px dashed rgba(49,255,99,.7);box-shadow:inset 0 0 40px rgba(49,255,99,.18)}
#${DOOR_ID} .rb-admin-core::after{inset:29%;border:1px solid rgba(247,201,72,.78);background:radial-gradient(circle,rgba(49,255,99,.58) 0%,rgba(8,31,13,.72) 34%,rgba(0,0,0,.96) 72%);box-shadow:0 0 52px rgba(247,201,72,.2)}
#${DOOR_ID} section{position:relative;z-index:2;display:grid;gap:9px;width:min(88vw,430px);padding:24px;text-align:center;text-shadow:0 4px 24px #000;transform:translateZ(0)}
#${DOOR_ID} small{color:#f7c948;font-size:.58rem;font-weight:950;letter-spacing:.22em}
#${DOOR_ID} strong{font-size:clamp(1.55rem,7vw,3.2rem);font-weight:1000;letter-spacing:.08em;line-height:.95}
#${DOOR_ID} span{color:#31ff63;font-size:.58rem;font-weight:950;letter-spacing:.15em}
#${DOOR_ID} nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%;margin:14px auto 0}
#${DOOR_ID} nav b{display:grid;place-items:center;min-height:50px;padding:10px 8px;border:1px solid rgba(255,255,255,.14);border-radius:15px;background:linear-gradient(145deg,rgba(10,28,13,.9),rgba(0,0,0,.76));font-size:.49rem;letter-spacing:.1em;box-shadow:inset 0 0 20px rgba(49,255,99,.12),0 0 20px rgba(49,255,99,.08)}
@keyframes rbAdminIn{from{opacity:0;filter:blur(12px);transform:scale(1.035)}to{opacity:1;filter:none;transform:none}}
@keyframes rbAdminSpin{to{transform:rotate(360deg)}}
@keyframes rbAdminOrbit{to{transform:rotate(-360deg)}}
@media (prefers-reduced-motion:reduce){#${DOOR_ID},#${DOOR_ID}::before,#${DOOR_ID} .rb-admin-core{animation:none!important}}
`;
  document.head.append(style);
}

function revealDoor(): void {
  if (document.getElementById(DOOR_ID)) return;
  ensureDoorStyle();

  const door = document.createElement('div');
  door.id = DOOR_ID;
  door.setAttribute('role', 'dialog');
  door.setAttribute('aria-modal', 'true');
  door.setAttribute('aria-label', 'Founder Secret Door');
  door.innerHTML = '<div class="rb-admin-core" aria-hidden="true"></div><section><small>FOUNDER AUTHORITY VERIFIED</small><strong>SECRET DOOR OPEN</strong><span>ENTERING PRIVATE COMMAND NETWORK</span><nav aria-label="Protected admin dimensions"><b>ON THE GO</b><b>DASH BUSINESSES</b><b>PRIVATE WORLD</b><b>MOVIES</b></nav></section>';

  document.body.append(door);
  navigator.vibrate?.([35, 35, 80]);
  window.setTimeout(() => location.assign(ROUTES.admin), 1125);
}

function findTrigger(): HTMLElement | null {
  for (const selector of TRIGGER_SELECTORS) {
    const node = document.querySelector<HTMLElement>(selector);
    if (node) return node;
  }
  return null;
}

export async function mountAdminSecretDoor(): Promise<void> {
  const page = document.body.dataset.page ?? '';
  if (!APPROVED_PAGES.has(page)) return;
  if (!getAuthSnapshot().user) return;

  const trigger = findTrigger();
  if (!trigger || trigger.dataset.adminDoorMounted === 'true') return;

  const { data: allowed, error } = await supabase.rpc('rb_is_admin', { p_min_permission: 1 });
  if (error || !allowed) return;

  trigger.dataset.adminDoorMounted = 'true';
  trigger.dataset.adminSecretDoor = 'ready';
  trigger.setAttribute('aria-description', 'Founder access gesture enabled');

  let taps = 0;
  let tapReset: number | null = null;
  let holdTimer: number | null = null;
  let opened = false;

  const clearHold = () => {
    if (holdTimer !== null) window.clearTimeout(holdTimer);
    holdTimer = null;
  };

  const clearTapReset = () => {
    if (tapReset !== null) window.clearTimeout(tapReset);
    tapReset = null;
  };

  const open = () => {
    if (opened) return;
    opened = true;
    clearHold();
    clearTapReset();
    revealDoor();
  };

  const startHold = () => {
    clearHold();
    holdTimer = window.setTimeout(open, HOLD_MS);
  };

  const registerTap = () => {
    taps += 1;
    clearTapReset();
    tapReset = window.setTimeout(() => { taps = 0; }, TAP_WINDOW_MS);
    if (taps >= REQUIRED_TAPS) open();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.altKey && event.shiftKey) {
      event.preventDefault();
      open();
    }
  };

  trigger.addEventListener('pointerdown', startHold);
  trigger.addEventListener('pointerup', clearHold);
  trigger.addEventListener('pointercancel', clearHold);
  trigger.addEventListener('pointerleave', clearHold);
  trigger.addEventListener('click', registerTap);
  trigger.addEventListener('keydown', onKeyDown);
  trigger.addEventListener('contextmenu', (event) => event.preventDefault());

  window.addEventListener('pagehide', () => {
    clearHold();
    clearTapReset();
  }, { once: true });
}
