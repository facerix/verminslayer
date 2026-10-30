import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createInitialGameState,
  getLegalNoiseMovePaths,
  getLegalSkavenPlacementPositions,
  projectHeroView,
  resolveCommand,
  restoreGameState,
} from '../../src/game/gameState.ts';
import type { GameState } from '../../src/game/gameState.ts';
import type { NoiseResultId } from '../../src/game/missionDefinition.ts';
import { THE_UNDERBURROW } from '../../src/game/missions/theUnderburrow.ts';
import { GameSession } from '../../src/game/gameSession.ts';
import { runSoloSkavenAi } from '../../src/game/skavenAi.ts';
import { RulesError } from '../../src/game/rulesError.ts';
import { SkavenTurnGameModule } from '../../src/game/modules/skavenTurn.ts';

const random = { next: () => 0 };
const doorPosition = { row: 6, column: 4 };
const noisePosition = { row: 7, column: 4 };

const noiseTurn = (resultId: NoiseResultId, command = 2): GameState => {
  const base = resolveCommand(
    createInitialGameState(THE_UNDERBURROW),
    {
      type: 'configure-game',
      mode: 'two-player',
      heroIds: ['gotrek'],
    },
    random
  ).state;
  return {
    ...base,
    setupStep: 'complete',
    phase: 'skaven',
    round: 1,
    command,
    heroes: [{ ...base.heroes[0]!, position: { row: 5, column: 4 }, facing: 'south' }],
    concealedNoise: [{ id: 'noise-1', resultId, position: noisePosition }],
    noiseActivationIds: ['noise-1'],
    activeNoiseId: 'noise-1',
    skavenTurnStep: 'activate-noise',
  };
};

const resolveDoor = (state: GameState) =>
  resolveCommand(
    state,
    {
      type: 'move-noise',
      noiseId: 'noise-1',
      path: [],
      doorPosition,
    },
    random
  );

const placeGroup = (initial: GameState): GameState => {
  let state = initial;
  while (state.revealedNoise[0]) {
    const noise = state.revealedNoise[0];
    state = resolveCommand(
      state,
      {
        type: 'place-revealed-skaven',
        noiseId: noise.id,
        position: getLegalSkavenPlacementPositions(state, THE_UNDERBURROW, noise.id)[0]!,
        facing: 'north',
      },
      random
    ).state;
  }
  return state;
};

for (const resultId of [
  'two-clanrats',
  'three-clanrats',
  'gutter-runner',
  'rat-ogor',
  'nothing',
] as const) {
  test(`${resultId} Noise resolves a blocking door without moving`, () => {
    const state = noiseTurn(resultId);
    assert.deepEqual(getLegalNoiseMovePaths(state, THE_UNDERBURROW), [
      { destination: noisePosition, steps: [], doorPosition },
    ]);
    const result = resolveDoor(state);
    assert.equal(
      result.state.doors.find(door => door.position.row === 6 && door.position.column === 4)
        ?.status,
      resultId === 'nothing' ? 'closed' : resultId === 'rat-ogor' ? 'destroyed' : 'open'
    );
    assert.equal(
      result.events.some(event => event.type === 'noise-moved'),
      false
    );
    assert.deepEqual(
      state.doors.find(door => door.position.row === 6 && door.position.column === 4)?.status,
      'closed'
    );
    if (resultId === 'nothing') {
      assert.deepEqual(result.state.concealedNoise[0]?.position, noisePosition);
      assert.equal(result.state.skavenTurnStep, 'reinforce');
      assert.equal(result.state.pendingReact, null);
      assert.equal(
        result.events.some(event => event.type === 'noise-revealed'),
        false
      );
    } else {
      assert.equal(
        result.events.some(
          event => event.type === (resultId === 'rat-ogor' ? 'door-destroyed' : 'door-opened')
        ),
        true
      );
      assert.equal(result.state.revealedNoise[0]?.resultId, resultId);
      const placed = placeGroup(
        restoreGameState(JSON.parse(JSON.stringify(result.state)), THE_UNDERBURROW)
      );
      assert.equal(placed.skaven.length, THE_UNDERBURROW.noiseResults[resultId].models.length);
      assert.deepEqual(placed.noiseActionIds, []);
      assert.deepEqual(placed.pendingReact, { source: 'noise', sourceId: 'noise-1' });
      assert.throws(
        () =>
          resolveCommand(
            placed,
            { type: 'start-skaven-activation', skavenId: placed.skaven[0]!.id },
            random
          ),
        RulesError
      );
      const finished = resolveCommand(placed, { type: 'skip-react' }, random).state;
      assert.equal(finished.activeNoiseId, null);
      assert.equal(finished.skavenTurnStep, 'reinforce');
      assert.deepEqual(finished.activatedNoiseIds, ['noise-1']);
      assert.throws(
        () =>
          resolveCommand(
            finished,
            { type: 'start-skaven-activation', skavenId: finished.skaven[0]!.id },
            random
          ),
        RulesError
      );
    }
  });
}

