import 'livekit-client';

declare module 'livekit-client' {
  interface LocalAudioTrack {
    setMuted(muted: boolean): Promise<void>;
  }

  interface LocalVideoTrack {
    setMuted(muted: boolean): Promise<void>;
  }

  interface LocalParticipant {
    publishTrack(track: LocalAudioTrack | LocalVideoTrack, options?: Record<string, unknown>): Promise<unknown>;
  }
}
