import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clipDuration } from '../../src/scene/clips/clips.ts';
import { CHAT_EVERY_MS, NEGLECT, PATIENCE_MS, TOOL_HOLD_MS } from '../../src/scene/constants/director.ts';
import { AGENT_LEAVE_MS, HANDOVER_AT, WALK_MS } from '../../src/scene/constants/timing.ts';
import {
  agentCue,
  agentHasLeft,
  bumpClip,
  director,
  holdTool,
  react,
  receiving,
  socialCues,
  toolClip,
  walking,
} from '../../src/scene/director.ts';
import type { Agent, Session } from '../../src/session/types.ts';

const session = (over: Partial<Session> = {}): Session => ({
  id: 's',
  pid: 1,
  cwd: '/p/a',
  project: 'a',
  activity: 'idle',
  mood: 'none',
  agents: [],
  since: 10_000,
  seenAt: 10_000,
  startedAt: 0,
  ...over,
});
const agent = (over: Partial<Agent> = {}): Agent => ({ id: 'a1', type: 'Explore', startedAt: 0, seenAt: 0, ...over });

test('idle timeline: celebrate, stand, look around, yawn, sleep', () => {
  const s = session({ mood: 'done' });
  const clipAt = (dt: number) => director(s, s.since + dt).clip;
  assert.equal(clipAt(100), 'celebrate');
  assert.equal(clipAt(clipDuration('celebrate') + 100), 'stand');
  assert.equal(clipAt(16_000), 'lookAround');
  assert.equal(clipAt(25_000), 'stand');
  assert.equal(clipAt(46_000), 'yawn');
  assert.equal(clipAt(60_000), 'sleep');
  assert.equal(director(s, s.since + 60_000).startedAt, s.since + 45_000 + clipDuration('yawn'));
});

test('every mood opens its idle period with its own clip', () => {
  const opening = (mood: Session['mood']) => director(session({ mood }), 10_100).clip;
  assert.deepEqual((['done', 'error', 'interrupted', 'denied', 'none'] as const).map(opening), [
    'celebrate',
    'sad',
    'puzzled',
    'puzzled',
    'stand',
  ]);
});

test('activities map to clips; enter and leave win', () => {
  const at = (over: Partial<Session>) => director(session(over), 20_000).clip;
  assert.equal(at({ activity: 'thinking' }), 'work');
  assert.equal(at({ activity: 'working', tool: 'Bash' }), 'hammer');
  assert.equal(at({ activity: 'waiting' }), 'alert');
  assert.equal(at({ activity: 'asking' }), 'ask');
  assert.equal(at({ activity: 'compacting' }), 'compact');
  assert.equal(at({ activity: 'delegating', agents: [agent()] }), 'fidget');
  assert.equal(at({ activity: 'working', startedAt: 19_900 }), 'enter');
  assert.equal(at({ activity: 'waiting', leavingAt: 20_000 }), 'leave');
});

test('tools in hand: typing, hammering, searching, browsing; anything else just works', () => {
  assert.deepEqual(['Edit', 'Write', 'Bash', 'Grep', 'WebFetch', 'TodoWrite', 'constructor', undefined].map(toolClip), [
    'type',
    'type',
    'hammer',
    'search',
    'globe',
    'work',
    'work',
    'work',
  ]);
});

test('dialogs beat a compaction, which beats a reaction, which beats tools', () => {
  const shipped = session({ activity: 'working', tool: 'Bash', reaction: { kind: 'shipped', at: 19_500 } });
  assert.deepEqual(director(shipped, 20_000), { clip: 'confetti', startedAt: 19_500 });
  assert.equal(director(shipped, 19_500 + clipDuration('confetti')).clip, 'hammer');
  assert.equal(director({ ...shipped, activity: 'compacting' }, 20_000).clip, 'compact');
  assert.equal(director({ ...shipped, activity: 'asking' }, 20_000).clip, 'ask');
  assert.equal(director(session({ reaction: { kind: 'testsFailed', at: 19_900 } }), 20_000).clip, 'upset');
  assert.equal(director(session({ reaction: { kind: 'refreshed', at: 19_900 } }), 20_000).clip, 'refresh');
});

test('a dialog ignored for too long brings on antics with its bubble kept up, plain alerts in between', () => {
  const waiting = session({ activity: 'waiting' });
  const at = (dt: number, s = waiting) => director(s, s.since + dt);
  assert.equal(at(PATIENCE_MS - 1).clip, 'alert');
  const clips = [0, 10_000, 20_000, 30_000, 40_000].map((dt) => at(PATIENCE_MS + dt + 100));
  assert.deepEqual(
    clips.map((c) => c.clip),
    ['highJump', 'panic', 'longLegs', 'elder', 'skeleton'],
  );
  assert.ok(clips.every((c) => c.bubble === 'bang'));
  assert.equal(at(PATIENCE_MS + 7_000).clip, 'alert');
  assert.equal(at(PATIENCE_MS + 100, session({ activity: 'asking' })).bubble, 'question');
  assert.equal(at(PATIENCE_MS + 50_100).clip, 'highJump', 'the antics come round again');
  assert.equal(director(waiting, waiting.since + 60_000, { antics: false }).clip, 'alert');
});

