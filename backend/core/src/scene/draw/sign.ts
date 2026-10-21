import { LETTER_H } from '../art/letters.ts';
import { PAL } from '../constants/look.ts';
import {
  SIGN_BUTTON_PAD,
  SIGN_BUTTON_SPACING,
  SIGN_BUTTONS_GAP,
  SIGN_COLORS,
  SIGN_LINE_GAP,
  SIGN_PAD,
  SIGN_TITLE,
} from '../constants/sign.ts';
import type { Frame, SignButton } from '../types.ts';
import { type Pixels, printText, textWidth } from './text.ts';

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface Line {
  readonly text: string;
  readonly x: number;
  readonly y: number;
}

export interface SignLayout {
  readonly w: number;
  readonly h: number;
  readonly lines: readonly Line[];
  readonly buttons: Readonly<Record<SignButton, Box & { readonly text: string }>>;
}

const layouts = new Map<string, SignLayout>();
const frames = new Map<string, Frame>(); // by the minutes shown and the button under the pointer

// Where everything on the board goes; the minutes are whole, as the sliders set them.
export function signLayout(workMin: number, snoozeMin: number): SignLayout {
  const key = `${workMin}:${snoozeMin}`;
  const cached = layouts.get(key);
  if (cached) return cached;
  const title = SIGN_TITLE;
  const subtitle = `${workMin} MIN AT THE SCREEN`;
  const skip = `SKIP (${snoozeMin} MIN)`;
  const done = 'DONE';
  const buttonW = (text: string) => textWidth(text) + 2 * SIGN_BUTTON_PAD.x + 2;
  const buttonH = LETTER_H + 2 * SIGN_BUTTON_PAD.y + 2;
  const row = buttonW(skip) + SIGN_BUTTON_SPACING + buttonW(done);
  const inner = Math.max(textWidth(title), textWidth(subtitle), row);
  const w = inner + 2 * SIGN_PAD + 2;
  const top = 1 + SIGN_PAD;
  const buttonsY = top + 2 * LETTER_H + SIGN_LINE_GAP + SIGN_BUTTONS_GAP;
  const h = buttonsY + buttonH + SIGN_PAD + 1;
  const centred = (width: number) => Math.floor((w - width) / 2);
  const rowX = centred(row);
  const layout: SignLayout = {
    w,
    h,
    lines: [
      { text: title, x: centred(textWidth(title)), y: top },
      { text: subtitle, x: centred(textWidth(subtitle)), y: top + LETTER_H + SIGN_LINE_GAP },
    ],
    buttons: {
      skip: { text: skip, x: rowX, y: buttonsY, w: buttonW(skip), h: buttonH },
      done: { text: done, x: rowX + buttonW(skip) + SIGN_BUTTON_SPACING, y: buttonsY, w: buttonW(done), h: buttonH },
    },
  };
  layouts.set(key, layout);
  return layout;
}

// A white board with an ink border, two lines of text and two buttons; the one under the pointer lights up.
export function signFrame(workMin: number, snoozeMin: number, hovered: SignButton | null): Frame {
  const key = `${workMin}:${snoozeMin}:${hovered}`;
  const cached = frames.get(key);
  if (cached) return cached;
  const layout = signLayout(workMin, snoozeMin);
  const { w, h } = layout;
  const canvas: Pixels = { w, h, pixels: new Uint8Array(w * h) };
  panel(canvas, { x: 0, y: 0, w, h }, SIGN_COLORS.board);
  for (const line of layout.lines) printText(canvas, line.x, line.y, line.text, PAL.ink);
  for (const name of ['skip', 'done'] as const) {
    const button = layout.buttons[name];
    panel(canvas, button, name === hovered ? SIGN_COLORS.hovered : SIGN_COLORS[name]);
    printText(canvas, button.x + 1 + SIGN_BUTTON_PAD.x, button.y + 1 + SIGN_BUTTON_PAD.y, button.text, PAL.ink);
  }
  const frame: Frame = { w, h, pixels: canvas.pixels, dx: 0, opacity: 1, solid: [0, w] };
  frames.set(key, frame);
  return frame;
}

// A filled box with an ink border and cut corners.
function panel(canvas: Pixels, box: Box, fill: number): void {
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      const edgeX = x === box.x || x === box.x + box.w - 1;
      const edgeY = y === box.y || y === box.y + box.h - 1;
      if (edgeX && edgeY) continue;
      canvas.pixels[y * canvas.w + x] = edgeX || edgeY ? PAL.ink : fill;
    }
  }
}
