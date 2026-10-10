import type { Session } from '../../session/types.ts';
import { DEFAULT_SETTINGS, SIZE_RANGE } from '../../settings/constants.ts';
import { settingsFrom } from '../../settings/settings.ts';
import type { Settings } from '../../settings/types.ts';
import { clamp } from '../../shared/math.ts';
import { FOLLOW_MS } from '../constants/crew.ts';
import { GRID_H, GRID_W } from '../constants/grid.ts';
import {
  CHIRP_CLICKS,
  DRAG_THRESHOLD,
  MARGIN,
  MAX_SCREEN_SHARE,
  MAX_TICK_MS,
  MULTI_CLICK_MS,
  SPACING,
  TOOLTIP_GAP,
  WALK_LINGER_MS,
  WALK_SPEED,
} from '../constants/stage.ts';
import { WALK_MS } from '../constants/timing.ts';
import { glide } from '../crew-layout.ts';
import { socialCues } from '../director.ts';
import { confine } from '../geometry.ts';
import { pickLook } from '../look.ts';
import type {
  Action,
  Anchor,
  Click,
  Confined,
  Drag,
  Frame,
  Inset,
  Look,
  Move,
  Point,
  Rect,
  Screen,
  SpriteDraw,
  StageSnapshot,
  View,
} from '../types.ts';
import { Crew } from './crew.ts';
import { crewLabel } from './label.ts';
import type { Sprite } from './sprite.ts';

export type { Anchor } from '../types.ts';

// The overlay's whole behaviour, free of any windowing system: the macOS app feeds it the daemon's
// snapshots, the pointer and the screens, and draws the sprites it hands back. Coordinates are global
// screen points with y growing downwards.

// One process keeps its mascot through /clear, when the session id changes.
const crewKey = (session: Session): string => (session.pid ? `pid:${session.pid}` : `id:${session.id}`);

export class Stage {
  private readonly crews = new Map<string, Crew>(); // left to right, in order of arrival
  private readonly clock: () => number;
  private clockOffset = 0;
  private settings: Settings = DEFAULT_SETTINGS; // until the daemon's first snapshot
  private basePx = DEFAULT_SETTINGS.size;
  private anchor: Anchor;
  private screens: Screen[] = [];
  private box = { x: 0, y: 0, width: 0, height: 0 };
  private drag: Drag | null = null;
  private move: Move | null = null; // the box trailing the pointer, kept until it settles after the release
  private lastClick: Click | null = null;
  private scrollRest = 0;
  private actions: Action[] = [];
  private readonly frameIds = new WeakMap<Uint8Array, number>();
  private nextFrameId = 1;

  constructor(anchor: Anchor | null = null, clock: () => number = Date.now) {
    this.anchor = anchor ?? { screen: null, right: MARGIN, bottom: MARGIN };
    this.clock = clock;
  }

  setScreens(screens: Screen[]): void {
    this.screens = screens;
  }

  // A daemon snapshot; an empty session list when it is down.
  sync(snapshot: StageSnapshot): void {
    this.clockOffset = snapshot.now - this.clock();
    if (snapshot.settings) this.applySettings(settingsFrom(snapshot.settings));
    const seen = new Set<string>();
    for (const session of snapshot.sessions) {
      const key = crewKey(session);
      seen.add(key);
      const crew = this.crews.get(key);
      if (crew) crew.session = session;
      else this.crews.set(key, new Crew(session, this.lookFor(session)));
    }
    for (const key of this.crews.keys()) if (!seen.has(key)) this.crews.delete(key);
  }