test('a long-idle mascot gathers cobwebs, gets overgrown, snowed in, then stays bones', () => {
  const idle = session({ mood: 'done' });
  const at = (min: number) => director(idle, idle.since + min * 60_000);
  assert.equal(at(4).clip, 'sleep');
  assert.deepEqual(
    [5.1, 8.9].map((m) => at(m).clip),
    ['cobweb', 'cobweb'],
  );
  assert.equal(at(9 + 1 / 60).clip, 'sprout');
  assert.equal(at(9 + 5 / 60).clip, 'overgrown');
  assert.equal(at(9 + 5 / 60).startedAt, idle.since + 9 * 60_000 + clipDuration('sprout'));
  assert.equal(at(13.5).clip, 'snowedIn');
  assert.deepEqual(
    [17.1, 60, 600].map((m) => at(m).clip),
    ['skeleton', 'skeleton', 'skeleton'],
  );
  assert.deepEqual(
    NEGLECT.map(([, clip]) => clip),
    ['cobweb', 'overgrown', 'snowedIn', 'skeleton'],
  );
  assert.equal(director(idle, idle.since + 20 * 60_000, { neglect: false }).clip, 'sleep');
});

test('agent cues: walk in, work with the tool in hand, wait on a dialog, deliver on the way out', () => {
  assert.equal(agentCue(agent({ startedAt: 1000 }), 1100, false).clip, 'enter');
  assert.equal(agentCue(agent(), 5000, false).clip, 'work');
  assert.equal(agentCue(agent({ tool: 'Read' }), 5000, false).clip, 'search');
  assert.equal(agentCue(agent({ tool: 'Read' }), 5000, true).clip, 'alert');
  assert.deepEqual(agentCue(agent(), 5000, false, 4000), { clip: 'deliver', startedAt: 4000 });
  assert.equal(agentHasLeft(4000, 4000 + AGENT_LEAVE_MS - 1), false);
  assert.equal(agentHasLeft(4000, 4000 + AGENT_LEAVE_MS), true);
});

test('a reaction plays over the cue and keeps a dialog bubble up; walking in or off is never interrupted', () => {
  const cue = director(session({ activity: 'working' }), 20_000);
  assert.deepEqual(react(cue, { clip: 'poke', at: 19_800 }, 20_000), { clip: 'poke', startedAt: 19_800 });
  assert.equal(react(cue, { clip: 'poke', at: 20_000 - clipDuration('poke') }, 20_000), cue);
  assert.equal(react(cue, undefined, 20_000), cue);
  assert.equal(react(cue, { clip: bumpClip('left'), at: 19_900 }, 20_000).clip, 'bumpLeft');
  const asking = director(session({ activity: 'asking' }), 20_000);
  assert.equal(react(asking, { clip: 'poke', at: 19_900 }, 20_000).bubble, 'question');
  const leaving = director(session({ leavingAt: 19_900 }), 20_000);
  assert.equal(react(leaving, { clip: 'poke', at: 19_950 }, 20_000), leaving);
  assert.equal(WALK_MS, 1500);
});

test('a dragged crew walks along unless it shows a state of its own', () => {
  assert.equal(walking(director(session({ activity: 'working' }), 20_000)).clip, 'walk');
  assert.equal(walking(director(session({ activity: 'waiting' }), 20_000)).clip, 'alert');
  for (const clip of [
    'sleep',
    'skeleton',
    'cobweb',
    'snowedIn',
    'highJump',
    'compact',
    'confetti',
    'deliver',
  ] as const) {
    assert.equal(walking({ clip, startedAt: 7 }).clip, clip);
  }
});

test('the main mascot takes the scroll at the handover, unless it is asking for something', () => {
  const stand = { clip: 'stand' as const, startedAt: 0 };
  assert.equal(receiving(stand, [4000], 4000 + HANDOVER_AT - 1), stand);
  assert.deepEqual(receiving(stand, [4000], 4000 + HANDOVER_AT + 10), {
    clip: 'receive',
    startedAt: 4000 + HANDOVER_AT,
  });
  assert.equal(receiving(stand, [4000], 4000 + HANDOVER_AT + clipDuration('receive')), stand);
  const alert = { clip: 'alert' as const, startedAt: 0 };
  assert.equal(receiving(alert, [4000], 4000 + HANDOVER_AT + 10), alert);
});

