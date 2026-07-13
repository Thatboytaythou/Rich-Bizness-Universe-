import { createArcadeGame } from '../shared/runtime/create-arcade-game';
createArcadeGame({ slug:'rich-chess', title:'Rich Chess', instruction:'Build tactical pressure and secure the crown.', actionLabel:'MAKE MOVE', targetScore:1000, timeLimitSeconds:60, pointsPerAction:50 });
