const toHex = (channel: number): string => Math.round(channel).toString(16).padStart(2, '0');

// Blends the hex colour `from` towards `to` by `t` (0..1).
export function mix(from: string, to: string, t: number): string {
  if (t === 0) return from;
  const channel = (hex: string, i: number): number => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => toHex(channel(from, i) + (channel(to, i) - channel(from, i)) * t)).join('')}`;
}

// Hue in degrees, saturation and lightness in percent.
export function hsl(hue: number, saturation: number, lightness: number): string {
  const amplitude = (saturation / 100) * Math.min(lightness / 100, 1 - lightness / 100);
  const channel = (n: number): string => {
    const k = (n + hue / 30) % 12;
    return toHex((lightness / 100 - amplitude * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}