test('idle neighbours chat now and then: left opens, right replies mirrored', () => {
  const at = 10 * CHAT_EVERY_MS; // a slot of the first pair
  const idle = (id: string, over: Partial<Session> = {}) => session({ id, since: at - 20_000, ...over });
  const [a, b, c] = [idle('a'), idle('b'), idle('c')];
  const cues = socialCues([a, b, c], at + 500);
  assert.deepEqual(cues, [{ clip: 'chatA', startedAt: at }, { clip: 'chatB', startedAt: at, mirror: true }, undefined]);
  assert.deepEqual(socialCues([a, b], at + clipDuration('chatA') + 1), [undefined, undefined]);
  const next = [...Array(CHAT_EVERY_MS / 100).keys()].map((k) => at + k * 100).find((t) => socialCues([a, b, c], t)[2]);
  assert.ok(next !== undefined && next - at >= clipDuration('chatA'), 'the next pair waits until the first is done');
  // Nobody busy, asleep, with subagents or freshly idle joins in.
  const none = (other: Session) => socialCues([a, other], at + 500).every((cue) => cue === undefined);
  assert.ok(none(idle('w', { activity: 'thinking' })));
  assert.ok(none(idle('z', { since: at - 120_000 })));
  assert.ok(none(idle('g', { agents: [agent()] })));
  assert.ok(none(idle('n', { since: at + 100 })));
});

test('a quick tool keeps its clip up a moment over thinking, but not over what matters more', () => {
  const working = { clip: 'search', startedAt: 1_000 } as const;
  let { hold } = holdTool(working, undefined, 1_000);
  const thinking = { clip: 'work', startedAt: 1_050 } as const;
  assert.deepEqual(holdTool(thinking, hold, 1_200).cue, working, 'still searching just after the Read');
  assert.deepEqual(holdTool(thinking, hold, 1_000 + TOOL_HOLD_MS).cue, thinking, 'thinking once the hold is over');
  const alert = { clip: 'alert', startedAt: 1_100 } as const;
  assert.deepEqual(holdTool(alert, hold, 1_200).cue, alert, 'a dialog shows at once');
  // A second Read soon after carries the lens sweep on instead of starting it over.
  ({ hold } = holdTool({ clip: 'search', startedAt: 1_400 }, hold, 1_400));
  assert.equal(holdTool({ clip: 'search', startedAt: 1_400 }, hold, 1_500).cue.startedAt, 1_000);
  assert.deepEqual(holdTool(thinking, hold, 1_400 + TOOL_HOLD_MS - 1).cue.clip, 'search', 'held from the latest');
});

test('at another pace the clips play faster or slower, and so do the windows timed by them', () => {
  assert.equal(clipDuration('celebrate', 2), clipDuration('celebrate') / 2);
  const done = session({ mood: 'done' });
  const halfway = done.since + clipDuration('celebrate') * 0.75;
  assert.equal(director(done, halfway).clip, 'celebrate');
  assert.equal(director(done, halfway, { pace: 2 }).clip, 'stand', 'twice as fast, it is over already');
});

test('with stroll on, an idle mascot paces about instead of sleeping, gathering cobwebs or turning to bones', () => {
  const idle = session();
  const at = (minutes: number) => director(idle, idle.since + minutes * 60_000, { stroll: true }).clip;
  assert.deepEqual([0.5, 2, 6, 20].map(at), ['stroll', 'stroll', 'stroll', 'stroll']);
  const done = session({ mood: 'done' });
  assert.equal(director(done, done.since + 100, { stroll: true }).clip, 'celebrate', 'a result still opens');
});

test('the idle timings move the yawn, the neglect and the antics, keeping their proportions', () => {
  const idle = session();
  const at = (s: number, behaviour = {}) => director(idle, idle.since + s * 1000, behaviour).clip;
  const quick = { sleepAfter: 20, neglectAfter: 60, patience: 10 };
  assert.equal(at(19, quick), 'stand');
  assert.equal(at(20.5, quick), 'yawn');
  assert.equal(at(45, quick), 'sleep');
  assert.equal(at(7, quick), 'lookAround', 'a third of the way to sleep');
  assert.equal(at(61, quick), 'cobweb');
  assert.equal(at((60 * 17) / 5 + 1, quick), 'skeleton', 'the bones in proportion');
  assert.equal(at(46), 'yawn', 'left alone, the built-in timings');
  const asking = session({ activity: 'asking', tool: 'AskUserQuestion' });
  assert.equal(director(asking, asking.since + 11_000, quick).bubble, 'question');
  assert.notEqual(director(asking, asking.since + 11_000, quick).clip, 'ask', 'antics after 10 s');
  assert.equal(director(asking, asking.since + 11_000).clip, 'ask', 'not yet with the built-in 30 s');
});
