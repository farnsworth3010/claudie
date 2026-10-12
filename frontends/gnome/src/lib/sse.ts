// Server-sent events, fed one line at a time (without the newline): a blank line ends an event.
export interface SseEvent {
  event: string;
  data: string;
}

export class SseParser {
  private event = '';
  private data: string[] = [];

  // The event a blank line completes, if it carried data.
  line(line: string): SseEvent | null {
    if (line === '') {
      const done = this.data.length > 0 ? { event: this.event || 'message', data: this.data.join('\n') } : null;
      this.event = '';
      this.data = [];
      return done;
    }
    if (line.startsWith(':')) return null; // a comment, the daemon's keep-alive ping
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') this.event = value;
    else if (field === 'data') this.data.push(value);
    return null;
  }
}
