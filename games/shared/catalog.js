export const GAME_CATALOG = Object.freeze({
  'avatar-free-roam': { title:'Avatar Free Roam', type:'simulation', mechanic:'roam', objective:'Explore the district, collect aura shards, and reach the portal.', controls:['move','dash','interact'], target:12, step:1 },
  'beat-smoke-studio': { title:'Beat Smoke Studio', type:'rhythm', mechanic:'rhythm', objective:'Hit the beat windows and build a clean studio combo.', controls:['kick','snare','hat'], target:24, step:2 },
  'bizness-party-room': { title:'Bizness Party Room', type:'party', mechanic:'party', objective:'Complete rotating party prompts before the room timer expires.', controls:['choose','lock','boost'], target:10, step:1 },
  'boss-walk-battle': { title:'Boss Walk Battle', type:'fighting', mechanic:'duel', objective:'Break the rival confidence meter with timed style attacks.', controls:['pose','counter','finisher'], target:100, step:12 },
  'cash-rain-catcher': { title:'Cash Rain Catcher', type:'arcade', mechanic:'catch', objective:'Catch clean money drops and avoid tax bombs.', controls:['left','right','boost'], target:40, step:2 },
  'diamond-bat-flip': { title:'Diamond Bat Flip', type:'sports', mechanic:'batting', objective:'Time each swing and stack home-run distance.', controls:['aim','swing','power'], target:5, step:1 },
  'dj-radio-run': { title:'DJ Radio Run', type:'arcade', mechanic:'lane', objective:'Switch radio lanes, collect records, and avoid dead air.', controls:['left','right','mix'], target:30, step:2 },
  'empire-builder': { title:'Empire Builder', type:'strategy', mechanic:'builder', objective:'Balance cash, influence, and defense to complete an empire cycle.', controls:['invest','expand','defend'], target:8, step:1 },
  'golf-green-gold': { title:'Golf Green Gold', type:'sports', mechanic:'golf', objective:'Finish the course under par using aim, power, and spin.', controls:['aim','power','swing'], target:9, step:1 },
  'gym-grind-reps': { title:'Gym Grind Reps', type:'sports', mechanic:'reps', objective:'Keep the rep rhythm clean without burning out.', controls:['push','hold','recover'], target:30, step:2 },
  'hero-villain-showdown': { title:'Hero Villain Showdown', type:'fighting', mechanic:'duel', objective:'Use powers, blocks, and finishers to win the showdown.', controls:['power','block','finisher'], target:100, step:10 },
  'market-flip': { title:'Market Flip', type:'strategy', mechanic:'market', objective:'Buy low, sell high, and finish with a profitable portfolio.', controls:['buy','hold','sell'], target:5000, step:250 },
  'money-road-racer': { title:'Money Road Racer', type:'racing', mechanic:'race', objective:'Build speed, dodge hazards, and reach the money tree finish.', controls:['steer','boost','drift'], target:1000, step:75 },
  'portal-dash': { title:'Portal Dash', type:'arcade', mechanic:'dash', objective:'Chain portal jumps without hitting unstable gates.', controls:['jump','dash','phase'], target:25, step:2 },
  'portal-room-rush': { title:'Portal Room Rush', type:'simulation', mechanic:'rooms', objective:'Open and stabilize every room before the universe timer closes.', controls:['scan','open','stabilize'], target:12, step:1 },
  'rich-chess-boss': { title:'Rich Chess Boss', type:'strategy', mechanic:'chess', objective:'Control the center, protect the boss, and checkmate the rival.', controls:['select','move','confirm'], target:1, step:1 },
  'rich-court-king': { title:'Rich Court King', type:'sports', mechanic:'basketball', objective:'Build a scoring streak with shots, steals, and clutch boosts.', controls:['shoot','steal','boost'], target:21, step:2 },
  'rich-runner': { title:'Rich Runner', type:'arcade', mechanic:'runner', objective:'Run the district, collect coins, and survive the full route.', controls:['jump','slide','dash'], target:50, step:2 },
  'smoke-burst-arena': { title:'Smoke Burst Arena', type:'fighting', mechanic:'arena', objective:'Charge smoke energy and knock opponents out of the arena.', controls:['burst','guard','launch'], target:100, step:11 },
  'smoke-cloud-drift': { title:'Smoke Cloud Drift', type:'racing', mechanic:'drift', objective:'Hold clean drift angles and complete the city circuit.', controls:['steer','drift','boost'], target:1200, step:90 },
  'smoke-room-cards': { title:'Smoke Room Cards', type:'party', mechanic:'cards', objective:'Build the strongest hand while reading the room.', controls:['draw','hold','play'], target:5, step:1 },
  'smoke-tap': { title:'Smoke Tap', type:'arcade', mechanic:'tap', objective:'Tap through smoke waves and keep the multiplier alive.', controls:['tap','charge','burst'], target:100, step:5 },
  'treehouse-ride': { title:'Treehouse Ride', type:'racing', mechanic:'ride', objective:'Climb the money road and reach the treehouse without crashing.', controls:['steer','jump','boost'], target:900, step:70 },
  'vault-unlock': { title:'Vault Unlock', type:'puzzle', mechanic:'vault', objective:'Crack the sequence, manage heat, and unlock the vault.', controls:['scan','rotate','confirm'], target:6, step:1 }
});

export function slugFromLocation(){
  const parts = location.pathname.split('/').filter(Boolean);
  return parts[1] || 'rich-runner';
}

export function getGameConfig(slug = slugFromLocation()){
  return GAME_CATALOG[slug] || GAME_CATALOG['rich-runner'];
}
