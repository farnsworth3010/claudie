export const DEFAULT_PORT = 47321;

export const SLOW_TICK_MS = 50;
export const FAST_TICK_MS = 16;
// Slow ticks with nothing to show before the timer stops; the next snapshot starts it again.
export const IDLE_TICKS = 20;

export const RECONNECT_FIRST_MS = 1000;
export const RECONNECT_MAX_MS = 10_000;

// Around the sprites and the tooltip, so the container never clips a Clawd's edge.
export const MARGIN = 4;
export const IMAGE_CACHE_LIMIT = 4000;
