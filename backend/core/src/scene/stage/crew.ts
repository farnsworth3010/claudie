import type { Session } from '../../session/types.ts';
import { BADGE_CLEARANCE, SLOT_COUNT } from '../constants/crew.ts';
import { GRID_H, GRID_W } from '../constants/grid.ts';
import { PLAN_MODE_SKIN } from '../constants/look.ts';
import { CONTEXT_WINDOW, MAIN_KEY, MAX_TICK_MS, MIN_CREW_PX, MIN_MINI_PX } from '../constants/stage.ts';
import { assignSlots, crewLayout, deliveryOffset, facesLeft, glide, slotOffset } from '../crew-layout.ts';
import {
  agentCue,
  agentHasLeft,
  bumpClip,
  director,
  holdTool,
  isLively,
  react,
  receiving,
  strolls,
  walking,
} from '../director.ts';
import { badgeFrame } from '../draw/badge.ts';
import { frameAt } from '../frames.ts';
import { lookPalette, lookScale, sickness, skinPalette } from '../look.ts';
import { skinFor } from '../skins.ts';
import type {
  Box,
  CrewDrawContext,
  Cue,
  Inset,
  Look,
  Mini,
  Point,
  Reaction,
  Rect,
  Side,
  SkinId,
  ToolHold,
} from '../types.ts';
import { Sprite } from './sprite.ts';

const strolling = (cue: Cue, moving: boolean, heading: 1 | -1): Cue => (moving ? walking(cue, heading) : cue);

// A session's Clawd with a mini Clawd for each running subagent around it.
export class Crew {
  session: Session;
  readonly look: Look;
  readonly main = new Sprite();
  private readonly badge = new Sprite(); // "+N" for the subagents with no slot left
  private hidden = 0;
  private miniPx = MIN_MINI_PX;
  private miniScale = 0.5; // miniPx over px
  private readonly minis = new Map<string, Mini>(); // in arrival order
  private readonly miniSprites = new Map<string, Sprite>();
  private slots = new Map<string, number>();
  private readonly reactions = new Map<string, Reaction>();
  private readonly holds = new Map<string, ToolHold>(); // by sprite key, like the reactions
  private box: Box | null = null; // gliding, in main grid pixels
  private lastTick = 0;
  private shown: Mini[] = [];
  px = 0;
  width = 0;
  height = 0;
  x = 0;
  y = 0;
  inset: Inset = { left: 0, right: 0 }; // points the crew may overhang a screen edge
  animating = false;
  strollable = false; // as of the last tick, the main mascot could walk along without dropping what it shows

  constructor(session: Session, look: Look) {
    this.session = session;
    this.look = look;
  }

  // Sizes the crew for this tick; placed and drawn by draw() once the stage knows where it goes.
  // `miniSize`: the minis' share of the main mascot's size, as set.
  layout(now: number, basePx: number, miniSize: number): void {
    const dt = this.lastTick ? Math.min(now - this.lastTick, MAX_TICK_MS) : 0;
    this.lastTick = now;
    this.px = Math.max(MIN_CREW_PX, Math.round(basePx * lookScale(this.look)));
    // Never bigger than set; the slots follow the size the rounding gives.
    this.miniPx = Math.max(MIN_MINI_PX, Math.floor(this.px * miniSize));
    this.miniScale = this.miniPx / this.px;
    this.syncMinis(now);
    this.glideBox(dt);
  }

  draw(context: CrewDrawContext): void {
    const { origin } = context;
    this.x = origin.x;
    this.y = origin.y;
    const sick = sickness((this.session.contextTokens ?? 0) / CONTEXT_WINDOW);
    this.drawMain(context, sick);
    this.drawMinis(context);
    this.drawBadge(context);
  }

