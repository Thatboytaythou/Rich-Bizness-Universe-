import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

type AuthSnapshot = Readonly<{ session: Session | null; user: User | null; ready: boolean }>;
type Listener = (snapshot: AuthSnapshot) => void;

let snapshot: AuthSnapshot = Object.freeze({ session: null, user: null, ready: false });
let initializePromise: Promise<AuthSnapshot> | null = null;
const listeners = new Set<Listener>();

function publish(next: AuthSnapshot): AuthSnapshot {
  snapshot = Object.freeze(next);
  for (const listener of listeners) listener(snapshot);
  return snapshot;
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
  const current = await supabase.auth.getSession();
  if (current.error) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    return publish({ session: null, user: null, ready: true });
  }

  let session = current.data.session;
  if (!session) {
    const refreshed = await supabase.auth.refreshSession();
    if (!refreshed.error) session = refreshed.data.session;
  }

  if (!session) return publish({ session: null, user: null, ready: true });

  const verified = await supabase.auth.getUser(session.access_token);
  if (verified.error || !verified.data.user) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    return publish({ session: null, user: null, ready: true });
  }

  return publish({ session, user: verified.data.user, ready: true });
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
  publish({ session, user: session?.user ?? null, ready: true });
});
