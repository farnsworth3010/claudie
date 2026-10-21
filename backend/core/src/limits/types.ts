// The subscription's usage limits, as Claude Code hands them to the status line.
export interface Limits {
  readonly fiveHour?: LimitWindow;
  readonly sevenDay?: LimitWindow;
}

export interface LimitWindow {
  readonly used: number; // percent, 0 to 100
  readonly resetsAt: number; // ms since the epoch
}

export type LimitKind = keyof Limits;
