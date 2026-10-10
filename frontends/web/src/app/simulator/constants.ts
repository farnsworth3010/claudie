import type { SimAction } from './types.ts';

export const SIM_PROJECTS = ['alpha', 'beta', 'gamma', 'delta'] as const;
export const SIM_TOOLS = ['Edit', 'Bash', 'Read', 'Grep', 'WebFetch', 'TodoWrite'] as const;
// One subagent type per skin, the last one for everything else.
export const SIM_AGENTS = [
  'Explore',
  'code-reviewer',
  'security-reviewer',
  'test-engineer',
  'Plan',
  'debugger',
  'doc-writer',
  'designer',
  'executor',
  'code-simplifier',
  'general-purpose',
] as const;

type SimpleAction = Extract<
  SimAction,
  {
    kind: 'prompt' | 'permission' | 'question' | 'approve' | 'plan' | 'done' | 'error' | 'commit' | 'testsFail' | 'end';
  }
>;

export const SIM_BUTTONS: ReadonlyArray<{ readonly label: string; readonly action: SimpleAction }> = [
  { label: 'prompt', action: { kind: 'prompt' } },
  { label: 'permission', action: { kind: 'permission' } },
  { label: 'question', action: { kind: 'question' } },
  { label: 'approve', action: { kind: 'approve' } },
  { label: 'plan mode', action: { kind: 'plan' } },
  { label: 'done', action: { kind: 'done' } },
  { label: 'error', action: { kind: 'error' } },
  { label: 'commit', action: { kind: 'commit' } },
  { label: 'tests fail', action: { kind: 'testsFail' } },
  { label: 'end', action: { kind: 'end' } },
];

// The random demo: a crowd of made-up sessions for a few seconds.
export const DEMO_MS = 10_000; // from the first arrival to everyone leaving
export const DEMO_SESSIONS = [4, 6] as const; // how many, at least and at most
export const DEMO_CREW = [3, 5] as const; // subagents of the session that delegates
export const DEMO_PROJECTS = ['api', 'web', 'infra', 'docs', 'ml', 'app', 'cli', 'site'] as const;
export const DEMO_ARRIVAL_MS = 250; // between one session's arrival and the next
export const DEMO_BUSY_AT = 1_500; // when they all get to work
export const DEMO_TWIST_AT = 5_000; // when some of them finish, ship or fail
