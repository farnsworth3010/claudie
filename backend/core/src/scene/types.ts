import type { Limits } from '../limits/types.ts';
import type { Agent, Session } from '../session/types.ts';
import type { Settings } from '../settings/types.ts';
import type { Crew } from './stage/crew.ts';

// --- Poses and clips

// A screen edge the mascots can run into while dragged.
export type Side = 'left' | 'right' | 'top' | 'bottom';

export type Bubble = 'bang' | 'question';

export type Fx = 'bang' | 'question' | 'z1' | 'z2' | 'z3' | 'heart1' | 'heart2' | 'stars' | 'chat1' | 'chat2' | 'chat3';

export type HammerPhase = 'up' | 'hit' | 'rest';

export type Prop =
  | { readonly cube: number } // twist index; -1 is solved
  | { readonly balls: number } // juggling phase 0..11
  | { readonly guitar: number } // strum phase 0..7
  | { readonly electric: number } // spark phase 0..7
  | { readonly book: number } // 0..2 reading, 3 a page turning
  | { readonly gum: number } // bubble radius 0..4, 5 = popped
  | { readonly yoyo: number } // string length
  | { readonly game: number } // position of the dot on the console screen
  | { readonly sparkle: number } // meditation sparkles phase
  | { readonly dizzy: number } // stars circling the head, phase
  | { readonly spinner: number } // rotation phase of a fidget spinner on the raised right hand
  | { readonly digits: 'left' | 'right' } // "6" and "7" over the palms, the named one raised
  | { readonly tumbleweed: number } // column of a tumbleweed rolling past along the floor
  | { readonly elder: 'watch' | 'cane' } // beard and brows; checking the clock or leaning on a cane
  | { readonly panic: number } // sweat flying off, phase
  | { readonly spider: number } // cobwebbed; how far the spider has let itself down
  | { readonly garden: number; readonly grow: number } // mossy, a flower grown `grow` of 5 on the head, butterfly phase
  | { readonly snow: number } // snowed in; falling flakes phase
  | { readonly keys: number } // typing: the key pressed now
  | { readonly hammer: HammerPhase }
  | { readonly lens: number; readonly big: boolean } // magnifier's left column; `big` when it is over an eye
  | { readonly globe: number } // spin phase
  | { readonly confetti: number } // fall phase
  | { readonly storm: number } // grumpy cloud phase; 4 is the slump after the stomping
  | { readonly bits: number } // tokens squeezed out of the sides, phase
  | { readonly shine: number } // fresh-start sparkles, phase
  | { readonly cup: 'hold' | 'sip'; readonly steam?: number }
  | { readonly scroll: 'held' | 'rolled' | 'open' }; // held up in the right hand, or in both hands in front

export interface Pose {
  readonly dx?: number;
  readonly dy?: number;
  readonly eyeDx?: number;
  readonly eyeDy?: number;
  readonly eyes?: 'open' | 'closed' | 'wide';
  readonly arms?: 'down' | 'up' | 'left' | 'right';
  readonly legs?: 0 | 1 | 2 | 3; // 3: both pairs tucked up
  readonly squash?: number; // rows pressed down from the top, or columns from the side of `wall`
  readonly wall?: Side; // the edge it just hit: flattens that side and puts the 'stars' there
  readonly mouth?: 1 | 2; // Clawd has no mouth, except a gaping one: half or fully open
  readonly legLen?: number; // leg length in rows (2 normally); longer legs lift the body, feet stay on the floor
  readonly skeleton?: boolean; // bones instead of a body
  readonly fx?: Fx;
  readonly prop?: Prop;
}

export interface Step {
  readonly pose: Pose;
  readonly ms: number;
}

export type Clip =
  | 'stand'
  | 'celebrate'
  | 'sad'
  | 'puzzled'
  | 'lookAround'
  | 'yawn'
  | 'sleep'
  | 'stroll'
  | 'work'
  | 'alert'
  | 'ask'
  | 'fidget'
  | 'highJump'
  | 'panic'
  | 'longLegs'
  | 'elder'
  | 'skeleton'
  | 'grandpa'
  | 'cobweb'
  | 'sprout'
  | 'overgrown'
  | 'snowedIn'
  | 'bumpLeft'
  | 'bumpRight'
  | 'bumpTop'
  | 'bumpBottom'
  | 'poke'
  | 'enter'
  | 'leave'
  | 'walk'
  | 'type'
  | 'hammer'
  | 'search'
  | 'globe'
  | 'confetti'
  | 'upset'
  | 'refresh'
  | 'compact'
  | 'deliver'
  | 'receive'
  | 'chatA'
  | 'chatB';

export interface ClipDef {
  readonly loop: boolean;
  readonly steps: readonly Step[];
}