test('Noise plans through a closed door even when an open detour exists', () => {
  const base = noiseTurn('gutter-runner');
  const state: GameState = {
    ...base,
    doors: base.doors.map(door => ({
      ...door,
      status: door.position.row === 6 && door.position.column === 4 ? 'closed' : 'open',
    })),
  };
  assert.deepEqual(getLegalNoiseMovePaths(state, THE_UNDERBURROW), [
    { destination: noisePosition, steps: [], doorPosition },
  ]);
});

test('moving to a blocking door does not open it in the same activation', () => {
  const base = noiseTurn('rat-ogor');
  const start = { row: 8, column: 4 };
  const state: GameState = {
    ...base,
    concealedNoise: [{ ...base.concealedNoise[0]!, position: start }],
  };
  const paths = getLegalNoiseMovePaths(state, THE_UNDERBURROW);
  assert.deepEqual(paths, [{ destination: noisePosition, steps: [noisePosition] }]);
  const result = resolveCommand(
    state,
    { type: 'move-noise', noiseId: 'noise-1', path: paths[0]!.steps },
    random
  );
  assert.equal(
    result.state.doors.find(door => door.position.row === 6 && door.position.column === 4)?.status,
    'closed'
  );
  assert.deepEqual(result.state.concealedNoise[0]?.position, noisePosition);
  assert.equal(result.state.skavenTurnStep, 'reinforce');
  assert.throws(() => resolveDoor(state), RulesError);
  const nextActivation: GameState = {
    ...result.state,
    round: 2,
    activeNoiseId: 'noise-1',
    activatedNoiseIds: [],
    skavenTurnStep: 'activate-noise',
  };
  assert.equal(
    resolveDoor(nextActivation).state.doors.find(
      door => door.position.row === 6 && door.position.column === 4
    )?.status,
    'destroyed'
  );
});

test('Noise cannot select a door outside its shortest route or omit the blocking door', () => {
  const state = noiseTurn('gutter-runner');
  for (const command of [
    { type: 'move-noise', noiseId: 'noise-1', path: [], doorPosition: { row: 6, column: 7 } },
    { type: 'move-noise', noiseId: 'noise-1', path: [] },
    { type: 'move-noise', noiseId: 'noise-1', path: [doorPosition], doorPosition },
  ] as const) {
    assert.throws(
      () => resolveCommand(state, command, random),
      (error: unknown) => error instanceof RulesError && error.code === 'INVALID_NOISE_PATH'
    );
  }
});

test('door revelation with insufficient Command finishes after placement without Actions', () => {
  const placed = placeGroup(resolveDoor(noiseTurn('three-clanrats', 1)).state);
  assert.equal(placed.skaven.length, 3);
  assert.equal(placed.pendingReact, null);
  assert.equal(placed.activeNoiseId, null);
  assert.equal(placed.skavenTurnStep, 'reinforce');
  assert.deepEqual(placed.noiseActionIds, []);
});

