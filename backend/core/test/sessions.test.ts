import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Sessions } from '../src/sessions.ts';

const envelope = (received: number, hook_event_name: string, session_id = 's1') => ({
  received,
  event: { hook_event_name, session_id, cwd: '/home/me/demo' },
});

test('sessions are kept by id and listed oldest first', () => {
  const sessions = new Sessions();
  assert.equal(sessions.hook(envelope(2000, 'SessionStart', 'b')), true);
  assert.equal(sessions.hook(envelope(1000, 'SessionStart', 'a')), true);
  const { now, sessions: list } = sessions.snapshot(5000);
  assert.equal(now, 5000);
  assert.deepEqual(
    list.map((s) => s.id),
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
  assert.equal(sessions.snapshot(0).sessions[0].mood, 'interrupted');
  assert.equal(sessions.transcript('nobody', { at: 1500, signal: 'interrupted' }), false);
  assert.equal(sessions.hook(envelope(1000, 'SessionEnd', 'nobody')), false);
});
