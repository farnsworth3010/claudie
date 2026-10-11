import { asNumber, asObject, asText, type JsonObject } from '../shared/json.ts';
import { INTERRUPTED_PREFIX, REJECTED_PREFIX } from './constants.ts';
import type { TranscriptNote } from './types.ts';

// What one line of a session's JSONL transcript says that hooks don't; undefined when nothing.
export function transcriptNote(line: string): TranscriptNote | undefined {
  let entry: JsonObject | undefined;
  try {
    entry = asObject(JSON.parse(line));
  } catch {
    return undefined;
  }
  // Sidechain lines are a subagent's; they say nothing about the main thread.
  if (!entry || entry.isSidechain === true) return undefined;
  const at = Date.parse(asText(entry.timestamp));
  if (Number.isNaN(at)) return undefined;
  const signal = signalOf(entry);
  const tokens = tokensOf(entry);
  if (!signal && tokens === undefined) return undefined;
  return { at, ...(signal && { signal }), ...(tokens !== undefined && { tokens }) };
}

function signalOf(entry: JsonObject): TranscriptNote['signal'] {
  if (entry.type !== 'user') return undefined;
  const content = asObject(entry.message)?.content;
  if (typeof content === 'string') return content.startsWith(INTERRUPTED_PREFIX) ? 'interrupted' : undefined;
  if (!Array.isArray(content)) return undefined;
  const blocks = content.map(asObject).filter((block) => block !== undefined);
  const rejected = (block: JsonObject) =>
    block.type === 'tool_result' && block.is_error === true && resultText(block.content).startsWith(REJECTED_PREFIX);
  const interrupted = (block: JsonObject) => block.type === 'text' && asText(block.text).startsWith(INTERRUPTED_PREFIX);
  if (blocks.some(rejected)) return 'denied';
  if (blocks.some(interrupted)) return 'interrupted';
  return undefined;
}

// A tool result's content is a string or a list of text blocks.
function resultText(content: unknown): string {
  if (Array.isArray(content)) return asText(asObject(content[0])?.text);
  return asText(content);
}

// A reply's prompt is the whole context it was sent with; a compaction says how much it left.
function tokensOf(entry: JsonObject): number | undefined {
  if (entry.type === 'system' && entry.subtype === 'compact_boundary') {
    return asNumber(asObject(entry.compactMetadata)?.postTokens);
  }
  const message = asObject(entry.message);
  if (entry.type !== 'assistant' || message?.model === '<synthetic>') return undefined;
  const usage = asObject(message?.usage);
  if (!usage) return undefined;
  const fields = [usage.input_tokens, usage.cache_creation_input_tokens, usage.cache_read_input_tokens];
  const tokens = fields.reduce<number>((sum, field) => sum + (asNumber(field) ?? 0), 0);
  return tokens > 0 ? tokens : undefined;
}
