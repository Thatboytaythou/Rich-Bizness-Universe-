export const XP_QUEUE_STATUS = Object.freeze({
  queued: 'queued',
  processing: 'processing',
  awarded: 'awarded',
  rejected: 'rejected',
  failed: 'failed'
} as const);

export const XP_TERMINAL_STATUS = Object.freeze([
  XP_QUEUE_STATUS.awarded,
  XP_QUEUE_STATUS.rejected,
  XP_QUEUE_STATUS.failed
] as const);

export const XP_SECTIONS = Object.freeze([
  'global',
  'profile',
  'avatar',
  'meta',
  'creator',
  'feed',
  'gallery',
  'search',
  'upload',
  'live',
  'watch',
  'music',
  'podcast',
  'radio',
  'sports',
  'gaming',
  'store',
  'messages'
] as const);

export const XP_PER_LEVEL = 1000;

export function levelFromXp(totalXp: number): number {
  const safeXp = Math.max(0, Math.floor(Number(totalXp) || 0));
  return Math.floor(safeXp / XP_PER_LEVEL) + 1;
}

export function currentLevelXp(totalXp: number): number {
  const safeXp = Math.max(0, Math.floor(Number(totalXp) || 0));
  return safeXp % XP_PER_LEVEL;
}

export function nextLevelXp(totalXp: number): number {
  return levelFromXp(totalXp) * XP_PER_LEVEL;
}

export type XpQueueStatus = (typeof XP_QUEUE_STATUS)[keyof typeof XP_QUEUE_STATUS];
export type XpTerminalStatus = (typeof XP_TERMINAL_STATUS)[number];
export type XpSection = (typeof XP_SECTIONS)[number];

export interface XpSnapshot {
  user_id: string;
  level: number;
  xp_total: number;
  xp_current: number;
  xp_next: number;
  rank_title: string;
  rich_points: number;
  coins: number;
}
