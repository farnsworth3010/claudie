import assert from 'node:assert/strict';
import { test } from 'node:test';
import { noteTranscript, reduce } from '../src/reducer.ts';
import type { HookEvent, Session, TranscriptNote } from '../src/types.ts';

type Step = [name: string, fields?: Omit<Partial<HookEvent>, 'hook_event_name'>, pid?: number];

// Plays events one second apart through reduce and returns the session after each of them.
function play(steps: Step[], from?: Session): (Session | undefined)[] {
  let s = from;
  const t0 = from ? from.seenAt : 0;
  return steps.map(([name, fields, pid], i) => {
    const event = { hook_event_name: name, session_id: 's1', cwd: '/home/me/demo', ...fields };
    s = reduce(s, { received: t0 + 1000 * (i + 1), pid, event });
    return s;
  });
}

const last = (steps: Step[], from?: Session) => play(steps, from).at(-1);
const activities = (states: (Session | undefined)[]) => states.map((s) => s?.activity);
const note = (s: Session | undefined, n: Omit<TranscriptNote, 'at'>, after = 500) =>
  noteTranscript(s, { at: (s?.seenAt ?? 0) + after, ...n });

// Sequences below are the ones Claude Code 2.1 sent in a recorded session.

test('a turn: thinking, working with a tool, thinking again, then idle and done', () => {
  const states = play([
    ['SessionStart', { source: 'startup' }, 4242],
    ['UserPromptSubmit'],
    ['PreToolUse', { tool_name: 'Read' }],
    ['PostToolUse', { tool_name: 'Read' }],
    ['Stop'],
  ]);
  assert.deepEqual(
    states.map((s) => [s?.activity, s?.mood, s?.tool]),
    [
      ['idle', 'none', undefined],
      ['thinking', 'none', undefined],
      ['working', 'none', 'Read'],
      ['thinking', 'none', undefined],
      ['idle', 'done', undefined],
    ],
  );
  const end = states.at(-1);
  assert.equal(end?.pid, 4242, 'the pid from SessionStart stays');
  assert.equal(end?.project, 'demo');
  assert.equal(end?.since, 5000, 'since is when it went idle');
});

test('since does not move while the activity stays the same', () => {
  const states = play([
    ['PreToolUse', { tool_name: 'Read' }],
    ['PreToolUse', { tool_name: 'Grep' }],
  ]);
  assert.deepEqual(
    states.map((s) => [s?.since, s?.tool]),
    [
      [1000, 'Read'],
      [1000, 'Grep'],
    ],
  );
});

test('the project stays where the session started, whatever the shell cds into', () => {
  const s = last([['SessionStart'], ['PreToolUse', { tool_name: 'Bash', cwd: '/home/me/demo/daemon' }]]);
  assert.deepEqual([s?.cwd, s?.project], ['/home/me/demo', 'demo']);
  assert.equal(last([['SessionStart', { cwd: '/home/me/other' }]], s)?.project, 'other', 'a new start may move it');
});

test('a session seen without SessionStart starts from its first event', () => {
  const s = last([['UserPromptSubmit', { transcript_path: '/t/s1.jsonl', permission_mode: 'default' }]]);
  assert.deepEqual([s?.activity, s?.startedAt, s?.pid], ['thinking', 1000, undefined]);
  assert.deepEqual([s?.transcriptPath, s?.mode], ['/t/s1.jsonl', 'default']);
});

test('an approved permission: waiting until the tool finishes', () => {
  const states = play([
    ['UserPromptSubmit'],
    ['PreToolUse', { tool_name: 'Write' }],
    ['PermissionRequest', { tool_name: 'Write' }],
    ['Notification', { notification_type: 'permission_prompt' }],
    ['PostToolUse', { tool_name: 'Write' }],
    ['Stop'],
  ]);
  assert.deepEqual(activities(states), ['thinking', 'working', 'waiting', 'waiting', 'thinking', 'idle']);
  assert.equal(states[3]?.since, states[2]?.since, 'the notification is the same dialog');
});

