import {
  DEMO_ARRIVAL_MS,
  DEMO_BUSY_AT,
  DEMO_CREW,
  DEMO_MS,
  DEMO_PROJECTS,
  DEMO_SESSIONS,
  DEMO_TWIST_AT,
  SIM_AGENTS,
  SIM_TOOLS,
} from './constants.ts';
import type { DemoStep, SimAction, SimSession } from './types.ts';

type Random = () => number; // [0, 1), like Math.random

// What a demo session is busy with, and how it ends up halfway through, if anything changes.
type Scenario = 'crew' | 'tool' | 'permission' | 'question' | 'plan' | 'commit' | 'testsFail' | 'done';
const SCENARIOS: readonly Scenario[] = ['tool', 'permission', 'question', 'plan', 'commit', 'testsFail', 'done'];

// A random crowd of sessions for the demo button: always one with a crew of subagents in different
// skins, the rest each in a different state; halfway through some finish, ship, fail or lose a
// subagent; at the end everyone leaves.
export function demoScript(random: Random, newId: () => string): DemoStep[] {
  const count = between(random, DEMO_SESSIONS);
  const scenarios: Scenario[] = ['crew', ...shuffled(random, SCENARIOS).slice(0, count - 1)];
  const projects = shuffled(random, DEMO_PROJECTS);
  const steps: DemoStep[] = [];
  scenarios.forEach((scenario, i) => {
    const session: SimSession = {
      id: `web-demo-${newId()}`,
      cwd: `/demo/${projects[i]}`,
      name: projects[i],
      agents: [],
    };
    const step = (at: number, action: SimAction) => steps.push({ at, session, action });
    step(i * DEMO_ARRIVAL_MS, { kind: 'start' });
    const busy = DEMO_BUSY_AT + i * DEMO_ARRIVAL_MS;
    if (scenario === 'plan') {
      step(busy, { kind: 'plan' });
    } else {
      step(busy, { kind: 'prompt' });
      for (const [at, action] of work(random, scenario, newId)) step(busy + at, action);
    }
    step(DEMO_MS, { kind: 'end' });
  });
  return steps.sort((a, b) => a.at - b.at);
}

// The scenario's actions after the prompt, `at` ms after it.
function work(random: Random, scenario: Scenario, newId: () => string): Array<readonly [number, SimAction]> {
  const twist = DEMO_TWIST_AT - DEMO_BUSY_AT;
  const tool: SimAction = { kind: 'tool', tool: pick(random, SIM_TOOLS) };
  switch (scenario) {
    case 'crew': {
      const types = shuffled(random, SIM_AGENTS).slice(0, between(random, DEMO_CREW));
      const agents = types.map((type) => ({ id: newId(), type }));
      return [
        ...agents.map((agent, i) => [i * 300, { kind: 'agentStart', agent }] as const),
        [twist, { kind: 'agentStop', agent: agents[0] }],
      ];
    }
    case 'tool':
      return [[0, tool]];
    case 'permission':
      return [[0, { kind: 'permission' }]];
    case 'question':
      return [[0, { kind: 'question' }]];
    case 'commit':
      return [
        [0, tool],
        [twist, { kind: 'commit' }],
      ];
    case 'testsFail':
      return [
        [0, tool],
        [twist, { kind: 'testsFail' }],
      ];
    case 'done':
      return [
        [0, tool],
        [twist, { kind: 'done' }],
      ];
    case 'plan':
      return [];
  }
}

function between(random: Random, [min, max]: readonly [number, number]): number {
  return min + Math.floor(random() * (max - min + 1));
}

function pick<T>(random: Random, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function shuffled<T>(random: Random, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
