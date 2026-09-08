import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { HeroId } from '../../src/game/entities.ts';
import {
  createInitialGameState,
  getLegalDeploymentPositions,
  getLegalNoiseSpawnPositions,
  projectHeroView,
  projectSkavenView,
  resolveCommand,
} from '../../src/game/gameState.ts';
import type { GameCommand, GameState, RandomSource } from '../../src/game/gameState.ts';
import { RulesError } from '../../src/game/rulesError.ts';
import { THE_NEST } from '../../src/game/missions/theNest.ts';

const randomSource: RandomSource = Object.freeze({
  next: () => 0.5,
});

const configure = (heroIds: readonly HeroId[] = ['gotrek', 'felix']) =>
  resolveCommand(
    createInitialGameState(THE_NEST),
    { type: 'configure-game', mode: 'solo', heroIds },
    randomSource
  ).state;

const deploy = (mode: 'solo' | 'two-player' = 'solo') => {
  const configured = resolveCommand(
    createInitialGameState(THE_NEST),
    { type: 'configure-game', mode, heroIds: ['gotrek'] },
    randomSource
  ).state;
  return resolveCommand(
    configured,
    {
      type: 'deploy-hero',
      heroId: 'gotrek',
      position: { row: 16, column: 3 },
      facing: 'north',
    },
    randomSource
  ).state;
};

test('initial setup defaults to Gotrek and Felix without starting the game', () => {
  const state = createInitialGameState(THE_NEST);

  assert.equal(state.setupStep, 'select-roster');
  assert.equal(state.mode, null);
  assert.deepEqual(state.selectedHeroIds, ['gotrek', 'felix']);
  assert.deepEqual(state.heroes, []);
  assert.equal(state.remainingNoiseBag.length, 20);
  assert.ok(Object.isFrozen(state));
  assert.ok(Object.isFrozen(state.selectedHeroIds));
});

test('configuration accepts solo or two-player rosters of 1 through 5 unique heroes', () => {
  for (const mode of ['solo', 'two-player'] as const) {
    for (let rosterSize = 1; rosterSize <= 5; rosterSize++) {
      const heroIds = ['snorri', 'gotrek', 'felix', 'ulrika', 'malakai'].slice(
        0,
        rosterSize
      ) as HeroId[];
      const result = resolveCommand(
        createInitialGameState(THE_NEST),
        { type: 'configure-game', mode, heroIds },
        randomSource
      );

      assert.equal(result.state.mode, mode);
      assert.equal(result.state.setupStep, 'deploy-heroes');
      assert.equal(result.state.heroes.length, rosterSize);
      assert.deepEqual(result.state.heroes[0], {
        id: 'snorri',
        definitionId: 'snorri',
        woundsRemaining: 3,
        position: null,
        facing: null,
      });
      assert.equal(result.events[0]?.type, 'game-configured');
    }
  }
});

test('configuration rejects empty, oversized, duplicate, and unknown hero rosters', () => {
  const state = createInitialGameState(THE_NEST);
  const invalidRosters = [
    [],
    ['gotrek', 'felix', 'snorri', 'ulrika', 'maximilian', 'malakai'],
    ['gotrek', 'gotrek'],
    ['ikit-claw'],
  ];

  for (const heroIds of invalidRosters) {
    assert.throws(
      () =>
        resolveCommand(
          state,
          { type: 'configure-game', mode: 'solo', heroIds: heroIds as HeroId[] },
          randomSource
        ),
      (error: unknown) => error instanceof RulesError && error.code === 'INVALID_HERO_ROSTER'
    );
  }
});

