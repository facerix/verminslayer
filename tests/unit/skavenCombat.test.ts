import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createInitialGameState,
  getLegalSkavenPlacementPositions,
  projectHeroView,
  resolveCommand,
} from '../../src/game/gameState.ts';
import type { GameState, RandomSource } from '../../src/game/gameState.ts';
import { THE_NEST } from '../../src/game/missions/theNest.ts';
import { RulesError } from '../../src/game/rulesError.ts';

const fixedRolls = (...values: readonly number[]): RandomSource => {
  let index = 0;
  return Object.freeze({
    next: () => values[index++] ?? values.at(-1) ?? 0,
  });
};

const heroTurnWithRevealedGroup = (
  resultId: 'two-clanrats' | 'three-clanrats' | 'gutter-runner' | 'rat-ogor' = 'two-clanrats'
): GameState => {
  let state = resolveCommand(
    createInitialGameState(THE_NEST),
    { type: 'configure-game', mode: 'two-player', heroIds: ['gotrek'] },
    fixedRolls(0)
  ).state;
  state = resolveCommand(
    state,
    {
      type: 'deploy-hero',
      heroId: 'gotrek',
      position: { row: 16, column: 3 },
      facing: 'north',
    },
    fixedRolls(0)
  ).state;
  return {
    ...state,
    setupStep: 'complete',
    phase: 'hero',
    round: 1,
    command: 2,
    activeHeroId: 'gotrek',
    actionsRemaining: 2,
    movementRemaining: 3,
    facingChangeAvailable: true,
    dashUsed: false,
    pushUsed: false,
    revealedNoise: Object.freeze([
      Object.freeze({
        id: 'noise-1',
        resultId,
        position: Object.freeze({ row: 15, column: 4 }),
        remainingModels: Object.freeze([...THE_NEST.noiseResults[resultId].models]),
      }),
    ]),
  };
};

test('a revealed group places stable Skaven models on the token then nearest squares', () => {
  let state = heroTurnWithRevealedGroup();

  assert.deepEqual(getLegalSkavenPlacementPositions(state, THE_NEST, 'noise-1'), [
    { row: 15, column: 4 },
  ]);
  state = resolveCommand(
    state,
    {
      type: 'place-revealed-skaven',
      noiseId: 'noise-1',
      position: { row: 15, column: 4 },
      facing: 'south',
    },
    fixedRolls(0)
  ).state;

  assert.deepEqual(state.skaven[0], {
    id: 'skaven-1',
    sourceNoiseId: 'noise-1',
    definitionId: 'clanrat',
    woundsRemaining: 1,
    position: { row: 15, column: 4 },
    facing: 'south',
  });
  assert.deepEqual(getLegalSkavenPlacementPositions(state, THE_NEST, 'noise-1'), [
    { row: 14, column: 4 },
    { row: 15, column: 5 },
    { row: 16, column: 4 },
    { row: 15, column: 3 },
  ]);

  const resolved = resolveCommand(
    state,
    {
      type: 'place-revealed-skaven',
      noiseId: 'noise-1',
      position: { row: 15, column: 5 },
      facing: 'west',
    },
    fixedRolls(0)
  );
  assert.equal(resolved.state.skaven[1]?.id, 'skaven-2');
  assert.deepEqual(resolved.state.revealedNoise, []);
  assert.deepEqual(
    resolved.events.map(event => event.type),
    ['skaven-placed', 'revealed-noise-resolved']
  );
});

