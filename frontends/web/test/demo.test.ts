import assert from 'node:assert/strict';
import test from 'node:test';
import { skinFor } from '@claudie/core/scene/skins.ts';
import { Sessions } from '@claudie/core/session/sessions.ts';
import { DEMO_CREW, DEMO_MS, DEMO_SESSIONS } from '../src/app/simulator/constants.ts';
import { demoScript } from '../src/app/simulator/demo.ts';
import { simEvents } from '../src/app/simulator/sim-events.ts';

// A seeded generator, so a failure can be replayed.
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

const script = (seed: number) => {
  let n = 0;
  return demoScript(seeded(seed), () => `id${n++}`);
};

test('every demo session starts first and leaves at the end, all together', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const steps = script(seed);
    const sessions = [...new Set(steps.map((step) => step.session))];
    assert.ok(
      sessions.length >= DEMO_SESSIONS[0] && sessions.length <= DEMO_SESSIONS[1],
      `${sessions.length} sessions`,
    );
    for (const session of sessions) {
      const own = steps.filter((step) => step.session === session);
      assert.equal(own[0].action.kind, 'start');
      assert.deepEqual(own.at(-1), { at: DEMO_MS, session, action: { kind: 'end' } });
    }
    assert.ok(
      steps.every((step, i) => i === 0 || steps[i - 1].at <= step.at),
      'in order of time',
    );
  }
});

test('a demo always has a crew of subagents in different skins, and sessions in different projects', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const steps = script(seed);
    const types = steps.flatMap((step) => (step.action.kind === 'agentStart' ? [step.action.agent.type] : []));
    assert.ok(types.length >= DEMO_CREW[0] && types.length <= DEMO_CREW[1], `${types.length} subagents`);
    assert.equal(new Set(types.map(skinFor)).size, types.length, 'one skin each');
    const cwds = new Set(steps.map((step) => step.session.cwd));
    assert.equal(cwds.size, new Set(steps.map((step) => step.session)).size, 'one project each');
  }
});

test('played through the real session logic, a demo shows a crowd that then leaves', () => {
  const steps = script(7);
  const sessions = new Sessions();
  const play = (until: number) => {
    for (const step of steps.filter((s) => s.at < until)) {
      for (const event of simEvents(step.session, step.action)) sessions.hook({ received: 1_000 + step.at, event });
    }
  };
  play(DEMO_MS);
  const live = sessions.list();
  assert.ok(live.length >= DEMO_SESSIONS[0]);
  assert.ok(
    live.some((s) => s.agents.length >= DEMO_CREW[0] - 1),
    'the crew is at work',
  );
  assert.ok(new Set(live.map((s) => `${s.activity}/${s.mood}/${s.mode ?? ''}`)).size >= 3, 'in different states');
  const after = new Sessions();
  for (const step of steps) {
    for (const event of simEvents(step.session, step.action)) after.hook({ received: 1_000 + step.at, event });
  }
  assert.ok(
    after.list().every((s) => s.leavingAt !== undefined),
    'and everyone leaves',
  );
});
