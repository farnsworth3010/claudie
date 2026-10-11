export const clamp = (value: number, [low, high]: readonly [number, number]): number =>
  Math.min(Math.max(value, low), high);