test('crowded group placement skips occupied squares but never skips an open nearer tier', () => {
  const base = heroTurnWithRevealedGroup('three-clanrats');
  const crowded: GameState = {
    ...base,
    heroes: Object.freeze([
      Object.freeze({ ...base.heroes[0]!, position: Object.freeze({ row: 14, column: 4 }) }),
    ]),
    concealedNoise: Object.freeze([
      Object.freeze({
        id: 'blocking-noise',
        resultId: 'nothing' as const,
        position: Object.freeze({ row: 15, column: 5 }),
      }),
    ]),
  };
  let state = resolveCommand(
    crowded,
    {
      type: 'place-revealed-skaven',
      noiseId: 'noise-1',
      position: { row: 15, column: 4 },
      facing: 'south',
    },
    fixedRolls(0)
  ).state;

  assert.deepEqual(getLegalSkavenPlacementPositions(state, THE_NEST, 'noise-1'), [
    { row: 16, column: 4 },
    { row: 15, column: 3 },
  ]);
  assert.throws(
    () =>
      resolveCommand(
        state,
        {
          type: 'place-revealed-skaven',
          noiseId: 'noise-1',
          position: { row: 16, column: 5 },
          facing: 'south',
        },
        fixedRolls(0)
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'INVALID_SKAVEN_PLACEMENT'
  );
  state = resolveCommand(
    state,
    {
      type: 'place-revealed-skaven',
      noiseId: 'noise-1',
      position: { row: 15, column: 3 },
      facing: 'south',
    },
    fixedRolls(0)
  ).state;
  assert.ok(
    getLegalSkavenPlacementPositions(state, THE_NEST, 'noise-1').some(
      position => position.row === 16 && position.column === 4
    )
  );
});

test('a three-model group can expand through its own models from a dead-end token square', () => {
  const base = heroTurnWithRevealedGroup('three-clanrats');
  let state: GameState = {
    ...base,
    revealedNoise: Object.freeze([
      Object.freeze({
        ...base.revealedNoise[0]!,
        position: Object.freeze({ row: 0, column: 10 }),
      }),
    ]),
  };

  for (const position of [
    { row: 0, column: 10 },
    { row: 1, column: 10 },
  ]) {
    state = resolveCommand(
      state,
      {
        type: 'place-revealed-skaven',
        noiseId: 'noise-1',
        position,
        facing: 'south',
      },
      fixedRolls(0)
    ).state;
  }

  assert.deepEqual(getLegalSkavenPlacementPositions(state, THE_NEST, 'noise-1'), [
    { row: 1, column: 11 },
    { row: 2, column: 10 },
    { row: 1, column: 9 },
  ]);
  const resolved = resolveCommand(
    state,
    {
      type: 'place-revealed-skaven',
      noiseId: 'noise-1',
      position: { row: 2, column: 10 },
      facing: 'south',
    },
    fixedRolls(0)
  ).state;

  assert.equal(resolved.skaven.length, 3);
  assert.deepEqual(resolved.revealedNoise, []);
});

test('a revealed group spills through unrelated Skaven when leaving a crowded spawn', () => {
  const base = heroTurnWithRevealedGroup('three-clanrats');
  let state: GameState = {
    ...base,
    heroes: Object.freeze([
      Object.freeze({ ...base.heroes[0]!, position: Object.freeze({ row: 11, column: 1 }) }),
    ]),
    revealedNoise: Object.freeze([
      Object.freeze({
        ...base.revealedNoise[0]!,
        position: Object.freeze({ row: 10, column: 0 }),
      }),
    ]),
    skaven: Object.freeze([
      Object.freeze({
        id: 'skaven-1',
        sourceNoiseId: 'older-noise',
        definitionId: 'clanrat' as const,
        woundsRemaining: 1,
        position: Object.freeze({ row: 10, column: 1 }),
        facing: 'west' as const,
      }),
    ]),
    nextSkavenSequence: 2,
  };

  state = resolveCommand(
    state,
    {
      type: 'place-revealed-skaven',
      noiseId: 'noise-1',
      position: { row: 10, column: 0 },
      facing: 'east',
    },
    fixedRolls(0)
  ).state;

  assert.deepEqual(getLegalSkavenPlacementPositions(state, THE_NEST, 'noise-1'), [
    { row: 9, column: 1 },
  ]);

  state = resolveCommand(
    state,
    {
      type: 'place-revealed-skaven',
      noiseId: 'noise-1',
      position: { row: 9, column: 1 },
      facing: 'north',
    },
    fixedRolls(0)
  ).state;

  assert.deepEqual(getLegalSkavenPlacementPositions(state, THE_NEST, 'noise-1'), [
    { row: 8, column: 1 },
  ]);
});

test('a stranded group away from an entry cannot spill through heroes', () => {
  const base = heroTurnWithRevealedGroup();
  let state: GameState = {
    ...base,
    heroes: [{ ...base.heroes[0]!, position: { row: 2, column: 1 } }],
    revealedNoise: [{ ...base.revealedNoise[0]!, position: { row: 1, column: 1 } }],
    concealedNoise: [
      { id: 'blocking-noise', resultId: 'nothing', position: { row: 1, column: 2 } },
    ],
  };
  state = resolveCommand(
    state,
    {
      type: 'place-revealed-skaven',
      noiseId: 'noise-1',
      position: { row: 1, column: 1 },
      facing: 'south',
    },
    fixedRolls(0)
  ).state;
  assert.deepEqual(getLegalSkavenPlacementPositions(state, THE_NEST, 'noise-1'), []);
});

test('entry spill keeps normal reachable squares before searching through heroes', () => {
  const base = heroTurnWithRevealedGroup('three-clanrats');
  let state: GameState = {
    ...base,
    heroes: [{ ...base.heroes[0]!, position: { row: 9, column: 1 } }],
    revealedNoise: [{ ...base.revealedNoise[0]!, position: { row: 10, column: 0 } }],
  };
  for (const position of [
    { row: 10, column: 0 },
    { row: 10, column: 1 },
  ]) {
    state = resolveCommand(
      state,
      { type: 'place-revealed-skaven', noiseId: 'noise-1', position, facing: 'east' },
      fixedRolls(0)
    ).state;
  }
  assert.deepEqual(getLegalSkavenPlacementPositions(state, THE_NEST, 'noise-1'), [
    { row: 11, column: 1 },
  ]);
});

test('a blocked entry cannot spill through concealed Noise', () => {
  const base = heroTurnWithRevealedGroup();
  let state: GameState = {
    ...base,
    heroes: [{ ...base.heroes[0]!, position: { row: 10, column: 1 } }],
    revealedNoise: [{ ...base.revealedNoise[0]!, position: { row: 10, column: 0 } }],
    concealedNoise: [
      { id: 'blocking-north', resultId: 'nothing', position: { row: 9, column: 1 } },
      { id: 'blocking-south', resultId: 'nothing', position: { row: 11, column: 1 } },
    ],
  };
  state = resolveCommand(
    state,
    {
      type: 'place-revealed-skaven',
      noiseId: 'noise-1',
      position: { row: 10, column: 0 },
      facing: 'east',
    },
    fixedRolls(0)
  ).state;
  assert.deepEqual(getLegalSkavenPlacementPositions(state, THE_NEST, 'noise-1'), []);
});

test('revealed groups interrupt Hero actions until every model is placed', () => {
  const state = heroTurnWithRevealedGroup();

  assert.deepEqual(projectHeroView(state).legalMovePaths, []);
  assert.deepEqual(projectHeroView(state).legalDoorInteractions, []);
  assert.deepEqual(projectHeroView(state).legalFightTargetIds, []);
  assert.throws(
    () =>
      resolveCommand(
        state,
        { type: 'move-hero', heroId: 'gotrek', path: [], facing: 'north' },
        fixedRolls(0)
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'SKAVEN_PLACEMENT_REQUIRED'
  );
});

const combatState = (
  options: {
    readonly heroWounds?: number;
    readonly skavenWounds?: number;
    readonly skavenPosition?: { readonly row: number; readonly column: number };
    readonly skavenType?: 'clanrat' | 'rat-ogor';
  } = {}
): GameState => {
  const base = heroTurnWithRevealedGroup();
  return {
    ...base,
    heroes: Object.freeze([
      Object.freeze({
        ...base.heroes[0]!,
        woundsRemaining: options.heroWounds ?? 3,
        position: Object.freeze({ row: 16, column: 3 }),
      }),
    ]),
    revealedNoise: Object.freeze([]),
    skaven: Object.freeze([
      Object.freeze({
        id: 'skaven-7',
        sourceNoiseId: 'resolved-noise',
        definitionId: options.skavenType ?? ('clanrat' as const),
        woundsRemaining: options.skavenWounds ?? 1,
        position: Object.freeze(options.skavenPosition ?? { row: 15, column: 3 }),
        facing: 'south' as const,
      }),
    ]),
    nextSkavenSequence: 8,
  };
};

test('a Fight rolls every printed die, records a tie, and spends one Action', () => {
  const result = resolveCommand(
    combatState(),
    { type: 'fight-skaven', heroId: 'gotrek', skavenId: 'skaven-7' },
    fixedRolls(0, 0.49, 0.99, 0.99)
  );

  assert.equal(result.state.actionsRemaining, 1);
  assert.equal(result.state.heroes[0]?.woundsRemaining, 3);
  assert.equal(result.state.skaven[0]?.woundsRemaining, 1);
  assert.deepEqual(result.state.combatLog.at(-1), {
    heroId: 'gotrek',
    skavenId: 'skaven-7',
    skavenDefinitionId: 'clanrat',
    heroRolls: [1, 3, 6],
    skavenRolls: [6],
    outcome: 'tie',
  });
  assert.deepEqual(
    result.events.map(event => event.type),
    ['fight-rolled', 'action-spent']
  );
});

test('a winning hero wounds and removes a defeated Skaven model', () => {
  const result = resolveCommand(
    combatState(),
    { type: 'fight-skaven', heroId: 'gotrek', skavenId: 'skaven-7' },
    fixedRolls(0.99, 0, 0, 0)
  );

  assert.deepEqual(result.state.skaven, []);
  assert.equal(result.state.combatLog.at(-1)?.outcome, 'hero-won');
  assert.deepEqual(
    result.events.map(event => event.type),
    ['fight-rolled', 'model-wounded', 'model-defeated', 'action-spent']
  );
});

test('a multi-Wound Rat Ogor remains in play until its last Wound is suffered', () => {
  const result = resolveCommand(
    combatState({ skavenType: 'rat-ogor', skavenWounds: 2 }),
    { type: 'fight-skaven', heroId: 'gotrek', skavenId: 'skaven-7' },
    fixedRolls(0.99, 0, 0, 0, 0, 0)
  );

  assert.equal(result.state.skaven[0]?.woundsRemaining, 1);
  assert.equal(
    result.events.some(event => event.type === 'model-defeated'),
    false
  );
});

test('a winning Skaven wounds and removes a defeated hero from the board', () => {
  const result = resolveCommand(
    combatState({ heroWounds: 1 }),
    { type: 'fight-skaven', heroId: 'gotrek', skavenId: 'skaven-7' },
    fixedRolls(0, 0, 0, 0.99)
  );

  assert.equal(result.state.heroes[0]?.woundsRemaining, 0);
  assert.equal(result.state.heroes[0]?.position, null);
  assert.equal(result.state.activeHeroId, null);
  assert.equal(result.state.actionsRemaining, null);
  assert.equal(result.state.combatLog.at(-1)?.outcome, 'skaven-won');
  assert.deepEqual(
    result.events.map(event => event.type),
    ['fight-rolled', 'model-wounded', 'model-defeated', 'hero-activation-ended']
  );
});

test('Fight rejects non-adjacent or unknown targets without changing state', () => {
  const state = combatState({ skavenPosition: { row: 13, column: 3 } });
  const before = JSON.stringify(state);

  assert.throws(
    () =>
      resolveCommand(
        state,
        { type: 'fight-skaven', heroId: 'gotrek', skavenId: 'skaven-7' },
        fixedRolls(0)
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'FIGHT_TARGET_NOT_ADJACENT'
  );
  assert.equal(JSON.stringify(state), before);
});

test('invalid combat randomness rejects the entire Fight transaction', () => {
  const state = combatState();
  const before = JSON.stringify(state);

  assert.throws(
    () =>
      resolveCommand(
        state,
        { type: 'fight-skaven', heroId: 'gotrek', skavenId: 'skaven-7' },
        fixedRolls(0, 0, 1)
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'INVALID_RANDOM_VALUE'
  );
  assert.equal(JSON.stringify(state), before);
});

test('the hero projection exposes models, legal Fight targets, and combat results', () => {
  const state = combatState();
  const view = projectHeroView(state);

  assert.equal(view.skaven[0]?.id, 'skaven-7');
  assert.deepEqual(view.legalFightTargetIds, ['skaven-7']);
  assert.deepEqual(view.combatLog, []);
});
