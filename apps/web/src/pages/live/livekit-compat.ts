import { LocalAudioTrack, LocalVideoTrack } from 'livekit-client';

type MuteCompat = {
  setMuted?: (muted: boolean) => Promise<void>;
  mute: () => Promise<unknown>;
  unmute: () => Promise<unknown>;
};

function installSetMuted(proto: MuteCompat): void {
  if (typeof proto.setMuted === 'function') return;
  Object.defineProperty(proto, 'setMuted', {
    configurable: true,
    value: async function setMuted(this: MuteCompat, muted: boolean): Promise<void> {
      if (muted) await this.mute();
      else await this.unmute();
    }
  });
}

export function installLiveKitCompatibility(): void {
  installSetMuted(LocalAudioTrack.prototype as unknown as MuteCompat);
  installSetMuted(LocalVideoTrack.prototype as unknown as MuteCompat);
}
