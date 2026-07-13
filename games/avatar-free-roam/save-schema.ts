export const AVATAR_FREE_ROAM_SAVE_VERSION = 1 as const;

export type AvatarFreeRoamSave = Readonly<{
  version: typeof AVATAR_FREE_ROAM_SAVE_VERSION;
  position: Readonly<{ x: number; y: number; z: number }>;
  completedMissionIds: readonly string[];
  bestScore: number;
  totalDistance: number;
  totalPlaySeconds: number;
  updatedAt: string;
}>;

export function createDefaultFreeRoamSave(): AvatarFreeRoamSave {
  return {
    version: AVATAR_FREE_ROAM_SAVE_VERSION,
    position: { x: 0, y: 0, z: 0 },
    completedMissionIds: [],
    bestScore: 0,
    totalDistance: 0,
    totalPlaySeconds: 0,
    updatedAt: new Date().toISOString()
  };
}
