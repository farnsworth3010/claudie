import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import { RECONNECT_FIRST_MS, RECONNECT_MAX_MS } from '../lib/constants.ts';
import { SseParser } from '../lib/sse.ts';
import { baseUrl } from './client.ts';

// Follows the daemon's `/events` stream for as long as it lives, reconnecting with a backoff.
// A lost connection is reported as a snapshot with no sessions, so the Clawds leave.
export class EventStream {
  private readonly session: Soup.Session;
  private readonly onSnapshot: (json: string) => void;
  private cancellable = new Gio.Cancellable();
  private delay = RECONNECT_FIRST_MS;
  private retry = 0;

  constructor(session: Soup.Session, onSnapshot: (json: string) => void) {
    this.session = session;
    this.onSnapshot = onSnapshot;
  }

  start(): void {
    this.connect();
  }

  stop(): void {
    this.cancellable.cancel();
    if (this.retry) GLib.source_remove(this.retry);
    this.retry = 0;
  }

  private connect(): void {
    const message = Soup.Message.new('GET', `${baseUrl()}/events`);
    if (!message) return;
    message.get_request_headers().append('Accept', 'text/event-stream');
    this.session.send_async(message, GLib.PRIORITY_DEFAULT, this.cancellable, (_session, result) => {
      try {
        const stream = this.session.send_finish(result);
        if (message.get_status() !== Soup.Status.OK) throw new Error(`HTTP ${message.get_status()}`);
        this.read(new Gio.DataInputStream({ base_stream: stream }), new SseParser());
      } catch {
        this.lost();
      }
    });
  }

  private read(input: Gio.DataInputStream, parser: SseParser): void {
    input.read_line_async(GLib.PRIORITY_DEFAULT, this.cancellable, (_input, result) => {
      let line: string | null;
      try {
        const [bytes] = input.read_line_finish_utf8(result);
        line = bytes;
      } catch {
        this.lost();
        return;
      }
      if (line === null) {
        this.lost();
        return;
      }
      this.delay = RECONNECT_FIRST_MS;
      const event = parser.line(line.replace(/\r$/, ''));
      if (event?.event === 'state') this.onSnapshot(event.data);
      this.read(input, parser);
    });
  }

  private lost(): void {
    if (this.cancellable.is_cancelled()) return;
    this.onSnapshot(JSON.stringify({ now: Date.now(), sessions: [] }));
    this.retry = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.delay, () => {
      this.retry = 0;
      this.connect();
      return GLib.SOURCE_REMOVE;
    });
    this.delay = Math.min(this.delay * 2, RECONNECT_MAX_MS);
  }
}
