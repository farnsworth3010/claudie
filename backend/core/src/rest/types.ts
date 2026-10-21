// How long the person has been at the screen without a break; all times in ms since the epoch.
export interface Rest {
  readonly since: number; // when the current stretch of work began
  readonly lastAt: number; // the last idle sample
  readonly snoozedUntil?: number; // a skipped reminder stays away until then
}

// The settings that time a break, in seconds.
export interface RestTiming {
  readonly breakAfter: number; // at the screen this long, it is time for a break
  readonly breakSnooze: number; // what skipping a reminder puts it off by
  readonly breakAway: number; // no input this long counts as a break
}
