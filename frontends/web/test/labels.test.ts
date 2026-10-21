import assert from 'node:assert/strict';
import test from 'node:test';
import { FLAGS, RANGES } from '@claudie/core/settings/constants.ts';
import { flagLabels, GROUPS } from '../src/app/settings/constants.ts';

test('the settings are named after the Mac on a Mac, and after GNOME elsewhere', () => {
  assert.match(flagLabels(true).overDock, /Dock/);
  assert.match(flagLabels(true).clickThrough, /⌥ Option/);
  assert.doesNotMatch(Object.values(flagLabels(false)).join(' '), /Dock|⌥|macOS|menu bar/);
  assert.match(flagLabels(false).clickThrough, /Alt/);
  assert.equal(flagLabels(true).gaze, flagLabels(false).gaze);
});

test('every setting is in exactly one section of the form', () => {
  const flags = GROUPS.flatMap((group) => group.flags);
  assert.deepEqual([...flags].sort(), [...FLAGS].sort());
  const numbers = GROUPS.flatMap((group) => group.sliders.map((spec) => spec.key));
  assert.deepEqual([...numbers].sort(), Object.keys(RANGES).sort());
});
