import assert from 'node:assert/strict';
import { test } from 'node:test';

import type {
  BoardDoorPresentation,
  BoardHeroPresentation,
} from '../../src/canvas/boardRenderer.ts';
import { createGameEventDelegate } from '../../src/game/gameModule.ts';
import type { GameModule } from '../../src/game/gameModule.ts';
import { SetupGameModule } from '../../src/game/modules/setup.ts';
import { InitialNoiseGameModule } from '../../src/game/modules/initialNoise.ts';
import { HeroTurnGameModule } from '../../src/game/modules/heroTurn.ts';
import { GameSession } from '../../src/game/gameSession.ts';
import type {
  GameEvent,
  HeroGameView,
  RandomSource,
  SkavenGameView,
} from '../../src/game/gameState.ts';
import type { Position } from '../../src/game/map.ts';
import { THE_NEST } from '../../src/game/missions/theNest.ts';

const randomSource: RandomSource = Object.freeze({ next: () => 0.5 });

class SetupViewSpy {
  #view: HeroGameView | null = null;
  #privateNoiseView: SkavenGameView | null = null;
  announced: readonly GameEvent[] = [];
  error = '';
  deployment: Position | null = null;
  moveSelection: 'destination' | Position | null = null;

  get view(): HeroGameView {
    assert.ok(this.#view, 'Expected the setup module to render a view');
    return this.#view;
  }

  set view(view: HeroGameView) {
    this.#view = view;
    this.#privateNoiseView = null;
  }

  get privateNoiseView(): SkavenGameView | null {
    return this.#privateNoiseView;
  }

  set privateNoiseView(view: SkavenGameView | null) {
    this.#privateNoiseView = view;
  }

  getPrivateNoiseView(): SkavenGameView | null {
    return this.#privateNoiseView;
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

  chooseMoveDestination() {
    this.moveSelection = 'destination';
  }

  chooseMoveFacing(destination: Position) {
    this.moveSelection = destination;
  }

  clearMoveSelection() {
    this.moveSelection = null;
  }
}

class BoardViewSpy {
  heroes: readonly BoardHeroPresentation[] = [];
  legalSquares: readonly Position[] = [];
  selectedSquare: Position | null = null;
  noiseTokens: readonly { readonly position: Position; readonly revealedLabel?: string }[] = [];
  doors: readonly BoardDoorPresentation[] = [];
}

const deploySingleHero = (session: GameSession, mode: 'solo' | 'two-player') => {
  session.dispatch({ type: 'configure-game', mode, heroIds: ['gotrek'] });
  session.dispatch({
    type: 'deploy-hero',
    heroId: 'gotrek',
    position: { row: 16, column: 3 },
    facing: 'north',
  });
};

const completeSoloSetup = (session: GameSession) => {
  deploySingleHero(session, 'solo');
  for (const spawn of THE_NEST.board.spawns) {
    session.dispatch({ type: 'draw-initial-noise' });
    session.dispatch({ type: 'place-initial-noise', position: spawn });
  }
};

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

test('two-player initial noise reveals one private draw and advances after each placement', () => {
  const session = new GameSession(THE_NEST, { next: () => 0 });
  deploySingleHero(session, 'two-player');
  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const module = new InitialNoiseGameModule({
    session,
    setup,
    board,
    randomSource,
  });

  module.render();
  assert.equal(setup.view.setupStep, 'initial-noise');
  assert.equal(setup.privateNoiseView, null);

  module.handleEvent(new CustomEvent('game-command', { detail: { type: 'draw-initial-noise' } }));
  assert.equal(setup.getPrivateNoiseView()?.pendingNoise?.resultId, 'two-clanrats');
  assert.equal(board.legalSquares.length, 3);
  assert.ok(!JSON.stringify(setup.view).includes('two-clanrats'));

  module.handleEvent(
    new CustomEvent('board-square-selected', { detail: THE_NEST.board.spawns[0]! })
  );
  assert.equal(board.noiseTokens.length, 1);
  assert.equal(board.legalSquares.length, 2);
  assert.equal(setup.getPrivateNoiseView()?.pendingNoise?.resultId, 'two-clanrats');
});

test('two-player initial noise completes after three board placements', () => {
  const session = new GameSession(THE_NEST, { next: () => 0 });
  deploySingleHero(session, 'two-player');
  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const module = new InitialNoiseGameModule({ session, setup, board, randomSource });

  module.handleEvent(new CustomEvent('game-command', { detail: { type: 'draw-initial-noise' } }));
  for (const spawn of THE_NEST.board.spawns) {
    module.handleEvent(new CustomEvent('board-square-selected', { detail: spawn }));
  }

  assert.equal(session.heroView.phase, 'hero');
  assert.equal(setup.view.phase, 'hero');
  assert.equal(setup.privateNoiseView, null);
  assert.equal(board.noiseTokens.length, 3);
  assert.deepEqual(board.legalSquares, []);
});

test('solo initial noise uses ordinary commands without rendering a private identity', () => {
  const session = new GameSession(THE_NEST, { next: () => 0 });
  deploySingleHero(session, 'solo');
  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const module = new InitialNoiseGameModule({
    session,
    setup,
    board,
    randomSource: { next: () => 0 },
  });

  module.handleEvent(new CustomEvent('game-command', { detail: { type: 'draw-initial-noise' } }));

  assert.equal(session.heroView.phase, 'hero');
  assert.equal(setup.privateNoiseView, null);
  assert.equal(board.noiseTokens.length, 3);
  assert.ok(!JSON.stringify(setup.view).includes('two-clanrats'));
});

test('the Hero-turn module chooses a destination before committing movement and facing', () => {
  const session = new GameSession(THE_NEST, { next: () => 0 });
  completeSoloSetup(session);
  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const module = new HeroTurnGameModule({ session, setup, board });

  module.render();
  assert.equal(setup.view.phase, 'hero');
  assert.equal(board.doors.length, THE_NEST.board.doors.length);

  module.handleEvent(
    new CustomEvent('game-command', {
      detail: { type: 'start-hero-activation', heroId: 'gotrek' },
    })
  );
  assert.equal(setup.view.activeHeroId, 'gotrek');
  assert.equal(board.heroes[0]?.activationStatus, 'active');

  module.handleEvent(new CustomEvent('hero-move-requested'));
  assert.equal(setup.moveSelection, 'destination');
  assert.ok(board.legalSquares.some(position => position.row === 15 && position.column === 3));

  module.handleEvent(new CustomEvent('board-square-selected', { detail: { row: 15, column: 3 } }));
  assert.deepEqual(setup.moveSelection, { row: 15, column: 3 });
  assert.deepEqual(board.selectedSquare, { row: 15, column: 3 });
  assert.deepEqual(setup.view.heroes[0]?.position, { row: 16, column: 3 });
  assert.equal(setup.view.heroes[0]?.facing, 'north');
  assert.equal(setup.view.actionsRemaining, 4);
  assert.deepEqual(board.legalSquares, []);

  module.handleEvent(new CustomEvent('hero-move-facing-selected', { detail: 'east' }));
  assert.deepEqual(setup.view.heroes[0]?.position, { row: 15, column: 3 });
  assert.equal(setup.view.heroes[0]?.facing, 'east');
  assert.equal(setup.view.actionsRemaining, 3);
  assert.equal(setup.moveSelection, null);
  assert.equal(board.selectedSquare, null);
  assert.deepEqual(board.legalSquares, []);
});

test('the Hero-turn module can cancel movement before or after choosing a destination', () => {
  const session = new GameSession(THE_NEST, { next: () => 0 });
  completeSoloSetup(session);
  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const module = new HeroTurnGameModule({ session, setup, board });

  module.handleEvent(
    new CustomEvent('game-command', {
      detail: { type: 'start-hero-activation', heroId: 'gotrek' },
    })
  );
  module.handleEvent(new CustomEvent('hero-move-requested'));
  module.handleEvent(new CustomEvent('hero-move-cancelled'));
  assert.equal(setup.moveSelection, null);
  assert.deepEqual(board.legalSquares, []);

  module.handleEvent(new CustomEvent('hero-move-requested'));
  module.handleEvent(new CustomEvent('board-square-selected', { detail: { row: 15, column: 3 } }));
  assert.deepEqual(board.selectedSquare, { row: 15, column: 3 });
  module.handleEvent(new CustomEvent('hero-move-cancelled'));
  assert.deepEqual(setup.view.heroes[0]?.position, { row: 16, column: 3 });
  assert.equal(setup.view.actionsRemaining, 4);
  assert.equal(setup.moveSelection, null);
  assert.equal(board.selectedSquare, null);
});

test('setup and noise modules leave Hero-turn commands for the Hero-turn module', () => {
  const session = new GameSession(THE_NEST, { next: () => 0 });
  completeSoloSetup(session);
  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const setupModule = new SetupGameModule({ session, setup, board });
  const noiseModule = new InitialNoiseGameModule({ session, setup, board, randomSource });
  const heroModule = new HeroTurnGameModule({ session, setup, board });
  const event = new CustomEvent('game-command', {
    detail: { type: 'start-hero-activation', heroId: 'gotrek' },
  });

  assert.equal(setupModule.handleEvent(event), false);
  assert.equal(noiseModule.handleEvent(event), false);
  assert.equal(heroModule.handleEvent(event), true);
});
