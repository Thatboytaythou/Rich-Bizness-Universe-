import { createArcadeGame } from '../shared/runtime/create-arcade-game';
createArcadeGame({ slug:'rich-court-king', title:'Rich Court King', instruction:'Run the court and stack buckets.', actionLabel:'SCORE BUCKET', targetScore:1500, timeLimitSeconds:45, pointsPerAction:100 });
