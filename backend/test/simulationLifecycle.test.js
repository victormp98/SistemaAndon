const test = require('node:test');
const assert = require('node:assert/strict');
const { canTransition } = require('../src/domain/simulationLifecycle');

test('simulation lifecycle accepts valid operational transitions', () => {
  assert.equal(canTransition('draft', 'ready'), true);
  assert.equal(canTransition('ready', 'running'), true);
  assert.equal(canTransition('running', 'paused'), true);
  assert.equal(canTransition('paused', 'running'), true);
  assert.equal(canTransition('running', 'completed'), true);
});

test('simulation lifecycle rejects invalid and terminal transitions', () => {
  assert.equal(canTransition('draft', 'running'), false);
  assert.equal(canTransition('completed', 'running'), false);
  assert.equal(canTransition('cancelled', 'draft'), false);
  assert.equal(canTransition('unknown', 'running'), false);
});
