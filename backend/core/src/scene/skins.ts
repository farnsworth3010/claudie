import { DEFAULT_SKIN, SKIN_RULES } from './constants/look.ts';
import type { SkinId } from './types.ts';

const matches = (word: string, pattern: string): boolean =>
  pattern.endsWith('*') ? word.startsWith(pattern.slice(0, -1)) : word === pattern;

// Plugin agents arrive scoped ("oh-my-claudecode:code-reviewer"); only the name after the colon counts.
export function skinFor(agentType: string): SkinId {
  const name = agentType.toLowerCase().split(':').pop() ?? '';
  const words = name.split(/[^a-z]+/).filter(Boolean);
  const rule = SKIN_RULES.find(([, patterns]) =>
    patterns.some((pattern) => words.some((word) => matches(word, pattern))),
  );
  return rule?.[0] ?? DEFAULT_SKIN;
}
