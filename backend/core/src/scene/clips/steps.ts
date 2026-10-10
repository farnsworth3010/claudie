import type { Pose, Step } from '../types.ts';

// The clip DSL: `s(ms, pose)` is a step that holds a pose for `ms`.
export const s = (ms: number, pose: Pose = {}): Step => ({ pose, ms });

export const repeat = (n: number, build: (i: number) => Step | Step[]): Step[] =>
  Array.from({ length: n }, (_, i) => build(i)).flat();

export const durationOf = (steps: readonly Step[]): number => steps.reduce((sum, step) => sum + step.ms, 0);
