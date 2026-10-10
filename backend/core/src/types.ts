// A Claude Code hook event: only the fields Claudie reads; the daemon keeps the rest untouched.
export interface HookEvent {
  hook_event_name: string;
  session_id: string;
  cwd?: string;
  transcript_path?: string;
  permission_mode?: string; // default, plan, acceptEdits, auto, bypassPermissions…
  tool_name?: string;
  tool_input?: { command?: unknown };
  is_interrupt?: unknown; // PostToolUseFailure: the user stopped the tool
  notification_type?: string;
  source?: string; // SessionStart: startup, resume, clear, compact or fork
  agent_id?: string; // set when a subagent fired the hook
  agent_type?: string; // empty for Claude Code's own helpers
}

// One received event as the daemon hands it over: the same shape as its event log lines.
export interface Envelope {
  received: number; // ms since the epoch
  pid?: number; // the session's process, known from SessionStart only
  event: HookEvent;
}

// What a line of the session's transcript says that hooks don't: denials, Esc, context use.
export interface TranscriptNote {
  at: number; // ms since the epoch, from the line's timestamp
  signal?: 'denied' | 'interrupted';
  tokens?: number; // tokens in the context window as of this line
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

// A running subagent.
export interface Agent {
  id: string;
  type: string;
  startedAt: number;
}

export interface Session {
  id: string;
  pid?: number;
  cwd: string;
  project: string;
  transcriptPath?: string;
  mode?: string; // the permission mode, as of the main thread's latest event
  activity: Activity;
  mood: Mood;
  tool?: string; // in use while working, or the one a dialog is about
  agents: Agent[];
  reaction?: { kind: ReactionKind; at: number };
  contextTokens?: number;
  resume?: Activity; // what an open dialog or a compaction returns to
  waiter?: string; // the subagent whose permission dialog is open
  startedAt: number;
  since: number; // when activity or mood last changed: animations count from it
  seenAt: number;
  leavingAt?: number;
}
