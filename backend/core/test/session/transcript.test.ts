import assert from 'node:assert/strict';
import { test } from 'node:test';
import { transcriptNote } from '../../src/session/transcript.ts';

const timestamp = '2026-10-10T17:05:18.715Z';
const at = Date.parse(timestamp);
const line = (entry: object) => JSON.stringify({ timestamp, isSidechain: false, ...entry });
const user = (content: unknown) => line({ type: 'user', message: { role: 'user', content } });

// Lines below are shaped like the ones Claude Code 2.1 wrote in a recorded session.

test('a rejected tool use is a denial', () => {
  const rejected = user([
    {
      type: 'tool_result',
      is_error: true,
      content:
        "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit…",
    },
  ]);
  assert.deepEqual(transcriptNote(rejected), { at, signal: 'denied' });
});

test('Esc leaves an interruption line, as text or as a string', () => {
  assert.deepEqual(transcriptNote(user([{ type: 'text', text: '[Request interrupted by user]' }])), {
    at,
    signal: 'interrupted',
  });
  assert.deepEqual(transcriptNote(user('[Request interrupted by user for tool use]')), { at, signal: 'interrupted' });
});

test('only the start of a message counts: a summary that mentions an interruption is not one', () => {
  assert.equal(transcriptNote(user('This session is being continued… [Request interrupted by user]')), undefined);
  assert.equal(transcriptNote(user([{ type: 'tool_result', is_error: true, content: 'Exit code 1' }])), undefined);
});

test('a reply tells how full the context is; a synthetic one does not', () => {
  const usage = { input_tokens: 2, cache_creation_input_tokens: 293, cache_read_input_tokens: 56465, output_tokens: 2 };
  assert.deepEqual(transcriptNote(line({ type: 'assistant', message: { model: 'claude-haiku-5-5', usage } })), {
    at,
    tokens: 56760,
  });
  assert.equal(transcriptNote(line({ type: 'assistant', message: { model: '<synthetic>', usage } })), undefined);
});

test('a compaction says how much it left', () => {
  const boundary = line({
    type: 'system',
    subtype: 'compact_boundary',
    compactMetadata: { preTokens: 64625, postTokens: 8104 },
  });
  assert.deepEqual(transcriptNote(boundary), { at, tokens: 8104 });
});

test('subagent lines, broken lines and lines without a time say nothing', () => {
  assert.equal(
    transcriptNote(line({ isSidechain: true, type: 'user', message: { content: '[Request interrupted by user]' } })),
    undefined,
  );
  assert.equal(transcriptNote('{not json'), undefined);
  assert.equal(
    transcriptNote(JSON.stringify({ type: 'user', message: { content: '[Request interrupted by user]' } })),
    undefined,
  );
});
