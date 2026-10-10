import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { Daemon } from '../daemon/daemon.ts';
import { SIM_AGENTS, SIM_BUTTONS, SIM_PROJECTS, SIM_TOOLS } from './constants.ts';
import { demoScript } from './demo.ts';
import { simEvents } from './sim-events.ts';
import type { SimAction, SimSession } from './types.ts';

// Made-up sessions, sent to the daemon as hooks like real ones, so they show on the Mac too. They
// end when the page closes.
@Component({
  selector: 'app-simulator',
  templateUrl: './simulator.html',
  styleUrl: './simulator.css',
  host: { '(window:pagehide)': 'endAll()' },
})
export class Simulator {
  private readonly daemon = inject(Daemon);
  protected readonly buttons = SIM_BUTTONS;
  protected readonly tools = SIM_TOOLS;
  protected readonly agentTypes = SIM_AGENTS;
  protected readonly sessions = signal<readonly SimSession[]>([]);
  protected readonly selectedId = signal('');
  protected readonly selected = computed(() => this.sessions().find((s) => s.id === this.selectedId()));
  protected readonly tool = signal<string>(SIM_TOOLS[0]);
  protected readonly agentType = signal<string>(SIM_AGENTS[0]);
  protected readonly demoRunning = signal(false);
  private count = 0;
  private demoTimers: ReturnType<typeof setTimeout>[] = [];
  private demoSessions: SimSession[] = []; // the demo's own, apart from the picker's

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopDemo());
  }

  // A random crowd for a few seconds: it plays through the daemon, so the Mac shows it too.
  protected demo(): void {
    if (this.demoRunning()) return;
    const steps = demoScript(Math.random, () => crypto.randomUUID());
    this.demoSessions = [...new Set(steps.map((step) => step.session))];
    this.demoRunning.set(true);
    this.demoTimers = steps.map((step) => setTimeout(() => this.post(step.session, step.action), step.at));
    const last = Math.max(...steps.map((step) => step.at));
    this.demoTimers.push(setTimeout(() => this.stopDemo(false), last));
  }

  protected start(): void {
    const name = SIM_PROJECTS[this.count % SIM_PROJECTS.length];
    this.count += 1;
    const session: SimSession = {
      id: `web-${crypto.randomUUID()}`,
      cwd: `/demo/${name}`,
      name: `${name} #${this.count}`,
      agents: [],
    };
    this.sessions.update((all) => [...all, session]);
    this.selectedId.set(session.id);
    this.post(session, { kind: 'start' });
  }

  protected send(action: SimAction): void {
    const session = this.selected();
    if (!session) return;
    this.post(session, action);
    if (action.kind !== 'end') return;
    this.sessions.update((all) => all.filter((s) => s !== session));
    this.selectedId.set(this.sessions()[0]?.id ?? '');
  }

  protected startAgent(): void {
    const session = this.selected();
    if (!session) return;
    const agent = { id: crypto.randomUUID(), type: this.agentType() };
    session.agents.push(agent);
    this.post(session, { kind: 'agentStart', agent });
  }

  // The oldest subagent finishes first.
  protected stopAgent(): void {
    const agent = this.selected()?.agents.shift();
    if (agent) this.send({ kind: 'agentStop', agent });
  }

  protected chosen(e: Event): string {
    return (e.target as HTMLSelectElement).value;
  }

  protected endAll(): void {
    for (const session of this.sessions()) this.post(session, { kind: 'end' }, true);
    this.stopDemo();
  }

  // `goodbye`: the demo was cut short, so its sessions are told to leave now.
  private stopDemo(goodbye = true): void {
    for (const timer of this.demoTimers) clearTimeout(timer);
    if (goodbye && this.demoRunning())
      for (const session of this.demoSessions) this.post(session, { kind: 'end' }, true);
    this.demoTimers = [];
    this.demoSessions = [];
    this.demoRunning.set(false);
  }

  private post(session: SimSession, action: SimAction, keepalive = false): void {
    for (const event of simEvents(session, action)) this.daemon.postHook(event, keepalive);
  }
}
