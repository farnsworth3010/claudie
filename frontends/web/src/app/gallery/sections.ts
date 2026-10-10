import { SKIN_IDS } from '@claudie/core/scene/art/skins.ts';
import { CLIP_NAMES, CLIPS, clipDuration } from '@claudie/core/scene/clips/clips.ts';
import { FIDGET_SCENES } from '@claudie/core/scene/clips/fidgets.ts';
import { HUES, SIZES } from '@claudie/core/scene/constants/look.ts';
import { WALK_MS } from '@claudie/core/scene/constants/timing.ts';
import { frameAt, sceneFrameAt } from '@claudie/core/scene/frames.ts';
import { lookPalette, lookScale, skinPalette } from '@claudie/core/scene/look.ts';
import type { Clip, FrameMods, Look } from '@claudie/core/scene/types.ts';
import { GALLERY_PX, REPLAY_PAUSE_MS, SICKNESS_CAPTIONS, WALKS } from './constants.ts';
import type { GallerySection, TileSpec } from './types.ts';

const ORANGE: Look = { hue: 0, size: 0 };

// Every clip, pastime, skin, stage of sickness and look.
export function gallerySections(): GallerySection[] {
  const orange = lookPalette(ORANGE);
  return [
    { title: 'Clips', tiles: CLIP_NAMES.map((clip) => tile(clip, clipLoop(clip, {}), orange)) },
    {
      title: 'While subagents work',
      tiles: FIDGET_SCENES.map((scene) => tile(scene, (elapsed) => sceneFrameAt(scene, elapsed), orange)),
    },
    {
      title: 'Subagent skins',
      tiles: SKIN_IDS.map((skin) => tile(skin, clipLoop('work', { skin }), skinPalette(skin))),
    },
    {
      title: 'Context sickness',
      tiles: SICKNESS_CAPTIONS.map((caption, sick) =>
        tile(caption, clipLoop('stand', { sick }), lookPalette(ORANGE, sick)),
      ),
    },
    {
      title: 'Colours and sizes',
      tiles: HUES.map((_, hue) => {
        const look = { hue, size: hue % SIZES.length };
        return tile(`colour ${hue + 1}`, clipLoop('work', {}), lookPalette(look), lookScale(look));
      }),
    },
  ];
}

function tile(caption: string, frames: TileSpec['frameAt'], palette: readonly string[], scale = 1): TileSpec {
  return { caption, frameAt: frames, palette, px: Math.round(GALLERY_PX * scale) };
}

// A clip that ends, or walks off, plays again after a pause, so it stays visible.
function clipLoop(clip: Clip, mods: FrameMods): TileSpec['frameAt'] {
  const period = WALKS.has(clip)
    ? WALK_MS + REPLAY_PAUSE_MS
    : CLIPS[clip].loop
      ? Number.POSITIVE_INFINITY
      : clipDuration(clip) + REPLAY_PAUSE_MS;
  return (elapsed) => frameAt(clip, elapsed % period, mods);
}
