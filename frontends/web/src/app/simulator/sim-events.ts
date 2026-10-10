import type { HookEvent } from '@claudie/core/session/types.ts';
import type { SimAction, SimSession } from './types.ts';

const COMMIT = 'git commit -m demo';
const TEST = 'pnpm test';

// The hook events a real session sends for what the simulator's button stands for.
export function simEvents(session: SimSession, action: SimAction): HookEvent[] {
  const event = (name: string, more: Partial<HookEvent> = {}): HookEvent => ({
    session_id: session.id,
    cwd: session.cwd,
    hook_event_name: name,
    ...more,
  });
  const bash = (name: string, command: string) => event(name, { tool_name: 'Bash', tool_input: { command } });
  switch (action.kind) {
    case 'start':
      return [event('SessionStart', { source: 'startup' })];
    case 'prompt':
      return [event('UserPromptSubmit')];
    case 'tool':
      return [event('PreToolUse', { tool_name: action.tool, tool_input: {} })];
    case 'permission':
      return [bash('PreToolUse', 'rm -rf build'), bash('PermissionRequest', 'rm -rf build')];
    case 'question':
      return [event('PermissionRequest', { tool_name: 'AskUserQuestion', tool_input: {} })];
    case 'approve':
      return [bash('PostToolUse', 'rm -rf build')];
    case 'plan':
      return [event('UserPromptSubmit', { permission_mode: 'plan' }), event('Stop', { permission_mode: 'plan' })];
    case 'done':
      return [event('Stop')];
    case 'error':
      return [event('StopFailure')];
    case 'commit':
      return [bash('PreToolUse', COMMIT), bash('PostToolUse', COMMIT), event('Stop')];
    case 'testsFail':
      return [bash('PreToolUse', TEST), bash('PostToolUseFailure', TEST), event('StopFailure')];
    case 'agentStart':
      return [event('SubagentStart', { agent_id: action.agent.id, agent_type: action.agent.type })];
    case 'agentStop':
      return [event('SubagentStop', { agent_id: action.agent.id, agent_type: action.agent.type })];
    case 'end':
      return [event('SessionEnd', { reason: 'other' })];
  }
}
