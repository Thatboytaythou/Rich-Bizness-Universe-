import { supabase } from '../../core/supabase/client';

type Json = Record<string, unknown>;
type StartResult = Readonly<{ ok: boolean; session_key: string; game_id: string; contract: string }>;
type FinishResult = Readonly<{ ok: boolean; session_key: string; score: number; xp: number; xp_event?: string; contract?: string; idempotent?: boolean }>;

const activeSessions = new Map<string, string>();

function deviceInfo(): Json {
  return {
    mobile: matchMedia('(max-width: 760px)').matches,
    touch: navigator.maxTouchPoints > 0,
    language: navigator.language,
    viewport: { width: innerWidth, height: innerHeight },
    pixel_ratio: devicePixelRatio,
    online: navigator.onLine
  };
}

export async function startGameSession(gameSlug: string, metadata: Json = {}): Promise<StartResult> {
  const existing = activeSessions.get(gameSlug);
  if (existing) return { ok: true, session_key: existing, game_id: '', contract: 'client-v1' };

  const { data, error } = await supabase.rpc('rb_game_action', {
    p_action: 'start_session',
    p_game_slug: gameSlug,
    p_payload: {
      platform_type: 'web',
      device_info: deviceInfo(),
      metadata: { ...metadata, client_contract: 'rich-bizness-game-runtime-client-v1' }
    }
  });
  if (error) throw error;
  const result = data as StartResult;
  if (!result?.session_key) throw new Error('Game session did not return a session key');
  activeSessions.set(gameSlug, result.session_key);
  return result;
}

export async function finishGameSession(
  gameSlug: string,
  input: Readonly<{ score?: number; result?: string; mode?: string; durationSeconds?: number; metadata?: Json }> = {}
): Promise<FinishResult> {
  const sessionKey = activeSessions.get(gameSlug);
  if (!sessionKey) throw new Error(`No active canonical session for ${gameSlug}`);

  const { data, error } = await supabase.rpc('rb_game_action', {
    p_action: 'finish_session',
    p_game_slug: gameSlug,
    p_payload: {
      session_key: sessionKey,
      score: Math.max(0, Math.floor(Number(input.score ?? 0))),
      result: input.result ?? 'completed',
      mode: input.mode ?? 'standard',
      duration_seconds: Math.max(0, Math.floor(Number(input.durationSeconds ?? 0))),
      platform_type: 'web',
      metadata: { ...(input.metadata ?? {}), client_contract: 'rich-bizness-game-runtime-client-v1' }
    }
  });
  if (error) throw error;
  activeSessions.delete(gameSlug);
  return data as FinishResult;
}

export function getActiveGameSession(gameSlug: string): string | null {
  return activeSessions.get(gameSlug) ?? null;
}

export const RichBiznessGameRuntime = Object.freeze({
  start: startGameSession,
  finish: finishGameSession,
  active: getActiveGameSession
});

Object.defineProperty(window, 'RichBiznessGameRuntime', {
  value: RichBiznessGameRuntime,
  configurable: false,
  enumerable: false,
  writable: false
});
