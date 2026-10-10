import { AGENT_TOOLS, GIT_SHIPPED, QUESTION_TOOLS, TEST_RUN } from './constants.ts';
import { projectName } from './project.ts';
import {
  back,
  behind,
  create,
  deferred,
  ended,
  interrupted,
  isBlocked,
  paused,
  to,
  touched,
  withoutAgent,
  withReaction,
} from './transitions.ts';
import type { Envelope, HookEvent, ReactionKind, Session, TranscriptNote } from './types.ts';

// The session after one more hook event; undefined when there is no session to show.
export function reduce(session: Session | undefined, envelope: Envelope): Session | undefined {
  const { received: at, pid, event } = envelope;
  const name = event.hook_event_name;
  if (session?.leavingAt !== undefined) return session;
  if (!session && name === 'SessionEnd') return undefined;

  let s: Session = { ...(session ?? create(event, at)), ...(pid ? { pid } : {}), seenAt: at };
  // An event's cwd follows every `cd` of the session's shell; the project is where the session started.
  if (name === 'SessionStart' && event.cwd) s = { ...s, cwd: event.cwd, project: projectName(event.cwd) };
  if (event.agent_id) return fromAgent(s, event, at);
  if (event.transcript_path) s = { ...s, transcriptPath: event.transcript_path };
  if (event.permission_mode) s = { ...s, mode: event.permission_mode };
  if (!isBlocked(s) || closesDialog(s, event)) return mainEvent(s, event, at);
  // A late PreToolUse of the very tool the dialog is about.
  if (name === 'PreToolUse' && !s.waiter && event.tool_name === s.tool) return s;
  // A parallel tool, or the turn going on while a subagent asks: the dialog stays open.
  return CARRY_ON.has(name) ? deferred(s, mainEvent(behind(s), event, at)) : mainEvent(s, event, at);
}

// Main-thread events that go on behind an open dialog without answering it.
const CARRY_ON: ReadonlySet<string> = new Set([
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'Stop',
  'StopFailure',
]);

// Whether a main-thread event is the outcome of the open dialog: its own tool finishing, or the turn
// ending. A subagent's dialog is answered only by that subagent.
function closesDialog(s: Session, event: HookEvent): boolean {
  if (s.waiter) return false;
  const name = event.hook_event_name;
  if (name === 'Stop' || name === 'StopFailure') return true;
  return (name === 'PostToolUse' || name === 'PostToolUseFailure') && event.tool_name === s.tool;
}

function mainEvent(s: Session, event: HookEvent, at: number): Session {
  const name = event.hook_event_name;
  switch (name) {
    case 'SessionStart':
      // Compaction restarts the session in the middle of things; PostCompact ends it.
      return event.source === 'compact' ? s : to(s, 'idle', at);
    case 'UserPromptSubmit':
      return to(s, 'thinking', at);
    case 'PreToolUse':
      return to(s, AGENT_TOOLS.has(event.tool_name ?? '') ? 'delegating' : 'working', at, 'none', event.tool_name);
    case 'PermissionRequest':
      return dialog(s, event, at);
    case 'PostToolUse':
      return withReaction(to(s, 'thinking', at), reactionTo(event), at);
    case 'PostToolUseFailure':
      if (event.is_interrupt === true) return interrupted(s, at);
      return withReaction(to(s, 'thinking', at), reactionTo(event), at);
    case 'Notification':
      return notified(s, event.notification_type, at);
    case 'PreCompact':
      return { ...to(s, 'compacting', at), resume: s.activity === 'compacting' ? s.resume : paused(s) };
    case 'PostCompact':
      return withReaction(back(s, at), 'refreshed', at);
    case 'Stop':
      return ended(s, 'done', at);
    case 'StopFailure':
      return ended(s, 'error', at);
    case 'SessionEnd':
      // /clear starts a new session in the same process right away; its mascot stays (see Sessions).
      return event.reason === 'clear' && s.pid ? to(s, 'idle', at) : { ...s, leavingAt: at };
    default:
      return s;
  }
}

// The session after a line of its transcript: the only trace of a denied permission or of Esc.
export function noteTranscript(session: Session | undefined, note: TranscriptNote): Session | undefined {
  if (!session || session.leavingAt !== undefined) return session;
  // Any line is a sign of life: long thinking or streaming isn't silence.
  let s = { ...session, seenAt: Math.max(session.seenAt, note.at) };
  if (note.tokens !== undefined) s = { ...s, contextTokens: note.tokens };
  // Hooks already moved past it, e.g. a line read again after a restart.
  if (note.at < s.since) return s;
  switch (note.signal) {
    case 'denied':
      return s.activity === 'idle' ? s : ended(s, 'denied', note.at);
    case 'interrupted':
      // A denial ends the turn with an interruption line of its own right after; background
      // subagents carry on.
      if (s.activity === 'idle' || (s.activity === 'delegating' && !s.tool)) return s;
      return interrupted(s, note.at);
    default:
      return s;
  }
}

// Subagent events: track who runs, and pass their permission dialogs on to the main mascot.
function fromAgent(s: Session, event: HookEvent, at: number): Session {
  const id = event.agent_id ?? '';
  const name = event.hook_event_name;
  const known = s.agents.some((a) => a.id === id);

  // Claude Code's own helpers stop after every turn without ever starting; nothing to do.
  if (name === 'SubagentStop') return known ? withoutAgent(s, id, at) : s;

  let t = s;
  if (known) {
    t = { ...s, agents: s.agents.map((a) => (a.id === id ? touched(a, event, at) : a)) };
  } else if (event.agent_type) {
    const agent = touched({ id, type: event.agent_type, startedAt: at, seenAt: at }, event, at);
    t = { ...s, agents: [...s.agents, agent] };
  }
  if (name === 'PermissionRequest') return { ...dialog(t, event, at), waiter: id };
  // The waiting subagent moving on means its dialog was answered; a denial sends no hook of its own.
  const movedOn =
    name === 'PostToolUse' || name === 'PostToolUseFailure' || (name === 'PreToolUse' && event.tool_name !== t.tool);
  if (t.waiter === id && movedOn) return back(t, at);
  return t.activity === 'idle' && t.agents.length ? to(t, 'delegating', at) : t;
}

function dialog(s: Session, event: HookEvent, at: number): Session {
  const activity = QUESTION_TOOLS.has(event.tool_name ?? '') ? 'asking' : 'waiting';
  return { ...to(s, activity, at, 'none', event.tool_name), resume: isBlocked(s) ? s.resume : paused(s) };
}

function notified(s: Session, type: string | undefined, at: number): Session {
  switch (type) {
    case 'permission_prompt':
      return isBlocked(s) ? s : to(s, 'waiting', at, 'none', s.tool);
    case 'elicitation_dialog':
    case 'elicitation_url_dialog':
      return to(s, 'asking', at);
    case 'idle_prompt':
      return s.activity === 'idle' || s.activity === 'delegating' ? s : to(s, 'idle', at);
    default:
      return s;
  }
}

// Only the main thread's own Bash calls count; a failed Bash arrives as PostToolUseFailure.
function reactionTo(event: HookEvent): ReactionKind | undefined {
  if (event.tool_name !== 'Bash') return undefined;
  const command = typeof event.tool_input?.command === 'string' ? event.tool_input.command : '';
  if (event.hook_event_name === 'PostToolUse' && GIT_SHIPPED.test(command)) return 'shipped';
  if (event.hook_event_name === 'PostToolUseFailure' && event.is_interrupt !== true && TEST_RUN.test(command)) {
    return 'testsFailed';
  }
  return undefined;
}
