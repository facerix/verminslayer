import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GameSession } from '../../src/game/gameSession.ts';
import type { GameState, RandomSource } from '../../src/game/gameState.ts';
import { THE_NEST } from '../../src/game/missions/theNest.ts';

const randomSource: RandomSource = Object.freeze({ next: () => 0.5 });

test('a game session owns engine state and exposes the hero-safe projection', () => {
  const session = new GameSession(THE_NEST, randomSource);

  assert.equal(session.heroView.setupStep, 'select-roster');
  assert.deepEqual(session.heroView.selectedHeroIds, ['gotrek', 'felix']);

  const events = session.dispatch({
    type: 'configure-game',
    mode: 'solo',
    heroIds: ['ulrika'],
  });

  assert.deepEqual(
    events.map(event => event.type),
    ['game-configured']
  );
  assert.equal(session.heroView.setupStep, 'deploy-heroes');
  assert.equal(session.heroView.heroes[0]?.id, 'ulrika');
  assert.equal(session.legalDeploymentPositions.length, 8);
});

test('a game session can restore a saved state and reports each successful transaction', () => {
  const savedStates: GameState[] = [];
  const original = new GameSession(THE_NEST, randomSource, undefined, state => {
    savedStates.push(state);
  });

  original.dispatch({
    type: 'configure-game',
    mode: 'two-player',
    heroIds: ['snorri'],
  });

  assert.equal(savedStates.length, 1);
  const savedState = structuredClone(savedStates[0]);
  const restored = new GameSession(THE_NEST, randomSource, savedState);

  assert.equal(restored.heroView.setupStep, 'deploy-heroes');
  assert.equal(restored.heroView.mode, 'two-player');
  assert.deepEqual(restored.heroView.selectedHeroIds, ['snorri']);
  assert.equal(Object.isFrozen(restored.state), true);

  assert.throws(() =>
    original.dispatch({
      type: 'configure-game',
      mode: 'solo',
      heroIds: ['gotrek'],
    })
  );
  assert.equal(savedStates.length, 1);
});
