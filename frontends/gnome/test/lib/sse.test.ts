import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SseParser } from '../../src/lib/sse.ts';

const feed = (parser: SseParser, text: string) => text.split('\n').map((line) => parser.line(line));

test('a blank line completes an event with its type and data', () => {
  const events = feed(new SseParser(), 'event: state\ndata: {"now":1}\n').filter(Boolean);
  assert.deepEqual(events, [{ event: 'state', data: '{"now":1}' }]);
});

test('comments are skipped and data lines join with newlines', () => {
  const events = feed(new SseParser(), ': ping\n\nevent: state\ndata: a\ndata: b\n\n').filter(Boolean);
  assert.deepEqual(events, [{ event: 'state', data: 'a\nb' }]);
});

test('an event without a type is a message, and the type resets after each event', () => {
  const events = feed(new SseParser(), 'event: state\ndata: 1\n\ndata: 2\n').filter(Boolean);
  assert.deepEqual(events, [
    { event: 'state', data: '1' },
    { event: 'message', data: '2' },
  ]);
});

test('only one space after the colon is stripped', () => {
  const [event] = feed(new SseParser(), 'data:  x\n').filter(Boolean);
  assert.equal(event?.data, ' x');
});
