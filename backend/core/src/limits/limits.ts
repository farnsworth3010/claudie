import { asNumber, asObject } from '../shared/json.ts';
import { clamp } from '../shared/math.ts';
import type { Limits, LimitWindow } from './types.ts';

// The limits in the status line's input; undefined when it has none (an API key, or no reply yet).
export function limitsFrom(raw: unknown): Limits | undefined {
  const limits = asObject(asObject(raw)?.rate_limits);
  if (!limits) return undefined;
  const fiveHour = windowFrom(limits.five_hour);
  const sevenDay = windowFrom(limits.seven_day);
  if (!fiveHour && !sevenDay) return undefined;
  return { ...(fiveHour && { fiveHour }), ...(sevenDay && { sevenDay }) };
}

function windowFrom(raw: unknown): LimitWindow | undefined {
  const window = asObject(raw);
  const used = asNumber(window?.used_percentage);
  const resetsAt = asNumber(window?.resets_at);
  if (used === undefined || resetsAt === undefined) return undefined;
  return { used: clamp(used, [0, 100]), resetsAt: resetsAt * 1000 };
}
