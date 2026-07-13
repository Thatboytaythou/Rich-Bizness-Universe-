export type WorldState = {
  width: number;
  depth: number;
  portals: ReadonlyArray<{ id: string; x: number; z: number; label: string }>;
  pickups: Array<{ id: string; x: number; z: number; value: number; collected: boolean }>;
};

export function createWorldState(): WorldState {
  return {
    width: 56,
    depth: 42,
    portals: [
      { id: 'portal-home', x: 0, z: -15, label: 'RICH PORTAL' },
      { id: 'portal-meta', x: 18, z: 10, label: 'META GATE' },
      { id: 'portal-games', x: -18, z: 12, label: 'GAME VAULT' }
    ],
    pickups: Array.from({ length: 12 }, (_, index) => ({
      id: `cash-${index + 1}`,
      x: -22 + ((index * 7) % 44),
      z: -14 + ((index * 11) % 28),
      value: 100,
      collected: false
    }))
  };
}

export function clampToWorld(value: number, size: number): number {
  const half = size / 2;
  return Math.max(-half, Math.min(half, value));
}

export function distance2D(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}
