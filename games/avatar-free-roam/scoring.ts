export type FreeRoamScoreState = {
  distance: number;
  checkpoints: number;
  elapsedSeconds: number;
  score: number;
};

export function calculateFreeRoamScore(distance: number, checkpoints: number, elapsedSeconds: number): number {
  const distanceScore = Math.floor(distance * 10);
  const checkpointScore = checkpoints * 500;
  const timeBonus = Math.max(0, 1200 - Math.floor(elapsedSeconds * 10));
  return distanceScore + checkpointScore + timeBonus;
}
