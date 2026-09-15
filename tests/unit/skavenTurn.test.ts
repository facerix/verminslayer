import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createInitialGameState,
  getLegalSkavenDoorInteractions,
  getLegalSkavenFightTargetIds,
  getLegalSkavenMovePaths,
  resolveCommand,
} from '../../src/game/gameState.ts';
import type { RandomSource } from '../../src/game/gameState.ts';
import { THE_NEST } from '../../src/game/missions/theNest.ts';
import { RulesError } from '../../src/game/rulesError.ts';

const fixedRolls = (...values: readonly number[]): RandomSource => {
  let index = 0;
  return Object.freeze({ next: () => values[index++] ?? values.at(-1) ?? 0 });
};

const skavenTurn = (definitionId: 'clanrat' | 'gutter-runner' | 'rat-ogor' = 'clanrat') => {
  let state = resolveCommand(
    createInitialGameState(THE_NEST),
    { type: 'configure-game', mode: 'two-player', heroIds: ['gotrek'] },
    fixedRolls(0)
  ).state;
  state = {
    ...state,
    setupStep: 'complete',
    phase: 'hero',
    round: 1,
    command: 2,
    heroes: Object.freeze([
      Object.freeze({
        ...state.heroes[0]!,
        position: Object.freeze({ row: 4, column: 4 }),
        facing: 'north' as const,
      }),
    ]),
    skaven: Object.freeze([
      Object.freeze({
        id: 'skaven-1',
        sourceNoiseId: 'noise-1',
        definitionId,
        woundsRemaining: definitionId === 'rat-ogor' ? 2 : 1,
        position: Object.freeze({ row: 4, column: 1 }),
        facing: 'east' as const,
      }),
    ]),
    nextSkavenSequence: 2,
    activatedHeroIds: Object.freeze(['gotrek']),
  };
  return resolveCommand(state, { type: 'end-hero-phase', confirmed: true }, fixedRolls(0)).state;
};

test('noise reveals from adjacency even when line of sight is blocked', () => {
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
  state = {
    ...state,
    heroes: Object.freeze([
      Object.freeze({
        ...state.heroes[0]!,
        position: Object.freeze({ row: 9, column: 0 }),
      }),
    ]),
  };
  state = resolveCommand(state, { type: 'draw-initial-noise' }, fixedRolls(0)).state;

  const result = resolveCommand(
    state,
    { type: 'place-initial-noise', position: { row: 10, column: 0 } },
    fixedRolls(0)
  );

  assert.deepEqual(result.state.concealedNoise, []);
  assert.equal(result.state.revealedNoise[0]?.id, 'noise-1');
  assert.equal(
    result.events.some(event => event.type === 'noise-revealed'),
    true
  );
});

test('the Skaven turn snapshots models that may activate this turn', () => {
  const state = skavenTurn();

  assert.equal(state.skavenTurnStep, 'activate-skaven');
  assert.deepEqual(state.skavenActivationIds, ['skaven-1']);
  assert.deepEqual(state.activatedSkavenIds, []);
  assert.equal(state.activeSkavenId, null);
});

