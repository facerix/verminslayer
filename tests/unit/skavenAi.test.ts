import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  chooseFacingTowardNearestHero,
  chooseNearestReachableSkavenId,
  chooseSoloSkavenPlacement,
  chooseSoloSkavenMovementPath,
} from '../../src/game/skavenAi.ts';
import type { HeroState, RandomSource } from '../../src/game/gameState.ts';
import { RulesError } from '../../src/game/rulesError.ts';

const hero = (row: number, column: number): HeroState =>
  Object.freeze({
    id: 'gotrek',
    definitionId: 'gotrek',
    woundsRemaining: 3,
    position: Object.freeze({ row, column }),
    facing: 'north',
  });

const sequence = (...values: readonly number[]): RandomSource => {
  let index = 0;
  return Object.freeze({ next: () => values[index++] ?? values.at(-1) ?? 0 });
};

test('solo placement maximizes the chance to attack before using randomness to break ties', () => {
  let randomCalls = 0;
  const randomSource: RandomSource = Object.freeze({
    next: () => {
      randomCalls++;
      return 0;
    },
  });

  const position = chooseSoloSkavenPlacement(
    [
      { row: 4, column: 4 },
      { row: 5, column: 4 },
      { row: 3, column: 3 },
    ],
    [hero(5, 5)],
    randomSource
  );

  assert.deepEqual(position, { row: 4, column: 4 });
  assert.equal(randomCalls, 1, 'only the two equally attacking placements require randomness');
});

test('solo placement rejects invalid randomness instead of silently biasing a tie', () => {
  assert.throws(
    () =>
      chooseSoloSkavenPlacement(
        [
          { row: 4, column: 4 },
          { row: 5, column: 4 },
        ],
        [hero(5, 5)],
        { next: () => 1 }
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'INVALID_RANDOM_VALUE'
  );
});

test('the nearest reachable Skaven activates first and fresh randomness breaks equal distances', () => {
  const distances = new Map([
    ['blocked', Number.POSITIVE_INFINITY],
    ['near-a', 3],
    ['far', 7],
    ['near-b', 3],
  ]);

  assert.equal(
    chooseNearestReachableSkavenId(
      ['blocked', 'near-a', 'far', 'near-b'],
      id => distances.get(id)!,
      sequence(0.75)
    ),
    'near-b'
  );
});

test('Skaven face toward the nearest living deployed hero', () => {
  assert.equal(
    chooseFacingTowardNearestHero({ row: 5, column: 5 }, [hero(2, 5), hero(5, 8)]),
    'north'
  );
});

test('a Skaven with no reachable hero holds instead of choosing an arbitrary legal move', () => {
  let randomCalls = 0;
  const hold = { destination: { row: 4, column: 1 }, steps: [] } as const;
  const path = chooseSoloSkavenMovementPath(
    [],
    [hold, { destination: { row: 4, column: 2 }, steps: [{ row: 4, column: 2 }] }],
    {
      next: () => {
        randomCalls++;
        return 0.5;
      },
    }
  );

  assert.equal(path, hold);
  assert.equal(randomCalls, 0);
});
