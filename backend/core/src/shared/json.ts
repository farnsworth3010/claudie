// Safe reads from parsed JSON of unknown shape.

export type JsonObject = Readonly<Record<string, unknown>>;

export const asObject = (value: unknown): JsonObject | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : undefined;

export const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

export const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
