import type { Limits } from '../limits/types.ts';
import type { Settings } from '../settings/types.ts';

// A Claude Code hook event: only the fields Claudie reads; the daemon keeps the rest untouched.
export interface HookEvent {
  readonly hook_event_name: string;
  readonly session_id: string;
  readonly cwd?: string;
  readonly transcript_path?: string;
  readonly permission_mode?: string; // default, plan, acceptEdits, auto, bypassPermissions…
  readonly tool_name?: string;
  readonly tool_input?: { readonly command?: unknown };
  readonly is_interrupt?: unknown; // PostToolUseFailure: the user stopped the tool
  readonly notification_type?: string;
  readonly source?: string; // SessionStart: startup, resume, clear, compact or fork
  readonly reason?: string; // SessionEnd: clear, logout, prompt_input_exit…
  readonly agent_id?: string; // set when a subagent fired the hook
  readonly agent_type?: string; // empty for Claude Code's own helpers
}

// One received event as the daemon hands it over: the same shape as its event log lines.
export interface Envelope {
  readonly received: number; // ms since the epoch
  readonly pid?: number; // the session's process, known from SessionStart only
  readonly event: HookEvent;
}

export type TranscriptSignal = 'denied' | 'interrupted';

// What a line of the session's transcript says that hooks don't: denials, Esc, context use.
export interface TranscriptNote {
  readonly at: number; // ms since the epoch, from the line's timestamp
  readonly signal?: TranscriptSignal;
  readonly tokens?: number; // tokens in the context window as of this line
}

// What the session is doing now.
export type Activity =
  | 'idle' // waiting for the user's next prompt
  | 'thinking' // in a turn, no tool running
  | 'working' // a tool is running
  | 'waiting' // a permission dialog is open
  | 'asking' // a question to the user is open
  | 'compacting' // squeezing the conversation
  | 'delegating'; // subagents do the work while the main thread waits

// How the last turn ended; set when the session goes idle.
export type Mood = 'none' | 'done' | 'error' | 'interrupted' | 'denied';

// A one-off flourish on how something turned out, played once over whatever goes on.
export type ReactionKind = 'shipped' | 'testsFailed' | 'refreshed';

export interface Reaction {
  readonly kind: ReactionKind;
  readonly at: number;
}

// What an open dialog or a compaction interrupted, to go back to afterwards.
export interface Resume {
  readonly activity: Activity;
  readonly mood: Mood;
  readonly tool?: string;
}

// A running subagent.
export interface Agent {
  readonly id: string;
  readonly type: string;
  readonly tool?: string; // in use right now
  readonly startedAt: number;
  readonly seenAt: number;
}

export interface Session {
  readonly id: string;
  readonly pid?: number;
  readonly cwd: string;
  readonly project: string;
  readonly transcriptPath?: string;
  readonly mode?: string; // the permission mode, as of the main thread's latest event
  readonly activity: Activity;
  readonly mood: Mood;
  readonly tool?: string; // in use while working, or the one a dialog is about
  readonly agents: readonly Agent[];
  readonly reaction?: Reaction;
  readonly contextTokens?: number;
  readonly resume?: Resume;
  readonly waiter?: string; // the subagent whose permission dialog is open
  readonly startedAt: number;
  readonly since: number; // when activity or mood last changed: animations count from it
  readonly seenAt: number;
  readonly leavingAt?: number;
}

// A transcript the daemon should tail, and whose it is.
export interface TranscriptRef {
  readonly id: string;
  readonly path: string;
}

// What the overlay gets: the daemon's clock, so animations line up, every session, the settings and
// the usage limits once a status line has reported them.
export interface Snapshot {
  readonly now: number;
  readonly sessions: readonly Session[];
  readonly settings: Settings;
  readonly limits?: Limits;
}
