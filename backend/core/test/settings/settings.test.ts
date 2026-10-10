import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS } from '../../src/settings/constants.ts';
import { settingsFrom, settingsPatch } from '../../src/settings/settings.ts';

test('settings: merged over the defaults and kept in range; junk is ignored', () => {
  assert.deepEqual(settingsFrom(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(settingsFrom([1, 2]), DEFAULT_SETTINGS);
  assert.deepEqual(settingsFrom({ size: 99.4, opacity: 0, gaze: 'x', antics: false, junk: 1 }), {
    ...DEFAULT_SETTINGS,
    size: 12,
    opacity: 0.2,
    antics: false,
  });
  assert.equal(settingsFrom({ size: 3.6 }).size, 4);
  assert.equal(settingsFrom({ size: Number.NaN }).size, DEFAULT_SETTINGS.size);
});

test('a patch with any unknown or mistyped field is refused whole', () => {
  assert.deepEqual(settingsPatch({ opacity: 0.5, neglect: false }), { opacity: 0.5, neglect: false });
  assert.deepEqual(settingsPatch({}), {});
  assert.equal(settingsPatch({ opacity: '0.5' }), undefined);
  assert.equal(settingsPatch({ size: 4, colour: 'red' }), undefined);
  assert.equal(settingsPatch([1]), undefined);
  assert.equal(settingsPatch(null), undefined);
});

test('the animation pace is kept within its range and patched like the other numbers', () => {
  assert.equal(settingsFrom({}).pace, 1);
  assert.equal(settingsFrom({ pace: 1.5 }).pace, 1.5);
  assert.equal(settingsFrom({ pace: 10 }).pace, 1.5);
  assert.equal(settingsFrom({ pace: 0.1 }).pace, 0.5);
  assert.deepEqual(settingsPatch({ pace: 1.2 }), { pace: 1.2 });
  assert.equal(settingsPatch({ pace: 'fast' }), undefined);
});

test('the mini size is a share of the main mascot, kept within its range', () => {
  assert.equal(settingsFrom({}).miniSize, 0.5);
  assert.equal(settingsFrom({ miniSize: 0.8 }).miniSize, 0.8);
  assert.equal(settingsFrom({ miniSize: 3 }).miniSize, 1);
  assert.equal(settingsFrom({ miniSize: 0 }).miniSize, 0.3);
  assert.deepEqual(settingsPatch({ miniSize: 0.6 }), { miniSize: 0.6 });
});

test('idle timings are seconds within their ranges', () => {
  assert.deepEqual(
    [settingsFrom({}).sleepAfter, settingsFrom({}).neglectAfter, settingsFrom({}).patience],
    [45, 300, 30],
  );
  assert.equal(settingsFrom({ sleepAfter: 1 }).sleepAfter, 10);
  assert.equal(settingsFrom({ neglectAfter: 99_999 }).neglectAfter, 3600);
  assert.deepEqual(settingsPatch({ patience: 12 }), { patience: 12 });
});
