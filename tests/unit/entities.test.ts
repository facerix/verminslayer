import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ALL_HERO_IDS, HERO_DEFINITIONS, SKAVEN_DEFINITIONS } from '../../src/game/entities.ts';
import { THE_NEST } from '../../src/game/missions/theNest.ts';

test('all six unique heroes have their printed stats and two abilities', () => {
  assert.deepEqual(ALL_HERO_IDS, ['gotrek', 'felix', 'snorri', 'ulrika', 'maximilian', 'malakai']);
  assert.deepEqual(
    ALL_HERO_IDS.map(id => ({
      id,
      stats: HERO_DEFINITIONS[id].stats,
      abilityCount: HERO_DEFINITIONS[id].abilities.length,
    })),
    [
      { id: 'gotrek', stats: { move: 3, fight: 3, wounds: 3 }, abilityCount: 2 },
      { id: 'felix', stats: { move: 5, fight: 2, wounds: 2 }, abilityCount: 2 },
      { id: 'snorri', stats: { move: 3, fight: 2, wounds: 3 }, abilityCount: 2 },
      { id: 'ulrika', stats: { move: 5, fight: 2, wounds: 2 }, abilityCount: 2 },
      { id: 'maximilian', stats: { move: 4, fight: 1, wounds: 2 }, abilityCount: 2 },
      { id: 'malakai', stats: { move: 3, fight: 2, wounds: 2 }, abilityCount: 2 },
    ]
  );
});

test('all three Skaven definitions have their printed stats and abilities', () => {
  assert.deepEqual(
    Object.values(SKAVEN_DEFINITIONS).map(definition => ({
      id: definition.id,
      stats: definition.stats,
      abilityCount: definition.abilities.length,
    })),
    [
      { id: 'clanrat', stats: { move: 4, fight: 1, wounds: 1 }, abilityCount: 1 },
      { id: 'gutter-runner', stats: { move: 6, fight: 2, wounds: 1 }, abilityCount: 2 },
      { id: 'rat-ogor', stats: { move: 3, fight: 3, wounds: 2 }, abilityCount: 2 },
    ]
  );
});

test('The Nest noise bag has the specified 20 results', () => {
  const counts = THE_NEST.noiseBag.reduce<Record<string, number>>((result, id) => {
    result[id] = (result[id] ?? 0) + 1;
    return result;
  }, {});

  assert.deepEqual(counts, {
    'two-clanrats': 8,
    'three-clanrats': 4,
    'gutter-runner': 2,
    'rat-ogor': 1,
    nothing: 5,
  });
  assert.equal(THE_NEST.initialNoiseCount, 3);
  assert.equal(THE_NEST.noisePerTurn, 2);
});
