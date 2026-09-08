import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseMap, RulesError } from '../../src/game/map.ts';
import { THE_NEST, THE_NEST_MAP } from '../../src/game/missions/theNest.ts';

test('The Nest parses as a 13 by 19 board with its required features', () => {
  const board = THE_NEST.board;

  assert.equal(board.width, 13);
  assert.equal(board.height, 19);
  assert.equal(board.doors.length, 6);
  assert.equal(board.nests.length, 3);
  assert.equal(board.spawns.length, 3);
  assert.deepEqual(board.deployment, { row: 16, column: 3 });
  assert.deepEqual(board.exit, { row: 18, column: 1 });
});

test('map positions and rows use zero-based coordinates', () => {
  const board = THE_NEST.board;

  assert.equal(board.tiles[0]?.[10]?.kind, 'spawn');
  assert.equal(board.tiles[18]?.[1]?.kind, 'exit');
});

test('parseMap rejects a map with the wrong number of rows', () => {
  assert.throws(
    () => parseMap('...\n...', { width: 3, height: 3 }),
    (error: unknown) => error instanceof RulesError && error.code === 'INVALID_MAP_HEIGHT'
  );
});

test('parseMap rejects a ragged map row', () => {
  assert.throws(
    () => parseMap('...\n..', { width: 3, height: 2 }),
    (error: unknown) => error instanceof RulesError && error.code === 'INVALID_MAP_WIDTH'
  );
});

test('parseMap rejects unknown symbols with their location', () => {
  assert.throws(
    () => parseMap('.?', { width: 2, height: 1 }),
    (error: unknown) =>
      error instanceof RulesError &&
      error.code === 'UNKNOWN_MAP_SYMBOL' &&
      error.message.includes('row 1, column 2')
  );
});

test('mission startup validation rejects missing required features', () => {
  const withoutExit = THE_NEST_MAP.replace('E', '#');

  assert.throws(
    () =>
      parseMap(withoutExit, {
        width: 13,
        height: 19,
        required: { deployment: 1, exit: 1, nest: 3, spawn: 3 },
      }),
    (error: unknown) => error instanceof RulesError && error.code === 'INVALID_FEATURE_COUNT'
  );
});
