import assert from 'node:assert/strict';
import test from 'node:test';
import { Sessions } from '@claudie/core/session/sessions.ts';
import { simEvents } from '../src/app/simulator/sim-events.ts';
import type { SimAction, SimSession } from '../src/app/simulator/types.ts';

const session: SimSession = { id: 'web-1', cwd: '/demo/alpha', name: 'alpha #1', agents: [] };

// Plays the actions through the real session logic and answers what the session ends up as.
function play(...actions: SimAction[]) {
  const sessions = new Sessions();
  const events = actions.flatMap((action) => simEvents(session, action));
  events.forEach((event, i) => {
    sessions.hook({ received: 1000 + i * 10, event });
  });
  return sessions.list().find((s) => s.id === session.id);
}

test('every event names the session and its folder', () => {
  for (const event of simEvents(session, { kind: 'commit' })) {
    assert.equal(event.session_id, 'web-1');
    assert.equal(event.cwd, '/demo/alpha');
  }
});

test('the buttons bring the session into the states they are named after', () => {
  assert.equal(play({ kind: 'start' })?.activity, 'idle');
  assert.equal(play({ kind: 'start' }, { kind: 'tool', tool: 'Edit' })?.tool, 'Edit');
  assert.equal(play({ kind: 'start' }, { kind: 'prompt' }, { kind: 'permission' })?.activity, 'waiting');
  assert.equal(play({ kind: 'start' }, { kind: 'prompt' }, { kind: 'question' })?.activity, 'asking');
  assert.equal(
    play({ kind: 'start' }, { kind: 'prompt' }, { kind: 'permission' }, { kind: 'approve' })?.activity,
    'thinking',
  );
  assert.equal(play({ kind: 'start' }, { kind: 'plan' })?.mode, 'plan');
  assert.equal(play({ kind: 'start' }, { kind: 'prompt' }, { kind: 'done' })?.mood, 'done');
  assert.equal(play({ kind: 'start' }, { kind: 'prompt' }, { kind: 'error' })?.mood, 'error');
  assert.equal(play({ kind: 'start' }, { kind: 'prompt' }, { kind: 'commit' })?.reaction?.kind, 'shipped');
  assert.equal(play({ kind: 'start' }, { kind: 'prompt' }, { kind: 'testsFail' })?.reaction?.kind, 'testsFailed');
});

test('subagents come and go', () => {
  const agent = { id: 'a1', type: 'Explore' };
  assert.equal(play({ kind: 'start' }, { kind: 'agentStart', agent })?.agents.length, 1);
  assert.equal(play({ kind: 'start' }, { kind: 'agentStart', agent }, { kind: 'agentStop', agent })?.agents.length, 0);
});

test('end lets the session go', () => {
  assert.notEqual(play({ kind: 'start' }, { kind: 'end' })?.leavingAt, undefined);
});
