import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

type AuthSnapshot = Readonly<{ session: Session | null; user: User | null; ready: boolean }>;
type Listener = (snapshot: AuthSnapshot) => void;

const AUTH_TIMEOUT_MS = 10_000;

let snapshot: AuthSnapshot = Object.freeze({ session: null, user: null, ready: false });
let initializePromise: Promise<AuthSnapshot> | null = null;
let authRevision=0;
const listeners = new Set<Listener>();

function publish(next: AuthSnapshot): AuthSnapshot {
  snapshot = Object.freeze(next);
  for (const listener of listeners) {
    try { listener(snapshot); } catch(error) { console.warn('[Rich ID] listener failed',error); }
  }
  return snapshot;
}

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), AUTH_TIMEOUT_MS);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        window.clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

export function getAuthSnapshot(): AuthSnapshot {
  return snapshot;
}

export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener);
  listener(snapshot);
  return () => listeners.delete(listener);
}

async function resolveVerifiedSession(): Promise<AuthSnapshot> {
  const revision=authRevision;
  const current=await withTimeout(supabase.auth.getSession(),null);
  if(authRevision!==revision&&snapshot.ready)return snapshot;
  if(!current)return publish({session:null,user:null,ready:false});
  const session=current.data.session;
  if(current.error||!session)return publish({session:null,user:null,ready:true});
  const verifyRevision=authRevision;
  const verified=await withTimeout(supabase.auth.getUser(session.access_token),null);
  // A newer sign-in/sign-out/refresh event must not be overwritten by an older request.
  if(authRevision!==verifyRevision&&snapshot.ready)return snapshot;
  if(!verified)return publish({session:null,user:null,ready:false});
  if(verified.error||!verified.data.user)return publish({session:null,user:null,ready:true});
  return publish({session,user:verified.data.user,ready:true});
}

export function initializeAuth(): Promise<AuthSnapshot> {
  if (snapshot.ready) return Promise.resolve(snapshot);
  if (!initializePromise) {
    initializePromise = resolveVerifiedSession().finally(() => {
      initializePromise = null;
    });
  }
  return initializePromise;
}

supabase.auth.onAuthStateChange((event,session)=>{
  // Initial storage state is verified by initializeAuth; later SDK auth events
  // supersede in-flight session requests.
  if(event==='INITIAL_SESSION')return;
  const revision=++authRevision;
  // Capture SDK state immediately, but run app observers outside its auth callback.
  snapshot=Object.freeze({session,user:session?.user??null,ready:true});
  window.setTimeout(()=>{if(authRevision===revision)publish(snapshot);},0);
});