// Pastimes a mascot plays in turn while it waits for subagents.
export type FidgetScene =
  | 'cube'
  | 'juggle'
  | 'guitar'
  | 'book'
  | 'gum'
  | 'yoyo'
  | 'game'
  | 'meditate'
  | 'spinner'
  | 'sixSeven'
  | 'pop'
  | 'tea'
  | 'electric';

// --- Frames

export interface Frame {
  readonly w: number;
  readonly h: number;
  readonly pixels: Uint8Array;
  readonly dx: number; // horizontal offset in grid pixels; fractional while walking in or off, for a smooth slide
  readonly opacity: number;
  readonly solid: readonly [number, number]; // body columns [from, to) before dx, for keeping it on screen
}

// Where open eyes look, one grid pixel each way; set while the pointer is near the mascot.
export interface Gaze {
  readonly x: -1 | 0 | 1;
  readonly y: -1 | 0 | 1;
}

// Mascot-wide modifiers: a subagent skin, how sick the session's context makes it (0..3), the gaze,
// and a horizontal flip so a clip drawn facing right faces left.
export interface FrameMods {
  readonly skin?: SkinId;
  readonly sick?: number;
  readonly gaze?: Gaze;
  readonly bubble?: Bubble; // keeps a pending dialog's bubble up over any clip
  readonly mirror?: boolean;
  readonly pace?: number; // how fast the clip plays; walking in or off keeps real time
}

// What a frame is drawn with, once the clip's time has been turned into phases.
export interface Appearance {
  readonly skin?: SkinId;
  readonly spin: number; // propeller blade frame, -1 when the skin has none
  readonly sick: number;
  readonly sweat: number; // sweat drop phase, -1 when not sick
  readonly gaze?: Gaze;
  readonly bubble?: Bubble;
}

export interface DrawnFrame {
  readonly pixels: Uint8Array;
  readonly solid: readonly [number, number];
}

// Paints one pixel at a column and row of the body, relative to the body's top-left corner.
export type Setter = (col: number, row: number, color: number) => void;

// Rows and columns the body is pressed in from the top, left and right.
export interface Squash {
  readonly top: number;
  readonly left: number;
  readonly right: number;
}

// Rows of [row, art], painted from some column.
export type ArtRows = ReadonlyArray<readonly [number, string]>;

// --- Looks and skins

// Slot indices into the colour and size tables.
export interface Look {
  readonly hue: number;
  readonly size: number;
}

export type SkinId =
  | 'helper'
  | 'explorer'
  | 'reviewer'
  | 'security'
  | 'planner'
  | 'tester'
  | 'debugger'
  | 'writer'
  | 'designer'
  | 'executor'
  | 'refactorer';

// Accessory rows are [logo row, art]; art column 0 is logo column 1, so the body spans art columns 2..13.
// Letters: A/B accessory colours, o ink, w white, r red, b blue, y yellow, n brown, i ice; '.' is see-through.
export type Accessory = ArtRows;

export interface Skin {
  readonly body: string;
  readonly acc: readonly [string, string];
  readonly accessory: Accessory;
  readonly glasses?: boolean; // the accessory sits around the eyes and turns with them
  readonly spin?: { readonly row: number; readonly frames: readonly string[] }; // an accessory row that turns, cycled over time
}

// A skin and the words in an agent's name that earn it.
export type SkinRule = readonly [SkinId, readonly string[]];

// --- Direction

// What a mascot plays: a clip and when it started, so every frontend shows the same frame.
export interface Cue {
  readonly clip: Clip;
  readonly startedAt: number;
  readonly bubble?: Bubble; // keeps a dialog's bubble up over an antic or a reaction
  readonly mirror?: boolean; // play it facing left
}

// A one-off clip played in response to the user: 'poke' on a click, a bump into a screen edge.
export interface Reaction {
  readonly clip: Clip;
  readonly at: number;
}

// The settings that change what a mascot plays; anything left out stays on.
export type Behaviour = Partial<
  Pick<Settings, 'antics' | 'neglect' | 'pace' | 'stroll' | 'sleepAfter' | 'neglectAfter' | 'patience'>
>;

// --- Geometry

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// How far a box may overhang the left and right edges of its area.
export interface Inset {
  readonly left: number;
  readonly right: number;
}

export interface Confined extends Point {
  readonly walls: Side[]; // the edges it was pushed back from
}

// One axis of a box fitted into an area, and the edge it was pushed back from, if any.
export interface Fitted {
  readonly value: number;
  readonly wall?: Side;
}

export interface CrewLayout {
  readonly width: number;
  readonly height: number;
  readonly main: Point;
  readonly minis: Point[];
  // Transparent padding between the box's sides and the nearest Clawd's body; the box may stick
  // out past a screen edge by this much, so bodies, not empty pixels, meet the edge.
  readonly inset: Inset;
}

// A spot where a finishing mini hands its scroll over, and the slot that blocks it when occupied.
export interface HandoverSpot {
  readonly blockedBy: number;
  readonly spot: Point;
}

