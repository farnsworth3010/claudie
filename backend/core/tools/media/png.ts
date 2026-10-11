import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// A tiny RGBA canvas that draws palette sprites and saves itself as a PNG; enough for pixel art.

export type Rgb = readonly [number, number, number];

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const COLOR_TYPE_RGBA = 6;
const FILTER_NONE = 0;

const CRC_TABLE = Int32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(bytes: Uint8Array): number {
  let c = -1;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

// '#rrggbb' to channels; anything else ('transparent') is undefined and draws nothing.
export function parseHex(css: string): Rgb | undefined {
  if (!/^#[0-9a-f]{6}$/i.test(css)) return undefined;
  return [1, 3, 5].map((i) => Number.parseInt(css.slice(i, i + 2), 16)) as unknown as Rgb;
}

export class Canvas {
  readonly width: number;
  readonly height: number;
  private readonly rgba: Uint8Array;

  constructor(width: number, height: number, background: Rgb) {
    this.width = Math.round(width);
    this.height = Math.round(height);
    this.rgba = new Uint8Array(this.width * this.height * 4);
    for (let i = 0; i < this.width * this.height; i++) this.rgba.set([...background, 255], i * 4);
  }

  // Fills a rectangle, blended over what is there by `alpha`.
  fill(x: number, y: number, w: number, h: number, color: Rgb, alpha = 1): void {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.width, Math.round(x + w));
    const y1 = Math.min(this.height, Math.round(y + h));
    for (let row = y0; row < y1; row++) {
      for (let col = x0; col < x1; col++) {
        const i = (row * this.width + col) * 4;
        for (let ch = 0; ch < 3; ch++) this.rgba[i + ch] = this.rgba[i + ch] * (1 - alpha) + color[ch] * alpha;
      }
    }
  }

  // A sprite of palette indices (`w` wide), each art pixel drawn `scale` screen pixels big.
  sprite(
    pixels: ArrayLike<number>,
    w: number,
    palette: readonly string[],
    x: number,
    y: number,
    scale: number,
    opacity = 1,
  ): void {
    for (let i = 0; i < pixels.length; i++) {
      const color = parseHex(palette[pixels[i]] ?? '');
      if (color) this.fill(x + (i % w) * scale, y + Math.floor(i / w) * scale, scale, scale, color, opacity);
    }
  }

  save(path: string): void {
    const stride = this.width * 4;
    const raw = Buffer.alloc((stride + 1) * this.height);
    for (let row = 0; row < this.height; row++) {
      raw[row * (stride + 1)] = FILTER_NONE;
      raw.set(this.rgba.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1);
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(this.width, 0);
    header.writeUInt32BE(this.height, 4);
    header[8] = 8; // bits per channel
    header[9] = COLOR_TYPE_RGBA;
    writeFileSync(
      path,
      Buffer.concat([
        SIGNATURE,
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0)),
      ]),
    );
  }
}
