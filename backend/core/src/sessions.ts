import { noteTranscript, reduce } from './reducer.ts';
import type { Envelope, Session, TranscriptNote } from './types.ts';

// What the overlay gets: the daemon's clock, so animations line up, and every session.
export interface Snapshot {
  now: number;
  sessions: Session[];
}

// All sessions the daemon knows, by session_id. Each method says whether anything changed,
// so the daemon only sends a snapshot when there is something new to show.
export class Sessions {
  private readonly byId = new Map<string, Session>();

  hook(envelope: Envelope): boolean {
    const id = envelope.event.session_id;
    return this.put(id, reduce(this.byId.get(id), envelope));
  }

  transcript(id: string, note: TranscriptNote): boolean {
    return this.put(id, noteTranscript(this.byId.get(id), note));
  }

  snapshot(now: number): Snapshot {
    return { now, sessions: [...this.byId.values()].sort((a, b) => a.startedAt - b.startedAt) };
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
