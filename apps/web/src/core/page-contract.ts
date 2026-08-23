export type CanonicalPageKey =
  | 'home'
  | 'tap-in'
  | 'portal'
  | 'avatar-studio'
  | 'avatar-lobby'
  | 'profile'
  | 'gaming'
  | 'upload';

export type CanonicalPageContract = Readonly<{
  key: CanonicalPageKey;
  term: string;
  route: string;
  routeKey: string;
  role: string;
}>;

export const PAGE_CONTRACT = Object.freeze({
  home: Object.freeze({
    key: 'home',
    term: 'Home / Index',
    route: '/index.html',
    routeKey: 'home',
    role: 'First app landing experience. It introduces the app; it does not duplicate Portal navigation.'
  }),
  tapIn: Object.freeze({
    key: 'tap-in',
    term: 'Tap In',
    route: '/tap-in.html',
    routeKey: 'tap-in',
    role: 'Sign-in and entry gate only.'
  }),
  portal: Object.freeze({
    key: 'portal',
    term: 'Portal',
    route: '/portal.html',
    routeKey: 'portal',
    role: 'Main eight-section universe navigation hub.'
  }),
  avatarStudio: Object.freeze({
    key: 'avatar-studio',
    term: 'Avatar Studio',
    route: '/avatar-characters.html',
    routeKey: 'avatar-characters',
    role: 'Create, select, customize, edit and save the character.'
  }),
  avatarLobby: Object.freeze({
    key: 'avatar-lobby',
    term: 'Avatar Lobby',
    route: '/avatar.html',
    routeKey: 'avatar',
    role: 'Playable 3D world using the saved avatar, controller, camera and movement.'
  }),
  profile: Object.freeze({
    key: 'profile',
    term: 'Profile',
    route: '/profile.html',
    routeKey: 'profile',
    role: 'Social identity page. It is not an avatar selector and not a database dashboard.'
  }),
  gaming: Object.freeze({
    key: 'gaming',
    term: 'Gaming',
    route: '/gaming.html',
    routeKey: 'gaming',
    role: 'Game discovery and playable game entry.'
  }),
  upload: Object.freeze({
    key: 'upload',
    term: 'Upload',
    route: '/upload.html',
    routeKey: 'upload',
    role: 'Creator publishing workflow.'
  })
} satisfies Record<string, CanonicalPageContract>);

export const APP_TERMS = Object.freeze({
  avatarModel: 'Avatar Model',
  avatarRig: 'Avatar Rig / Skeleton',
  avatarAnimation: 'Avatar Animation',
  avatarController: 'Avatar Controller',
  avatarLoadout: 'Avatar Loadout',
  avatarWorld: 'Avatar World',
  designOwner: 'Design Owner',
  pageOwner: 'Page Owner',
  sourceOfTruth: 'Source of Truth',
  prototypeAsset: 'Prototype Asset',
  productionAsset: 'Production Asset',
  preview: 'Preview',
  production: 'Production'
});
