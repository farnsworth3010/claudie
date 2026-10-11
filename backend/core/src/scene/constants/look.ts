import type { SkinId, SkinRule } from '../types.ts';

// Palette slots shared by every sprite; index 0 is transparent.
export const PAL = {
  body: 1,
  shade: 2,
  ink: 3,
  white: 4,
  red: 5,
  blue: 6,
  zed: 7,
  yellow: 8,
  green: 9,
  ice: 10,
  cheek: 11,
  acc1: 12,
  acc2: 13,
  brown: 14,
} as const;

// The colours of the slots that don't change with the look.
export const FIXED_COLORS = {
  ink: '#1f1611', // eyes, outlines
  white: '#ffffff',
  red: '#e5484d',
  blue: '#3e63dd',
  zed: '#a9bfd6',
  yellow: '#f5c542',
  green: '#46a758',
  ice: '#9fd8f5',
  cheek: '#f29bab',
  brown: '#7a4e2d',
} as const;

// --- Session looks

// Hue 14.8 at 63.1% / 59.6% is exactly Claude orange (#D97757); the first project always gets it.
export const HUES: readonly number[] = [14.8, 200, 135, 275, 45, 335, 175, 95, 240, 0];
export const SIZES: readonly number[] = [1, 0.8, 1.2, 0.9, 1.1];
export const BODY_HSL = { saturation: 63.1, lightness: 59.6 } as const;
export const SHADE_HSL = { saturation: 52, lightness: 44 } as const;
export const LOOK_ACCENTS = [FIXED_COLORS.blue, FIXED_COLORS.red] as const;

// --- Skins

export const PLAN_MODE_SKIN: SkinId = 'planner'; // the session's own Clawd dresses as the planner in plan mode
export const SKIN_SHADE_BLACK_MIX = 0.28; // how far a skin's body is darkened towards black for its shade

// A word with a trailing '*' matches the start of a name word; any other must match a whole word,
// so "doc" finds "doc-writer" but not "doctor", and "trace*" finds "tracer" but not "tracker".
// First match wins, so narrower roles come before broad words like "code".
export const SKIN_RULES: readonly SkinRule[] = [
  ['security', ['security']],
  ['tester', ['test', 'tests', 'tester', 'testing']], // before reviewer's "qa", so qa-tester is a tester
  ['reviewer', ['review*', 'critic', 'verif*', 'audit*', 'qa']],
  ['explorer', ['explor*', 'search*', 'research*', 'scout*', 'guide', 'document*']],
  ['planner', ['plan', 'planner', 'planning', 'architect*', 'analyst']],
  ['debugger', ['debug*', 'trace*', 'tracing']],
  ['writer', ['writ*', 'doc', 'docs']],
  ['designer', ['design*']],
  ['refactorer', ['refactor*', 'simplif*', 'slop', 'clean*']], // before executor's "code", so code-simplifier is a refactorer
  ['executor', ['execut*', 'build*', 'implement*', 'code', 'coder']],
];
export const DEFAULT_SKIN: SkinId = 'helper';

// --- Sickness

// Context share -> sickness level: fine, sweating (50%), feverish (65%), very ill (80%).
export const SICK_AT = [0.5, 0.65, 0.8] as const;
export const SICK_LEVEL = { feverish: 2, veryIll: 3 } as const;
export const SICK_TINT = '#a3b84a';
export const SICK_MIX = [0, 0.15, 0.3, 0.45] as const; // by sickness level
