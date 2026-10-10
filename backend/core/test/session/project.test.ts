import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectName } from '../../src/session/project.ts';

test('the project is the last part of the working directory', () => {
  assert.equal(projectName('/home/me/projects/claudie'), 'claudie');
  assert.equal(projectName('/home/me/projects/claudie/'), 'claudie');
  assert.equal(projectName('/'), '');
  assert.equal(projectName(''), '');
});
