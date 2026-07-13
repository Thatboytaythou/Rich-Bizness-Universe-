import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

type AuthSnapshot = Readonly<{ session: Session | null; user: User | null; ready: boolean }>;
type Listener = (snapshot: AuthSnapshot) => void;

let snapshot: AuthSnapshot = Object.freeze({ session: null, user: null, ready: false });
const listeners = new Set<Listener>();

function publish(next: AuthSnapshot): void {
  snapshot = Object.freeze(next);
  for (const listener of listeners) listener(snapshot);
}

export function getAuthSnapshot(): AuthSnapshot {
  return snapshot;
}

export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener);
  listener(snapshot);
  return () => listeners.delete(listener);
}

export async function initializeAuth(): Promise<AuthSnapshot> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  publish({ session: data.session, user: data.session?.user ?? null, ready: true });
  return snapshot;
}

supabase.auth.onAuthStateChange((_event, session) => {
  publish({ session, user: session?.user ?? null, ready: true });
});
