import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SKIN_IDS } from '../../src/scene/art/skins.ts';
import { skinFor } from '../../src/scene/skins.ts';

test('skins follow the agent name, scoped plugin names included', () => {
  const expected: Record<string, string> = {
    Explore: 'explorer',
    explorer: 'explorer',
    'oh-my-claudecode:explore': 'explorer',
    'claude-code-guide': 'explorer',
    'general-purpose': 'helper',
    'oh-my-claudecode:code-reviewer': 'reviewer',
    reviewer: 'reviewer',
    'oh-my-claudecode:critic': 'reviewer',
    'oh-my-claudecode:verifier': 'reviewer',
    Plan: 'planner',
    'oh-my-claudecode:architect': 'planner',
    'oh-my-claudecode:test-engineer': 'tester',
    'oh-my-claudecode:qa-tester': 'tester',
    'oh-my-claudecode:executor': 'executor',
    'oh-my-claudecode:security-reviewer': 'security',
    'doc-writer': 'writer',
    'oh-my-claudecode:debugger': 'debugger',
    'oh-my-claudecode:designer': 'designer',
    'refactor-bot': 'refactorer',
    'oh-my-claudecode:code-simplifier': 'refactorer',
    'ai-slop-cleaner': 'refactorer',
  };
  for (const [type, skin] of Object.entries(expected)) assert.equal(skinFor(type), skin, type);
  assert.deepEqual(new Set(Object.values(expected)), new Set(SKIN_IDS), 'the table covers every skin');
});

test('a word only part of a longer one does not pick the skin', () => {
  for (const type of ['extract-tool', 'latest-news', 'doctor', 'tracker', 'docker-runner', 'planet', 'attestation']) {
    assert.equal(skinFor(type), 'helper', type);
  }
  assert.equal(skinFor('tracer'), 'debugger');
  assert.equal(skinFor('trace-agent'), 'debugger');
  assert.equal(skinFor('docs'), 'writer');
  assert.equal(skinFor('my:Test_Runner'), 'tester');
  assert.equal(skinFor('unit-test'), 'tester');
  assert.equal(skinFor('builder'), 'executor');
});
