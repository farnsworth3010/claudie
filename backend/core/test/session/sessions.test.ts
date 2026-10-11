import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEAVE_MS, SILENCE_MS } from '../../src/session/constants.ts';
import { Sessions } from '../../src/session/sessions.ts';
import type { Envelope, HookEvent } from '../../src/session/types.ts';

const envelope = (
  received: number,
  hook_event_name: string,
  session_id = 's1',
  more: Partial<HookEvent> = {},
  pid?: number,
): Envelope => ({
  received,
  pid,
  event: { hook_event_name, session_id, cwd: '/home/me/demo', ...more },
});

test('sessions are kept by id and listed oldest first', () => {
  const sessions = new Sessions();
  assert.equal(sessions.hook(envelope(2000, 'SessionStart', 'b')), true);
  assert.equal(sessions.hook(envelope(1000, 'SessionStart', 'a')), true);
  assert.deepEqual(
    sessions.list().map((s) => s.id),
    ['a', 'b'],
  );
});

test('only a real change counts as one', () => {
  const sessions = new Sessions();
  sessions.hook(envelope(1000, 'UserPromptSubmit'));
  assert.equal(sessions.hook(envelope(2000, 'PreToolUse')), true, 'thinking to working');
  assert.equal(sessions.hook(envelope(2000, 'PreToolUse')), false, 'the same again');
});

test('a transcript note reaches its session; a session that never was stays unknown', () => {
  const sessions = new Sessions();
  sessions.hook(envelope(1000, 'UserPromptSubmit'));
  assert.equal(sessions.transcript('s1', { at: 1500, signal: 'interrupted' }), true);
  assert.equal(sessions.list()[0].mood, 'interrupted');
  assert.equal(sessions.transcript('nobody', { at: 1500, signal: 'interrupted' }), false);
  assert.equal(sessions.hook(envelope(1000, 'SessionEnd', 'nobody')), false);
});

test('/clear: the new session takes the old one’s place in the same process', () => {
  const sessions = new Sessions();
  sessions.hook(envelope(1000, 'SessionStart', 'old', {}, 77));
  sessions.hook(envelope(2000, 'SessionStart', 'other', {}, 88));
  sessions.hook(envelope(3000, 'SessionEnd', 'old', { reason: 'clear' }));
  assert.equal(sessions.hook(envelope(3100, 'SessionStart', 'new', { source: 'clear' }, 77)), true);
  assert.deepEqual(
    sessions.list().map((s) => [s.id, s.startedAt]),
    [
      ['new', 1000],
      ['other', 2000],
    ],
  );
});

test('only sessions still here have their transcript read', () => {
  const sessions = new Sessions();
  sessions.hook(envelope(1000, 'UserPromptSubmit', 'a', { transcript_path: '/t/a.jsonl' }));
  sessions.hook(envelope(1000, 'UserPromptSubmit', 'b'));
  sessions.hook(envelope(1000, 'UserPromptSubmit', 'c', { transcript_path: '/t/c.jsonl' }));
  sessions.hook(envelope(2000, 'SessionEnd', 'c'));
  assert.deepEqual(sessions.transcripts(), [{ id: 'a', path: '/t/a.jsonl' }]);
});

test('tick: a dead process leaves, a pid-less session times out, the gone are forgotten', () => {
  const sessions = new Sessions();
  sessions.hook(envelope(1000, 'SessionStart', 'live', {}, 1));
  sessions.hook(envelope(1000, 'SessionStart', 'dead', {}, 2));
  sessions.hook(envelope(1000, 'SessionStart', 'orphan'));
  assert.equal(
    sessions.tick(5000, (pid) => pid === 1),
    true,
  );
  const leaving = () =>
    sessions
      .list()
      .filter((s) => s.leavingAt !== undefined)
      .map((s) => s.id);
  assert.deepEqual(leaving(), ['dead']);
  assert.equal(
    sessions.tick(5000 + LEAVE_MS - 1, () => true),
    false,
  );
  sessions.tick(5000 + LEAVE_MS, () => true);
  assert.deepEqual(
    sessions.list().map((s) => s.id),
    ['live', 'orphan'],
  );
  sessions.tick(1001 + 60 * 60_000, () => true);
  assert.deepEqual(leaving(), ['orphan']);
});

test('restored sessions hold no tool: a Stop lost while the daemon was down must not keep one forever', () => {
  const first = new Sessions();
  first.hook(envelope(1000, 'PreToolUse', 's1', { tool_name: 'Bash' }));
  const saved = JSON.parse(JSON.stringify(first.list()));
  const second = new Sessions();
  second.restore(saved);
  assert.deepEqual(
    second.list().map((s) => [s.activity, s.tool, s.since]),
    [['thinking', undefined, 1000]],
  );
  second.restore([{ key: 'pid:1', sessionId: 'old format' }] as never);
  assert.equal(second.list().length, 1, 'records of another shape are skipped');
  second.tick(1001 + SILENCE_MS, () => true);
  assert.equal(second.list()[0].activity, 'idle', 'then silence idles it');
});
