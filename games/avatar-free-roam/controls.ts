export type ControlState = Readonly<{
  forward: number;
  strafe: number;
  sprint: boolean;
  jump: boolean;
}>;

export function createControls(): () => ControlState {
  const keys = new Set<string>();
  addEventListener('keydown', (event) => keys.add(event.code));
  addEventListener('keyup', (event) => keys.delete(event.code));

  return () => ({
    forward: Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')),
    strafe: Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')),
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    jump: keys.has('Space')
  });
}
