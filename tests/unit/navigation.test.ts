import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameUrl, missionIdFromSearch } from '../../src/game/navigation.ts';

test('mission links encode the selected id on the game route', () => {
  assert.equal(gameUrl('the-nest'), '/game?id=the-nest');
  assert.equal(gameUrl('a & b'), '/game?id=a%20%26%20b');
});

test('the game route requires an explicit mission id', () => {
  assert.equal(missionIdFromSearch('?id=the-underburrow'), 'the-underburrow');
  assert.throws(() => missionIdFromSearch(''), /mission id is required/);
  assert.throws(() => missionIdFromSearch('?id='), /mission id is required/);
});
