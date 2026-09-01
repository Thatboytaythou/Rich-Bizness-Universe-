export {};

declare global {
  interface Window {
    __rbPageCleanup?: (() => void | Promise<void>) | null;
  }
}
