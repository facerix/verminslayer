import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hasLineOfSight, traceSupercoverLine } from '../../src/game/lineOfSight.ts';
import { parseMap } from '../../src/game/map.ts';

const openBoard = parseMap('...\n@..\n..E', { width: 3, height: 3 });

test('supercover traces every square touched at a grid corner', () => {
  assert.deepEqual(traceSupercoverLine({ row: 1, column: 0 }, { row: 0, column: 1 }), [
    { row: 1, column: 0 },
    { row: 1, column: 1 },
    { row: 0, column: 0 },
    { row: 0, column: 1 },
  ]);
});

test('line of sight crosses ordinary floor and water', () => {
  const board = parseMap('..E\n@~.\n...', { width: 3, height: 3 });

  assert.equal(hasLineOfSight(board, { row: 1, column: 0 }, { row: 1, column: 2 }), true);
});

test('line of sight is blocked when a ray only touches a blocking terrain corner', () => {
  const board = parseMap('#.E\n@..\n...', { width: 3, height: 3 });

  assert.equal(hasLineOfSight(board, { row: 1, column: 0 }, { row: 0, column: 1 }), false);
});

test('walls, rubble, and closed doors block while open doors do not', () => {
  const wallBoard = parseMap('.#.\n@..\n..E', { width: 3, height: 3 });
  const rubbleBoard = parseMap('.:.\n@..\n..E', { width: 3, height: 3 });
  const doorBoard = parseMap('.+.\n@..\n..E', { width: 3, height: 3 });
  const from = { row: 0, column: 0 };
  const to = { row: 0, column: 2 };

  assert.equal(hasLineOfSight(wallBoard, from, to), false);
  assert.equal(hasLineOfSight(rubbleBoard, from, to), false);
  assert.equal(hasLineOfSight(doorBoard, from, to), false);
  assert.equal(hasLineOfSight(doorBoard, from, to, []), true);
  assert.equal(hasLineOfSight(openBoard, from, to), true);
});
