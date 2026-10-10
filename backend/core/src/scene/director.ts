import type { Agent, Session } from '../session/types.ts';
import { clipDuration } from './clips/clips.ts';
import {
  ANTIC_MS,
  ANTIC_ROUND_MS,
  ANTICS,
  AWAKE,
  BUMPS,
  CHAT_EVERY_MS,
  CHAT_STAGGER_MS,
  DEFAULT_TOOL_CLIP,
  LIVELY,
  LOOK_AROUND_AT,
  NEGLECT,
  OPENINGS,
  PATIENCE_MS,
  REACTION_CLIPS,
  STROLLERS,
  TOOL_CLIPS,
  YAWN_AT,
} from './constants/director.ts';
import { AGENT_LEAVE_MS, HANDOVER_AT, WALK_MS } from './constants/timing.ts';
import type { Behaviour, Clip, Cue, Reaction, Side } from './types.ts';

export function toolClip(tool: string | undefined): Clip {
  if (tool === undefined || !Object.hasOwn(TOOL_CLIPS, tool)) return DEFAULT_TOOL_CLIP;
  return TOOL_CLIPS[tool];
}

// The bubble a clip that calls for attention keeps up.
const bubbleOf = (clip: Clip): Cue['bubble'] => (clip === 'alert' ? 'bang' : clip === 'ask' ? 'question' : undefined);

function impatient(plain: Cue, since: number, now: number): Cue {
  const t = now - since - PATIENCE_MS;
  if (t < 0) return plain;
  const round = Math.floor(t / ANTIC_ROUND_MS);
  if (t - round * ANTIC_ROUND_MS >= ANTIC_MS) return plain;
  return {
    clip: ANTICS[round % ANTICS.length],
    startedAt: since + PATIENCE_MS + round * ANTIC_ROUND_MS,
    bubble: plain.clip === 'ask' ? 'question' : 'bang',
  };
}

// Left idle long enough, a sleeping mascot gathers cobwebs and worse; undefined while it is not that long.
function neglectCue(idleFor: number, since: number, now: number): Cue | undefined {
  const stage = [...NEGLECT].reverse().find(([at]) => idleFor >= at);
  if (!stage) return undefined;
  const [at, clip] = stage;
  const start = since + at;
  // The flower sprouts once, then keeps blooming.
  if (clip !== 'overgrown') return { clip, startedAt: start };
  const grown = start + clipDuration('sprout');
  return now < grown ? { clip: 'sprout', startedAt: start } : { clip: 'overgrown', startedAt: grown };
}

// What a session that has nothing to do plays, by how long it has been idle.
function idleCue(session: Session, now: number, behaviour: Behaviour): Cue {
  const idleFor = now - session.since;
  const opening = OPENINGS[session.mood];
  if (opening && idleFor < clipDuration(opening)) return { clip: opening, startedAt: session.since };
  const neglect = behaviour.neglect === false ? undefined : neglectCue(idleFor, session.since, now);
  if (neglect) return neglect;
  const yawnEnd = YAWN_AT + clipDuration('yawn');
  if (idleFor >= yawnEnd) return { clip: 'sleep', startedAt: session.since + yawnEnd };
  if (idleFor >= YAWN_AT) return { clip: 'yawn', startedAt: session.since + YAWN_AT };
  if (idleFor >= LOOK_AROUND_AT && idleFor < LOOK_AROUND_AT + clipDuration('lookAround')) {
    return { clip: 'lookAround', startedAt: session.since + LOOK_AROUND_AT };
  }
  return { clip: 'stand', startedAt: session.since };
}

// What the session's own mascot plays at `now`; the stage asks every tick.
export function director(session: Session, now: number, behaviour: Behaviour = {}): Cue {
  const fret = (plain: Cue): Cue => (behaviour.antics === false ? plain : impatient(plain, session.since, now));
  if (session.leavingAt !== undefined) return { clip: 'leave', startedAt: session.leavingAt };
  if (now - session.startedAt < WALK_MS) return { clip: 'enter', startedAt: session.startedAt };
  if (session.activity === 'waiting') return fret({ clip: 'alert', startedAt: session.since });
  if (session.activity === 'asking') return fret({ clip: 'ask', startedAt: session.since });
  if (session.activity === 'compacting') return { clip: 'compact', startedAt: session.since };
  const reactionClip = session.reaction && REACTION_CLIPS[session.reaction.kind];
  if (reactionClip && session.reaction && now - session.reaction.at < clipDuration(reactionClip)) {
    return { clip: reactionClip, startedAt: session.reaction.at };
  }
  if (session.activity === 'thinking') return { clip: 'work', startedAt: session.since };
  if (session.activity === 'working') return { clip: toolClip(session.tool), startedAt: session.since };
  if (session.activity === 'delegating') return { clip: 'fidget', startedAt: session.since };
  return idleCue(session, now, behaviour);
}

