import { Component, DestroyRef, inject, linkedSignal, signal } from '@angular/core';
import { DEFAULT_SETTINGS, RANGES } from '@claudie/core/settings/constants.ts';
import type { Settings, SettingsFlag, SettingsNumber } from '@claudie/core/settings/types.ts';
import { Daemon } from '../daemon/daemon.ts';
import {
  flagLabels,
  GROUPS,
  RESET_CONFIRM_MS,
  SAVE_DELAY_MS,
  SLIDERS,
  type SliderSpec,
  TIMING_SLIDERS,
} from './constants.ts';
import { SliderField } from './slider-field.ts';

type SliderValues = Readonly<Record<SettingsNumber, number>>;

// Shows what the daemon says and sends it what the hand changes; the daemon echoes every change
// back to every page and overlay.
@Component({
  selector: 'app-settings-form',
  imports: [SliderField],
  templateUrl: './settings-form.html',
  styleUrl: './settings-form.css',
})
export class SettingsForm {
  private readonly daemon = inject(Daemon);
  protected readonly settings = this.daemon.settings;
  protected readonly groups = GROUPS;
  protected readonly labels = flagLabels(/Mac/.test(navigator.userAgent));
  // A slider in the hand keeps what the hand says, not an echo of a moment ago.
  protected readonly values = linkedSignal<Settings, SliderValues>({
    source: this.settings,
    computation: (s, previous) =>
      Object.fromEntries(
        [...SLIDERS, ...TIMING_SLIDERS].map(({ key, scale }) => [
          key,
          this.held === key && previous ? previous.value[key] : Math.round(s[key] * scale),
        ]),
      ) as SliderValues,
  });
  protected readonly confirming = signal(false);
  private held: SettingsNumber | null = null;
  private pending: Partial<Settings> = {};
  private timer: ReturnType<typeof setTimeout> | undefined;
  private confirmTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      clearTimeout(this.confirmTimer);
    });
  }

  protected range({ key, scale }: SliderSpec): readonly [number, number] {
    const [min, max] = RANGES[key];
    return [Math.round(min * scale), Math.round(max * scale)];
  }

  protected hold(key: SettingsNumber, held: boolean): void {
    this.held = held ? key : null;
  }

  protected slide({ key, scale }: SliderSpec, value: number): void {
    this.values.update((all) => ({ ...all, [key]: value }));
    this.change({ [key]: value / scale }, SAVE_DELAY_MS);
  }

  protected toggle(flag: SettingsFlag, e: Event): void {
    this.change({ [flag]: (e.target as HTMLInputElement).checked }, 0);
  }

  // Two clicks: the first asks, the second puts every setting back to its default on every overlay.
  protected reset(): void {
    clearTimeout(this.confirmTimer);
    if (!this.confirming()) {
      this.confirming.set(true);
      this.confirmTimer = setTimeout(() => this.confirming.set(false), RESET_CONFIRM_MS);
      return;
    }
    this.confirming.set(false);
    clearTimeout(this.timer);
    this.pending = {};
    this.daemon.saveSettings(DEFAULT_SETTINGS);
  }

  private change(patch: Partial<Settings>, delay: number): void {
    this.pending = { ...this.pending, ...patch };
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.daemon.saveSettings(this.pending);
      this.pending = {};
    }, delay);
  }
}