test('a revealed Skaven takes one Movement, may change facing, and cannot split it', () => {
  let state = skavenTurn();
  state = resolveCommand(
    state,
    { type: 'start-skaven-activation', skavenId: 'skaven-1' },
    fixedRolls(0)
  ).state;

  assert.equal(state.skavenMovementRemaining, 4);
  assert.ok(
    getLegalSkavenMovePaths(state, THE_NEST).some(
      path => path.destination.row === 4 && path.destination.column === 3
    )
  );
  state = resolveCommand(
    state,
    {
      type: 'move-skaven',
      skavenId: 'skaven-1',
      path: [
        { row: 4, column: 2 },
        { row: 4, column: 3 },
      ],
      facing: 'south',
    },
    fixedRolls(0)
  ).state;

  assert.deepEqual(state.skaven[0]?.position, { row: 4, column: 3 });
  assert.equal(state.skaven[0]?.facing, 'south');
  assert.equal(state.skavenMovementRemaining, 0);
  assert.deepEqual(getLegalSkavenMovePaths(state, THE_NEST), []);
  assert.throws(
    () =>
      resolveCommand(
        state,
        {
          type: 'move-skaven',
          skavenId: 'skaven-1',
          path: [],
          facing: 'south',
        },
        fixedRolls(0)
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'SKAVEN_MOVEMENT_USED'
  );
});

test('a Skaven may hold position to complete its Movement', () => {
  let state = skavenTurn();
  state = resolveCommand(
    state,
    { type: 'start-skaven-activation', skavenId: 'skaven-1' },
    fixedRolls(0)
  ).state;

  const result = resolveCommand(
    state,
    { type: 'move-skaven', skavenId: 'skaven-1', path: [], facing: 'east' },
    fixedRolls(0)
  );

  assert.equal(result.state.skavenMovementRemaining, 0);
  assert.equal(result.events.at(-1)?.type, 'skaven-movement-completed');
});

test('Skaven Movement rejects blocked paths transactionally', () => {
  let state = skavenTurn();
  state = resolveCommand(
    state,
    { type: 'start-skaven-activation', skavenId: 'skaven-1' },
    fixedRolls(0)
  ).state;
  const before = JSON.stringify(state);

  assert.throws(
    () =>
      resolveCommand(
        state,
        {
          type: 'move-skaven',
          skavenId: 'skaven-1',
          path: [{ row: 4, column: 0 }],
          facing: 'west',
        },
        fixedRolls(0)
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'INVALID_MOVEMENT_PATH'
  );
  assert.equal(JSON.stringify(state), before);
});

test('a Skaven cannot take its Action before completing Movement', () => {
  let state = skavenTurn();
  state = resolveCommand(
    state,
    { type: 'start-skaven-activation', skavenId: 'skaven-1' },
    fixedRolls(0)
  ).state;

  assert.throws(
    () =>
      resolveCommand(
        state,
        { type: 'fight-hero', skavenId: 'skaven-1', heroId: 'gotrek' },
        fixedRolls(0)
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'SKAVEN_MOVEMENT_REQUIRED'
  );
});

test('an active Skaven can Fight an adjacent hero once', () => {
  let state = skavenTurn();
  state = resolveCommand(
    state,
    { type: 'start-skaven-activation', skavenId: 'skaven-1' },
    fixedRolls(0)
  ).state;
  state = resolveCommand(
    state,
    {
      type: 'move-skaven',
      skavenId: 'skaven-1',
      path: [
        { row: 4, column: 2 },
        { row: 4, column: 3 },
      ],
      facing: 'east',
    },
    fixedRolls(0)
  ).state;

  assert.deepEqual(getLegalSkavenFightTargetIds(state), ['gotrek']);
  const result = resolveCommand(
    state,
    { type: 'fight-hero', skavenId: 'skaven-1', heroId: 'gotrek' },
    fixedRolls(0, 0, 0, 0.99)
  );

  assert.equal(result.state.skavenActionsRemaining, 0);
  assert.equal(result.state.heroes[0]?.woundsRemaining, 2);
  assert.equal(result.state.combatLog.at(-1)?.outcome, 'skaven-won');
});

test('a Clanrat may spend its Action opening or closing an adjacent door', () => {
  let state = skavenTurn();
  state = {
    ...state,
    skaven: Object.freeze([
      Object.freeze({ ...state.skaven[0]!, position: Object.freeze({ row: 5, column: 4 }) }),
    ]),
  };
  state = resolveCommand(
    state,
    { type: 'start-skaven-activation', skavenId: 'skaven-1' },
    fixedRolls(0)
  ).state;
  state = resolveCommand(
    state,
    { type: 'move-skaven', skavenId: 'skaven-1', path: [], facing: 'east' },
    fixedRolls(0)
  ).state;

  assert.deepEqual(getLegalSkavenDoorInteractions(state, THE_NEST), [{ row: 6, column: 4 }]);
  const result = resolveCommand(
    state,
    { type: 'interact-door-skaven', skavenId: 'skaven-1', position: { row: 6, column: 4 } },
    fixedRolls(0)
  );

  assert.equal(
    result.state.doors.find(door => door.position.row === 6 && door.position.column === 4)?.status,
    'open'
  );
  assert.equal(result.state.skavenActionsRemaining, 0);
});

test('only a Clanrat may take the Door action', () => {
  let state = skavenTurn('gutter-runner');
  state = {
    ...state,
    skaven: Object.freeze([
      Object.freeze({ ...state.skaven[0]!, position: Object.freeze({ row: 5, column: 4 }) }),
    ]),
  };
  state = resolveCommand(
    state,
    { type: 'start-skaven-activation', skavenId: 'skaven-1' },
    fixedRolls(0)
  ).state;
  state = resolveCommand(
    state,
    { type: 'move-skaven', skavenId: 'skaven-1', path: [], facing: 'east' },
    fixedRolls(0)
  ).state;

  assert.deepEqual(getLegalSkavenDoorInteractions(state, THE_NEST), []);
  assert.throws(
    () =>
      resolveCommand(
        state,
        {
          type: 'interact-door-skaven',
          skavenId: 'skaven-1',
          position: { row: 6, column: 4 },
        },
        fixedRolls(0)
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'CLANRAT_DOOR_ONLY'
  );
});

test('newly revealed Skaven are excluded from the turn-start activation snapshot', () => {
  let state = skavenTurn();
  state = {
    ...state,
    revealedNoise: Object.freeze([
      Object.freeze({
        id: 'noise-2',
        resultId: 'gutter-runner' as const,
        position: Object.freeze({ row: 4, column: 2 }),
        remainingModels: Object.freeze(['gutter-runner' as const]),
      }),
    ]),
  };
  state = resolveCommand(
    state,
    {
      type: 'place-revealed-skaven',
      noiseId: 'noise-2',
      position: { row: 4, column: 2 },
      facing: 'east',
    },
    fixedRolls(0)
  ).state;

  assert.equal(state.skaven[1]?.id, 'skaven-2');
  assert.throws(
    () =>
      resolveCommand(
        state,
        { type: 'start-skaven-activation', skavenId: 'skaven-2' },
        fixedRolls(0)
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'SKAVEN_NOT_ELIGIBLE'
  );
});

test('ending the last revealed Skaven activation advances to Noise activation', () => {
  let state = skavenTurn();
  state = resolveCommand(
    state,
    { type: 'start-skaven-activation', skavenId: 'skaven-1' },
    fixedRolls(0)
  ).state;

  const result = resolveCommand(
    state,
    { type: 'end-skaven-activation', skavenId: 'skaven-1', confirmed: true },
    fixedRolls(0)
  );

  assert.equal(result.state.skavenTurnStep, 'activate-noise');
  assert.deepEqual(result.state.activatedSkavenIds, ['skaven-1']);
  assert.equal(result.state.activeSkavenId, null);
});
