import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInitialGameState, resolveCommand } from '../../src/game/gameState.ts';
import { THE_NEST } from '../../src/game/missions/theNest.ts';
import { THE_UNDERBURROW } from '../../src/game/missions/theUnderburrow.ts';
import { getMissionDefinition } from '../../src/game/missions/registry.ts';
import { RulesError } from '../../src/game/rulesError.ts';

test('mission registry presents a small introductory Nest and the larger Underburrow', () => {
  assert.equal(getMissionDefinition('the-nest'), THE_NEST);
  assert.equal(getMissionDefinition('the-underburrow'), THE_UNDERBURROW);
  assert.equal(THE_NEST.board.nests.length, 1);
  assert.equal(THE_NEST.board.spawns.length, 2);
  assert.equal(THE_UNDERBURROW.board.nests.length, 3);
  assert.equal(THE_UNDERBURROW.name, 'The Underburrow');
  assert.ok(
    THE_NEST.board.width * THE_NEST.board.height <
      THE_UNDERBURROW.board.width * THE_UNDERBURROW.board.height
  );
  assert.deepEqual(THE_NEST.allowedHeroes, ['gotrek', 'felix']);
  assert.deepEqual(THE_NEST.fixedHeroes, ['gotrek', 'felix']);
  assert.ok(THE_NEST.noiseBag.every(id => id === 'two-clanrats' || id === 'nothing'));
});

test('the introductory map connects deployment to the nest, both spawns, and exit', () => {
  const board = THE_NEST.board;
  const start = board.deployment;
  const queue = [start];
  const seen = new Set([`${start.row},${start.column}`]);
  for (const current of queue) {
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const row = current.row + dr;
      const column = current.column + dc;
      const tile = board.tiles[row]?.[column];
      const key = `${row},${column}`;
      if (!tile || tile.kind === 'wall' || seen.has(key)) continue;
      seen.add(key);
      queue.push({ row, column });
    }
  }
  for (const position of [...board.nests, ...board.spawns, board.exit]) {
    assert.ok(seen.has(`${position.row},${position.column}`));
  }
});

test('the introductory Nest requires Gotrek and Felix and rejects other rosters', () => {
  const state = createInitialGameState(THE_NEST);
  assert.deepEqual(state.selectedHeroIds, ['gotrek', 'felix']);
  const random = { next: () => 0.5 };
  for (const heroIds of [['gotrek'], ['felix', 'gotrek'], ['gotrek', 'felix', 'snorri']] as const) {
    assert.throws(
      () => resolveCommand(state, { type: 'configure-game', mode: 'solo', heroIds }, random),
      (error: unknown) => error instanceof RulesError && error.code === 'INVALID_HERO_ROSTER'
    );
  }
  const configured = resolveCommand(
    state,
    { type: 'configure-game', mode: 'solo', heroIds: ['gotrek', 'felix'] },
    random
  ).state;
  assert.deepEqual(
    configured.heroes.map(hero => hero.id),
    ['gotrek', 'felix']
  );
});
