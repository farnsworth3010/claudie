import type { Session } from '../../session/types.ts';
import { DEFAULT_SETTINGS, RANGES } from '../../settings/constants.ts';
import { settingsFrom } from '../../settings/settings.ts';
import type { Settings } from '../../settings/types.ts';
import { clamp } from '../../shared/math.ts';
import { FOLLOW_MS } from '../constants/crew.ts';
import { GRID_H, GRID_W } from '../constants/grid.ts';
import {
  AIR_FRICTION_MS,
  APPROACH_SPEED,
  BOUNCE,
  BUMP_SPEED,
  CHIRP_CLICKS,
  DRAG_THRESHOLD,
  GRAVITY,
  GROUND_FRICTION_MS,
  MARGIN,
  MAX_SCREEN_SHARE,
  MAX_THROW_SPEED,
  MAX_TICK_MS,
  MULTI_CLICK_MS,
  REST_SPEED,
  SPACING,
  TOOLTIP_GAP,
  VELOCITY_SMOOTH_MS,
  WALK_LINGER_MS,
  WALK_SPEED,
  WANDER_REST_MS,
  WANDER_SPEED,
  WANDER_STEP,
  WANDER_WAIT_MS,
  WANDER_WAKE_MS,
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
  Roam,
  Screen,
  Side,
  SpriteDraw,
  StageSnapshot,
  View,
} from '../types.ts';
import { moveAlong, nearest, placeAt, type Spot, spotAt, type Track, track } from './crawl.ts';
import { Crew } from './crew.ts';
import { crewLabel } from './label.ts';
import { toUpright, turnedSize, turnPixels, turnRect } from './orient.ts';
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
  private bumps = new Set<Side>(); // edges hit this tick, played once the crews stand at their new place
  private readonly frameIds = new WeakMap<Uint8Array, number>();
  private readonly turned = new WeakMap<Uint8Array, Map<Side, Uint8Array>>(); // frames as drawn on a wall or the ceiling
  private nextFrameId = 1;
  private readonly random: () => number;
  private edge: Side = 'bottom'; // the edge the crews' feet are on; the box is laid out upright and turned to it
  private roam: Roam | null = null;
  private stuck: Spot | null = null; // where on the track a dragged crew clings to an edge
  private roamAt = 0;

  constructor(anchor: Anchor | null = null, clock: () => number = Date.now, random: () => number = Math.random) {
    this.anchor = anchor ?? { screen: null, right: MARGIN, bottom: MARGIN };
    this.clock = clock;
    this.random = random;
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
      clickThrough: this.settings.clickThrough,
      overDock: this.settings.overDock,
      overMenuBar: this.settings.overMenuBar,
      fast: false,
    };
    if (!this.screens.length) return view;
    for (const [key, crew] of this.crews) {
      const { leavingAt } = crew.session;
      if (leavingAt !== undefined && now - leavingAt >= WALK_MS) this.crews.delete(key);
      else crew.layout(now, this.basePx, this.settings.miniSize);
    }
    const crews = [...this.crews.values()];
    this.box.width = crews.reduce((sum, crew) => sum + crew.width, 0) + SPACING * Math.max(crews.length - 1, 0);
    this.box.height = Math.max(0, ...crews.map((crew) => crew.height));
    const dragged = this.follow(now);
    this.cling(crews);
    if (!this.move && !this.roam) this.place();
    if (!this.move && !this.roam && this.settings.gravity && crews.length && this.aboveFloor()) this.drop();
    const roaming = this.wander(now, crews);
    const moving = dragged || roaming;

    const { gaze, antics, neglect, pace, stroll, sleepAfter, neglectAfter, patience } = this.settings;
    const bounds = this.workArea();
    const behaviour = { antics, neglect, pace, stroll, sleepAfter, neglectAfter, patience };
    const social = socialCues(
      crews.map((crew) => crew.session),
      now,
      behaviour,
    );
    const upright = pointer && this.upright(pointer);
    let x = this.box.x;
    crews.forEach((crew, i) => {
      const y = this.box.y + this.box.height - crew.height;
      crew.draw({
        origin: { x, y },
        now,
        pointer: gaze ? upright : null,
        bounds: this.edge === 'bottom' ? bounds : undefined,
        moving,
        heading: this.roam?.heading ?? 1,
        social: social[i],
        behaviour,
      });
      x += crew.width + SPACING;
      for (const sprite of crew.sprites) {
        if (sprite.frame) view.sprites.push(this.drawOf(sprite, sprite.frame));
      }
    });
    this.playBumps(now, bounds);

    const hovered = upright && !this.drag ? crews.find((crew) => crew.hit(upright.x, upright.y)) : undefined;
    if (hovered) {
      const r = turnRect(this.edge, this.box, hovered);
      view.tooltip = { text: crewLabel(hovered.session), x: r.x + r.width / 2, y: r.y - TOOLTIP_GAP };
    }
    view.fast = !!this.move || roaming || crews.some((crew) => crew.animating);
    return view;
  }

  // Whether the point lands on a drawn Clawd, so the app should take the mouse there.
  hit(x: number, y: number): boolean {
    const p = this.upright({ x, y });
    return !!this.drag || [...this.crews.values()].some((crew) => crew.hit(p.x, p.y));
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
    // Picked up off a wall or the ceiling, it stands upright in the hand, where it was. Upright
    // from the turned box's corner, a wide crew would hang past the edge and seem pushed into it.
    if (this.roam) {
      const upright = this.uprightInPlace();
      this.stopWandering(false);
      drag.boxX = upright.x;
      drag.boxY = upright.y;
    }
    const screen = this.screenAt(x, y);
    this.move ??= {
      x: drag.boxX,
      y: drag.boxY,
      wantX: drag.boxX,
      wantY: drag.boxY,
      screen,
      walls: [],
      pushing: [],
      released: false,
      vx: 0,
      vy: 0,
      flying: false,
    };
    // Caught in flight, it is the pointer's again.
    Object.assign(this.move, {
      wantX: drag.boxX + dx,
      wantY: drag.boxY + dy,
      screen,
      released: false,
      flying: false,
    });
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
    const p = this.upright({ x, y });
    const crew = [...this.crews.values()].find((candidate) => candidate.poke(p.x, p.y, now));
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
    if (move.flying) {
      this.fly(move, dt);
      return false;
    }
    const { width, height } = this.box;
    const area = move.screen.area;
    const to = confine(move.wantX, move.wantY, width, height, area, this.inset());
    move.pushing = move.released ? [] : to.walls;
    const x = glide(move.x, to.x, dt, FOLLOW_MS);
    const y = glide(move.y, to.y, dt, FOLLOW_MS);
    if (Math.hypot(x - move.x, y - move.y) > WALK_SPEED * dt) move.walkedAt = now;
    // Walks the whole time the button is held, still pointer included; after the release, while it catches up.
    const moving = !move.released || now - (move.walkedAt ?? -Infinity) < WALK_LINGER_MS;
    if (dt > 0) {
      const k = 1 - Math.exp(-dt / VELOCITY_SMOOTH_MS);
      move.vx += ((x - move.x) / dt - move.vx) * k;
      move.vy += ((y - move.y) / dt - move.vy) * k;
    }
    move.x = x;
    move.y = y;
    this.box.x = Math.round(x);
    this.box.y = Math.round(y);

    this.bumpWalls(move, to);
    if (move.released && (this.settings.inertia || this.settings.gravity)) this.launch(move);
    else if (move.released && x === to.x && y === to.y) this.settle(move);
    return moving;
  }

  // Let go of: with inertia it flies off at the speed it was dragged; with gravity alone it just drops.
  private launch(move: Move): void {
    move.flying = true;
    if (!this.settings.inertia) {
      move.vx = 0;
      move.vy = 0;
    }
    const speed = Math.hypot(move.vx, move.vy);
    if (speed > MAX_THROW_SPEED) {
      move.vx *= MAX_THROW_SPEED / speed;
      move.vy *= MAX_THROW_SPEED / speed;
    }
  }

  // Gravity was turned on, or the crew was placed in the air: it falls from where it stands.
  private drop(): void {
    const { x, y } = this.box;
    const screen = this.anchorScreen();
    this.move = {
      x,
      y,
      wantX: x,
      wantY: y,
      screen,
      walls: [],
      pushing: [],
      released: true,
      vx: 0,
      vy: 0,
      flying: true,
    };
  }

  private aboveFloor(): boolean {
    const area = this.anchorScreen().area;
    return this.box.y + this.box.height < area.y + area.height - 0.5;
  }

  // One step of flight: gravity pulls, friction slows, the screen's edges bounce it back. It
  // comes to rest when slow enough, on the floor if gravity is on.
  private fly(move: Move, dt: number): void {
    const { inertia, gravity } = this.settings;
    const area = move.screen.area;
    const { width, height } = this.box;
    const floor = area.y + area.height - height;
    const grounded = gravity && move.y >= floor - 0.5;
    if (gravity && !grounded) move.vy += GRAVITY * dt;
    if (inertia) {
      const k = Math.exp(-dt / (grounded ? GROUND_FRICTION_MS : AIR_FRICTION_MS));
      move.vx *= k;
      if (!gravity) move.vy *= k;
    }
    const to = confine(move.x + move.vx * dt, move.y + move.vy * dt, width, height, area, this.inset());
    for (const side of to.walls) this.bounce(move, side);
    move.x = to.x;
    move.y = to.y;
    this.box.x = Math.round(to.x);
    this.box.y = Math.round(to.y);
    const resting = Math.hypot(move.vx, move.vy) < REST_SPEED && (!gravity || move.y >= floor - 0.5);
    if (resting) this.settle(move);
  }

  // Off a wall with some of its speed, flinching if the hit was hard.
  private bounce(move: Move, side: Side): void {
    const across = side === 'left' || side === 'right' ? 'vx' : 'vy';
    const speed = Math.abs(move[across]);
    if (speed > BUMP_SPEED) this.bumps.add(side);
    const away = side === 'left' || side === 'top' ? 1 : -1;
    const kept = speed * BOUNCE;
    move[across] = kept < REST_SPEED ? 0 : away * kept;
  }

  // Bumps the crews against each edge the box has just reached; `to` is where the pointer wants it.
  private bumpWalls(move: Move, to: Confined): void {
    const touching = to.walls.filter(
      (side) => Math.abs(side === 'left' || side === 'right' ? move.x - to.x : move.y - to.y) < 1,
    );
    // A plain drag just stops at the edge; only throwing and falling hit it hard enough to flinch.
    if (this.settings.inertia || this.settings.gravity) {
      for (const side of touching) if (!move.walls.includes(side)) this.bumps.add(side);
    }
    move.walls = to.walls.filter((side) => touching.includes(side) || move.walls.includes(side));
  }

  // Which Clawds touch a side edge depends on where they stand, known only once drawn there.
  private playBumps(now: number, bounds: Rect): void {
    for (const side of this.bumps) for (const crew of this.crews.values()) crew.bump(side, now, bounds);
    this.bumps.clear();
  }

  // The drag is over and the box has caught up: it stays where it is, anchored to that screen.
  private settle(move: Move): void {
    this.move = null;
    // Let go of against an edge it clings to, it crawls on from there.
    if (this.stuck !== null) {
      this.roam = this.newRoam(this.stuck, this.now());
      this.stuck = null;
      if (this.edge !== 'bottom') return; // a wall or the ceiling isn't kept across restarts
    }
    this.anchorTo(move.screen);
  }

  // Wandering without gravity, a crew dragged into an edge clings to it, turned to stand on it, and
  // crawls along it with the pointer; pulled away, it stands upright in the hand again. Only a push
  // past the edge counts: a big crew is always near one, and must still go where it is dragged.
  private cling(crews: Crew[]): void {
    const move = this.move;
    const { wander, gravity } = this.settings;
    this.stuck = null;
    if (!move || move.flying || !wander || gravity || this.settings.anywhere || !crews.length) {
      if (move) this.edge = 'bottom';
      return;
    }
    const t = track(move.screen.area, this.box.width, this.box.height, false);
    const sides = t.floorOnly ? move.pushing.filter((side) => side === 'bottom') : move.pushing;
    // Let go of, it clings on to the edge it was pushed into until it settles there.
    const held = move.released && this.edge !== 'bottom' ? [this.edge] : sides;
    if (!held.length) {
      this.edge = 'bottom';
      return;
    }
    const near = nearest(t, this.box, held);
    const spot = spotAt(t, near.s);
    const at = placeAt(t, spot);
    this.box.x = Math.round(at.x);
    this.box.y = Math.round(at.y);
    this.edge = at.edge;
    this.stuck = spot;
  }

  // Stays where it is, anchored to `screen`; the app keeps the anchor across restarts.
  private anchorTo(screen: Screen): void {
    const { area } = screen;
    this.anchor = {
      screen: screen.id,
      right: area.x + area.width - (this.box.x + this.box.width),
      bottom: area.y + area.height - (this.box.y + this.box.height),
    };
    this.actions.push({ type: 'anchor', anchor: this.anchor });
  }

  // The upright box centred where the turned one is, kept on the screen.
  private uprightInPlace(): Point {
    const { x, y, width, height } = this.box;
    const turned = turnedSize(this.edge, width, height);
    const centre = { x: x + turned.width / 2, y: y + turned.height / 2 };
    const at = confine(
      centre.x - width / 2,
      centre.y - height / 2,
      width,
      height,
      this.anchorScreen().area,
      this.inset(),
    );
    return { x: Math.round(at.x), y: Math.round(at.y) };
  }

  // On the stage a point is on screen; the crews know only their upright layout.
  private upright(p: Point): Point {
    return this.edge === 'bottom' ? p : toUpright(this.edge, this.box, p);
  }

  // Wandering: rests a while, walks a stretch of the track, rests again. Nobody sets off while a
  // crew shows something it can't walk along with (a call for attention, sleep), so a dialog
  // stays where it was noticed. Returns whether it walks this tick.
  private wander(now: number, crews: Crew[]): boolean {
    const dt = this.roamAt ? Math.min(now - this.roamAt, MAX_TICK_MS) : 0;
    this.roamAt = now;
    const { wander, gravity } = this.settings;
    if (!wander || this.move || this.drag?.moved) {
      if (this.roam) this.stopWandering(!wander);
      return false;
    }
    // Nobody to show (the daemon is away for a moment): it picks up where it was when they're back.
    if (!crews.length) return false;
    // Gravity pulls it off a wall or the ceiling; it falls from there.
    if (this.roam && gravity && this.edge !== 'bottom') {
      this.stopWandering(true);
      return false;
    }
    if (gravity && !this.roam && this.aboveFloor()) return false; // falling first
    const free = this.settings.anywhere && !gravity;
    if (this.roam && !!this.roam.free !== free) this.stopWandering(false); // switched between edges and anywhere
    const screen = this.anchorScreen();
    const t = track(screen.area, this.box.width, this.box.height, gravity);
    if (!this.roam && free) {
      this.roam = this.newRoam({ side: 0, along: 0 }, now);
      this.roam.free = { x: this.box.x, y: this.box.y };
    }
    if (!this.roam) {
      const near = nearest(t, this.box);
      this.roam = this.newRoam(spotAt(t, near.s), now);
      if (near.gap > 0.5) this.roam.approach = { x: this.box.x, y: this.box.y };
    }
    const roam = this.roam;
    if (roam.approach) return this.approach(roam, t, dt);
    const calm = crews.every((crew) => crew.strollable);
    // Just woken up, or done with a dialog: it stands a while before it wanders off.
    if (calm && !roam.calm) roam.restUntil = Math.max(roam.restUntil, now + this.between(WANDER_WAKE_MS));
    roam.calm = calm;
    if (roam.remaining === null && now >= roam.restUntil) {
      if (calm) this.setOff(roam, t);
      else roam.restUntil = now + WANDER_WAIT_MS;
    } else if (roam.remaining !== null && !calm) {
      roam.remaining = null;
      roam.restUntil = now + WANDER_WAIT_MS;
    }
    if (roam.free) return this.roamFree(roam, roam.free, screen, dt);
    let arrived = false;
    if (roam.remaining !== null) {
      const step = Math.min(roam.speed * dt, roam.remaining);
      roam.spot = moveAlong(t, roam.spot, roam.heading * step);
      roam.remaining -= step;
      arrived = roam.remaining <= 0;
      if (arrived) {
        roam.remaining = null;
        roam.restUntil = now + this.between(WANDER_REST_MS);
      }
    }
    const at = placeAt(t, roam.spot);
    this.box.x = Math.round(at.x);
    this.box.y = Math.round(at.y);
    this.edge = at.edge;
    // Resting on the floor it is remembered there, as if dropped; a wall or the ceiling isn't kept.
    if (arrived && this.edge === 'bottom') this.anchorTo(screen);
    return roam.remaining !== null;
  }

  // Roaming anywhere: straight towards the walk's goal, upright, facing the way it goes.
  private roamFree(roam: Roam, at: { x: number; y: number }, screen: Screen, dt: number): boolean {
    let arrived = false;
    if (roam.remaining !== null && roam.goal) {
      const step = Math.min(roam.speed * dt, roam.remaining);
      const length = Math.hypot(roam.goal.x - at.x, roam.goal.y - at.y) || 1;
      at.x += ((roam.goal.x - at.x) / length) * step;
      at.y += ((roam.goal.y - at.y) / length) * step;
      roam.remaining -= step;
      arrived = roam.remaining <= 0;
      if (arrived) {
        roam.remaining = null;
        roam.restUntil = this.now() + this.between(WANDER_REST_MS);
      }
    }
    const { x, y } = confine(at.x, at.y, this.box.width, this.box.height, screen.area);
    at.x = x;
    at.y = y;
    this.box.x = Math.round(x);
    this.box.y = Math.round(y);
    this.edge = 'bottom';
    if (arrived) this.anchorTo(screen);
    return roam.remaining !== null;
  }

  // Off on a walk: a random stretch either way, turning back at the ends of the floor; roaming
  // anywhere, a random stretch in a random direction, kept on the screen.
  private setOff(roam: Roam, t: Track): void {
    const distance = this.between(WANDER_STEP);
    roam.speed = this.between(WANDER_SPEED);
    if (roam.free) {
      const angle = this.random() * 2 * Math.PI;
      const { area, w, h } = t;
      const goal = {
        x: Math.min(Math.max(roam.free.x + Math.cos(angle) * distance, area.x), area.x + area.width - w),
        y: Math.min(Math.max(roam.free.y + Math.sin(angle) * distance, area.y), area.y + area.height - h),
      };
      roam.goal = goal;
      roam.heading = goal.x < roam.free.x ? -1 : 1;
      roam.remaining = Math.hypot(goal.x - roam.free.x, goal.y - roam.free.y);
      return;
    }
    roam.heading = this.random() < 0.5 ? -1 : 1;
    if (!t.floorOnly) {
      roam.remaining = distance;
      return;
    }
    const room = (heading: 1 | -1) => (heading > 0 ? t.lengths[0] - roam.spot.along : roam.spot.along);
    if (room(roam.heading) < 1) roam.heading = roam.heading > 0 ? -1 : 1;
    roam.remaining = Math.min(distance, room(roam.heading));
  }

  // Without gravity a crew let go of in mid-air drifts straight to the nearest edge before crawling.
  private approach(roam: Roam, t: Track, dt: number): boolean {
    const from = roam.approach;
    if (!from) return false;
    const near = nearest(t, from);
    const step = APPROACH_SPEED * dt;
    if (near.gap <= step) {
      roam.approach = undefined;
      roam.spot = spotAt(t, near.s);
      return true;
    }
    const dx = near.to.x - from.x;
    const dy = near.to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    from.x += (dx / length) * step;
    from.y += (dy / length) * step;
    this.box.x = Math.round(from.x);
    this.box.y = Math.round(from.y);
    return true;
  }

  private newRoam(spot: Spot, now: number): Roam {
    const speed = this.between(WANDER_SPEED);
    return { spot, remaining: null, heading: 1, speed, restUntil: now + this.between(WANDER_REST_MS), calm: true };
  }

  // Back upright where it is; `anchor`: stays there (else the hand or gravity takes over).
  private stopWandering(anchor: boolean): void {
    this.roam = null;
    this.edge = 'bottom';
    if (anchor) this.anchorTo(this.anchorScreen());
  }

  private between([min, max]: readonly [number, number]): number {
    return min + this.random() * (max - min);
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
    let next = clamp(Math.round(px), RANGES.size);
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
    const edge = this.edge;
    const pixels = this.turnedPixels(frame, edge);
    let id = this.frameIds.get(pixels);
    const fresh = id === undefined;
    if (id === undefined) {
      id = this.nextFrameId++;
      this.frameIds.set(pixels, id);
    }
    const upright = { x: sprite.x + sprite.tx, y: sprite.y, width: frame.w * sprite.px, height: frame.h * sprite.px };
    const at = edge === 'bottom' ? upright : turnRect(edge, this.box, upright);
    const size = turnedSize(edge, frame.w, frame.h);
    return {
      id,
      w: size.width,
      h: size.height,
      palette: sprite.palette,
      x: at.x,
      y: at.y,
      px: sprite.px,
      opacity: sprite.opacity,
      ...(fresh ? { pixels: [...pixels] } : {}),
    };
  }

  // Turned frames are kept like the frames themselves, so a turned frame keeps its id.
  private turnedPixels(frame: Frame, edge: Side): Uint8Array {
    if (edge === 'bottom') return frame.pixels;
    let byEdge = this.turned.get(frame.pixels);
    if (!byEdge) {
      byEdge = new Map();
      this.turned.set(frame.pixels, byEdge);
    }
    let pixels = byEdge.get(edge);
    if (!pixels) {
      pixels = turnPixels(frame.pixels, frame.w, frame.h, edge);
      byEdge.set(edge, pixels);
    }
    return pixels;
  }
}