test('a denied permission sends no hook at all: the transcript ends it', () => {
  const waiting = last([
    ['UserPromptSubmit'],
    ['PreToolUse', { tool_name: 'Write' }],
    ['PermissionRequest', { tool_name: 'Write' }],
  ]);
  const denied = note(waiting, { signal: 'denied' });
  assert.deepEqual([denied?.activity, denied?.mood], ['idle', 'denied']);
  const after = note(denied, { signal: 'interrupted' }, 1);
  assert.deepEqual(
    [after?.activity, after?.mood],
    ['idle', 'denied'],
    'the interruption line that follows changes nothing',
  );
});

test('Esc sends no hook either: the transcript says the turn was interrupted', () => {
  const s = note(last([['UserPromptSubmit']]), { signal: 'interrupted' });
  assert.deepEqual([s?.activity, s?.mood], ['idle', 'interrupted']);
});

test('transcript lines older than the current state change nothing but the context', () => {
  const thinking = last([['UserPromptSubmit']]);
  const s = noteTranscript(thinking, { at: 0, signal: 'interrupted', tokens: 1234 });
  assert.deepEqual([s?.activity, s?.contextTokens], ['thinking', 1234]);
});

test('a question asks until it is answered; so does approving a plan', () => {
  const states = play([
    ['UserPromptSubmit', { permission_mode: 'plan' }],
    ['PreToolUse', { tool_name: 'AskUserQuestion' }],
    ['PermissionRequest', { tool_name: 'AskUserQuestion' }],
    ['Notification', { notification_type: 'permission_prompt' }],
    ['PostToolUse', { tool_name: 'AskUserQuestion' }],
    ['PermissionRequest', { tool_name: 'ExitPlanMode' }],
    ['PostToolUse', { tool_name: 'ExitPlanMode', permission_mode: 'default' }],
  ]);
  assert.deepEqual(activities(states), ['thinking', 'working', 'asking', 'asking', 'thinking', 'asking', 'thinking']);
  assert.deepEqual(
    states.map((s) => s?.mode),
    ['plan', 'plan', 'plan', 'plan', 'plan', 'plan', 'default'],
  );
});

test('notifications: an elicitation asks, an idle prompt idles, others change nothing', () => {
  const thinking = last([['UserPromptSubmit']]);
  assert.equal(last([['Notification', { notification_type: 'elicitation_dialog' }]], thinking)?.activity, 'asking');
  assert.equal(last([['Notification', { notification_type: 'idle_prompt' }]], thinking)?.activity, 'idle');
  assert.equal(last([['Notification', { notification_type: 'auth_success' }]], thinking)?.activity, 'thinking');
});

test('a failed turn ends idle with an error', () => {
  const s = last([['UserPromptSubmit'], ['StopFailure']]);
  assert.deepEqual([s?.activity, s?.mood], ['idle', 'error']);
});

test('a background subagent: the turn ends, the session delegates until it is done', () => {
  const agent = { agent_id: 'a1', agent_type: 'Explore', cwd: '/tmp/worktree' };
  const states = play([
    ['UserPromptSubmit'],
    ['PreToolUse', { tool_name: 'Agent' }],
    ['SubagentStart', agent],
    ['PostToolUse', { tool_name: 'Agent' }],
    ['Stop'],
    ['PreToolUse', { ...agent, tool_name: 'Bash' }],
    ['SubagentStop', { agent_id: 'helper', agent_type: '' }],
    ['PostToolUse', { ...agent, tool_name: 'Bash' }],
    ['SubagentStop', agent],
    ['UserPromptSubmit'],
    ['Stop'],
  ]);
  assert.deepEqual(activities(states), [
    'thinking',
    'delegating',
    'delegating',
    'thinking',
    'delegating',
    'delegating',
    'delegating',
    'delegating',
    'idle',
    'thinking',
    'idle',
  ]);
  assert.deepEqual(
    states[4]?.agents.map((a) => [a.id, a.type]),
    [['a1', 'Explore']],
  );
  assert.equal(states[8]?.agents.length, 0);
  assert.equal(states[7]?.cwd, '/home/me/demo', 'a subagent in its own worktree does not move the session');
  assert.equal(states.at(-1)?.mood, 'done');
});

