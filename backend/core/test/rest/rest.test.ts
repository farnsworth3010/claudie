import assert from 'node:assert/strict';
import { test } from 'node:test';
import { restDone, restDue, restLeft, restSample, restSkip, restStart, restUnsampled } from '../../src/rest/rest.ts';
import type { Rest } from '../../src/rest/types.ts';

const MIN = 60_000;
const timing = { breakAfter: 50 * 60, breakSnooze: 5 * 60, breakAway: 5 * 60 };

// Samples every 5 s from `from` to `to`, each with the idle time `idle` gives at that moment.
function work(rest: Rest, from: number, to: number, idle: (t: number) => number = () => 0): Rest {
  let state = rest;
  for (let t = from + 5000; t <= to; t += 5000) state = restSample(state, t, idle(t), timing);
  return state;
}

test('50 minutes at the screen make a break due, not a moment earlier', () => {
  const rest = work(restStart(0), 0, 50 * MIN - 5000);
  assert.equal(restDue(rest, 50 * MIN - 5000, timing), false);
  assert.equal(restDue(work(rest, 50 * MIN - 5000, 50 * MIN), 50 * MIN, timing), true);
});

test('short pauses in input still count as work', () => {
  const rest = work(restStart(0), 0, 50 * MIN, (t) => t % (4 * MIN));
  assert.equal(restDue(rest, 50 * MIN, timing), true);
});

test('5 minutes without input are a break: the next stretch starts on return', () => {
  let rest = work(restStart(0), 0, 40 * MIN);
  rest = work(rest, 40 * MIN, 47 * MIN, (t) => t - 40 * MIN);
  rest = work(rest, 47 * MIN, 90 * MIN);
  assert.equal(restDue(rest, 90 * MIN, timing), false);
  assert.equal(restDue(work(rest, 90 * MIN, 97 * MIN), 97 * MIN, timing), true);
});

test('a long gap between samples, a suspend, counts as a break', () => {
  const rest = restSample(work(restStart(0), 0, 45 * MIN), 52 * MIN, 0, timing);
  assert.equal(restDue(work(rest, 52 * MIN, 60 * MIN), 60 * MIN, timing), false);
});

test('skipping puts the reminder off by the snooze; it comes back after', () => {
  const rest = restSkip(work(restStart(0), 0, 50 * MIN), 50 * MIN, timing);
  assert.equal(restDue(work(rest, 50 * MIN, 54 * MIN), 54 * MIN, timing), false);
  assert.equal(restDue(work(rest, 50 * MIN, 55 * MIN), 55 * MIN, timing), true);
});

test('a break in the middle of a snooze clears it', () => {
  let rest = restSkip(work(restStart(0), 0, 50 * MIN), 50 * MIN, timing);
  rest = restSample(rest, 51 * MIN, 5 * MIN, timing);
  assert.equal(rest.snoozedUntil, undefined);
});

test('done starts a new stretch', () => {
  const rest = work(restDone(50 * MIN), 50 * MIN, 99 * MIN);
  assert.equal(restDue(rest, 99 * MIN, timing), false);
  assert.equal(restDue(work(rest, 99 * MIN, 100 * MIN), 100 * MIN, timing), true);
});

test('without samples nothing is due: none yet, or none for a while', () => {
  assert.equal(restDue(restUnsampled(0), 99 * MIN, timing), false);
  assert.equal(restDue(work(restUnsampled(0), 0, 50 * MIN), 50 * MIN, timing), true);
  assert.equal(restDue(work(restStart(0), 0, 50 * MIN), 56 * MIN, timing), false);
});

test('the time left counts down to the sign, then to the end of a snooze; unknown without samples', () => {
  const rest = work(restStart(0), 0, 20 * MIN);
  assert.equal(restLeft(rest, 20 * MIN, timing), 30 * MIN);
  const due = work(rest, 20 * MIN, 50 * MIN);
  assert.equal(restLeft(due, 50 * MIN, timing), 0);
  assert.equal(restLeft(restSkip(due, 50 * MIN, timing), 51 * MIN, timing), 4 * MIN);
  assert.equal(restLeft(restUnsampled(0), 1000, timing), undefined);
  assert.equal(restLeft(rest, 26 * MIN, timing), undefined, 'samples stopped');
});
