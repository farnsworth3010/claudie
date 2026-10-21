import type { LimitKind } from '../../limits/types.ts';
import type { Corner } from '../types.ts';
import { MARGIN } from './stage.ts';

// The usage limit clocks, in art pixels.
export const CLOCK_FACE = 11; // the dial's diameter
export const CLOCK_SCALE = 0.5; // a clock's art pixel against a Clawd's
export const CLOCK_RADIUS = 5.3; // round enough at this size, with a three-pixel top and bottom
export const CLOCK_LABEL_GAP = 1; // between the dial and its label
export const CLOCK_WARN = 50; // percent used from which the dial fills yellow
export const CLOCK_ALARM = 80; // and red

export const CLOCK_LABELS: Readonly<Record<LimitKind, string>> = { fiveHour: '5h', sevenDay: 'wk' };
export const CLOCK_KINDS: readonly LimitKind[] = ['fiveHour', 'sevenDay']; // left to right
export const CLOCKS_CORNER: Corner = { screen: null, right: MARGIN, bottom: MARGIN }; // until dragged elsewhere
