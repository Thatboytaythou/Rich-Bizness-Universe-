import avatarFreeRoam from './avatar-free-roam/manifest';
import biznessPartyRoom from './bizness-party-room/manifest';
import bossWalkBattle from './boss-walk-battle/manifest';
import cashRainCatcher from './cash-rain-catcher/manifest';
import diamondBatFlip from './diamond-bat-flip/manifest';
import djRadioRun from './dj-radio-run/manifest';
import empireBuilder from './empire-builder/manifest';
import golfGreenGold from './golf-green-gold/manifest';
import gymGrindReps from './gym-grind-reps/manifest';
import heroVillainShowdown from './hero-villain-showdown/manifest';
import marketFlip from './market-flip/manifest';
import moneyRoadRunner from './money-road-runner/manifest';
import portalDash from './portal-dash/manifest';
import portalRoomRush from './portal-room-rush/manifest';
import richChess from './rich-chess/manifest';
import richCourtKing from './rich-court-king/manifest';
import richRunner from './rich-runner/manifest';
import smokeBurstArena from './smoke-burst-arena/manifest';
import smokeCityHustle from './smoke-city-hustle/manifest';
import smokeRoomCards from './smoke-room-cards/manifest';
import smokeTap from './smoke-tap/manifest';
import studioShowdown from './studio-showdown/manifest';
import treehouseRide from './treehouse-ride/manifest';
import vaultUnlock from './vault-unlock/manifest';

export const GAME_MANIFESTS = Object.freeze([
  avatarFreeRoam,biznessPartyRoom,bossWalkBattle,cashRainCatcher,diamondBatFlip,djRadioRun,
  empireBuilder,golfGreenGold,gymGrindReps,heroVillainShowdown,marketFlip,moneyRoadRunner,
  portalDash,portalRoomRush,richChess,richCourtKing,richRunner,smokeBurstArena,
  smokeCityHustle,smokeRoomCards,smokeTap,studioShowdown,treehouseRide,vaultUnlock
]);

if (GAME_MANIFESTS.length !== 24) throw new Error(`Expected 24 standalone games, found ${GAME_MANIFESTS.length}`);
if (new Set(GAME_MANIFESTS.map((game) => game.slug)).size !== 24) throw new Error('Duplicate game slug detected');
if (GAME_MANIFESTS.some((game) => !game.standalone || game.entry !== './game.ts')) throw new Error('Every game must own its standalone runtime entry');
