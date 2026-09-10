import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseMap } from '../../src/game/map.ts';
import { getReachablePaths, isLegalMovementPath } from '../../src/game/pathfinding.ts';

const board = parseMap('#####\n#.+.#\n#...#\n#@~E#\n#####', { width: 5, height: 5 });
const boardWithNest = parseMap('#####\n#@N.#\n#...#\n#..E#\n#####', { width: 5, height: 5 });

test('pathfinding returns shortest orthogonal paths including a zero-square move', () => {
  const paths = getReachablePaths({
    board,
    start: { row: 2, column: 1 },
    maximumSteps: 3,
    closedDoors: board.doors,
    blockedPositions: [{ row: 2, column: 2 }],
    exitOpen: false,
  });

  assert.deepEqual(
    paths.find(path => path.destination.row === 2 && path.destination.column === 1),
    {
      destination: { row: 2, column: 1 },
      steps: [],
    }
  );
  assert.equal(
    paths.some(path => path.destination.row === 2 && path.destination.column === 3),
    false
  );
  assert.equal(
    paths.some(path => path.destination.row === 1 && path.destination.column === 2),
    false
  );
  assert.equal(
    paths.some(path => path.destination.row === 3 && path.destination.column === 3),
    false
  );
});

test('open doors become traversable immediately', () => {
  const paths = getReachablePaths({
    board,
    start: { row: 2, column: 1 },
    maximumSteps: 2,
    closedDoors: [],
    blockedPositions: [],
    exitOpen: false,
  });

  assert.deepEqual(
    paths.find(path => path.destination.row === 1 && path.destination.column === 2)?.steps,
    [
      { row: 1, column: 1 },
      { row: 1, column: 2 },
    ]
  );
});

test('nest tiles are passable unless the movement context explicitly blocks them', () => {
  const context = {
    board: boardWithNest,
    start: { row: 1, column: 1 },
    maximumSteps: 2,
    closedDoors: [] as const,
    blockedPositions: [] as const,
    exitOpen: false,
  };

  assert.deepEqual(
    getReachablePaths(context).find(
      path => path.destination.row === 1 && path.destination.column === 3
    )?.steps,
    [
      { row: 1, column: 2 },
      { row: 1, column: 3 },
    ]
  );
  assert.equal(
    getReachablePaths({ ...context, blockedPositions: boardWithNest.nests }).some(
      path => path.destination.row === 1 && path.destination.column === 2
    ),
    false
  );
});

test('movement path validation accepts detours but rejects diagonal and blocked steps', () => {
  const context = {
    board,
    start: { row: 2, column: 1 },
    maximumSteps: 3,
    closedDoors: [] as const,
    blockedPositions: [] as const,
    exitOpen: false,
  };

  assert.equal(
    isLegalMovementPath(context, [
      { row: 1, column: 1 },
      { row: 1, column: 2 },
      { row: 1, column: 1 },
    ]),
    true
  );
  assert.equal(isLegalMovementPath(context, [{ row: 1, column: 2 }]), false);
  assert.equal(
    isLegalMovementPath(context, [
      { row: 3, column: 1 },
      { row: 3, column: 2 },
    ]),
    false
  );
});