test('configuration rejects an invalid runtime mode', () => {
  assert.throws(
    () =>
      resolveCommand(
        createInitialGameState(THE_NEST),
        { type: 'configure-game', mode: 'network', heroIds: ['gotrek'] } as unknown as GameCommand,
        randomSource
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'INVALID_MODE'
  );
});

test('unknown runtime commands are rejected explicitly', () => {
  assert.throws(
    () =>
      resolveCommand(
        createInitialGameState(THE_NEST),
        { type: 'teleport-everyone' } as unknown as GameCommand,
        randomSource
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'INVALID_COMMAND'
  );
});

test('deployment positions include the marker and passable adjacent squares only', () => {
  const legal = getLegalDeploymentPositions(configure(), THE_NEST);

  assert.equal(legal.length, 8);
  assert.ok(legal.some(position => position.row === 16 && position.column === 3));
  assert.ok(!legal.some(position => position.row === 15 && position.column === 2));
});

test('selected heroes deploy with facing and cannot share a square', () => {
  const configured = configure();
  const first = resolveCommand(
    configured,
    {
      type: 'deploy-hero',
      heroId: 'gotrek',
      position: { row: 16, column: 3 },
      facing: 'north',
    },
    randomSource
  );

  assert.deepEqual(first.state.heroes[0]?.position, { row: 16, column: 3 });
  assert.equal(first.state.heroes[0]?.facing, 'north');
  assert.equal(first.state.setupStep, 'deploy-heroes');
  assert.throws(
    () =>
      resolveCommand(
        first.state,
        {
          type: 'deploy-hero',
          heroId: 'felix',
          position: { row: 16, column: 3 },
          facing: 'south',
        },
        randomSource
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'DEPLOYMENT_OCCUPIED'
  );
});

test('deployment rejects impassable, distant, unselected, and already-deployed heroes', () => {
  const state = configure(['gotrek']);
  const invalidCommands = [
    {
      type: 'deploy-hero' as const,
      heroId: 'gotrek' as const,
      position: { row: 15, column: 2 },
      facing: 'north' as const,
    },
    {
      type: 'deploy-hero' as const,
      heroId: 'gotrek' as const,
      position: { row: 1, column: 1 },
      facing: 'north' as const,
    },
    {
      type: 'deploy-hero' as const,
      heroId: 'felix' as const,
      position: { row: 16, column: 3 },
      facing: 'north' as const,
    },
  ];

  for (const command of invalidCommands) {
    assert.throws(() => resolveCommand(state, command, randomSource), RulesError);
  }

  const deployed = resolveCommand(
    configure(),
    {
      type: 'deploy-hero',
      heroId: 'gotrek',
      position: { row: 16, column: 3 },
      facing: 'east',
    },
    randomSource
  ).state;
  assert.throws(
    () =>
      resolveCommand(
        deployed,
        {
          type: 'deploy-hero',
          heroId: 'gotrek',
          position: { row: 16, column: 4 },
          facing: 'east',
        },
        randomSource
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'HERO_ALREADY_DEPLOYED'
  );
});

test('deployment rejects an invalid runtime facing', () => {
  assert.throws(
    () =>
      resolveCommand(
        configure(['felix']),
        {
          type: 'deploy-hero',
          heroId: 'felix',
          position: { row: 16, column: 3 },
          facing: 'up',
        } as unknown as GameCommand,
        randomSource
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'INVALID_FACING'
  );
});

test('deploying the final hero transitions to initial-noise setup', () => {
  const result = resolveCommand(
    configure(['ulrika']),
    {
      type: 'deploy-hero',
      heroId: 'ulrika',
      position: { row: 16, column: 3 },
      facing: 'west',
    },
    randomSource
  );

  assert.equal(result.state.setupStep, 'initial-noise');
  assert.deepEqual(
    result.events.map(event => event.type),
    ['hero-deployed', 'deployment-complete']
  );
});

test('rejected commands leave the prior state unchanged', () => {
  const state = configure();
  const before = JSON.stringify(state);

  assert.throws(
    () =>
      resolveCommand(
        state,
        {
          type: 'deploy-hero',
          heroId: 'gotrek',
          position: { row: 0, column: 0 },
          facing: 'north',
        },
        randomSource
      ),
    RulesError
  );
  assert.equal(JSON.stringify(state), before);
  assert.equal(state.heroes[0]?.position, null);
});

test('hero projection omits concealed identities while Skaven projection includes them', () => {
  const state: GameState = {
    ...configure(['malakai']),
    concealedNoise: Object.freeze([
      Object.freeze({
        id: 'noise-1',
        resultId: 'rat-ogor',
        position: Object.freeze({ row: 0, column: 10 }),
      }),
    ]),
  };

  const heroView = projectHeroView(state);
  const skavenView = projectSkavenView(state);

  assert.deepEqual(heroView.noiseTokens, [{ id: 'noise-1', position: { row: 0, column: 10 } }]);
  assert.ok(!JSON.stringify(heroView).includes('rat-ogor'));
  assert.equal(skavenView.noiseTokens[0]?.resultId, 'rat-ogor');
});

test('initial noise draws one private result without replacement', () => {
  const result = resolveCommand(
    deploy('two-player'),
    { type: 'draw-initial-noise' },
    { next: () => 0 }
  );

  assert.equal(result.state.remainingNoiseBag.length, 19);
  assert.equal(result.state.pendingNoise?.resultId, 'two-clanrats');
  assert.deepEqual(result.events, [{ type: 'noise-drawn' }]);
  assert.ok(!JSON.stringify(projectHeroView(result.state)).includes('two-clanrats'));
  assert.equal(projectSkavenView(result.state).pendingNoise?.resultId, 'two-clanrats');
});

test('initial noise placement accepts only an empty Skaven spawn', () => {
  const drawn = resolveCommand(
    deploy('two-player'),
    { type: 'draw-initial-noise' },
    { next: () => 0 }
  ).state;

  assert.throws(
    () =>
      resolveCommand(
        drawn,
        { type: 'place-initial-noise', position: { row: 1, column: 1 } },
        randomSource
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'INVALID_NOISE_SPAWN'
  );

  const placed = resolveCommand(
    drawn,
    { type: 'place-initial-noise', position: THE_NEST.board.spawns[0]! },
    randomSource
  ).state;
  const drawnAgain = resolveCommand(
    placed,
    { type: 'draw-initial-noise' },
    { next: () => 0 }
  ).state;
  assert.throws(
    () =>
      resolveCommand(
        drawnAgain,
        { type: 'place-initial-noise', position: THE_NEST.board.spawns[0]! },
        randomSource
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'NOISE_SPAWN_OCCUPIED'
  );
});

test('three resolved setup draws begin Hero Turn 1 with 3 Command', () => {
  let state = deploy('two-player');

  for (const spawn of THE_NEST.board.spawns) {
    state = resolveCommand(state, { type: 'draw-initial-noise' }, { next: () => 0 }).state;
    state = resolveCommand(
      state,
      { type: 'place-initial-noise', position: spawn },
      randomSource
    ).state;
  }

  assert.equal(state.setupStep, 'complete');
  assert.equal(state.phase, 'hero');
  assert.equal(state.round, 1);
  assert.equal(state.command, 3);
  assert.equal(state.initialNoiseDrawsResolved, 3);
  assert.equal(state.concealedNoise.length, 3);
});

test('nothing remains concealed as an ordinary face-down token until revealed', () => {
  const drawn = resolveCommand(
    deploy('two-player'),
    { type: 'draw-initial-noise' },
    { next: () => 0.999_999 }
  ).state;
  const spawn = THE_NEST.board.spawns[0]!;
  const placed = resolveCommand(
    drawn,
    { type: 'place-initial-noise', position: spawn },
    randomSource
  ).state;

  assert.equal(drawn.pendingNoise?.resultId, 'nothing');
  assert.equal(placed.concealedNoise[0]?.resultId, 'nothing');
  assert.equal(placed.initialNoiseDrawsResolved, 1);
  assert.ok(!JSON.stringify(projectHeroView(placed)).includes('nothing'));
  assert.ok(
    !getLegalNoiseSpawnPositions(placed, THE_NEST).some(
      position => position.row === spawn.row && position.column === spawn.column
    )
  );
});

test('a draw is consumed when every spawn is occupied', () => {
  const base = deploy('two-player');
  const occupied: GameState = {
    ...base,
    initialNoiseDrawsResolved: 2,
    concealedNoise: Object.freeze(
      THE_NEST.board.spawns.map((position, index) =>
        Object.freeze({ id: `noise-${index + 1}`, resultId: 'two-clanrats' as const, position })
      )
    ),
  };
  const result = resolveCommand(occupied, { type: 'draw-initial-noise' }, { next: () => 0 });

  assert.equal(result.state.initialNoiseDrawsResolved, 3);
  assert.equal(result.state.remainingNoiseBag.length, 19);
  assert.equal(result.state.pendingNoise, null);
  assert.equal(result.state.phase, 'hero');
  assert.deepEqual(
    result.events.map(event => event.type),
    ['noise-draw-consumed', 'initial-noise-complete', 'hero-turn-started']
  );
});

test('noise placed in hero line of sight reveals immediately', () => {
  const base = deploy('two-player');
  const spawn = THE_NEST.board.spawns[0]!;
  const exposed: GameState = {
    ...base,
    heroes: Object.freeze([
      Object.freeze({
        ...base.heroes[0]!,
        position: Object.freeze({ row: 1, column: 10 }),
      }),
    ]),
  };
  const drawn = resolveCommand(exposed, { type: 'draw-initial-noise' }, { next: () => 0 }).state;
  const result = resolveCommand(
    drawn,
    { type: 'place-initial-noise', position: spawn },
    randomSource
  );

  assert.deepEqual(result.state.concealedNoise, []);
  assert.equal(result.state.revealedNoise[0]?.resultId, 'two-clanrats');
  assert.ok(JSON.stringify(projectHeroView(result.state)).includes('two-clanrats'));
  assert.deepEqual(
    result.events.map(event => event.type),
    ['noise-placed', 'noise-revealed']
  );
});

test('noise commands reject invalid sequencing transactionally', () => {
  const state = deploy('two-player');
  const before = JSON.stringify(state);

  assert.throws(
    () =>
      resolveCommand(
        state,
        { type: 'place-initial-noise', position: THE_NEST.board.spawns[0]! },
        randomSource
      ),
    (error: unknown) => error instanceof RulesError && error.code === 'NO_NOISE_DRAWN'
  );
  assert.equal(JSON.stringify(state), before);

  const drawn = resolveCommand(state, { type: 'draw-initial-noise' }, { next: () => 0 }).state;
  assert.throws(
    () => resolveCommand(drawn, { type: 'draw-initial-noise' }, { next: () => 0 }),
    (error: unknown) => error instanceof RulesError && error.code === 'NOISE_ALREADY_DRAWN'
  );
});

test('noise placement treats a hero-occupied spawn as unavailable', () => {
  const base = deploy('two-player');
  const spawn = THE_NEST.board.spawns[0]!;
  const occupied: GameState = {
    ...base,
    heroes: Object.freeze([
      Object.freeze({ ...base.heroes[0]!, position: Object.freeze({ ...spawn }) }),
    ]),
  };

  assert.ok(
    !getLegalNoiseSpawnPositions(occupied, THE_NEST).some(
      position => Object.is(position.row, spawn.row) && Object.is(position.column, spawn.column)
    )
  );
});

test('invalid randomness rejects a draw without consuming the bag', () => {
  const state = deploy('two-player');
  const before = JSON.stringify(state);

  assert.throws(
    () => resolveCommand(state, { type: 'draw-initial-noise' }, { next: () => 1 }),
    (error: unknown) => error instanceof RulesError && error.code === 'INVALID_RANDOM_VALUE'
  );
  assert.equal(JSON.stringify(state), before);
});
