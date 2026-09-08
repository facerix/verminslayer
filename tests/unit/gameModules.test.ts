import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { BoardHeroPresentation } from '../../src/canvas/boardRenderer.ts';
import { createGameEventDelegate } from '../../src/game/gameModule.ts';
import type { GameModule } from '../../src/game/gameModule.ts';
import { SetupGameModule } from '../../src/game/modules/setup.ts';
import { GameSession } from '../../src/game/gameSession.ts';
import type { GameEvent, HeroGameView, RandomSource } from '../../src/game/gameState.ts';
import type { Position } from '../../src/game/map.ts';
import { THE_NEST } from '../../src/game/missions/theNest.ts';

const randomSource: RandomSource = Object.freeze({ next: () => 0.5 });

class SetupViewSpy {
  #view: HeroGameView | null = null;
  announced: readonly GameEvent[] = [];
  error = '';
  deployment: Position | null = null;

  get view(): HeroGameView {
    assert.ok(this.#view, 'Expected the setup module to render a view');
    return this.#view;
  }

  set view(view: HeroGameView) {
    this.#view = view;
  }

  get renderedView(): HeroGameView | null {
    return this.#view;
  }

  announce(events: readonly GameEvent[]) {
    this.announced = events;
  }

  showError(message: string) {
    this.error = message;
  }

  deployAt(position: Position) {
    this.deployment = position;
  }
}

class BoardViewSpy {
  heroes: readonly BoardHeroPresentation[] = [];
  legalSquares: readonly Position[] = [];
}

test('the setup module renders setup state and handles setup commands', () => {
  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const module = new SetupGameModule({
    session: new GameSession(THE_NEST, randomSource),
    setup,
    board,
  });

  module.render();
  assert.equal(setup.renderedView?.setupStep, 'select-roster');
  assert.deepEqual(board.heroes, []);
  assert.deepEqual(board.legalSquares, []);

  const handled = module.handleEvent(
    new CustomEvent('game-command', {
      detail: { type: 'configure-game', mode: 'solo', heroIds: ['gotrek'] },
    })
  );

  assert.equal(handled, true);
  assert.equal(setup.renderedView?.setupStep, 'deploy-heroes');
  assert.deepEqual(
    setup.announced.map(event => event.type),
    ['game-configured']
  );
  assert.equal(board.legalSquares.length, 8);
});

test('the setup module projects deployed heroes onto the board', () => {
  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const module = new SetupGameModule({
    session: new GameSession(THE_NEST, randomSource),
    setup,
    board,
  });
  module.handleEvent(
    new CustomEvent('game-command', {
      detail: { type: 'configure-game', mode: 'solo', heroIds: ['gotrek'] },
    })
  );

  module.handleEvent(
    new CustomEvent('game-command', {
      detail: {
        type: 'deploy-hero',
        heroId: 'gotrek',
        position: { row: 16, column: 3 },
        facing: 'north',
      },
    })
  );

  assert.deepEqual(board.heroes, [
    {
      label: 'Go',
      position: { row: 16, column: 3 },
      facing: 'north',
      woundsRemaining: 3,
    },
  ]);
  assert.deepEqual(board.legalSquares, []);
});

test('the setup module delegates board selections to setup controls', () => {
  const setup = new SetupViewSpy();
  const module = new SetupGameModule({
    session: new GameSession(THE_NEST, randomSource),
    setup,
    board: new BoardViewSpy(),
  });
  module.handleEvent(
    new CustomEvent('game-command', {
      detail: { type: 'configure-game', mode: 'solo', heroIds: ['gotrek'] },
    })
  );

  const handled = module.handleEvent(
    new CustomEvent('board-square-selected', { detail: { row: 16, column: 3 } })
  );

  assert.equal(handled, true);
  assert.deepEqual(setup.deployment, { row: 16, column: 3 });
});

test('the setup module reports rules errors without changing its session', () => {
  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const module = new SetupGameModule({
    session: new GameSession(THE_NEST, randomSource),
    setup,
    board,
  });

  const handled = module.handleEvent(
    new CustomEvent('game-command', {
      detail: { type: 'configure-game', mode: 'solo', heroIds: [] },
    })
  );

  assert.equal(handled, true);
  assert.equal(setup.renderedView, null);
  assert.match(setup.error, /1 and 5 unique heroes/);
  assert.deepEqual(board.heroes, []);
});

test('the event delegate stops at the module that handles an event and rejects gaps', () => {
  const calls: string[] = [];
  const modules: readonly GameModule[] = [
    {
      eventTypes: ['game-command'],
      render: () => undefined,
      handleEvent: () => {
        calls.push('first');
        return true;
      },
    },
    {
      eventTypes: ['game-command'],
      render: () => undefined,
      handleEvent: () => {
        calls.push('second');
        return true;
      },
    },
  ];
  const delegate = createGameEventDelegate(modules);

  delegate(new Event('game-command'));
  assert.deepEqual(calls, ['first']);
  assert.throws(() => delegate(new Event('unclaimed-event')), /No game module handled/);
});
