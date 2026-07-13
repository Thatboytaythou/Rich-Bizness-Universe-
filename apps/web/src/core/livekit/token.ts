import { supabase } from '../supabase/client';

export type LiveKitConnection = Readonly<{
  url: string;
  token: string;
  room: string;
  role: string;
  expiresIn: number;
}>;

export async function getLiveKitConnection(room: string): Promise<LiveKitConnection> {
  const normalizedRoom = room.trim();
  if (!/^[A-Za-z0-9_-]{3,128}$/.test(normalizedRoom)) throw new Error('Invalid LiveKit room name.');

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) throw new Error('Sign in is required to join this room.');

  const response = await fetch('/api/livekit/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ room: normalizedRoom })
  });

  const payload = await response.json() as Partial<LiveKitConnection> & { error?: string };
  if (!response.ok || !payload.url || !payload.token || !payload.room || !payload.role || !payload.expiresIn) {
    throw new Error(payload.error ?? 'Unable to authorize LiveKit room.');
  }

  return Object.freeze({
    url: payload.url,
    token: payload.token,
    room: payload.room,
    role: payload.role,
    expiresIn: payload.expiresIn
  });
}