  tick(pointer: Point | null): View {
    const now = this.now();
    const view: View = {
      sprites: [],
      opacity: this.settings.opacity,
      overFullscreen: this.settings.overFullscreen,
      fast: false,
    };
    if (!this.screens.length) return view;
    for (const [key, crew] of this.crews) {
      const { leavingAt } = crew.session;
      if (leavingAt !== undefined && now - leavingAt >= WALK_MS) this.crews.delete(key);
      else crew.layout(now, this.basePx);
    }
    const crews = [...this.crews.values()];
    this.box.width = crews.reduce((sum, crew) => sum + crew.width, 0) + SPACING * Math.max(crews.length - 1, 0);
    this.box.height = Math.max(0, ...crews.map((crew) => crew.height));
    const moving = this.follow(now);
    if (!this.move) this.place();

    const { gaze, antics, neglect } = this.settings;
    const bounds = this.workArea();
    const social = socialCues(
      crews.map((crew) => crew.session),
      now,
    );
    let x = this.box.x;
    crews.forEach((crew, i) => {
      const y = this.box.y + this.box.height - crew.height;
      crew.draw({
        origin: { x, y },
        now,
        pointer: gaze ? pointer : null,
        bounds,
        moving,
        social: social[i],
        behaviour: { antics, neglect },
      });
      x += crew.width + SPACING;
      for (const sprite of crew.sprites) {
        if (sprite.frame) view.sprites.push(this.drawOf(sprite, sprite.frame));
      }
    });

    const hovered = pointer && !this.drag ? crews.find((crew) => crew.hit(pointer.x, pointer.y)) : undefined;
    if (hovered) {
      view.tooltip = { text: crewLabel(hovered.session), x: hovered.x + hovered.width / 2, y: hovered.y - TOOLTIP_GAP };
    }
    view.fast = !!this.move || crews.some((crew) => crew.animating);
    return view;
  }

  // Whether the point lands on a drawn Clawd, so the app should take the mouse there.
  hit(x: number, y: number): boolean {
    return !!this.drag || [...this.crews.values()].some((crew) => crew.hit(x, y));
  }

  press(x: number, y: number): boolean {
    this.drag = null;
    if (!this.hit(x, y)) return false;
    this.drag = { x, y, boxX: this.box.x, boxY: this.box.y, moved: false };
    return true;
  }

  // The group stays on the screen under the pointer and bumps into its edges; crossing to a
  // neighbouring screen needs the pointer itself to cross.
  motion(x: number, y: number): void {
    const drag = this.drag;
    if (!drag) return;
    const dx = x - drag.x;
    const dy = y - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    const screen = this.screenAt(x, y);
    this.move ??= {
      x: drag.boxX,
      y: drag.boxY,
      wantX: drag.boxX,
      wantY: drag.boxY,
      screen,
      walls: [],
      released: false,
    };
    Object.assign(this.move, { wantX: drag.boxX + dx, wantY: drag.boxY + dy, screen, released: false });
  }

  release(): void {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    if (!drag.moved) this.click(drag.x, drag.y);
    else if (this.move) this.move.released = true; // anchored once it settles, see follow()
  }

  // Ctrl+scroll: `delta` in wheel notches, fractions from touchpads add up to whole steps.
  zoom(delta: number): void {
    this.scrollRest += delta;
    const steps = Math.trunc(this.scrollRest);
    this.scrollRest -= steps;
    // Applied right away; the daemon stores it and echoes it back to every overlay.
    if (steps && this.resize(this.basePx + steps))
      this.actions.push({ type: 'settings', patch: { size: this.basePx } });
  }

  takeActions(): Action[] {
    const out = this.actions;
    this.actions = [];
    return out;
  }

  private now(): number {
    return this.clock() + this.clockOffset;
  }

  private lookFor(session: Session): Look {
    return pickLook(
      [...this.crews.values()].map((crew) => ({ cwd: crew.session.cwd, look: crew.look })),
      session.cwd,
    );
  }

  // Every click pokes; three in a row on the same crew chirp.
  private click(x: number, y: number): void {
    const now = this.now();
    const crew = [...this.crews.values()].find((candidate) => candidate.poke(x, y, now));
    const t = this.clock();
    const last = this.lastClick;
    const follows =
      crew &&
      last?.crew === crew &&
      t - last.t < MULTI_CLICK_MS &&
      Math.hypot(x - last.x, y - last.y) < DRAG_THRESHOLD * 2;
    const count = follows ? last.count + 1 : 1;
    this.lastClick = crew && count < CHIRP_CLICKS ? { crew, t, x, y, count } : null;
    if (count === CHIRP_CLICKS) this.actions.push({ type: 'chirp' });
  }

