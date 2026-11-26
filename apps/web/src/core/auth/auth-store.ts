import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

type AuthSnapshot = Readonly<{ session: Session | null; user: User | null; ready: boolean }>;
type Listener = (snapshot: AuthSnapshot) => void;

const AUTH_TIMEOUT_MS = 4_000;

let snapshot: AuthSnapshot = Object.freeze({ session: null, user: null, ready: false });
let initializePromise: Promise<AuthSnapshot> | null = null;
let authEventRevision = 0;
const listeners = new Set<Listener>();

function publish(next: AuthSnapshot): AuthSnapshot {
  snapshot = Object.freeze(next);
  for (const listener of listeners) listener(snapshot);
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
  const startingRevision = authEventRevision;
  const current = await withTimeout(
    supabase.auth.getSession(),
    { data: { session: null }, error: null }
  );

  if (authEventRevision !== startingRevision) return snapshot;

  const session = current.data.session;
  if (current.error || !session) {
    return publish({ session: null, user: null, ready: true });
  }

  const verification = await withTimeout(
    supabase.auth.getUser(session.access_token),
    { data: { user: null }, error: null }
  );

  if (authEventRevision !== startingRevision) return snapshot;

  if (!verification.data.user) {
    // Do not equate a timed-out request with an invalid persisted session.
    // The SDK auth listener remains authoritative and can settle the state.
    if (!verification.error) return snapshot;
    return publish({ session, user: session.user, ready: true });
  }

  return publish({ session, user: verification.data.user, ready: true });
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

supabase.auth.onAuthStateChange((_event, session) => {
  authEventRevision += 1;
  publish({ session, user: session?.user ?? null, ready: true });
});
