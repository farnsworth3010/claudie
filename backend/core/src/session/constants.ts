// Tools whose permission dialog is really a question for the user.
export const QUESTION_TOOLS: ReadonlySet<string> = new Set(['AskUserQuestion', 'ExitPlanMode']);
// Tools that hand the work to a subagent.
export const AGENT_TOOLS: ReadonlySet<string> = new Set(['Agent', 'Task']);

// Hooks that never came (a lost connection, a daemon restart) shouldn't leave a session busy forever;
// long enough for a long think, which reaches the transcript only once it is over.
export const SILENCE_MS = 10 * 60_000;
export const COMPACT_SILENCE_MS = 10 * 60_000;
// An interrupted or crashed subagent never sends SubagentStop. One running a tool or waiting on a
// dialog sends nothing either, so it gets far longer before it's presumed gone.
export const AGENT_SILENCE_MS = 5 * 60_000;
export const AGENT_BUSY_MS = 30 * 60_000;
// How long a mascot takes to walk off screen; the session is forgotten after that.
export const LEAVE_MS = 1500;
// A session without a pid can't be checked; it goes once nothing was heard from it for this long.
export const ORPHAN_MS = 60 * 60_000;

// What Claude Code writes into a transcript as of 2.1; the format isn't documented.
export const INTERRUPTED_PREFIX = '[Request interrupted by user';
export const REJECTED_PREFIX = "The user doesn't want to proceed with this tool use";

// `git [-C dir] commit|push`, anywhere in a compound command.
export const GIT_SHIPPED = /(?:^|[\s;&|(])git(?:\s+-\S+(?:\s+[^\s-]\S*)?)*\s+(?:commit|push)\b/;
// The usual ways to run a test suite, anywhere in a compound command.
export const TEST_RUN = new RegExp(
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
    .map((alt) => String.raw`(?:^|[\s;&|(])${alt}`)
    .join('|'),
);
