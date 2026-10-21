// How the overlay looks and behaves. The daemon keeps them and sends them with every snapshot,
// so every overlay looks the same; Ctrl+scroll on the Mac changes the size.
export interface Settings {
  readonly size: number; // screen points per art pixel
  readonly opacity: number;
  readonly miniSize: number; // a subagent's mini next to its session's Clawd: 0.5 is half as big
  readonly pace: number; // how fast animations play: 1 as drawn, 1.5 half as fast again
  readonly overFullscreen: boolean; // stay visible over fullscreen windows instead of hiding
  readonly clickThrough: boolean; // the Clawds never catch the mouse; on the Mac ⌥ Option lets it through for a moment
  readonly overDock: boolean; // macOS: the Clawds may stand on the Dock; off, they keep out of its area
  readonly overMenuBar: boolean; // macOS: the Clawds may climb onto the menu bar
  readonly gaze: boolean; // eyes follow the pointer
  readonly antics: boolean; // clowning around when a dialog waits too long
  readonly neglect: boolean; // cobwebs, a flower, snow and bones when left idle for long
  readonly inertia: boolean; // a crew let go of keeps flying, slows down and bounces off the edges
  readonly gravity: boolean; // a crew let go of falls to the bottom of its screen
  readonly stroll: boolean; // idle, it paces slowly about instead of falling asleep, gathering cobwebs and turning to bones
  readonly wander: boolean; // walks about on its own and crawls along the screen's edges (with gravity, the floor only)
  readonly anywhere: boolean; // wandering without gravity goes all over the screen, upright, not round its edges
  readonly limits: boolean; // clocks of the 5-hour and weekly usage limits, apart from the crews, fed by the status line
  readonly clockInertia: boolean; // the clocks let go of keep flying, slow down and bounce off the edges
  readonly clockGravity: boolean; // the clocks let go of fall to the bottom of their screen
  // Idle timings, in seconds.
  readonly sleepAfter: number; // idle this long, it yawns and falls asleep; it looks around a third of the way
  readonly neglectAfter: number; // idle this long, cobwebs; the flower, the snow and the bones follow in proportion
  readonly patience: number; // a dialog unanswered this long sets off the antics
}

export type SettingsNumber = 'size' | 'opacity' | 'miniSize' | 'pace' | 'sleepAfter' | 'neglectAfter' | 'patience';

export type SettingsFlag =
  | 'overFullscreen'
  | 'clickThrough'
  | 'overDock'
  | 'overMenuBar'
  | 'gaze'
  | 'antics'
  | 'neglect'
  | 'inertia'
  | 'gravity'
  | 'wander'
  | 'stroll'
  | 'anywhere'
  | 'limits'
  | 'clockInertia'
  | 'clockGravity';