  // Back to front: resting minis, a mini walking its result over, the main mascot.
  get sprites(): Sprite[] {
    const minis = [...this.miniSprites.values()];
    const badge = this.hidden ? [this.badge] : [];
    return [
      ...minis.filter((mini) => !mini.delivering),
      ...minis.filter((mini) => mini.delivering),
      this.main,
      ...badge,
    ];
  }

  hit(x: number, y: number): boolean {
    return this.sprites.some((sprite) => sprite.hit(x, y));
  }

  // Pokes whichever Clawd is drawn under the point; false when it hit empty space.
  poke(x: number, y: number, now: number): boolean {
    const key = this.main.hit(x, y) ? MAIN_KEY : [...this.miniSprites].find(([, sprite]) => sprite.hit(x, y))?.[0];
    if (key === undefined) return false;
    this.reactions.set(key, { clip: 'poke', at: now });
    return true;
  }

  // Floor and ceiling stop the whole crew; a side wall only those whose body is right at it.
  bump(side: Side, now: number, bounds: Rect): void {
    const reaction = { clip: bumpClip(side), at: now };
    for (const [key, sprite] of [[MAIN_KEY, this.main] as const, ...this.miniSprites]) {
      if (side === 'top' || side === 'bottom' || sprite.touches(side, bounds)) this.reactions.set(key, reaction);
    }
  }

  // Follows the session's agents: new ones appear, finished ones stay a moment to hand their result over.
  private syncMinis(now: number): void {
    const { agents } = this.session;
    const here = new Set(agents.map((agent) => agent.id));
    for (const [id, mini] of this.minis) {
      if (!here.has(id) && mini.leftAt === undefined) mini.leftAt = now;
      if (mini.leftAt !== undefined && agentHasLeft(mini.leftAt, now)) this.minis.delete(id);
    }
    for (const agent of agents) {
      const mini = this.minis.get(agent.id);
      if (mini) mini.agent = agent;
      else this.minis.set(agent.id, { agent, skin: skinFor(agent.type) });
    }
    this.slots = assignSlots(this.slots, [...this.minis.keys()]);
    this.shown = [...this.minis.values()].filter((mini) => this.slots.has(mini.agent.id));
    this.hidden = [...this.minis.values()].filter((m) => !this.slots.has(m.agent.id) && m.leftAt === undefined).length;
    for (const id of this.miniSprites.keys()) {
      if (this.slots.has(id)) continue;
      this.miniSprites.delete(id);
      this.reactions.delete(id);
      this.holds.delete(id);
    }
    for (const mini of this.shown) {
      if (!this.miniSprites.has(mini.agent.id)) this.miniSprites.set(mini.agent.id, new Sprite());
    }
  }

  // The box and the main mascot slide to their new place; minis ride along in fixed slots.
  private glideBox(dt: number): void {
    const target = crewLayout(
      this.shown.map((mini) => this.slot(mini)),
      this.miniScale,
    );
    const from = this.box ?? { width: target.width, height: target.height, x: target.main.x, y: target.main.y };
    this.box = {
      width: glide(from.width, target.width, dt),
      height: glide(from.height, target.height, dt),
      x: glide(from.x, target.main.x, dt),
      y: glide(from.y, target.main.y, dt),
    };
    const { width, height, x, y } = this.box;
    this.animating = width !== target.width || height !== target.height || x !== target.main.x || y !== target.main.y;
    this.inset = { left: target.inset.left * this.px, right: target.inset.right * this.px };
    this.width = Math.round(width * this.px);
    this.height = Math.round(height * this.px);
  }

