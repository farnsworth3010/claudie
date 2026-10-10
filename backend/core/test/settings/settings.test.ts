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