// --- Stage

export interface Screen {
  readonly id: number;
  readonly area: Rect; // where the Clawds may go
}

// Where something stands: how far its bottom-right corner is from its screen's.
export interface Corner {
  readonly screen: number | null; // the first screen when it is gone
  readonly right: number;
  readonly bottom: number;
}

// Where the crews stand, and the usage limit clocks, which stand apart from them.
export interface Anchor extends Corner {
  readonly clocks?: Corner;
}

export type Action =
  | { readonly type: 'chirp' }
  | { readonly type: 'settings'; readonly patch: Partial<Settings> }
  | { readonly type: 'anchor'; readonly anchor: Anchor };

// `pixels` comes along only the first time a frame id is drawn; the app keeps them by id.
export interface SpriteDraw {
  readonly id: number;
  readonly pixels?: number[];
  readonly w: number;
  readonly h: number;
  readonly palette: string; // comma-separated colours by palette slot, 'transparent' for none
  readonly x: number;
  readonly y: number;
  readonly px: number;
  readonly opacity: number;
}

export interface View {
  sprites: SpriteDraw[]; // back to front
  tooltip?: { text: string; x: number; y: number }; // x: centre, y: bottom edge
  opacity: number;
  overFullscreen: boolean;
  clickThrough: boolean; // the app takes the mouse over a Clawd only while ⌥ Option is held
  overDock: boolean; // the app counts the Dock's area as room for the Clawds
  overMenuBar: boolean; // and the menu bar's
  fast: boolean; // something moves: tick on the display's refresh instead of the slow timer
}

export interface StageSnapshot {
  readonly now: number;
  readonly sessions: Session[];
  readonly settings?: unknown;
  readonly limits?: Limits;
}

// A subagent on screen; `leftAt` once it finished and walks its result over.
export interface Mini {
  agent: Agent;
  readonly skin: SkinId;
  leftAt?: number;
}

// What a crew needs to know to draw itself this tick.
export interface CrewDrawContext {
  readonly origin: Point; // top-left corner of the crew's box
  readonly now: number;
  readonly pointer: Point | null; // null when the eyes shouldn't follow it
  readonly bounds: Rect | undefined;
  readonly moving: boolean; // being dragged across the screen, or wandering, right now
  readonly heading: 1 | -1; // which way a walk goes: forwards (rightwards when upright) or back
  readonly social: Cue | undefined; // a chat with a neighbour, overriding the director's cue
  readonly behaviour: Behaviour;
}

export interface Box extends Point {
  readonly width: number;
  readonly height: number;
}

export interface Drag {
  readonly x: number;
  readonly y: number;
  boxX: number; // where the upright box was when the drag began
  boxY: number;
  moved: boolean;
}

// The usage limit clocks in the hand; `at` and `screen` once it has moved them, and how fast they
// went at `t`, for a throw.
export interface ClockDrag {
  readonly x: number;
  readonly y: number;
  readonly fromX: number; // where the clocks' top-left corner was when the drag began
  readonly fromY: number;
  moved: boolean;
  at?: Point;
  screen?: Screen;
  vx: number;
  vy: number;
  t: number;
}

// The usage limit clocks thrown or falling, on their screen; `at` is the last step's time.
export interface ClockFlight {
  x: number;
  y: number;
  vx: number;
  vy: number;
  readonly screen: Screen;
  at: number;
}

// The crew box trailing the pointer while it is dragged, kept until it settles after the release.
export interface Move {
  x: number;
  y: number;
  wantX: number;
  wantY: number;
  screen: Screen;
  walls: Side[];
  pushing: Side[]; // the edges the pointer drags the box past right now
  released: boolean;
  vx: number; // points per ms, while dragged and in flight
  vy: number;
  flying: boolean; // let go of with inertia or gravity on: physics moves it, not the pointer
  at?: number;
  walkedAt?: number;
}

// Wandering about the screen's edges: how far along the track, where to, and when to set off again.
export interface Roam {
  spot: { readonly side: number; readonly along: number }; // see crawl.ts
  remaining: number | null; // points left of the walk, null while resting
  heading: 1 | -1;
  speed: number; // points per ms, picked per walk
  restUntil: number;
  calm: boolean; // last tick, every crew could walk along
  free?: { x: number; y: number }; // roaming anywhere: where the upright box is, unrounded
  goal?: Point; // roaming anywhere: where this walk goes
  approach?: { x: number; y: number }; // drifting from mid-air to the nearest edge, upright, before it can crawl
}

// A tool clip kept on screen a moment after a quick tool finished, so it doesn't just flash.
export interface ToolHold {
  readonly clip: Clip;
  readonly startedAt: number;
  readonly until: number;
}

export interface Click extends Point {
  readonly crew: Crew;
  readonly t: number;
  readonly count: number;
}