test('a door-opening Noise remains hidden when the door change does not expose it', () => {
  const base = noiseTurn('two-clanrats');
  const state: GameState = {
    ...base,
    heroes: [{ ...base.heroes[0]!, position: { row: 4, column: 1 } }],
  };
  const result = resolveDoor(state);
  assert.equal(
    result.state.doors.find(door => door.position.row === 6 && door.position.column === 4)?.status,
    'open'
  );
  assert.equal(result.state.concealedNoise.length, 1);
  assert.equal(result.state.pendingReact, null);
  assert.equal(result.state.activeNoiseId, null);
  assert.equal(result.state.skavenTurnStep, 'reinforce');
  assert.equal(
    result.events.some(event => event.type === 'noise-revealed'),
    false
  );
});

test('public route choices do not expose the hidden Noise result', () => {
  const views = ['two-clanrats', 'gutter-runner', 'rat-ogor', 'nothing'].map(resultId =>
    projectHeroView(noiseTurn(resultId as NoiseResultId))
  );
  for (const view of views) {
    assert.deepEqual(view.noiseTokens, [{ id: 'noise-1', position: noisePosition }]);
    assert.deepEqual(view.legalNoiseMovePaths, views[0]!.legalNoiseMovePaths);
    assert.equal(JSON.stringify(view).includes('resultId'), false);
  }
});

test('solo AI resolves the door, pauses for React, and never grants post-door Actions', () => {
  const session = new GameSession(THE_UNDERBURROW, random, {
    ...noiseTurn('three-clanrats'),
    mode: 'solo',
  });
  const events = runSoloSkavenAi(session, random);
  assert.equal(
    events.some(event => event.type === 'door-opened'),
    true
  );
  assert.equal(session.heroView.pendingReact?.source, 'noise');
  assert.deepEqual(session.heroView.noiseActionIds, []);
  session.dispatch({ type: 'skip-react' });
  const remaining = runSoloSkavenAi(session, random);
  assert.equal(
    remaining.some(event => event.type === 'skaven-activation-started'),
    false
  );
  assert.equal(session.heroView.phase, 'hero');
  assert.equal(session.heroView.round, 2);
});

test('diagonally adjacent blocking doors remain distinct tied route choices', () => {
  const base = noiseTurn('rat-ogor');
  const state: GameState = {
    ...base,
    heroes: [{ ...base.heroes[0]!, position: { row: 9, column: 11 } }],
    concealedNoise: [{ ...base.concealedNoise[0]!, position: { row: 13, column: 5 } }],
  };
  assert.deepEqual(getLegalNoiseMovePaths(state, THE_UNDERBURROW), [
    { destination: { row: 13, column: 5 }, steps: [], doorPosition: { row: 12, column: 5 } },
    { destination: { row: 13, column: 5 }, steps: [], doorPosition: { row: 14, column: 6 } },
  ]);
  for (const doorPosition of [
    { row: 12, column: 5 },
    { row: 14, column: 6 },
  ]) {
    const result = resolveCommand(
      state,
      { type: 'move-noise', noiseId: 'noise-1', path: [], doorPosition },
      random
    );
    assert.equal(
      result.state.doors.find(
        door =>
          door.position.row === doorPosition.row && door.position.column === doorPosition.column
      )?.status,
      'destroyed'
    );
    assert.equal(
      result.events.some(event => event.type === 'noise-moved'),
      false
    );
  }
});

test('a Fight reaction finishes the spent Noise activation while surviving Clanrats cannot act', () => {
  const placed = placeGroup(resolveDoor(noiseTurn('two-clanrats')).state);
  const restored = restoreGameState(JSON.parse(JSON.stringify(placed)), THE_UNDERBURROW);
  const target = projectHeroView(restored).legalReactFightOptions[0];
  assert.ok(target, 'one placed Clanrat should be within Fight range');
  const rolls = [0.99, 0.99, 0.99, 0];
  const result = resolveCommand(
    restored,
    { type: 'react-fight-skaven', ...target },
    { next: () => rolls.shift()! }
  );
  assert.equal(result.state.skaven.length, 1);
  assert.equal(result.state.command, 0);
  assert.equal(result.state.pendingReact, null);
  assert.equal(result.state.activeNoiseId, null);
  assert.equal(result.state.skavenTurnStep, 'reinforce');
  assert.deepEqual(result.state.noiseActionIds, []);
});