  private drawMain(
    { origin, now, pointer, bounds, moving, heading, social, behaviour }: CrewDrawContext,
    sick: number,
  ): void {
    const { x, y } = this.box ?? { x: 0, y: 0 };
    const skin: SkinId | undefined = this.session.mode === 'plan' ? PLAN_MODE_SKIN : undefined;
    const palette = skin ? skinPalette(skin, sick) : lookPalette(this.look, sick);
    this.main.place(origin.x + Math.round(x * this.px), origin.y + Math.round(y * this.px), this.px, palette);
    const leftAt = this.shown.flatMap((mini) => (mini.leftAt === undefined ? [] : [mini.leftAt]));
    const pace = behaviour.pace ?? 1;
    const base = this.held(
      MAIN_KEY,
      receiving(social ?? director(this.session, now, behaviour), leftAt, now, pace),
      now,
    );
    this.strollable = strolls(base);
    const cue = react(strolling(base, moving, heading), this.reactions.get(MAIN_KEY), now, pace);
    this.animating ||= isLively(cue);
    this.main.show(
      frameAt(cue.clip, now - cue.startedAt, {
        sick,
        skin,
        gaze: this.main.gazeAt(pointer),
        bubble: cue.bubble,
        mirror: cue.mirror,
        pace,
      }),
      bounds,
    );
  }

  private drawMinis({ origin, now, pointer, bounds, moving, heading, behaviour }: CrewDrawContext): void {
    const pace = behaviour.pace ?? 1;
    const { x, y } = this.box ?? { x: 0, y: 0 };
    const { miniPx, miniScale } = this;
    for (const mini of this.shown) {
      const id = mini.agent.id;
      const sprite = this.miniSprites.get(id);
      if (!sprite) continue;
      const slot = this.slot(mini);
      const base = this.held(id, agentCue(mini.agent, now, this.session.waiter === id, mini.leftAt), now);
      const cue = react(strolling(base, moving, heading), this.reactions.get(id), now, pace);
      sprite.delivering = cue.clip === 'deliver';
      const offset = slotOffset(slot, miniScale);
      const taken = this.shown.map((other) => this.slot(other)).filter((otherSlot) => otherSlot !== slot);
      const walk: Point = sprite.delivering
        ? deliveryOffset(slot, now - cue.startedAt, miniScale, taken)
        : { x: 0, y: 0 };
      sprite.place(
        origin.x + Math.round((x + offset.x + walk.x) * this.px),
        origin.y + Math.round((y + offset.y + walk.y) * this.px),
        miniPx,
        skinPalette(mini.skin),
      );
      this.animating ||= isLively(cue);
      const mirror = sprite.delivering ? facesLeft(slot) : cue.mirror;
      sprite.show(
        frameAt(cue.clip, now - cue.startedAt, {
          skin: mini.skin,
          gaze: sprite.gazeAt(pointer),
          bubble: cue.bubble,
          mirror,
          pace,
        }),
        bounds,
      );
    }
  }

  // Over the outermost mini, the last slot to fill, so it reads as "and N more like these"; minis'
  // bodies fill the lower half of their grid, and a skin's hat rises up to BADGE_CLEARANCE above it.
  private drawBadge({ origin }: CrewDrawContext): void {
    if (!this.hidden) return;
    const frame = badgeFrame(this.hidden);
    const px = this.miniPx;
    const main = this.box ?? { x: 0, y: 0 };
    const last = slotOffset(SLOT_COUNT - 1, this.miniScale);
    const x = origin.x + Math.round((main.x + last.x + (GRID_W * this.miniScale) / 2) * this.px - (frame.w * px) / 2);
    const y =
      origin.y +
      Math.round((main.y + last.y + (GRID_H * this.miniScale) / 2) * this.px) -
      (frame.h + BADGE_CLEARANCE) * px;
    this.badge.place(x, y, px, this.main.palette.split(','));
    this.badge.show(frame, undefined);
  }

  // A quick tool's clip, kept up a moment after the tool is done.
  private held(key: string, cue: Cue, now: number): Cue {
    const { cue: shown, hold } = holdTool(cue, this.holds.get(key), now);
    if (hold) this.holds.set(key, hold);
    else this.holds.delete(key);
    return shown;
  }

  private slot(mini: Mini): number {
    return this.slots.get(mini.agent.id) ?? 0;
  }
}
