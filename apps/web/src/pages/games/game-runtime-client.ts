import { supabase } from '../../core/supabase/client';

type Json = Record<string, unknown>;
type StartResult = Readonly<{ ok: boolean; session_key: string; game_id: string; contract: string }>;
type FinishResult = Readonly<{ ok: boolean; session_key: string; score: number; xp: number; xp_event?: string; contract?: string; idempotent?: boolean }>;
type RoomResult = Readonly<{ ok: boolean; room: Record<string, unknown>; reused?: boolean }>;
type SaveResult = Readonly<{ ok: boolean; game_id?: string; game_slug?: string; save_version?: number; checksum?: string; saved_at?: string; exists?: boolean; save?: Json; checkpoint?: Json; contract?: string }>;
type RealtimeChannel = ReturnType<typeof supabase.channel>;

const activeSessions = new Map<string, string>();
const activeRooms = new Map<string, string>();
const realtimeChannels = new Set<RealtimeChannel>();
let disposed = false;

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

function canonicalSaveKey(gameSlug: string): string {
  return `rb:game:${gameSlug}:save:v2`;
}

function parseLocalSave(raw: string | null): Json | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Json : null;
  } catch {
    return null;
  }
}

async function action<T>(fn: string, args: Json): Promise<T> {
  if (disposed) throw new Error('Game runtime has already been disposed');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export async function startGameSession(gameSlug: string, metadata: Json = {}): Promise<StartResult> {
  const existing = activeSessions.get(gameSlug);
  if (existing) return { ok: true, session_key: existing, game_id: '', contract: 'client-v2' };
  const result = await action<StartResult>('rb_game_action', {
    p_action: 'start_session', p_game_slug: gameSlug,
    p_payload: { platform_type: 'web', device_info: deviceInfo(), metadata: { ...metadata, client_contract: 'rich-bizness-game-runtime-client-v3' } }
  });
  if (!result?.session_key) throw new Error('Game session did not return a session key');
  activeSessions.set(gameSlug, result.session_key);
  return result;
}

export async function finishGameSession(gameSlug: string, input: Readonly<{ score?: number; result?: string; mode?: string; durationSeconds?: number; metadata?: Json }> = {}): Promise<FinishResult> {
  const sessionKey = activeSessions.get(gameSlug);
  if (!sessionKey) throw new Error(`No active canonical session for ${gameSlug}`);
  const result = await action<FinishResult>('rb_game_action', {
    p_action: 'finish_session', p_game_slug: gameSlug,
    p_payload: {
      session_key: sessionKey,
      score: Math.max(0, Math.floor(Number(input.score ?? 0))),
      result: input.result ?? 'completed', mode: input.mode ?? 'standard',
      duration_seconds: Math.max(0, Math.floor(Number(input.durationSeconds ?? 0))),
      platform_type: 'web', metadata: { ...(input.metadata ?? {}), client_contract: 'rich-bizness-game-runtime-client-v3' }
    }
  });
  activeSessions.delete(gameSlug);
  return result;
}

export async function saveGameCheckpoint(gameSlug: string, checkpoint: Json, input: Readonly<{ saveVersion?: number; metadata?: Json; mirrorLocal?: boolean }> = {}): Promise<SaveResult> {
  const envelope: Json = {
    contract: 'rb-game-save-v2', save_version: Math.max(2, Math.floor(input.saveVersion ?? 2)),
    game_slug: gameSlug, saved_at: new Date().toISOString(), source: 'canonical-client',
    checkpoint, device: deviceInfo(), metadata: input.metadata ?? {}
  };
  if (input.mirrorLocal !== false) localStorage.setItem(canonicalSaveKey(gameSlug), JSON.stringify(envelope));
  try {
    return await action<SaveResult>('rb_game_save_action', {
      p_action: 'save', p_game_slug: gameSlug,
      p_payload: { checkpoint, save_version: envelope.save_version, source: 'canonical-client', device: deviceInfo(), metadata: { ...(input.metadata ?? {}), client_contract: 'rich-bizness-game-runtime-client-v3' } }
    });
  } catch (error) {
    if (!navigator.onLine) return { ok: true, game_slug: gameSlug, save_version: Number(envelope.save_version), saved_at: String(envelope.saved_at), contract: 'rb-game-save-v2' };
    throw error;
  }
}

export async function loadGameCheckpoint(gameSlug: string, input: Readonly<{ legacyKeys?: string[]; preferLocal?: boolean }> = {}): Promise<SaveResult> {
  const canonicalLocal = parseLocalSave(localStorage.getItem(canonicalSaveKey(gameSlug)));
  let migratedLocal: Json | null = null;
  for (const key of input.legacyKeys ?? []) {
    const legacy = parseLocalSave(localStorage.getItem(key));
    if (!legacy) continue;
    migratedLocal = {
      contract: 'rb-game-save-v2', save_version: 2, game_slug: gameSlug,
      saved_at: new Date().toISOString(), source: 'legacy-local-migration',
      legacy_key: key, checkpoint: legacy
    };
    localStorage.setItem(canonicalSaveKey(gameSlug), JSON.stringify(migratedLocal));
    break;
  }
  const localSave = canonicalLocal ?? migratedLocal;
  if (input.preferLocal && localSave) return { ok: true, game_slug: gameSlug, exists: true, save: localSave, contract: 'rb-game-save-v2' };
  try {
    const cloud = await action<SaveResult>('rb_game_save_action', { p_action: 'load', p_game_slug: gameSlug, p_payload: {} });
    if (cloud.exists) return cloud;
  } catch (error) {
    if (!localSave || navigator.onLine) throw error;
  }
  return localSave
    ? { ok: true, game_slug: gameSlug, exists: true, save: localSave, contract: 'rb-game-save-v2' }
    : { ok: true, game_slug: gameSlug, exists: false, checkpoint: {}, contract: 'rb-game-save-v2' };
}

export async function getGameSaveHistory(gameSlug: string): Promise<SaveResult> {
  return action<SaveResult>('rb_game_save_action', { p_action: 'history', p_game_slug: gameSlug, p_payload: {} });
}

export async function createGameRoom(gameSlug: string, input: Readonly<{ roomCode?: string; maxPlayers?: number; roomType?: string; boardState?: unknown; gameState?: Json; metadata?: Json }> = {}): Promise<RoomResult> {
  const result = await action<RoomResult>('rb_game_room_action', {
    p_action: 'create', p_game_slug: gameSlug,
    p_payload: { room_code: input.roomCode, max_players: input.maxPlayers ?? 8, room_type: input.roomType ?? 'realtime', board_state: input.boardState, game_state: input.gameState ?? {}, metadata: { ...(input.metadata ?? {}), device: deviceInfo(), client_contract: 'rich-bizness-game-runtime-client-v3' } }
  });
  const roomId = String(result.room?.id ?? '');
  if (roomId) activeRooms.set(gameSlug, roomId);
  return result;
}

export async function joinGameRoom(gameSlug: string, roomCode: string, input: Readonly<{ role?: string; metadata?: Json }> = {}): Promise<RoomResult> {
  const result = await action<RoomResult>('rb_game_room_action', {
    p_action: 'join', p_game_slug: gameSlug,
    p_payload: { room_code: roomCode.trim().toUpperCase(), role: input.role ?? 'player', metadata: { ...(input.metadata ?? {}), device: deviceInfo(), client_contract: 'rich-bizness-game-runtime-client-v3' } }
  });
  const roomId = String(result.room?.id ?? '');
  if (roomId) activeRooms.set(gameSlug, roomId);
  return result;
}

export async function leaveGameRoom(gameSlug: string): Promise<RoomResult | null> {
  const roomId = activeRooms.get(gameSlug);
  if (!roomId) return null;
  const result = await action<RoomResult>('rb_game_room_action', { p_action: 'leave', p_game_slug: gameSlug, p_payload: { room_id: roomId, client_contract: 'rich-bizness-game-runtime-client-v3' } });
  activeRooms.delete(gameSlug);
  return result;
}

export function trackGameRealtimeChannel(channel: RealtimeChannel): RealtimeChannel { realtimeChannels.add(channel); return channel; }
export async function releaseGameRealtimeChannel(channel: RealtimeChannel): Promise<void> { realtimeChannels.delete(channel); await supabase.removeChannel(channel); }
export function getActiveGameSession(gameSlug: string): string | null { return activeSessions.get(gameSlug) ?? null; }
export function getActiveGameRoom(gameSlug: string): string | null { return activeRooms.get(gameSlug) ?? null; }

export async function disposeGameRuntime(): Promise<void> {
  if (disposed) return;
  disposed = true;
  const channels = [...realtimeChannels];
  realtimeChannels.clear();
  await Promise.allSettled(channels.map((channel) => supabase.removeChannel(channel)));
  activeSessions.clear();
  activeRooms.clear();
}

export const RichBiznessGameRuntime = Object.freeze({
  start: startGameSession, finish: finishGameSession, active: getActiveGameSession,
  saves: Object.freeze({ save: saveGameCheckpoint, load: loadGameCheckpoint, history: getGameSaveHistory, key: canonicalSaveKey }),
  rooms: Object.freeze({ create: createGameRoom, join: joinGameRoom, leave: leaveGameRoom, active: getActiveGameRoom }),
  realtime: Object.freeze({ track: trackGameRealtimeChannel, release: releaseGameRealtimeChannel }),
  dispose: disposeGameRuntime
});

Object.defineProperty(window, 'RichBiznessGameRuntime', { value: RichBiznessGameRuntime, configurable: false, enumerable: false, writable: false });
window.addEventListener('pagehide', () => { void disposeGameRuntime(); }, { once: true });
window.addEventListener('beforeunload', () => { void disposeGameRuntime(); }, { once: true });
