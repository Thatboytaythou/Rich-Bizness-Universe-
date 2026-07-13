export const FREE_ROAM_ASSETS = Object.freeze({
  world: {
    sky: '/brand/backgrounds/portal-sky.webp',
    ground: '/images/gaming/avatar-free-roam-ground.webp',
    portal: '/models/portals/rich-portal.glb'
  },
  character: {
    fallbackModel: '/models/characters/custom/rich-default.glb',
    idleAnimation: '/animations/locomotion/idle/rich-idle.glb',
    walkAnimation: '/animations/locomotion/walk/rich-walk.glb',
    runAnimation: '/animations/locomotion/run/rich-run.glb',
    jumpAnimation: '/animations/traversal/jump/rich-jump.glb'
  },
  audio: {
    ambience: '/audio/ambience/free-roam-night.mp3',
    pickup: '/audio/interface/cash-pickup.mp3',
    portal: '/audio/portal/portal-charge.mp3'
  }
});

export type FreeRoamAssetKey = keyof typeof FREE_ROAM_ASSETS;
