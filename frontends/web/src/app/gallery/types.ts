import type { Frame } from '@claudie/core/scene/types.ts';

export interface TileSpec {
  readonly caption: string;
  readonly frameAt: (elapsed: number) => Frame;
  readonly palette: readonly string[];
  readonly px: number;
}

export interface GallerySection {
  readonly title: string;
  readonly tiles: readonly TileSpec[];
}
