import { createArcadeGame } from '../shared/runtime/create-arcade-game';
createArcadeGame({ slug:'gym-grind-reps', title:'Gym Grind Reps', instruction:'Finish the workout before the clock.', actionLabel:'COMPLETE REP', targetScore:1200, timeLimitSeconds:45, pointsPerAction:60 });
