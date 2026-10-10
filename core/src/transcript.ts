import type { TranscriptNote } from './types.ts';

// The transcript format isn't documented; these are what Claude Code writes as of 2.1.
const INTERRUPTED = '[Request interrupted by user';
const REJECTED = "The user doesn't want to proceed with this tool use";

type Json = Record<string, unknown>;
const object = (v: unknown): Json | undefined =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : undefined;
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

// What one line of a session's JSONL transcript says that hooks don't; undefined when nothing.
export function transcriptNote(line: string): TranscriptNote | undefined {
  let entry: Json | undefined;
  try {
    entry = object(JSON.parse(line));
  } catch {
    return undefined;
  }
  // Sidechain lines are a subagent's; they say nothing about the main thread.
  if (!entry || entry.isSidechain === true) return undefined;
  const at = Date.parse(text(entry.timestamp));
  if (Number.isNaN(at)) return undefined;
  const signal = signalOf(entry);
  const tokens = tokensOf(entry);
  if (!signal && tokens === undefined) return undefined;
  return { at, ...(signal && { signal }), ...(tokens !== undefined && { tokens }) };
}

function signalOf(entry: Json): TranscriptNote['signal'] {
  if (entry.type !== 'user') return undefined;
  const content = object(entry.message)?.content;
  if (typeof content === 'string') return content.startsWith(INTERRUPTED) ? 'interrupted' : undefined;
  if (!Array.isArray(content)) return undefined;
  const blocks = content.map(object).filter((b) => b !== undefined);
  if (
    blocks.some((b) => b.type === 'tool_result' && b.is_error === true && resultText(b.content).startsWith(REJECTED))
  ) {
    return 'denied';
  }
  if (blocks.some((b) => b.type === 'text' && text(b.text).startsWith(INTERRUPTED))) return 'interrupted';
  return undefined;
}

// A tool result's content is a string or a list of text blocks.
function resultText(content: unknown): string {
  if (Array.isArray(content)) return text(object(content[0])?.text);
  return text(content);
}

// A reply's prompt is the whole context it was sent with; a compaction says how much it left.
function tokensOf(entry: Json): number | undefined {
  if (entry.type === 'system' && entry.subtype === 'compact_boundary') {
    const post = object(entry.compactMetadata)?.postTokens;
    return typeof post === 'number' ? post : undefined;
  }
  const message = object(entry.message);
  if (entry.type !== 'assistant' || message?.model === '<synthetic>') return undefined;
  const usage = object(message?.usage);
  if (!usage) return undefined;
  const fields = [usage.input_tokens, usage.cache_creation_input_tokens, usage.cache_read_input_tokens];
  const tokens = fields.reduce<number>((sum, n) => sum + (typeof n === 'number' ? n : 0), 0);
  return tokens > 0 ? tokens : undefined;
}
