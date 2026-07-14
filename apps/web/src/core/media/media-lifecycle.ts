const trackedStreams = new Set<MediaStream>();
let installed = false;

function lockVideo(video: HTMLVideoElement): void {
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.setAttribute('controlsList', 'nodownload noremoteplayback nofullscreen');
  video.disablePictureInPicture = true;
  video.disableRemotePlayback = true;
}

function stopAllMedia(): void {
  trackedStreams.forEach((stream) => {
    stream.getTracks().forEach((track) => track.stop());
  });
  trackedStreams.clear();

  document.querySelectorAll<HTMLVideoElement>('video').forEach((video) => {
    const source = video.srcObject;
    if (source instanceof MediaStream) {
      source.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }
    video.pause();
  });
}

export function installMediaLifecycleGuard(): void {
  if (installed) return;
  installed = true;

  const mediaDevices = navigator.mediaDevices;
  if (mediaDevices?.getUserMedia) {
    const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
    mediaDevices.getUserMedia = async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
      const stream = await originalGetUserMedia(constraints);
      trackedStreams.add(stream);
      stream.getTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          if (stream.getTracks().every((item) => item.readyState === 'ended')) trackedStreams.delete(stream);
        }, { once: true });
      });
      return stream;
    };
  }

  document.querySelectorAll<HTMLVideoElement>('video').forEach(lockVideo);
  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLVideoElement) lockVideo(node);
        if (node instanceof HTMLElement) node.querySelectorAll<HTMLVideoElement>('video').forEach(lockVideo);
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('pagehide', stopAllMedia);
  window.addEventListener('beforeunload', stopAllMedia);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && document.body.dataset.page === 'live') {
      window.setTimeout(() => {
        if (document.visibilityState === 'hidden') stopAllMedia();
      }, 1500);
    }
  });
}
