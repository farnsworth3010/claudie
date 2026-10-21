import assert from 'node:assert/strict';
import { test } from 'node:test';
import { limitsFrom } from '../../src/limits/limits.ts';

test('the limits are read from the status line input, in ms', () => {
  const input = {
    session_id: 's',
    rate_limits: {
      five_hour: { used_percentage: 23.5, resets_at: 1738425600 },
      seven_day: { used_percentage: 41.2, resets_at: 1738857600 },
    },
  };
  assert.deepEqual(limitsFrom(input), {
    fiveHour: { used: 23.5, resetsAt: 1738425600_000 },
    sevenDay: { used: 41.2, resetsAt: 1738857600_000 },
  });
});

test('each window may be absent; with neither, or junk, there are no limits', () => {
  assert.deepEqual(limitsFrom({ rate_limits: { seven_day: { used_percentage: 5, resets_at: 1 } } }), {
    sevenDay: { used: 5, resetsAt: 1000 },
  });
  assert.deepEqual(
    limitsFrom({
      rate_limits: { five_hour: { used_percentage: '5', resets_at: 1 }, seven_day: { used_percentage: 7 } },
    }),
    undefined,
  );
  assert.equal(limitsFrom({ model: 'x' }), undefined);
  assert.equal(limitsFrom({ rate_limits: [] }), undefined);
  assert.equal(limitsFrom(null), undefined);
});

test('the share used is kept between 0 and 100', () => {
  const at = (used: number) =>
    limitsFrom({ rate_limits: { five_hour: { used_percentage: used, resets_at: 1 } } })?.fiveHour?.used;
  assert.equal(at(130), 100);
  assert.equal(at(-3), 0);
});
