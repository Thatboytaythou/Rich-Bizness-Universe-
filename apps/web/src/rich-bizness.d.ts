export {};

declare global {
  interface Window {
    __rbPageCleanup?: (() => void | Promise<void>) | null;
  }

  interface Document {
    querySelector<E extends Element = Element>(selectors: '#app'): E;
  }
}
