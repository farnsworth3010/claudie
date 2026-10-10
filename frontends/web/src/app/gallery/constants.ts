import type { Clip } from '@claudie/core/scene/types.ts';

export const GALLERY_PX = 4;
export const REPLAY_PAUSE_MS = 600; // a clip that doesn't loop plays again after this
// They loop their steps but walk across the box only once, over WALK_MS.
export const WALKS: ReadonlySet<Clip> = new Set<Clip>(['enter', 'leave']);
export const SICKNESS_CAPTIONS = ['healthy', 'context ≥ 50%', 'context ≥ 65%', 'context ≥ 80%'] as const;
