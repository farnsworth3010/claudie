import type { Rest, RestTiming } from './types.ts';

export function restStart(now: number): Rest {
  return { since: now, lastAt: now };
}

// The app has just started: the stretch counts from now, but no break falls due before the first sample.
export function restUnsampled(now: number): Rest {
  return { since: now, lastAt: Number.NEGATIVE_INFINITY };
}

// `idleMs`: how long since the last keyboard or mouse input, as the system reports it.
// A long gap between samples (a suspend) counts as a break too; while away, the next stretch keeps starting now.
export function restSample(rest: Rest, now: number, idleMs: number, timing: RestTiming): Rest {
  const away = timing.breakAway * 1000;
  if (idleMs >= away || now - Math.max(rest.lastAt, rest.since) >= away) return restStart(now);
  return { ...rest, lastAt: now };
}

// Only while the samples keep coming: an app that stops sending them knows nothing of the person.
export function restDue(rest: Rest, now: number, timing: RestTiming): boolean {
  return (
    now - rest.since >= timing.breakAfter * 1000 &&
    now - rest.lastAt < timing.breakAway * 1000 &&
    !(rest.snoozedUntil !== undefined && now < rest.snoozedUntil)
  );
}

// How long until the next reminder, 0 once it is up; undefined while nothing is known of the person.
export function restLeft(rest: Rest, now: number, timing: RestTiming): number | undefined {
  if (now - rest.lastAt >= timing.breakAway * 1000) return undefined;
  return Math.max(0, rest.since + timing.breakAfter * 1000 - now, (rest.snoozedUntil ?? now) - now);
}

export function restSkip(rest: Rest, now: number, timing: RestTiming): Rest {
  return { ...rest, snoozedUntil: now + timing.breakSnooze * 1000 };
}

export function restDone(now: number): Rest {
  return restStart(now);
}
