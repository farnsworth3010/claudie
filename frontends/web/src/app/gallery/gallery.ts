import { Component } from '@angular/core';
import { GalleryTile } from './gallery-tile.ts';
import { gallerySections } from './sections.ts';

@Component({
  selector: 'app-gallery',
  imports: [GalleryTile],
  templateUrl: './gallery.html',
  styleUrl: './gallery.css',
})
export class Gallery {
  protected readonly sections = gallerySections();
}
