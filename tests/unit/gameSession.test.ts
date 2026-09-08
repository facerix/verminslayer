import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GameSession } from '../../src/game/gameSession.ts';
import type { RandomSource } from '../../src/game/gameState.ts';
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
