import type { Session } from '../../session/types.ts';
import { MINI_SCALE } from '../constants/crew.ts';
import { PLAN_MODE_SKIN } from '../constants/look.ts';
import { CONTEXT_WINDOW, MAIN_KEY, MAX_TICK_MS, MIN_CREW_PX, MIN_MINI_PX } from '../constants/stage.ts';
import { assignSlots, crewLayout, deliveryOffset, facesLeft, glide, slotOffset } from '../crew-layout.ts';
import { agentCue, agentHasLeft, bumpClip, director, isLively, react, receiving, walking } from '../director.ts';
import { frameAt } from '../frames.ts';
import { lookPalette, lookScale, sickness, skinPalette } from '../look.ts';
import { skinFor } from '../skins.ts';
import type { Box, CrewDrawContext, Cue, Inset, Look, Mini, Point, Reaction, Rect, Side, SkinId } from '../types.ts';
import { Sprite } from './sprite.ts';

const strolling = (cue: Cue, moving: boolean): Cue => (moving ? walking(cue) : cue);

// A session's Clawd with a mini Clawd for each running subagent around it.
export class Crew {
  session: Session;
  readonly look: Look;
  readonly main = new Sprite();
  private readonly minis = new Map<string, Mini>(); // in arrival order
  private readonly miniSprites = new Map<string, Sprite>();
  private slots = new Map<string, number>();
  private readonly reactions = new Map<string, Reaction>();
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

  constructor(session: Session, look: Look) {
    this.session = session;
    this.look = look;
  }

  // Sizes the crew for this tick; placed and drawn by draw() once the stage knows where it goes.
  layout(now: number, basePx: number): void {
    const dt = this.lastTick ? Math.min(now - this.lastTick, MAX_TICK_MS) : 0;
    this.lastTick = now;
    this.px = Math.max(MIN_CREW_PX, Math.round(basePx * lookScale(this.look)));
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
  }

  // Back to front: resting minis, a mini walking its result over, the main mascot.
  get sprites(): Sprite[] {
    const minis = [...this.miniSprites.values()];
    return [...minis.filter((mini) => !mini.delivering), ...minis.filter((mini) => mini.delivering), this.main];
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
    for (const id of this.miniSprites.keys()) {
      if (this.slots.has(id)) continue;
      this.miniSprites.delete(id);
      this.reactions.delete(id);
    }
    for (const mini of this.shown) {
      if (!this.miniSprites.has(mini.agent.id)) this.miniSprites.set(mini.agent.id, new Sprite());
    }
  }

  // The box and the main mascot slide to their new place; minis ride along in fixed slots.
  private glideBox(dt: number): void {
    const target = crewLayout(this.shown.map((mini) => this.slot(mini)));
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

  private drawMain({ origin, now, pointer, bounds, moving, social, behaviour }: CrewDrawContext, sick: number): void {
    const { x, y } = this.box ?? { x: 0, y: 0 };
    const skin: SkinId | undefined = this.session.mode === 'plan' ? PLAN_MODE_SKIN : undefined;
    const palette = skin ? skinPalette(skin, sick) : lookPalette(this.look, sick);
    this.main.place(origin.x + Math.round(x * this.px), origin.y + Math.round(y * this.px), this.px, palette);
    const leftAt = this.shown.flatMap((mini) => (mini.leftAt === undefined ? [] : [mini.leftAt]));
    const cue = react(
      strolling(receiving(social ?? director(this.session, now, behaviour), leftAt, now), moving),
      this.reactions.get(MAIN_KEY),
      now,
    );
    this.animating ||= isLively(cue);
    this.main.show(
      frameAt(cue.clip, now - cue.startedAt, {
        sick,
        skin,
        gaze: this.main.gazeAt(pointer),
        bubble: cue.bubble,
        mirror: cue.mirror,
      }),
      bounds,
    );
  }

  private drawMinis({ origin, now, pointer, bounds, moving }: CrewDrawContext): void {
    const { x, y } = this.box ?? { x: 0, y: 0 };
    const miniPx = Math.max(MIN_MINI_PX, Math.round(this.px * MINI_SCALE));
    for (const mini of this.shown) {
      const id = mini.agent.id;
      const sprite = this.miniSprites.get(id);
      if (!sprite) continue;
      const slot = this.slot(mini);
      const cue = react(
        strolling(agentCue(mini.agent, now, this.session.waiter === id, mini.leftAt), moving),
        this.reactions.get(id),
        now,
      );
      sprite.delivering = cue.clip === 'deliver';
      const offset = slotOffset(slot);
      const taken = this.shown.map((other) => this.slot(other)).filter((otherSlot) => otherSlot !== slot);
      const walk: Point = sprite.delivering ? deliveryOffset(slot, now - cue.startedAt, taken) : { x: 0, y: 0 };
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
        }),
        bounds,
      );
    }
  }

  private slot(mini: Mini): number {
    return this.slots.get(mini.agent.id) ?? 0;
  }
}
