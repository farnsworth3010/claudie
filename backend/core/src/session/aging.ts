import { AGENT_BUSY_MS, AGENT_SILENCE_MS, COMPACT_SILENCE_MS, SILENCE_MS } from './constants.ts';
import { back, to, withoutAgent } from './transitions.ts';
import type { Session } from './types.ts';

// The session as time passes with no word from it: hooks that never came don't keep it busy, and
// subagents that went quiet are let go.
export function aged(session: Session, now: number): Session {
  if (session.leavingAt !== undefined) return session;
  let s = session;
  for (const agent of session.agents) {
    const busy = agent.tool !== undefined || s.waiter === agent.id;
    if (now - agent.seenAt > (busy ? AGENT_BUSY_MS : AGENT_SILENCE_MS)) s = withoutAgent(s, agent.id, now);
  }
  const quiet = now - s.seenAt;
  const forsaken = s.activity === 'thinking' || (s.activity === 'delegating' && !s.agents.length);
  if (forsaken && quiet > SILENCE_MS) return to(s, 'idle', now);
  if (s.activity === 'compacting' && quiet > COMPACT_SILENCE_MS) return back(s, now);
  return s;
}