test('React may close an opened door but cannot close a smashed door', () => {
  const opened = placeGroup(resolveDoor(noiseTurn('gutter-runner')).state);
  const result = resolveCommand(
    opened,
    { type: 'react-interact-door', heroId: 'gotrek', position: doorPosition },
    random
  );
  assert.equal(
    result.state.doors.find(door => door.position.row === 6 && door.position.column === 4)?.status,
    'closed'
  );
  assert.equal(result.state.skavenTurnStep, 'reinforce');
  const smashed = placeGroup(resolveDoor(noiseTurn('rat-ogor')).state);
  assert.throws(
    () =>
      resolveCommand(
        smashed,
        { type: 'react-interact-door', heroId: 'gotrek', position: doorPosition },
        random
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'INVALID_DOOR'
  );
});

test('opening a door also reveals other visible Noise without giving it immediate Actions', () => {
  const base = noiseTurn('gutter-runner');
  const state: GameState = {
    ...base,
    concealedNoise: [
      ...base.concealedNoise,
      { id: 'noise-2', resultId: 'gutter-runner', position: { row: 8, column: 4 } },
    ],
    noiseActivationIds: ['noise-1', 'noise-2'],
  };
  const result = resolveDoor(state);
  assert.equal(result.state.revealedNoise.length, 2);
  const placed = placeGroup(result.state);
  assert.equal(placed.skaven.length, 2);
  assert.deepEqual(placed.noiseActionIds, []);
  assert.equal(placed.pendingReact?.sourceId, 'noise-1');
  const finished = resolveCommand(placed, { type: 'skip-react' }, random).state;
  assert.equal(finished.skavenTurnStep, 'reinforce');
  assert.deepEqual(finished.noiseActionIds, []);
});

const moduleFor = (session: GameSession) => {
  type Options = ConstructorParameters<typeof SkavenTurnGameModule>[0];
  const board: Options['board'] = {
    heroes: [],
    noiseTokens: [],
    doors: [],
    skaven: [],
    legalSquares: [],
    selectedSquare: null,
  };
  const announcements: unknown[] = [];
  const setup: Options['setup'] = {
    view: session.heroView,
    privateNoiseView: null,
    announce: events => announcements.push(...events),
    showError: message => assert.fail(message),
    chooseSkavenMoveDestination() {},
    chooseSkavenMoveFacing() {},
    clearMoveSelection() {},
  };
  return {
    module: new SkavenTurnGameModule({ session, setup, board, randomSource: random }),
    board,
    announcements,
  };
};

test('two-player controls resolve a single blocking-door route', () => {
  const session = new GameSession(THE_UNDERBURROW, random, noiseTurn('rat-ogor'));
  const { module, announcements } = moduleFor(session);
  assert.equal(module.handleEvent(new CustomEvent('noise-move-requested')), true);
  assert.equal(
    session.heroView.doors.find(door => door.position.row === 6 && door.position.column === 4)
      ?.status,
    'destroyed'
  );
  assert.ok(announcements.some(event => (event as { type: string }).type === 'door-destroyed'));
});

test('two-player controls highlight and resolve the selected door among tied routes', () => {
  const base = noiseTurn('rat-ogor');
  const session = new GameSession(THE_UNDERBURROW, random, {
    ...base,
    heroes: [{ ...base.heroes[0]!, position: { row: 9, column: 11 } }],
    concealedNoise: [{ ...base.concealedNoise[0]!, position: { row: 13, column: 5 } }],
  });
  const { module, board } = moduleFor(session);
  assert.equal(module.handleEvent(new CustomEvent('noise-move-requested')), true);
  assert.deepEqual(board.legalSquares, [
    { row: 12, column: 5 },
    { row: 14, column: 6 },
  ]);
  assert.equal(
    module.handleEvent(
      new CustomEvent('board-square-selected', { detail: { row: 14, column: 6 } })
    ),
    true
  );
  assert.equal(
    session.heroView.doors.find(door => door.position.row === 14 && door.position.column === 6)
      ?.status,
    'destroyed'
  );
  assert.equal(
    session.heroView.doors.find(door => door.position.row === 12 && door.position.column === 5)
      ?.status,
    'closed'
  );
  assert.deepEqual(board.legalSquares, []);
});
