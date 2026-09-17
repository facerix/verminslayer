import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createInitialGameState,
  getLegalSkavenDoorInteractions,
  getLegalSkavenFightTargetIds,
  getLegalSkavenMovePaths,
  getLegalNoiseMovePaths,
  getLegalSkavenPlacementPositions,
  getSkavenApproachPaths,
  getSkavenDistanceToNearestReachableHero,
  resolveCommand,
} from '../../src/game/gameState.ts';
import type { GameState, RandomSource } from '../../src/game/gameState.ts';
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

test('Skaven approach paths use board distance to the nearest reachable attack square', () => {
  let state = skavenTurn();
  assert.equal(getSkavenDistanceToNearestReachableHero(state, THE_NEST, 'skaven-1'), 2);

  state = resolveCommand(
    state,
    { type: 'start-skaven-activation', skavenId: 'skaven-1' },
    fixedRolls(0)
  ).state;

  assert.deepEqual(getSkavenApproachPaths(state, THE_NEST, 'skaven-1'), [
    {
      destination: { row: 4, column: 3 },
      steps: [
        { row: 4, column: 2 },
        { row: 4, column: 3 },
      ],
    },
  ]);
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
  assert.equal(result.state.pendingReact?.source, 'skaven');
  assert.equal(result.events.at(-1)?.type, 'react-window-opened');
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
  state = resolveCommand(state, { type: 'skip-react' }, fixedRolls(0)).state;

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
  state = resolveCommand(state, { type: 'skip-react' }, fixedRolls(0)).state;

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
  state = resolveCommand(state, { type: 'skip-react' }, fixedRolls(0)).state;

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

test('ending the last revealed Skaven activation skips an empty Noise step', () => {
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

  assert.equal(result.state.skavenTurnStep, 'reinforce');
  assert.deepEqual(result.state.activatedSkavenIds, ['skaven-1']);
  assert.equal(result.state.activeSkavenId, null);
});

test('React gates the Skaven Action, costs 2 Command, and can defeat the mover', () => {
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

  assert.equal(state.pendingReact?.sourceId, 'skaven-1');
  assert.throws(
    () =>
      resolveCommand(
        state,
        { type: 'fight-hero', skavenId: 'skaven-1', heroId: 'gotrek' },
        fixedRolls(0)
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'REACT_WINDOW_OPEN'
  );

  const result = resolveCommand(
    state,
    { type: 'react-fight-skaven', heroId: 'gotrek', skavenId: 'skaven-1' },
    fixedRolls(0.99, 0.99, 0.99, 0)
  );
  assert.equal(result.state.command, 0);
  assert.equal(result.state.pendingReact, null);
  assert.deepEqual(result.state.skaven, []);
  assert.equal(result.state.skavenTurnStep, 'reinforce');
});

test('React may use an adjacent Door action without consuming a Hero activation', () => {
  let state = skavenTurn();
  state = {
    ...state,
    heroes: Object.freeze([
      Object.freeze({ ...state.heroes[0]!, position: Object.freeze({ row: 5, column: 4 }) }),
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
  const result = resolveCommand(
    state,
    { type: 'react-interact-door', heroId: 'gotrek', position: { row: 6, column: 4 } },
    fixedRolls(0)
  );
  assert.equal(result.state.command, 0);
  assert.equal(result.state.pendingReact, null);
  assert.equal(result.state.activatedHeroIds.includes('gotrek'), true);
  assert.equal(
    result.state.doors.find(door => door.position.row === 6 && door.position.column === 4)?.status,
    'open'
  );
});

test('Noise follows a shortest route, reveals, and grants its group Actions without Movement', () => {
  let state = skavenTurn();
  state = {
    ...state,
    skaven: Object.freeze([]),
    skavenTurnStep: 'activate-noise',
    skavenActivationIds: Object.freeze([]),
    activatedSkavenIds: Object.freeze([]),
    activeSkavenId: null,
    doors: Object.freeze(
      state.doors.map(door => Object.freeze({ ...door, status: 'open' as const }))
    ),
    concealedNoise: Object.freeze([
      Object.freeze({
        id: 'noise-2',
        resultId: 'two-clanrats' as const,
        position: Object.freeze({ row: 8, column: 5 }),
      }),
    ]),
    noiseActivationIds: Object.freeze(['noise-2']),
    activatedNoiseIds: Object.freeze([]),
    activeNoiseId: null,
    noiseActionIds: Object.freeze([]),
  };
  state = resolveCommand(
    state,
    { type: 'start-noise-activation', noiseId: 'noise-2' },
    fixedRolls(0)
  ).state;
  const path = getLegalNoiseMovePaths(state, THE_NEST)[0]!;
  assert.ok(path.steps.length > 0 && path.steps.length <= 5);
  state = resolveCommand(
    state,
    { type: 'move-noise', noiseId: 'noise-2', path: path.steps },
    fixedRolls(0)
  ).state;
  assert.equal(state.concealedNoise.length, 0);
  assert.equal(state.revealedNoise[0]?.id, 'noise-2');

  while (state.revealedNoise[0]) {
    const noise = state.revealedNoise[0];
    state = resolveCommand(
      state,
      {
        type: 'place-revealed-skaven',
        noiseId: noise.id,
        position: getLegalSkavenPlacementPositions(state, THE_NEST, noise.id)[0]!,
        facing: 'south',
      },
      fixedRolls(0)
    ).state;
  }

  assert.equal(state.pendingReact?.source, 'noise');
  assert.equal(state.noiseActionIds.length, 2);
  state = resolveCommand(state, { type: 'skip-react' }, fixedRolls(0)).state;
  const actingId = state.noiseActionIds[0]!;
  state = resolveCommand(
    state,
    { type: 'start-skaven-activation', skavenId: actingId },
    fixedRolls(0)
  ).state;
  assert.equal(state.skavenMovementRemaining, 0);
  assert.deepEqual(getLegalSkavenMovePaths(state, THE_NEST), []);
});

test('Noise advances toward a closed door when no hero is currently reachable', () => {
  let state = skavenTurn();
  state = {
    ...state,
    skaven: Object.freeze([]),
    skavenTurnStep: 'activate-noise',
    skavenActivationIds: Object.freeze([]),
    activatedSkavenIds: Object.freeze([]),
    activeSkavenId: null,
    heroes: Object.freeze([
      Object.freeze({
        ...state.heroes[0]!,
        position: Object.freeze({ row: 16, column: 3 }),
      }),
    ]),
    concealedNoise: Object.freeze([
      Object.freeze({
        id: 'noise-2',
        resultId: 'nothing' as const,
        position: Object.freeze({ row: 8, column: 12 }),
      }),
    ]),
    noiseActivationIds: Object.freeze(['noise-2']),
    activatedNoiseIds: Object.freeze([]),
    activeNoiseId: null,
    noiseActionIds: Object.freeze([]),
  };
  state = resolveCommand(
    state,
    { type: 'start-noise-activation', noiseId: 'noise-2' },
    fixedRolls(0)
  ).state;

  const paths = getLegalNoiseMovePaths(state, THE_NEST);

  assert.equal(
    paths.every(path => path.steps.length > 0),
    true
  );
  assert.equal(
    paths.every(path =>
      path.steps.every(
        step =>
          !state.doors.some(
            door =>
              door.status === 'closed' &&
              door.position.row === step.row &&
              door.position.column === step.column
          )
      )
    ),
    true
  );
});

test('two private reinforcements complete the round and reset Command to 2', () => {
  let state: GameState = {
    ...skavenTurn(),
    skaven: Object.freeze([]),
    skavenTurnStep: 'reinforce' as const,
    skavenActivationIds: Object.freeze([]),
    remainingNoiseBag: Object.freeze(['nothing' as const, 'nothing' as const]),
    command: 0,
  };
  const spawns = THE_NEST.board.spawns;
  for (let index = 0; index < 2; index++) {
    state = resolveCommand(state, { type: 'draw-reinforcement-noise' }, fixedRolls(0)).state;
    assert.equal(state.pendingNoise?.resultId, 'nothing');
    state = resolveCommand(
      state,
      { type: 'place-reinforcement-noise', position: spawns[index]! },
      fixedRolls(0)
    ).state;
  }
  assert.equal(state.phase, 'hero');
  assert.equal(state.round, 2);
  assert.equal(state.command, 2);
  assert.equal(state.skavenTurnStep, null);
});

for (const resultId of ['two-clanrats', 'three-clanrats'] as const) {
  test(`${resultId} reinforcement spills past a hero blocking the entry`, () => {
    const base = skavenTurn();
    const heroPosition = { row: 10, column: 1 };
    let state: GameState = {
      ...base,
      skaven: [],
      skavenTurnStep: 'reinforce',
      skavenActivationIds: [],
      remainingNoiseBag: [resultId],
      reinforcementDrawsResolved: 1,
      heroes: [{ ...base.heroes[0]!, position: heroPosition }],
    };
    state = resolveCommand(state, { type: 'draw-reinforcement-noise' }, fixedRolls(0)).state;
    state = resolveCommand(
      state,
      { type: 'place-reinforcement-noise', position: { row: 10, column: 0 } },
      fixedRolls(0)
    ).state;
    const noiseId = state.revealedNoise[0]!.id;
    state = resolveCommand(
      state,
      {
        type: 'place-revealed-skaven',
        noiseId,
        position: { row: 10, column: 0 },
        facing: 'east',
      },
      fixedRolls(0)
    ).state;

    assert.deepEqual(getLegalSkavenPlacementPositions(state, THE_NEST, noiseId), [
      { row: 9, column: 1 },
      { row: 11, column: 1 },
    ]);
    assert.throws(
      () =>
        resolveCommand(
          state,
          { type: 'place-revealed-skaven', noiseId, position: heroPosition, facing: 'east' },
          fixedRolls(0)
        ),
      (error: unknown) => error instanceof RulesError && error.code === 'INVALID_SKAVEN_PLACEMENT'
    );
    while (state.revealedNoise.length > 0) {
      const position = getLegalSkavenPlacementPositions(state, THE_NEST, noiseId)[0];
      assert.ok(position, 'every remaining Clanrat must have an empty spill destination');
      state = resolveCommand(
        state,
        { type: 'place-revealed-skaven', noiseId, position, facing: 'east' },
        fixedRolls(0)
      ).state;
    }

    assert.equal(state.skaven.length, THE_NEST.noiseResults[resultId].models.length);
    assert.equal(
      new Set(state.skaven.map(model => JSON.stringify(model.position))).size,
      state.skaven.length
    );
    assert.deepEqual(state.heroes[0]!.position, heroPosition);
    assert.equal(state.phase, 'hero');
    assert.equal(state.noiseActionIds.length, 0);
  });
}

test('an immediately revealed reinforcement is placed but receives no Action this turn', () => {
  let state: GameState = {
    ...skavenTurn(),
    skaven: Object.freeze([]),
    skavenTurnStep: 'reinforce',
    skavenActivationIds: Object.freeze([]),
    remainingNoiseBag: Object.freeze(['gutter-runner']),
    reinforcementDrawsResolved: 1,
    heroes: Object.freeze([
      Object.freeze({
        ...skavenTurn().heroes[0]!,
        position: Object.freeze({ row: 9, column: 0 }),
      }),
    ]),
  };
  state = resolveCommand(state, { type: 'draw-reinforcement-noise' }, fixedRolls(0)).state;
  state = resolveCommand(
    state,
    { type: 'place-reinforcement-noise', position: { row: 10, column: 0 } },
    fixedRolls(0)
  ).state;
  assert.equal(state.revealedNoise[0]?.resultId, 'gutter-runner');
  const noise = state.revealedNoise[0]!;
  state = resolveCommand(
    state,
    {
      type: 'place-revealed-skaven',
      noiseId: noise.id,
      position: getLegalSkavenPlacementPositions(state, THE_NEST, noise.id)[0]!,
      facing: 'north',
    },
    fixedRolls(0)
  ).state;
  assert.equal(state.phase, 'hero');
  assert.equal(state.noiseActionIds.length, 0);
  assert.equal(state.skaven.length, 1);
});
