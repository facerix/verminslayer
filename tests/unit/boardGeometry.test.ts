import assert from 'node:assert/strict';
import { test } from 'node:test';

import { calculateBoardGeometry, pointToSquare } from '../../src/canvas/boardGeometry.ts';

test('board geometry fits all 13 by 19 squares inside the viewport', () => {
  const geometry = calculateBoardGeometry(650, 760, 13, 19);

  assert.equal(geometry.squareSize, 40);
  assert.deepEqual(geometry, {
    x: 65,
    y: 0,
    width: 520,
    height: 760,
    squareSize: 40,
    columns: 13,
    rows: 19,
  });
});

test('pointToSquare maps canvas coordinates and excludes the board edges', () => {
  const geometry = calculateBoardGeometry(650, 760, 13, 19);

  assert.deepEqual(pointToSquare({ x: 65, y: 0 }, geometry), { row: 0, column: 0 });
  assert.deepEqual(pointToSquare({ x: 584.9, y: 759.9 }, geometry), {
    row: 18,
    column: 12,
  });
  assert.equal(pointToSquare({ x: 64.9, y: 0 }, geometry), null);
  assert.equal(pointToSquare({ x: 585, y: 760 }, geometry), null);
});

test('invalid board geometry dimensions fail loudly', () => {
  assert.throws(() => calculateBoardGeometry(0, 100, 13, 19), RangeError);
  assert.throws(() => calculateBoardGeometry(100, 100, -1, 19), RangeError);
});
