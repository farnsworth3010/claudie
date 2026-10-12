import type Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import St from 'gi://St';
import type { SpriteDraw } from '@claudie/core/scene/types.ts';
import { IMAGE_CACHE_LIMIT } from '../lib/constants.ts';
import { rgba } from '../lib/pixels.ts';

// Sprite frames by id (their pixels arrive once) and the images drawn from them per palette.
export class SpriteCache {
  private readonly frames = new Map<number, readonly number[]>();
  private readonly images = new Map<string, Clutter.Content>();

  remember(sprite: SpriteDraw): void {
    if (sprite.pixels) this.frames.set(sprite.id, sprite.pixels);
  }

  key(sprite: SpriteDraw): string {
    return `${sprite.id}|${sprite.palette}`;
  }

  image(sprite: SpriteDraw): Clutter.Content | null {
    const key = this.key(sprite);
    const known = this.images.get(key);
    if (known) return known;
    const pixels = this.frames.get(sprite.id);
    if (!pixels) return null;
    const content = St.ImageContent.new_with_preferred_size(sprite.w, sprite.h) as St.ImageContent;
    const context = global.stage.context.get_backend().get_cogl_context();
    const bytes = rgba(pixels, sprite.palette);
    content.set_bytes(context, bytes, Cogl.PixelFormat.RGBA_8888, sprite.w, sprite.h, sprite.w * 4);
    if (this.images.size > IMAGE_CACHE_LIMIT) this.images.clear();
    this.images.set(key, content);
    return content;
  }
}