  // Glides the box towards where the pointer wants it, kept on the pointer's screen; bumps each
  // edge once per contact, when the bodies reach it. Returns whether the crew is walking along.
  private follow(now: number): boolean {
    const move = this.move;
    if (!move) return false;
    const dt = move.at ? Math.min(now - move.at, MAX_TICK_MS) : 0;
    move.at = now;
    const { width, height } = this.box;
    const area = move.screen.area;
    const to = confine(move.wantX, move.wantY, width, height, area, this.inset());
    const x = glide(move.x, to.x, dt, FOLLOW_MS);
    const y = glide(move.y, to.y, dt, FOLLOW_MS);
    if (Math.hypot(x - move.x, y - move.y) > WALK_SPEED * dt) move.walkedAt = now;
    // Walks the whole time the button is held, still pointer included; after the release, while it catches up.
    const moving = !move.released || now - (move.walkedAt ?? -Infinity) < WALK_LINGER_MS;
    move.x = x;
    move.y = y;
    this.box.x = Math.round(x);
    this.box.y = Math.round(y);

    this.bumpWalls(move, to, now);
    if (move.released && x === to.x && y === to.y) this.settle(move);
    return moving;
  }

  // Bumps the crews against each edge the box has just reached; `to` is where the pointer wants it.
  private bumpWalls(move: Move, to: Confined, now: number): void {
    const touching = to.walls.filter(
      (side) => Math.abs(side === 'left' || side === 'right' ? move.x - to.x : move.y - to.y) < 1,
    );
    for (const side of touching) {
      if (!move.walls.includes(side)) for (const crew of this.crews.values()) crew.bump(side, now, move.screen.area);
    }
    move.walls = to.walls.filter((side) => touching.includes(side) || move.walls.includes(side));
  }

  // The drag is over and the box has caught up: it stays where it is, anchored to that screen.
  private settle(move: Move): void {
    const { area } = move.screen;
    this.move = null;
    this.anchor = {
      screen: move.screen.id,
      right: area.x + area.width - (this.box.x + this.box.width),
      bottom: area.y + area.height - (this.box.y + this.box.height),
    };
    this.actions.push({ type: 'anchor', anchor: this.anchor });
  }

  // Anchored by its bottom-right corner to its screen's area, so it grows leftwards and upwards.
  private place(): void {
    const area = this.anchorScreen().area;
    const { width, height } = this.box;
    const { x, y } = confine(
      area.x + area.width - this.anchor.right - width,
      area.y + area.height - this.anchor.bottom - height,
      width,
      height,
      area,
      this.inset(),
    );
    this.box.x = Math.round(x);
    this.box.y = Math.round(y);
  }

  // The outermost Clawds' padding: the box may overhang the screen edge until their bodies touch it.
  private inset(): Inset {
    const crews = [...this.crews.values()];
    return { left: crews[0]?.inset.left ?? 0, right: crews.at(-1)?.inset.right ?? 0 };
  }

  private workArea(): Rect {
    return (this.move?.screen ?? this.anchorScreen()).area;
  }

  private anchorScreen(): Screen {
    return this.screens.find((screen) => screen.id === this.anchor.screen) ?? this.screens[0];
  }

  private screenAt(x: number, y: number): Screen {
    const inside = (r: Rect): boolean => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;
    return this.screens.find((screen) => inside(screen.area)) ?? this.anchorScreen();
  }

  private applySettings(settings: Settings): void {
    this.settings = settings;
    this.resize(settings.size);
  }

  // Grows no further than fits in the screen's share; returns whether the size changed.
  private resize(px: number): boolean {
    let next = clamp(Math.round(px), SIZE_RANGE);
    if (next > this.basePx && this.screens.length) {
      // With nobody on screen yet, a single bare Clawd stands in for the crews.
      const width = this.box.width || GRID_W * this.basePx;
      const height = this.box.height || GRID_H * this.basePx;
      const area = this.anchorScreen().area;
      const room = Math.min((area.width * MAX_SCREEN_SHARE) / width, (area.height * MAX_SCREEN_SHARE) / height);
      next = Math.max(this.basePx, Math.min(next, Math.floor(this.basePx * room)));
    }
    if (next === this.basePx) return false;
    this.basePx = next;
    return true;
  }

  private drawOf(sprite: Sprite, frame: Frame): SpriteDraw {
    let id = this.frameIds.get(frame.pixels);
    const fresh = id === undefined;
    if (id === undefined) {
      id = this.nextFrameId++;
      this.frameIds.set(frame.pixels, id);
    }
    return {
      id,
      w: frame.w,
      h: frame.h,
      palette: sprite.palette,
      x: sprite.x + sprite.tx,
      y: sprite.y,
      px: sprite.px,
      opacity: sprite.opacity,
      ...(fresh ? { pixels: [...frame.pixels] } : {}),
    };
  }
}
