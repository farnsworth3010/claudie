// A made-up session of the simulator, as the hooks of a real one would describe it.
export interface SimSession {
  readonly id: string;
  readonly cwd: string;
  readonly name: string;
  agents: SimAgent[];
}

export interface SimAgent {
  readonly id: string;
  readonly type: string;
}

export type SimAction =
  | { readonly kind: 'start' }
  | { readonly kind: 'prompt' }
  | { readonly kind: 'tool'; readonly tool: string }
  | { readonly kind: 'permission' }
  | { readonly kind: 'question' }
  | { readonly kind: 'approve' }
  | { readonly kind: 'plan' }
  | { readonly kind: 'done' }
  | { readonly kind: 'error' }
  | { readonly kind: 'commit' }
  | { readonly kind: 'testsFail' }
  | { readonly kind: 'agentStart'; readonly agent: SimAgent }
  | { readonly kind: 'agentStop'; readonly agent: SimAgent }
  | { readonly kind: 'end' };

// One hook-worthy moment of the random demo, `at` ms after it starts.
export interface DemoStep {
  readonly at: number;
  readonly session: SimSession;
  readonly action: SimAction;
}
