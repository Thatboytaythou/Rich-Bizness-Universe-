export type ControlState = Readonly<{
  forward: number;
  strafe: number;
  sprint: boolean;
  jump: boolean;
}>;

export function createControls(signal?:AbortSignal): () => ControlState {
  const keys = new Set<string>();
  addEventListener('keydown', (event) => keys.add(event.code),signal?{signal}:undefined);
  addEventListener('keyup', (event) => keys.delete(event.code),signal?{signal}:undefined);
  addEventListener('blur',()=>keys.clear(),signal?{signal}:undefined);

  return () => ({
    forward: Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')),
    strafe: Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')),
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    jump: keys.has('Space')
  });
}
