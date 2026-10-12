// Palette slot indices to straight RGBA; a slot whose colour isn't '#rrggbb' stays transparent.
export function rgba(pixels: ArrayLike<number>, palette: string): Uint8Array {
  const colors = palette.split(',').map(parseHex);
  const out = new Uint8Array(pixels.length * 4);
  for (let i = 0; i < pixels.length; i++) {
    const color = colors[pixels[i]];
    if (!color) continue;
    out.set(color, i * 4);
  }
  return out;
}

function parseHex(css: string): [number, number, number, number] | undefined {
  if (!/^#[0-9a-f]{6}$/i.test(css)) return undefined;
  const n = Number.parseInt(css.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255, 255];
}
