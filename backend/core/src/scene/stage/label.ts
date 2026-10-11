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