test('a subagent asking for permission stops the mascot until it moves on', () => {
  const agent = { agent_id: 'a1', agent_type: 'Explore' };
  const delegating = last([['SubagentStart', agent]]);
  assert.equal(delegating?.activity, 'delegating');
  const waiting = last([['PermissionRequest', { ...agent, tool_name: 'Bash' }]], delegating);
  assert.deepEqual([waiting?.activity, waiting?.waiter], ['waiting', 'a1']);
  assert.equal(last([['PostToolUse', { ...agent, tool_name: 'Bash' }]], waiting)?.activity, 'delegating');
  assert.equal(
    last([['PreToolUse', { ...agent, tool_name: 'Read' }]], waiting)?.activity,
    'delegating',
    'denied: it moved on',
  );
  assert.equal(
    last([['PreToolUse', { ...agent, tool_name: 'Bash' }]], waiting)?.activity,
    'waiting',
    'a late PreToolUse',
  );
  assert.equal(last([['SubagentStop', agent]], waiting)?.activity, 'idle');
});

test('the helper agent that stops after every turn is ignored', () => {
  const done = last([['UserPromptSubmit'], ['Stop']]);
  const s = last([['SubagentStop', { agent_id: 'helper', agent_type: '' }]], done);
  assert.deepEqual([s?.activity, s?.mood, s?.agents.length], ['idle', 'done', 0]);
});

test('compaction squeezes, then goes back to what it interrupted and refreshes', () => {
  const manual = play(
    [
      ['PreCompact'],
      ['SubagentStop', { agent_id: 'helper', agent_type: '' }],
      ['SessionStart', { source: 'compact' }],
      ['PostCompact'],
    ],
    last([['UserPromptSubmit'], ['Stop']]),
  );
  assert.deepEqual(activities(manual), ['compacting', 'compacting', 'compacting', 'idle']);
  assert.equal(manual.at(-1)?.reaction?.kind, 'refreshed');
  const auto = last([['UserPromptSubmit'], ['PreCompact'], ['SessionStart', { source: 'compact' }], ['PostCompact']]);
  assert.equal(auto?.activity, 'thinking', 'an automatic compaction mid-turn lets the turn go on');
});

test('a commit or push ships, a failed test run upsets; other commands and subagents do not', () => {
  const bash = (name: string, command: string, more: Partial<HookEvent> = {}) =>
    last([[name, { tool_name: 'Bash', tool_input: { command }, ...more }]])?.reaction?.kind;
  assert.equal(bash('PostToolUse', 'git add a.txt && git commit -q -m "add a"'), 'shipped');
  assert.equal(bash('PostToolUse', 'git -C repo push origin main'), 'shipped');
  assert.equal(bash('PostToolUse', 'git status'), undefined);
  assert.equal(bash('PostToolUseFailure', 'node --test failing.test.mjs'), 'testsFailed');
  assert.equal(bash('PostToolUseFailure', 'pnpm test', { is_interrupt: true }), undefined, 'stopped by the user');
  assert.equal(bash('PostToolUseFailure', 'git commit -m x'), undefined, 'a failed commit ships nothing');
  assert.equal(bash('PostToolUse', 'git commit -m x', { agent_id: 'a1', agent_type: 'Explore' }), undefined);
});

test('/clear ends one session and starts another in the same process', () => {
  const s = last([['SessionStart', {}, 77], ['UserPromptSubmit'], ['SessionEnd']]);
  assert.equal(s?.leavingAt, 3000);
  const next = reduce(undefined, {
    received: 3000,
    pid: 77,
    event: { hook_event_name: 'SessionStart', session_id: 's2', source: 'clear' },
  });
  assert.deepEqual([next?.id, next?.pid, next?.activity], ['s2', 77, 'idle']);
});

test('SessionEnd makes the session leave for good; an unknown one stays unknown', () => {
  const states = play([['UserPromptSubmit'], ['SessionEnd'], ['UserPromptSubmit']]);
  assert.equal(states[1]?.leavingAt, 2000);
  assert.deepEqual([states[2]?.activity, states[2]?.seenAt], ['thinking', 2000], 'events after the end change nothing');
  assert.equal(last([['SessionEnd']]), undefined);
  assert.equal(noteTranscript(states[1], { at: 9000, signal: 'interrupted' }), states[1]);
});
