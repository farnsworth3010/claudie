import { PAL } from './look.ts';

// The break sign, in art pixels.
export const SIGN_SCALE = 0.5; // a sign's art pixel against a Clawd's, as the clocks'
export const SIGN_PAD = 3; // inside the board's border
export const SIGN_LINE_GAP = 2; // between the two lines of text
export const SIGN_BUTTONS_GAP = 3; // between the text and the buttons
export const SIGN_BUTTON_PAD = { x: 2, y: 1 }; // inside a button's border
export const SIGN_BUTTON_SPACING = 5; // between the two buttons
export const SIGN_GAP = 2; // between the sign and the Clawd holding it up

export const SIGN_TITLE = 'TIME FOR A BREAK!';
export const SIGN_COLORS = { board: PAL.white, skip: PAL.ice, done: PAL.green, hovered: PAL.yellow } as const;
export const SIGN_YAWN_EVERY_MS = 6_000; // the idle Clawds around the sign yawn again this often
export const SIGN_YAWN_STAGGER_MS = 900; // and each a little after its left neighbour
