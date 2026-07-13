export const FREE_ROAM_RULES = Object.freeze({
  worldBounds: 28,
  walkSpeed: 5,
  sprintSpeed: 10,
  jumpVelocity: 7,
  gravity: 18,
  checkpointRadius: 1.8,
  missionTimeLimitSeconds: 120
});

export function clampToWorld(value: number): number {
  return Math.max(-FREE_ROAM_RULES.worldBounds, Math.min(FREE_ROAM_RULES.worldBounds, value));
}
