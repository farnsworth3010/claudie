import { Component, input, output } from '@angular/core';
import type { SliderSpec } from './constants.ts';

// One number setting as a labelled slider with its value spelled out.
@Component({
  selector: 'app-slider-field',
  templateUrl: './slider-field.html',
  styleUrl: './slider-field.css',
})
export class SliderField {
  readonly spec = input.required<SliderSpec>();
  readonly range = input.required<readonly [number, number]>();
  readonly value = input.required<number>();
  readonly moved = output<number>(); // in slider units
  readonly held = output<boolean>();

  protected slide(e: Event): void {
    this.moved.emit(Number((e.target as HTMLInputElement).value));
  }
}
