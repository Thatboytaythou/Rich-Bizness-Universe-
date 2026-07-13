export type FreeRoamMission = Readonly<{
  id: string;
  title: string;
  description: string;
  target: Readonly<{ x: number; z: number }>;
  rewardXp: number;
  rewardRichPoints: number;
}>;

export const FREE_ROAM_MISSIONS: readonly FreeRoamMission[] = Object.freeze([
  {
    id: 'enter-emerald-portal',
    title: 'Enter the Emerald Portal',
    description: 'Reach the first portal checkpoint.',
    target: { x: 8, z: -6 },
    rewardXp: 50,
    rewardRichPoints: 10
  },
  {
    id: 'boss-walk-route',
    title: 'Boss Walk Route',
    description: 'Cross the gold district checkpoint.',
    target: { x: -10, z: 9 },
    rewardXp: 75,
    rewardRichPoints: 15
  },
  {
    id: 'treehouse-return',
    title: 'Treehouse Return',
    description: 'Return to the central Rich Bizness portal.',
    target: { x: 0, z: 0 },
    rewardXp: 100,
    rewardRichPoints: 25
  }
]);
