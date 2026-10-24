import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createInitialGameState,
  projectHeroView,
  resolveCommand,
} from '../../src/game/gameState.ts';
import type { GameState } from '../../src/game/gameState.ts';
import { GameSession } from '../../src/game/gameSession.ts';
import { THE_NEST } from '../../src/game/missions/theNest.ts';
import { RulesError } from '../../src/game/rulesError.ts';

const random = { next: () => 0.5 };
const position = { row: 9, column: 1 };

const heroTurn = (rosterSize = 1): GameState => {
  const ids = ['gotrek', 'felix', 'snorri', 'ulrika', 'maximilian'].slice(0, rosterSize);
  const configured = resolveCommand(
    createInitialGameState(THE_NEST),
    { type: 'configure-game', mode: 'solo', heroIds: ids as GameState['selectedHeroIds'] },
    random
  ).state;
  return {
    ...configured,
    setupStep: 'complete',
    phase: 'hero',
    round: 1,
    heroes: configured.heroes.map((hero, index) => ({
      ...hero,
      position: { row: 9, column: 2 + index },
      facing: 'east' as const,
    })),
    activeHeroId: 'gotrek',
    actionsRemaining: 2,
    movementRemaining: 3,
  };
};

test('ordinary nest interaction costs two Actions and opens the exit after the third nest', () => {
  const state = heroTurn();
  const first = resolveCommand(state, { type: 'destroy-nest', heroId: 'gotrek', position }, random);
  assert.equal(first.state.actionsRemaining, 0);
  assert.equal(first.state.nests.find(nest => nest.position.row === 9)?.status, 'destroyed');
  assert.equal(projectHeroView(first.state).exitOpen, false);
  assert.ok(first.events.some(event => event.type === 'nest-destroyed'));

  const last = resolveCommand(
    {
      ...state,
      nests: state.nests.map(nest => ({
        ...nest,
        status: nest.position.row === 9 ? ('intact' as const) : ('destroyed' as const),
      })),
    },
    { type: 'destroy-nest', heroId: 'gotrek', position },
    random
  );
  assert.equal(projectHeroView(last.state).exitOpen, true);
  assert.ok(last.events.some(event => event.type === 'exit-opened'));
});

test('invalid nest interaction leaves the state untouched', () => {
  const state = { ...heroTurn(), actionsRemaining: 1 };
  assert.throws(
    () => resolveCommand(state, { type: 'destroy-nest', heroId: 'gotrek', position }, random),
    RulesError
  );
  assert.equal(state.nests.find(nest => nest.position.row === 9)?.status, 'intact');
});

test('Demolition Charge opens the exit when it destroys the final Nest', () => {
  const base = heroTurn();
  const state: GameState = {
    ...base,
    selectedHeroIds: ['malakai'],
    heroes: [
      {
        id: 'malakai',
        definitionId: 'malakai',
        woundsRemaining: 2,
        position: { row: 8, column: 1 },
        facing: 'south',
      },
    ],
    activeHeroId: 'malakai',
    skaven: [],
    nests: base.nests.map(nest => ({
      ...nest,
      status: nest.position.row === 9 ? ('intact' as const) : ('destroyed' as const),
    })),
  };
  const placed = resolveCommand(
    state,
    { type: 'place-demolition-charge', heroId: 'malakai', position },
    random
  );
  const detonated = resolveCommand(
    placed.state,
    { type: 'detonate-demolition-charge', confirmed: true },
    random
  );
  assert.equal(projectHeroView(detonated.state).exitOpen, true);
  assert.ok(detonated.events.some(event => event.type === 'exit-opened'));
});

test('exit victory is immediate and later commands are rejected for rosters of one through five', () => {
  for (let size = 1; size <= 5; size++) {
    const state = heroTurn(size);
    const ready = {
      ...state,
      heroes: state.heroes.map((hero, index) => ({
        ...hero,
        position: index === 0 ? { row: 17, column: 1 } : hero.position,
      })),
      nests: state.nests.map(nest => ({ ...nest, status: 'destroyed' as const })),
    };
    const result = resolveCommand(
      ready,
      { type: 'move-hero', heroId: 'gotrek', path: [{ row: 18, column: 1 }], facing: 'east' },
      random
    );
    assert.deepEqual(result.state.result, { winner: 'heroes', reason: 'exit' });
    assert.ok(result.events.some(event => event.type === 'game-ended'));
    assert.throws(
      () =>
        resolveCommand(
          result.state,
          { type: 'end-hero-activation', heroId: 'gotrek', confirmed: true },
          random
        ),
      RulesError
    );
  }
});

test('exit victory commits even when its final step also reveals Noise', () => {
  const base = heroTurn();
  const state: GameState = {
    ...base,
    heroes: base.heroes.map(hero => ({ ...hero, position: { row: 17, column: 1 } })),
    nests: base.nests.map(nest => ({ ...nest, status: 'destroyed' as const })),
    concealedNoise: [
      { id: 'noise-test', resultId: 'two-clanrats', position: { row: 17, column: 2 } },
    ],
  };
  const session = new GameSession(THE_NEST, random, state);
  const events = session.dispatch({
    type: 'move-hero',
    heroId: 'gotrek',
    path: [{ row: 18, column: 1 }],
    facing: 'east',
  });
  assert.deepEqual(session.state.result, { winner: 'heroes', reason: 'exit' });
  assert.ok(events.some(event => event.type === 'game-ended'));
});

test('all selected heroes dead ends the game for rosters of one through five', () => {
  for (let size = 1; size <= 5; size++) {
    const state = heroTurn(size);
    const dying = {
      ...state,
      phase: 'skaven' as const,
      activeHeroId: null,
      heroes: state.heroes.map((hero, index) => ({
        ...hero,
        woundsRemaining: index === 0 ? 1 : 0,
        position: index === 0 ? { row: 9, column: 2 } : null,
      })),
      skaven: [
        {
          id: 'skaven-1',
          sourceNoiseId: 'noise-1',
          definitionId: 'rat-ogor' as const,
          woundsRemaining: 2,
          position: { row: 9, column: 3 },
          facing: 'west' as const,
        },
      ],
      skavenTurnStep: 'activate-skaven' as const,
      activeSkavenId: 'skaven-1',
      skavenActionsRemaining: 1,
      skavenMovementRemaining: 0,
    };
    let roll = 0;
    const started = resolveCommand(
      dying,
      { type: 'fight-hero', skavenId: 'skaven-1', heroId: 'gotrek' },
      { next: () => (roll++ < 4 ? 0 : 0.99) }
    );
    const result = started.state.pendingCombat
      ? resolveCommand(started.state, { type: 'accept-fight-rolls' }, random)
      : started;
    assert.deepEqual(result.state.result, { winner: 'skaven', reason: 'elimination' });
  }
});

test('Hero Turn 8 ends in timeout without a Skaven turn for rosters of one through five', () => {
  for (let size = 1; size <= 5; size++) {
    const base = heroTurn(size);
    const state = {
      ...base,
      round: 8,
      activeHeroId: null,
      actionsRemaining: null,
      movementRemaining: null,
      activatedHeroIds: base.selectedHeroIds,
    };
    const result = resolveCommand(state, { type: 'end-hero-phase', confirmed: true }, random);
    assert.deepEqual(result.state.result, { winner: 'skaven', reason: 'timeout' });
    assert.equal(result.state.phase, 'hero');
    assert.equal(
      result.events.some(event => event.type === 'skaven-turn-started'),
      false
    );
  }
});
