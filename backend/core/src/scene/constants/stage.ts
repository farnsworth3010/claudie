export const MARGIN = 24;
export const SPACING = 10; // between neighbouring sessions' crews
export const MIN_CREW_PX = 2;
export const MIN_MINI_PX = 1;
export const MAX_TICK_MS = 250; // the longest gap a tick's easing counts, so a stalled app doesn't make jumps
export const MAX_SCREEN_SHARE = 0.6; // never grow past this much of the screen's area

// The transcript names the model but not its window; Claude 5 models run with a 1M one.
export const CONTEXT_WINDOW = 1_000_000;

// Pointer
export const DRAG_THRESHOLD = 4;
export const WALK_SPEED = 0.05; // px per ms of gliding that counts as walking along
export const WALK_LINGER_MS = 250; // after the release, keeps walking through the glide's slow last stretch
export const MULTI_CLICK_MS = 400;
export const CHIRP_CLICKS = 3;
export const TOOLTIP_GAP = 4; // between a crew's top edge and its tooltip

export const MAIN_KEY = ''; // reaction key of the main mascot; agent ids are never empty
