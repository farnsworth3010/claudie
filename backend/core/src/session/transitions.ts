import { AGENT_TOOLS } from './constants.ts';
import { projectName } from './project.ts';
import type { Activity, Agent, HookEvent, Mood, ReactionKind, Resume, Session } from './types.ts';

// The building blocks of every state change; reducer.ts and aging.ts put them together.

export function create(event: HookEvent, at: number): Session {
  const cwd = event.cwd ?? '';
  return {
    id: event.session_id,
    cwd,
    project: projectName(cwd),
    activity: 'idle',
    mood: 'none',
    agents: [],
    startedAt: at,
    since: at,
    seenAt: at,
  };
}

// `since` moves only on a real change, so an animation isn't restarted by every tool call.
// Any move ends an open dialog or compaction; callers that open one set it again.
export function to(s: Session, activity: Activity, at: number, mood: Mood = 'none', tool?: string): Session {
  const next = { ...s, tool, resume: undefined, waiter: undefined };
  return s.activity === activity && s.mood === mood ? next : { ...next, activity, mood, since: at };
}

export const isBlocked = (s: Session): boolean => s.activity === 'waiting' || s.activity === 'asking';

// The turn is over; subagents still running keep it going.
export function ended(s: Session, mood: Mood, at: number): Session {
  return s.agents.length ? to(s, 'delegating', at) : to(s, 'idle', at, mood);
}

// What the session is doing, to come back to once a dialog or a compaction is over.
export const paused = (s: Session): Resume => ({ activity: s.activity, mood: s.mood, tool: s.tool });

// Back to what an answered dialog or a finished compaction interrupted. Between turns that is
// idle or delegating, whichever fits the subagents still running now.
export function back(s: Session, at: number): Session {
  const resume = s.resume ?? { activity: 'thinking', mood: 'none' };
  if (resume.activity !== 'idle' && resume.activity !== 'delegating') {
    return to(s, resume.activity, at, resume.mood, resume.tool);
  }
  return s.agents.length ? to(s, 'delegating', at) : to(s, 'idle', at, resume.mood);
}

// The session as it would be without its open dialog: what main-thread events carry on from.
export const behind = (s: Session): Session => ({
  ...s,
  ...(s.resume ?? paused(s)),
  resume: undefined,
  waiter: undefined,
});

// The dialog stays open; what happened meanwhile becomes what it returns to.
export const deferred = (s: Session, meanwhile: Session): Session => ({
  ...s,
  agents: meanwhile.agents,
  reaction: meanwhile.reaction,
  resume: paused(meanwhile),
});

// Esc or a stopped tool ends the turn. Subagents of a foreground Agent call die with it; background
// ones that still run come back with their next event.
export function interrupted(s: Session, at: number): Session {
  const foreground = s.activity === 'delegating' && AGENT_TOOLS.has(s.tool ?? '');
  return ended(foreground ? { ...s, agents: [] } : s, 'interrupted', at);
}

export function withReaction(s: Session, kind: ReactionKind | undefined, at: number): Session {
  return kind ? { ...s, reaction: { kind, at } } : s;
}

// A subagent's own event: what it holds now and when it was last heard of.
export function touched(agent: Agent, event: HookEvent, at: number): Agent {
  switch (event.hook_event_name) {
    case 'PreToolUse':
      return { ...agent, tool: event.tool_name, seenAt: at };
    case 'PostToolUse':
    case 'PostToolUseFailure':
      return { ...agent, tool: undefined, seenAt: at };
    default:
      return { ...agent, seenAt: at };
  }
}

// A subagent is done, or presumed gone: a dialog it held is over, and the last one out ends the delegation.
export function withoutAgent(s: Session, id: string, at: number): Session {
  const left = { ...s, agents: s.agents.filter((a) => a.id !== id) };
  if (s.waiter === id) return back(left, at);
  return s.activity === 'delegating' && !s.tool && !left.agents.length ? to(left, 'idle', at) : left;
}
