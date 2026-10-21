import type { Mood, ReactionKind } from '../../session/types.ts';
import type { Clip, Side } from '../types.ts';

// The tool in hand while working; tools without one of their own just bustle about.
export const TOOL_CLIPS: Readonly<Record<string, Clip>> = {
  Edit: 'type',
  Write: 'type',
  MultiEdit: 'type',
  NotebookEdit: 'type',
  Bash: 'hammer',
  Read: 'search',
  Grep: 'search',
  Glob: 'search',
  LS: 'search',
  WebSearch: 'globe',
  WebFetch: 'globe',
};
export const DEFAULT_TOOL_CLIP: Clip = 'work';
// Quick tools (a Read, a Grep) finish in a blink; their clip stays at least this long anyway.
export const TOOL_HOLD_MS = 1_500;

export const REACTION_CLIPS: Readonly<Record<ReactionKind, Clip>> = {
  shipped: 'confetti',
  testsFailed: 'upset',
  refreshed: 'refresh',
};

// How an idle period opens, played once.
export const OPENINGS: Readonly<Partial<Record<Mood, Clip>>> = {
  done: 'celebrate',
  error: 'sad',
  interrupted: 'puzzled',
  denied: 'puzzled',
};

// Idle and alone: a look around, a yawn, then sleep.
export const LOOK_AROUND_AT = 15_000;
export const YAWN_AT = 45_000;

// A dialog ignored too long: a different antic each round, with the plain call for attention in between.
export const PATIENCE_MS = 30_000;
export const ANTICS: readonly Clip[] = ['highJump', 'panic', 'longLegs', 'elder', 'skeleton'];
export const ANTIC_MS = 6_000;
export const ANTIC_ROUND_MS = 10_000;

// Left idle that long, a sleeping mascot gathers cobwebs, gets overgrown, snowed in, and at last
// grows old for good; each stage stays until the next one.
export const NEGLECT: ReadonlyArray<readonly [number, Clip]> = [
  [5 * 60_000, 'cobweb'],
  [9 * 60_000, 'overgrown'],
  [13 * 60_000, 'snowedIn'],
  [17 * 60_000, 'grandpa'],
];

// Clips of a Clawd just standing about or busy with its hands, which a drag may turn into walking.
export const STROLLERS: ReadonlySet<Clip> = new Set<Clip>([
  'stand',
  'lookAround',
  'stroll',
  'celebrate',
  'sad',
  'puzzled',
  'work',
  'type',
  'hammer',
  'search',
  'globe',
  'fidget',
  'chatA',
  'chatB',
]);

// Clips that move a mascot across the screen or change pose faster than a slow tick shows.
export const LIVELY: ReadonlySet<Clip> = new Set<Clip>([
  'enter',
  'leave',
  'walk',
  'poke',
  'bumpLeft',
  'bumpRight',
  'bumpTop',
  'bumpBottom',
  'deliver',
]);

export const BUMPS: Readonly<Record<Side, Clip>> = {
  left: 'bumpLeft',
  right: 'bumpRight',
  top: 'bumpTop',
  bottom: 'bumpBottom',
};

// Chatting
export const CHAT_EVERY_MS = 30_000;
export const CHAT_STAGGER_MS = 7_300; // neighbouring pairs never chat at once: the exchange is shorter
export const AWAKE: ReadonlySet<Clip> = new Set<Clip>(['stand', 'lookAround', 'stroll']);