// A subagent's mini mascot: `waiting` when its permission dialog is open, `leftAt` once it finished.
export function agentCue(agent: Agent, now: number, waiting: boolean, leftAt?: number): Cue {
  if (leftAt !== undefined) return { clip: 'deliver', startedAt: leftAt };
  if (now - agent.startedAt < WALK_MS) return { clip: 'enter', startedAt: agent.startedAt };
  return waiting
    ? { clip: 'alert', startedAt: agent.seenAt }
    : { clip: toolClip(agent.tool), startedAt: agent.startedAt };
}

// A reaction plays over whatever the mascot was doing, then hands back; walking in or off wins.
// A dialog's bubble stays up over it, so a poke never hides that something waits for an answer.
export function react(cue: Cue, reaction: Reaction | undefined, now: number): Cue {
  if (!reaction || cue.clip === 'enter' || cue.clip === 'leave' || cue.clip === 'deliver') return cue;
  if (now - reaction.at >= clipDuration(reaction.clip)) return cue;
  const bubble = cue.bubble ?? bubbleOf(cue.clip);
  return { clip: reaction.clip, startedAt: reaction.at, ...(bubble && { bubble }) };
}

// While dragged across the screen the crew walks along; anything that shows a state of its own
// (a call for attention, sleep, cobwebs, bones, an antic, a reaction) carries on as it is.
export function walking(cue: Cue): Cue {
  return STROLLERS.has(cue.clip) ? { clip: 'walk', startedAt: 0 } : cue;
}

export const isLively = (cue: Cue): boolean => LIVELY.has(cue.clip);

export const bumpClip = (side: Side): Clip => BUMPS[side];

// Subagents take longer to go than sessions: they deliver their result on the way out.
export const agentHasLeft = (leftAt: number, now: number): boolean => now - leftAt >= AGENT_LEAVE_MS;

// The main mascot takes the scroll from a mini that is handing it over, unless it is asking for something.
export function receiving(cue: Cue, leftAt: readonly number[], now: number): Cue {
  if (cue.clip === 'alert' || cue.clip === 'ask' || cue.clip === 'enter' || cue.clip === 'leave') return cue;
  for (const left of leftAt) {
    const at = left + HANDOVER_AT;
    if (now >= at && now - at < clipDuration('receive')) return { clip: 'receive', startedAt: at };
  }
  return cue;
}

// Idle neighbours on screen now and then chat: every CHAT_EVERY_MS each adjacent pair that is idle,
// awake and alone gets an exchange, the left one opening and the right one, mirrored, replying.
// Both must already have been idle when the slot began, so nobody joins mid-sentence.
// The result follows `onScreen`, left to right.
export function socialCues(onScreen: readonly Session[], now: number): (Cue | undefined)[] {
  const cues: (Cue | undefined)[] = onScreen.map(() => undefined);
  const length = clipDuration('chatA');
  const free = (candidate: Session, at: number): boolean =>
    candidate.activity === 'idle' &&
    candidate.leavingAt === undefined &&
    candidate.since <= at &&
    candidate.agents.length === 0 &&
    AWAKE.has(director(candidate, at).clip) &&
    AWAKE.has(director(candidate, now).clip);
  for (let i = 0; i + 1 < onScreen.length; i++) {
    if (cues[i]) continue;
    const offset = (i * CHAT_STAGGER_MS) % CHAT_EVERY_MS;
    const at = Math.floor((now - offset) / CHAT_EVERY_MS) * CHAT_EVERY_MS + offset;
    if (now - at >= length || !free(onScreen[i], at) || !free(onScreen[i + 1], at)) continue;
    cues[i] = { clip: 'chatA', startedAt: at };
    cues[i + 1] = { clip: 'chatB', startedAt: at, mirror: true };
  }
  return cues;
}
