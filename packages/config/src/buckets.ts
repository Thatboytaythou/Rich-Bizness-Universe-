export const BUCKETS = Object.freeze({
  profileAvatars: 'avatars',
  profileBanners: 'profile-banners',
  galleryMedia: 'gallery-media',
  generalUploads: 'general-uploads',
  liveRecordings: 'live-recordings',
  liveThumbnails: 'live-thumbnails',
  metaAvatars: 'meta-avatars',
  metaWorlds: 'meta-worlds',
  gameAssets: 'game-assets',
  gameClips: 'game-clips',
  gameCovers: 'game-covers',
  musicAudio: 'music-audio',
  musicCovers: 'music-covers',
  podcastAudio: 'podcast-audio',
  podcastCovers: 'podcast-covers',
  radioCovers: 'radio-covers',
  sportsMedia: 'sports-media',
  sportsClips: 'sports-clips',
  sportsCovers: 'sports-covers',
  storeProducts: 'store-products',
  storeDigital: 'store-digital',
  storeSellerMedia: 'store-seller-media'
} as const);

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];
