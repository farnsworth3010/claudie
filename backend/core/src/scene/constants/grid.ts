// Clawd is drawn procedurally after the Claude Code logo. Logo pixels are terminal
// quadrants (twice as tall as wide), so each logo row is two grid rows here:
// a 12x8 body, 1x2 eyes, side arms and four legs. Colours are PAL slots (see look.ts).
export const GRID_W = 20;
export const GRID_H = 22;

export const OX = 1; // logo column 0
export const OY = 12; // body top row; rows above hold jump headroom, bubbles, hats and props

// Columns a standing Clawd's body and arms cover; the rest of the grid is transparent padding.
export const SOLID = [2, 18] as const;

// Midpoint between the two eyes, in sprite grid pixels.
export const EYES = { x: 10, y: 15 } as const;
// How close, in the sprite's own grid pixels, the pointer must come before the eyes follow it.
export const GAZE_RADIUS = 40;
