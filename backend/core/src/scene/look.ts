import { SKINS } from './art/skins.ts';
import { hsl, mix } from './color.ts';
import {
  BODY_HSL,
  FIXED_COLORS,
  HUES,
  LOOK_ACCENTS,
  SHADE_HSL,
  SICK_AT,
  SICK_MIX,
  SICK_TINT,
  SIZES,
  SKIN_SHADE_BLACK_MIX,
} from './constants/look.ts';
import type { Look, SkinId } from './types.ts';

// Same project shares a colour, each extra session of it gets the next free size.
export function pickLook(taken: readonly { cwd: string; look: Look }[], cwd: string): Look {
  const sameProject = taken.filter((session) => session.cwd === cwd);
  const hue =
    sameProject[0]?.look.hue ??
    lowestFree(
      taken.map((session) => session.look.hue),
      HUES.length,
    );
  const size = lowestFree(
    sameProject.map((session) => session.look.size),
    SIZES.length,
  );
  return { hue, size };
}

function lowestFree(used: readonly number[], count: number): number {
  for (let i = 0; i < count; i++) if (!used.includes(i)) return i;
  return used.length % count;
}

export function lookScale(look: Look): number {
  return SIZES[look.size % SIZES.length];
}

// Context share -> sickness level 0..3.
export function sickness(share: number | undefined): number {
  const used = share ?? 0;
  return SICK_AT.filter((at) => used >= at).length;
}

// The session mascot; `sick` (0..3) washes the body towards a feverish green.
export function lookPalette(look: Look, sick = 0): string[] {
  const hue = HUES[look.hue % HUES.length];
  const t = SICK_MIX[sick] ?? 0;
  return palette(
    mix(hsl(hue, BODY_HSL.saturation, BODY_HSL.lightness), SICK_TINT, t),
    mix(hsl(hue, SHADE_HSL.saturation, SHADE_HSL.lightness), SICK_TINT, t),
    LOOK_ACCENTS,
  );
}

export function skinPalette(skin: SkinId, sick = 0): string[] {
  const { body, acc } = SKINS[skin];
  const t = SICK_MIX[sick] ?? 0;
  return palette(mix(body, SICK_TINT, t), mix(mix(body, '#000000', SKIN_SHADE_BLACK_MIX), SICK_TINT, t), acc);
}

// The colours by palette slot (see PAL).
function palette(body: string, shade: string, accents: readonly [string, string]): string[] {
  const c = FIXED_COLORS;
  return [
    'transparent',
    body,
    shade,
    c.ink,
    c.white,
    c.red,
    c.blue,
    c.zed,
    c.yellow,
    c.green,
    c.ice,
    c.cheek,
    ...accents,
    c.brown,
  ];
}
