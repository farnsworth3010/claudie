import { aged } from './aging.ts';
import { LEAVE_MS, ORPHAN_MS } from './constants.ts';
import { noteTranscript, reduce } from './reducer.ts';
import type { Envelope, Session, TranscriptNote, TranscriptRef } from './types.ts';

// All sessions the daemon knows, by session_id. Each method says whether anything changed,
// so the daemon only sends a snapshot when there is something new to show.
export class Sessions {
  private readonly byId = new Map<string, Session>();

  hook(envelope: Envelope): boolean {
    const id = envelope.event.session_id;
    let next = reduce(this.byId.get(id), envelope);
    let changed = false;
    // One process, one mascot: a session /clear or /resume left behind hands its place on.
    if (next && envelope.pid) {
      for (const [other, s] of this.byId) {
        if (other === id || s.pid !== envelope.pid) continue;
        this.byId.delete(other);
        next = { ...next, startedAt: Math.min(next.startedAt, s.startedAt) };
        changed = true;
      }
    }
    return this.put(id, next) || changed;
  }

  transcript(id: string, note: TranscriptNote): boolean {
    return this.put(id, noteTranscript(this.byId.get(id), note));
  }

  // Sessions whose transcript should be read.
  transcripts(): TranscriptRef[] {
    return [...this.byId.values()].flatMap((s) =>
      s.transcriptPath && s.leavingAt === undefined ? [{ id: s.id, path: s.transcriptPath }] : [],
    );
  }

  // Runs every few seconds: a session whose process is gone leaves (claude killed with -9 or a closed
  // terminal never sends SessionEnd), silence is aged, and those that walked off are forgotten.
  tick(now: number, alive: (pid: number) => boolean): boolean {
    let changed = false;
    for (const [id, s] of this.byId) {
      if (s.leavingAt !== undefined) {
        if (now - s.leavingAt >= LEAVE_MS) changed = this.byId.delete(id) || changed;
        continue;
      }
      const gone = s.pid ? !alive(s.pid) : now - s.seenAt > ORPHAN_MS;
      changed = this.put(id, gone ? { ...s, leavingAt: now } : aged(s, now)) || changed;
    }
    return changed;
  }

  list(): Session[] {
    return [...this.byId.values()].sort((a, b) => a.startedAt - b.startedAt);
  }

  // Sessions saved by an earlier daemon. Hooks sent while it was down are lost, so nothing is
  // trusted to be still running: a lost Stop must not keep a tool in hand forever.
  restore(saved: readonly Session[]): void {
    for (const s of saved) {
      // A file from another version is no reason to show a broken mascot.
      if (typeof s?.id !== 'string' || typeof s.activity !== 'string' || !Array.isArray(s.agents)) continue;
      const activity =
        s.activity === 'working' || (s.activity === 'delegating' && !s.agents.length) ? 'thinking' : s.activity;
      const agents = s.agents.map((a) => ({ ...a, tool: undefined }));
      this.byId.set(s.id, { ...s, activity, tool: undefined, agents });
    }
  }

  private put(id: string, next: Session | undefined): boolean {
    const prev = this.byId.get(id);
    if (!next) return this.byId.delete(id);
    // Reducers always return a fresh object; only a different content counts as a change.
    if (prev && JSON.stringify(prev) === JSON.stringify(next)) return false;
    this.byId.set(id, next);
    return true;
  }
}
