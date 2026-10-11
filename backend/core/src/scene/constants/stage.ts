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

// Thrown and falling, in screen points and ms
export const GRAVITY = 0.004; // points per ms²
export const BOUNCE = 0.3; // the share of its speed a crew keeps off a wall
export const AIR_FRICTION_MS = 450; // the time a flying crew's speed takes to fall to a third
export const GROUND_FRICTION_MS = 120; // the same, sliding along the bottom edge
export const REST_SPEED = 0.03; // slower than this, a crew has come to rest
export const BUMP_SPEED = 0.4; // an impact this fast makes the crew flinch
export const MAX_THROW_SPEED = 4;
export const VELOCITY_SMOOTH_MS = 40; // a drag's speed is averaged over about this long

// Wandering, in screen points and ms
export const WANDER_SPEED = [0.025, 0.055] as const; // each walk picks its own pace in between
export const WANDER_STEP = [120, 600] as const; // how far one walk goes, at least and at most
export const WANDER_REST_MS = [3_000, 9_000] as const; // the pause between walks
export const WANDER_WAIT_MS = 1_000; // how soon to look again while someone can't walk along
export const WANDER_WAKE_MS = [4_000, 8_000] as const; // standing a while once everyone can walk again, as after sleep
export const APPROACH_SPEED = 0.12; // let go of in mid-air without gravity: drifting to the nearest edge

export const MAIN_KEY = ''; // reaction key of the main mascot; agent ids are never empty
