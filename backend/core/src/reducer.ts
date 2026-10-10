import { projectName } from './project.ts';
import type { Activity, Envelope, HookEvent, Mood, ReactionKind, Session, TranscriptNote } from './types.ts';

// Tools whose permission dialog is really a question for the user.
const QUESTION_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode']);
// Tools that hand the work to a subagent.
const AGENT_TOOLS = new Set(['Agent', 'Task']);
// `git [-C dir] commit|push`, anywhere in a compound command.
const GIT_SHIPPED = /(?:^|[\s;&|(])git(?:\s+-\S+(?:\s+[^\s-]\S*)?)*\s+(?:commit|push)\b/;
const TEST_RUN = new RegExp(
  [
    String.raw`(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test\b`,
    String.raw`node\s+--test\b`,
    String.raw`(?:jest|vitest|mocha|ava)\b`,
    String.raw`playwright\s+test\b`,
    String.raw`py\.?test\b`,
    String.raw`python3?\s+-m\s+(?:pytest|unittest)\b`,
    String.raw`cargo\s+(?:test|nextest)\b`,
    String.raw`go\s+test\b`,
    String.raw`make\s+(?:test|check)\b`,
    String.raw`(?:\.\/)?gradlew?\s+test\b`,
    String.raw`mvn\s+(?:test|verify)\b`,
    String.raw`dotnet\s+test\b`,
    String.raw`(?:rspec|phpunit|ctest)\b`,
    String.raw`(?:deno|mix|swift)\s+test\b`,
  ]
    .map((alt) => String.raw`(?:^|[\s;&|(])` + alt)
    .join('|'),
);

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
    case 'PostToolUseFailure':
      return react(to(s, 'thinking', at), reactionTo(event), at);
    case 'Notification':
      return notified(s, event.notification_type, at);
    case 'PreCompact':
      return { ...to(s, 'compacting', at), resume: s.activity === 'compacting' ? s.resume : s.activity };
    case 'PostCompact':
      return react(back(s, at), 'refreshed', at);
    case 'Stop':
      return ended(s, 'done', at);
    case 'StopFailure':
      return ended(s, 'error', at);
    case 'SessionEnd':
      return { ...s, leavingAt: at };
    default:
      return s;
  }
}

// The session after a line of its transcript: the only trace of a denied permission or of Esc.
export function noteTranscript(session: Session | undefined, note: TranscriptNote): Session | undefined {
  if (!session || session.leavingAt !== undefined) return session;
  const s = note.tokens === undefined ? session : { ...session, contextTokens: note.tokens };
  // Hooks already moved past it, e.g. a line read again after a restart.
  if (note.at < s.since) return s;
  switch (note.signal) {
    case 'denied':
      return s.activity === 'idle' ? s : ended(s, 'denied', note.at);
    case 'interrupted':
      // A denial ends the turn with an interruption line of its own right after.
      return s.activity === 'idle' || s.activity === 'delegating' ? s : ended(s, 'interrupted', note.at);
    default:
      return s;
  }
}

// Subagent events: track who runs, and pass their permission dialogs on to the main mascot.
function fromAgent(s: Session, event: HookEvent, at: number): Session {
  const id = event.agent_id ?? '';
  const name = event.hook_event_name;
  const known = s.agents.some((a) => a.id === id);

  if (name === 'SubagentStop') {
    // Claude Code's own helpers stop after every turn without ever starting; nothing to do.
    if (!known) return s;
    const left = { ...s, agents: s.agents.filter((a) => a.id !== id) };
    if (s.waiter === id) return back(left, at);
    return s.activity === 'delegating' && !s.tool && !left.agents.length ? to(left, 'idle', at) : left;
  }

  const t =
    known || !event.agent_type ? s : { ...s, agents: [...s.agents, { id, type: event.agent_type, startedAt: at }] };
  if (name === 'PermissionRequest') return { ...dialog(t, event, at), waiter: id };
  // The waiting subagent moving on means its dialog was answered; a denial sends no hook of its own.
  const movedOn =
    name === 'PostToolUse' || name === 'PostToolUseFailure' || (name === 'PreToolUse' && event.tool_name !== t.tool);
  if (t.waiter === id && movedOn) return back(t, at);
  return t.activity === 'idle' && t.agents.length ? to(t, 'delegating', at) : t;
}

function dialog(s: Session, event: HookEvent, at: number): Session {
  const blocked = s.activity === 'waiting' || s.activity === 'asking';
  const activity = QUESTION_TOOLS.has(event.tool_name ?? '') ? 'asking' : 'waiting';
  return { ...to(s, activity, at, 'none', event.tool_name), resume: blocked ? s.resume : s.activity };
}

function notified(s: Session, type: string | undefined, at: number): Session {
  switch (type) {
    case 'permission_prompt':
      return s.activity === 'waiting' || s.activity === 'asking' ? s : to(s, 'waiting', at, 'none', s.tool);
    case 'elicitation_dialog':
    case 'elicitation_url_dialog':
      return to(s, 'asking', at);
    case 'idle_prompt':
      return s.activity === 'idle' || s.activity === 'delegating' ? s : to(s, 'idle', at);
    default:
      return s;
  }
}

// The turn is over; subagents still running keep it going.
function ended(s: Session, mood: Mood, at: number): Session {
  return s.agents.length ? to(s, 'delegating', at) : to(s, 'idle', at, mood);
}

// Back to what an answered dialog or a finished compaction interrupted. Between turns that is
// idle or delegating, whichever fits the subagents still running now.
function back(s: Session, at: number): Session {
  const resume = s.resume ?? 'thinking';
  if (resume !== 'idle' && resume !== 'delegating') return to(s, resume, at);
  return to(s, s.agents.length ? 'delegating' : 'idle', at);
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

function react(s: Session, kind: ReactionKind | undefined, at: number): Session {
  return kind ? { ...s, reaction: { kind, at } } : s;
}

// `since` moves only on a real change, so an animation isn't restarted by every tool call.
// Any move ends an open dialog or compaction; callers that open one set it again.
function to(s: Session, activity: Activity, at: number, mood: Mood = 'none', tool?: string): Session {
  const next = { ...s, tool, resume: undefined, waiter: undefined };
  return s.activity === activity && s.mood === mood ? next : { ...next, activity, mood, since: at };
}

function create(event: HookEvent, at: number): Session {
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
