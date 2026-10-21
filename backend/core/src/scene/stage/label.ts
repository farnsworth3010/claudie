import type { LimitKind, LimitWindow } from '../../limits/types.ts';
import type { Session } from '../../session/types.ts';
import { CONTEXT_WINDOW } from '../constants/stage.ts';

const agentName = (type: string): string => type.split(':').pop() ?? type;

// The tooltip over a crew: project, what it is doing, how full its context is, which agents run.
export function crewLabel(session: Session): string {
  const state = [
    session.activity,
    session.tool,
    session.mood === 'none' ? undefined : session.mood,
    session.mode === 'plan' ? 'plan mode' : undefined,
  ];
  const lines = [session.project, state.filter(Boolean).join(' · ')];
  if (session.contextTokens !== undefined) {
    lines.push(`context ${Math.round((session.contextTokens / CONTEXT_WINDOW) * 100)}%`);
  }
  if (session.agents.length) lines.push(`agents: ${session.agents.map((agent) => agentName(agent.type)).join(', ')}`);
  return lines.join('\n');
}

const LIMIT_NAMES: Readonly<Record<LimitKind, string>> = { fiveHour: '5-hour limit', sevenDay: 'Weekly limit' };

// The tooltip over a limit's clock: which limit, how much of it is used, when it starts over.
export function limitLabel(kind: LimitKind, window: LimitWindow, now: number): string {
  return [LIMIT_NAMES[kind], `${Math.round(window.used)}% used`, `resets in ${timeLeft(window.resetsAt - now)}`].join(
    '\n',
  );
}

// The last line of a crew's tooltip: how long until the break sign goes up.
export function breakLabel(left: number): string {
  return left > 0 ? `break in ${timeLeft(left)}` : 'time for a break';
}

function timeLeft(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  if (days) return hours ? `${days} d ${hours} h` : `${days} d`;
  if (hours) return rest ? `${hours} h ${rest} min` : `${hours} h`;
  return `${rest} min`;
}
