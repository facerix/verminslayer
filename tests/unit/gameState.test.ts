import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { HeroId } from '../../src/game/entities.ts';
import {
  createInitialGameState,
  getLegalDeploymentPositions,
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
