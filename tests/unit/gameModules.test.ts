import assert from 'node:assert/strict';
import { test } from 'node:test';

import type {
  BoardDoorPresentation,
  BoardHeroPresentation,
  BoardSkavenPresentation,
} from '../../src/canvas/boardRenderer.ts';
import { createGameEventDelegate } from '../../src/game/gameModule.ts';
import type { GameModule } from '../../src/game/gameModule.ts';
import { SetupGameModule } from '../../src/game/modules/setup.ts';
import { InitialNoiseGameModule } from '../../src/game/modules/initialNoise.ts';
import { HeroTurnGameModule } from '../../src/game/modules/heroTurn.ts';
import { SkavenTurnGameModule } from '../../src/game/modules/skavenTurn.ts';
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
  boardActionSelection: string | null = null;

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

  chooseSkavenMoveDestination() {
    this.moveSelection = 'destination';
  }

  chooseSkavenMoveFacing(destination: Position) {
    this.moveSelection = destination;
  }

  clearMoveSelection() {
    this.moveSelection = null;
  }

  chooseBoardAction(selection: string) {
    this.boardActionSelection = selection;
  }

  clearBoardAction() {
    this.boardActionSelection = null;
  }
}

class BoardViewSpy {
  heroes: readonly BoardHeroPresentation[] = [];
  legalSquares: readonly Position[] = [];
  selectedSquare: Position | null = null;
  noiseTokens: readonly { readonly position: Position; readonly revealedLabel?: string }[] = [];
  doors: readonly BoardDoorPresentation[] = [];
  skaven: readonly BoardSkavenPresentation[] = [];
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
      woundsMaximum: 3,
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
  const module = new HeroTurnGameModule({ session, setup, board, randomSource });

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
  assert.equal(setup.view.actionsRemaining, 2);
  assert.equal(setup.view.movementRemaining, 3);
  assert.deepEqual(board.legalSquares, []);

  module.handleEvent(new CustomEvent('hero-move-facing-selected', { detail: 'east' }));
  assert.deepEqual(setup.view.heroes[0]?.position, { row: 15, column: 3 });
  assert.equal(setup.view.heroes[0]?.facing, 'east');
  assert.equal(setup.view.actionsRemaining, 2);
  assert.equal(setup.view.movementRemaining, 2);
  assert.equal(setup.moveSelection, null);
  assert.equal(board.selectedSquare, null);
  assert.deepEqual(board.legalSquares, []);
});

test('the Hero-turn module can cancel movement before or after choosing a destination', () => {
  const session = new GameSession(THE_NEST, { next: () => 0 });
  completeSoloSetup(session);
  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const module = new HeroTurnGameModule({ session, setup, board, randomSource });

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
  assert.equal(setup.view.actionsRemaining, 2);
  assert.equal(setup.moveSelection, null);
  assert.equal(board.selectedSquare, null);
});

test('the Hero-turn module highlights and resolves a Slayer’s Fury move from the board', () => {
  const base = new GameSession(THE_NEST, { next: () => 0 });
  completeSoloSetup(base);
  base.dispatch({ type: 'start-hero-activation', heroId: 'gotrek' });
  const session = new GameSession(THE_NEST, randomSource, {
    ...base.state,
    pendingAbility: { type: 'slayers-fury', heroId: 'gotrek' },
  });
  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const module = new HeroTurnGameModule({ session, setup, board, randomSource });
  module.render();
  const destination = session.heroView.legalAbilityMovePositions[0]!;
  assert.ok(destination);

  module.handleEvent(new CustomEvent('hero-ability-move-requested'));
  assert.equal(setup.boardActionSelection, 'ability-move');
  assert.deepEqual(board.legalSquares, session.heroView.legalAbilityMovePositions);
  module.handleEvent(new CustomEvent('hero-board-action-cancelled'));
  assert.equal(setup.boardActionSelection, null);
  assert.deepEqual(board.legalSquares, []);
  assert.equal(session.heroView.pendingAbility?.type, 'slayers-fury');

  module.handleEvent(new CustomEvent('hero-ability-move-requested'));
  module.handleEvent(new CustomEvent('board-square-selected', { detail: destination }));
  assert.deepEqual(session.heroView.heroes[0]?.position, destination);
  assert.equal(session.heroView.pendingAbility, null);
  assert.deepEqual(board.legalSquares, []);
  assert.equal(setup.boardActionSelection, null);
});

test('a charge follow-up can target the board between hero activations', () => {
  const base = new GameSession(THE_NEST, { next: () => 0 });
  base.dispatch({ type: 'configure-game', mode: 'solo', heroIds: ['malakai'] });
  base.dispatch({
    type: 'deploy-hero',
    heroId: 'malakai',
    position: { row: 16, column: 3 },
    facing: 'north',
  });
  for (const spawn of THE_NEST.board.spawns) {
    base.dispatch({ type: 'draw-initial-noise' });
    base.dispatch({ type: 'place-initial-noise', position: spawn });
  }
  const target = { row: 15, column: 3 };
  const session = new GameSession(THE_NEST, randomSource, {
    ...base.state,
    activeHeroId: null,
    skaven: [
      {
        id: 'skaven-1',
        sourceNoiseId: 'old',
        definitionId: 'clanrat',
        position: target,
        facing: 'south',
        woundsRemaining: 1,
      },
    ],
    pendingAbility: { type: 'charge', heroId: 'malakai', targetIds: ['skaven-1'] },
  });
  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const module = new HeroTurnGameModule({ session, setup, board, randomSource });
  module.render();
  module.handleEvent(new CustomEvent('hero-ability-fight-requested'));
  assert.deepEqual(board.legalSquares, [target]);
  module.handleEvent(new CustomEvent('board-square-selected', { detail: target }));
  assert.equal(setup.error, '');
  assert.deepEqual(board.legalSquares, []);
});

test('placing a Demolition Charge highlights legal features and spends the action on selection', () => {
  const base = new GameSession(THE_NEST, { next: () => 0 });
  base.dispatch({ type: 'configure-game', mode: 'solo', heroIds: ['malakai'] });
  base.dispatch({
    type: 'deploy-hero',
    heroId: 'malakai',
    position: { row: 16, column: 3 },
    facing: 'north',
  });
  for (const spawn of THE_NEST.board.spawns) {
    base.dispatch({ type: 'draw-initial-noise' });
    base.dispatch({ type: 'place-initial-noise', position: spawn });
  }
  base.dispatch({ type: 'start-hero-activation', heroId: 'malakai' });
  const session = new GameSession(THE_NEST, randomSource, {
    ...base.state,
    heroes: [{ ...base.state.heroes[0]!, position: { row: 15, column: 5 } }],
  });
  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const module = new HeroTurnGameModule({ session, setup, board, randomSource });
  module.render();
  const position = { row: 14, column: 6 };
  assert.ok(
    session.heroView.legalChargePositions.some(
      candidate => candidate.row === position.row && candidate.column === position.column
    )
  );
  module.handleEvent(new CustomEvent('hero-charge-requested'));
  assert.deepEqual(board.legalSquares, session.heroView.legalChargePositions);
  module.handleEvent(new CustomEvent('board-square-selected', { detail: position }));
  assert.deepEqual(session.heroView.demolitionCharge?.position, position);
  assert.equal(session.heroView.actionsRemaining, 1);
  assert.deepEqual(board.legalSquares, []);
});

test('a Skaven-turn Two-Fisted follow-up still offers its board target', () => {
  const base = new GameSession(THE_NEST, { next: () => 0 });
  base.dispatch({ type: 'configure-game', mode: 'solo', heroIds: ['snorri'] });
  base.dispatch({
    type: 'deploy-hero',
    heroId: 'snorri',
    position: { row: 16, column: 3 },
    facing: 'north',
  });
  for (const spawn of THE_NEST.board.spawns) {
    base.dispatch({ type: 'draw-initial-noise' });
    base.dispatch({ type: 'place-initial-noise', position: spawn });
  }
  const target = { row: 15, column: 3 };
  const session = new GameSession(THE_NEST, randomSource, {
    ...base.state,
    phase: 'skaven',
    activeHeroId: null,
    skaven: [
      {
        id: 'skaven-1',
        sourceNoiseId: 'old',
        definitionId: 'clanrat',
        position: target,
        facing: 'south',
        woundsRemaining: 1,
      },
    ],
    pendingAbility: { type: 'two-fisted', heroId: 'snorri' },
  });
  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const module = new HeroTurnGameModule({ session, setup, board, randomSource });
  module.render();
  assert.deepEqual(session.heroView.legalAbilityFightTargetIds, ['skaven-1']);
  module.handleEvent(new CustomEvent('hero-ability-fight-requested'));
  assert.deepEqual(board.legalSquares, [target]);
});

test('the Hero-turn module automatically resolves a revealed 3C group in solo mode', () => {
  const drawValues = [0.45, 0, 0];
  const session = new GameSession(THE_NEST, {
    next: () => drawValues.shift() ?? 0,
  });
  session.dispatch({ type: 'configure-game', mode: 'solo', heroIds: ['felix'] });
  session.dispatch({
    type: 'deploy-hero',
    heroId: 'felix',
    position: { row: 15, column: 4 },
    facing: 'north',
  });
  for (const spawn of [
    { row: 10, column: 0 },
    { row: 0, column: 10 },
    { row: 8, column: 12 },
  ]) {
    session.dispatch({ type: 'draw-initial-noise' });
    session.dispatch({ type: 'place-initial-noise', position: spawn });
  }

  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const module = new HeroTurnGameModule({
    session,
    setup,
    board,
    randomSource: { next: () => 0 },
  });
  for (const command of [
    { type: 'start-hero-activation', heroId: 'felix' },
    {
      type: 'move-hero',
      heroId: 'felix',
      path: [
        { row: 14, column: 4 },
        { row: 13, column: 4 },
        { row: 13, column: 5 },
      ],
      facing: 'north',
    },
    {
      type: 'interact-door',
      heroId: 'felix',
      position: { row: 12, column: 5 },
    },
    { type: 'dash-hero', heroId: 'felix' },
    {
      type: 'move-hero',
      heroId: 'felix',
      path: [
        { row: 12, column: 5 },
        { row: 11, column: 5 },
        { row: 10, column: 5 },
      ],
      facing: 'west',
    },
  ] as const) {
    module.handleEvent(new CustomEvent('game-command', { detail: command }));
  }

  assert.equal(setup.error, '');
  assert.deepEqual(session.heroView.revealedNoise, []);
  assert.equal(session.heroView.skaven.length, 3);
  assert.equal(board.skaven.length, 3);
  assert.ok(setup.announced.some(event => event.type === 'noise-revealed'));
  assert.equal(setup.announced.filter(event => event.type === 'skaven-placed').length, 3);
});

test('the session automatically places consecutive revealed models with one legal square', () => {
  const drawValues = [0.45, 0, 0];
  const session = new GameSession(THE_NEST, {
    next: () => drawValues.shift() ?? 0,
  });
  session.dispatch({ type: 'configure-game', mode: 'two-player', heroIds: ['felix'] });
  session.dispatch({
    type: 'deploy-hero',
    heroId: 'felix',
    position: { row: 15, column: 4 },
    facing: 'north',
  });
  for (const spawn of [
    { row: 10, column: 0 },
    { row: 0, column: 10 },
    { row: 8, column: 12 },
  ]) {
    session.dispatch({ type: 'draw-initial-noise' });
    session.dispatch({ type: 'place-initial-noise', position: spawn });
  }

  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const module = new HeroTurnGameModule({ session, setup, board, randomSource });
  for (const command of [
    { type: 'start-hero-activation', heroId: 'felix' },
    {
      type: 'move-hero',
      heroId: 'felix',
      path: [
        { row: 14, column: 4 },
        { row: 13, column: 4 },
        { row: 13, column: 5 },
      ],
      facing: 'north',
    },
    { type: 'interact-door', heroId: 'felix', position: { row: 12, column: 5 } },
    { type: 'dash-hero', heroId: 'felix' },
    {
      type: 'move-hero',
      heroId: 'felix',
      path: [
        { row: 12, column: 5 },
        { row: 11, column: 5 },
        { row: 10, column: 5 },
      ],
      facing: 'west',
    },
  ] as const) {
    module.handleEvent(new CustomEvent('game-command', { detail: command }));
  }

  assert.equal(setup.error, '');
  assert.deepEqual(
    session.heroView.skaven.map(skaven => ({ position: skaven.position, facing: skaven.facing })),
    [
      { position: { row: 10, column: 0 }, facing: 'east' },
      { position: { row: 10, column: 1 }, facing: 'east' },
    ]
  );
  assert.deepEqual(session.heroView.revealedNoise[0]?.remainingModels, ['clanrat']);
  assert.deepEqual(session.legalSkavenPlacementPositions('noise-1'), [
    { row: 9, column: 1 },
    { row: 11, column: 1 },
  ]);
  assert.equal(setup.announced.filter(event => event.type === 'skaven-placed').length, 2);
});

test('setup and noise modules leave Hero-turn commands for the Hero-turn module', () => {
  const session = new GameSession(THE_NEST, { next: () => 0 });
  completeSoloSetup(session);
  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const setupModule = new SetupGameModule({ session, setup, board });
  const noiseModule = new InitialNoiseGameModule({ session, setup, board, randomSource });
  const heroModule = new HeroTurnGameModule({ session, setup, board, randomSource });
  const event = new CustomEvent('game-command', {
    detail: { type: 'start-hero-activation', heroId: 'gotrek' },
  });

  assert.equal(setupModule.handleEvent(event), false);
  assert.equal(noiseModule.handleEvent(event), false);
  assert.equal(heroModule.handleEvent(event), true);
});

test('the Skaven-turn module offers a direct hold when no movement path is open', () => {
  const drawValues = [0.45, 0, 0];
  const session = new GameSession(THE_NEST, {
    next: () => drawValues.shift() ?? 0,
  });
  session.dispatch({ type: 'configure-game', mode: 'two-player', heroIds: ['felix'] });
  session.dispatch({
    type: 'deploy-hero',
    heroId: 'felix',
    position: { row: 15, column: 4 },
    facing: 'north',
  });
  for (const spawn of [
    { row: 10, column: 0 },
    { row: 0, column: 10 },
    { row: 8, column: 12 },
  ]) {
    session.dispatch({ type: 'draw-initial-noise' });
    session.dispatch({ type: 'place-initial-noise', position: spawn });
  }

  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const heroModule = new HeroTurnGameModule({
    session,
    setup,
    board,
    randomSource: { next: () => 0 },
  });
  for (const command of [
    { type: 'start-hero-activation', heroId: 'felix' },
    {
      type: 'move-hero',
      heroId: 'felix',
      path: [
        { row: 14, column: 4 },
        { row: 13, column: 4 },
        { row: 13, column: 5 },
      ],
      facing: 'north',
    },
    { type: 'interact-door', heroId: 'felix', position: { row: 12, column: 5 } },
    { type: 'dash-hero', heroId: 'felix' },
    {
      type: 'move-hero',
      heroId: 'felix',
      path: [
        { row: 12, column: 5 },
        { row: 11, column: 5 },
        { row: 10, column: 5 },
      ],
      facing: 'west',
    },
    { type: 'end-hero-activation', heroId: 'felix', confirmed: true },
    { type: 'end-hero-phase', confirmed: true },
  ] as const) {
    heroModule.handleEvent(new CustomEvent('game-command', { detail: command }));
    while (session.heroView.revealedNoise[0]) {
      const noise = session.heroView.revealedNoise[0];
      session.dispatch({
        type: 'place-revealed-skaven',
        noiseId: noise.id,
        position: session.legalSkavenPlacementPositions(noise.id)[0]!,
        facing: 'east',
      });
    }
  }

  assert.equal(session.heroView.skavenTurnStep, 'activate-skaven');
  const module = new SkavenTurnGameModule({ session, setup, board, randomSource });
  module.render();
  const skavenId = session.heroView.skavenActivationIds[0]!;
  assert.equal(
    module.handleEvent(
      new CustomEvent('game-command', {
        detail: { type: 'start-skaven-activation', skavenId },
      })
    ),
    true
  );
  assert.equal(setup.view.activeSkavenId, skavenId);
  assert.equal(board.skaven.find(skaven => skaven.id === skavenId)?.activationStatus, 'active');
  assert.equal(board.skaven.find(skaven => skaven.id === 'skaven-1')?.identifier, '1');
  assert.equal(board.skaven.find(skaven => skaven.id === 'skaven-2')?.identifier, '2');
  assert.deepEqual(session.heroView.legalSkavenMovePaths, [
    {
      destination: { row: 10, column: 0 },
      steps: [],
    },
  ]);

  module.handleEvent(new CustomEvent('skaven-move-requested'));
  assert.equal(setup.view.skavenMovementRemaining, 4);
  assert.deepEqual(setup.moveSelection, { row: 10, column: 0 });
  assert.equal(board.legalSquares.length, 0);
  module.handleEvent(new CustomEvent('skaven-move-facing-selected', { detail: 'east' }));
  assert.equal(setup.view.skavenMovementRemaining, 0);
  assert.equal(setup.moveSelection, null);
  assert.equal(board.legalSquares.length, 0);

  module.handleEvent(new CustomEvent('game-command', { detail: { type: 'skip-react' } }));

  module.handleEvent(
    new CustomEvent('game-command', {
      detail: { type: 'end-skaven-activation', skavenId, confirmed: true },
    })
  );
  module.handleEvent(
    new CustomEvent('game-command', {
      detail: { type: 'start-skaven-activation', skavenId: 'skaven-2' },
    })
  );
  module.handleEvent(new CustomEvent('skaven-move-requested'));
  assert.equal(setup.moveSelection, 'destination');
  assert.ok(board.legalSquares.some(position => position.row === 11 && position.column === 1));
  module.handleEvent(new CustomEvent('board-square-selected', { detail: { row: 11, column: 1 } }));
  assert.deepEqual(setup.moveSelection, { row: 11, column: 1 });
  module.handleEvent(new CustomEvent('skaven-move-facing-selected', { detail: 'south' }));
  assert.equal(setup.view.skavenMovementRemaining, 0);
  assert.deepEqual(setup.view.skaven.find(skaven => skaven.id === 'skaven-2')?.position, {
    row: 11,
    column: 1,
  });
});

test('the Skaven-turn module renders the next Hero turn after reinforcement', () => {
  const session = new GameSession(THE_NEST, { next: () => 0 });
  completeSoloSetup(session);
  session.dispatch({ type: 'start-hero-activation', heroId: 'gotrek' });
  session.dispatch({ type: 'end-hero-activation', heroId: 'gotrek', confirmed: true });
  session.dispatch({ type: 'end-hero-phase', confirmed: true });

  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const module = new SkavenTurnGameModule({ session, setup, board, randomSource });
  module.render();
  for (const noiseId of session.heroView.noiseActivationIds) {
    module.handleEvent(
      new CustomEvent('game-command', {
        detail: { type: 'start-noise-activation', noiseId },
      })
    );
    module.handleEvent(new CustomEvent('noise-move-requested'));
    if (board.legalSquares[0]) {
      module.handleEvent(
        new CustomEvent('board-square-selected', { detail: board.legalSquares[0] })
      );
    }
  }
  for (let draw = 0; draw < THE_NEST.noisePerTurn; draw++) {
    module.handleEvent(
      new CustomEvent('game-command', { detail: { type: 'draw-reinforcement-noise' } })
    );
    if (session.skavenView.pendingNoise) {
      module.handleEvent(new CustomEvent('reinforcement-placement-requested'));
      module.handleEvent(
        new CustomEvent('board-square-selected', { detail: board.legalSquares[0]! })
      );
    }
  }

  assert.equal(session.heroView.phase, 'hero');
  assert.equal(setup.view.phase, 'hero');
  assert.equal(setup.view.round, 2);
  assert.equal(setup.view.command, 2);
});

test('solo mode generates legal Skaven commands until React or the next Hero turn', () => {
  const session = new GameSession(THE_NEST, { next: () => 0 });
  completeSoloSetup(session);
  const setup = new SetupViewSpy();
  const board = new BoardViewSpy();
  const heroModule = new HeroTurnGameModule({
    session,
    setup,
    board,
    randomSource: { next: () => 0 },
  });
  const skavenModule = new SkavenTurnGameModule({
    session,
    setup,
    board,
    randomSource: { next: () => 0 },
  });

  heroModule.handleEvent(
    new CustomEvent('game-command', {
      detail: { type: 'start-hero-activation', heroId: 'gotrek' },
    })
  );
  heroModule.handleEvent(
    new CustomEvent('game-command', {
      detail: { type: 'end-hero-activation', heroId: 'gotrek', confirmed: true },
    })
  );
  heroModule.handleEvent(
    new CustomEvent('game-command', {
      detail: { type: 'end-hero-phase', confirmed: true },
    })
  );

  let reactWindows = 0;
  while (session.heroView.phase === 'skaven') {
    assert.ok(session.heroView.pendingReact, 'the solo AI must stop only for a Hero React choice');
    reactWindows++;
    assert.ok(reactWindows < 20, 'the AI should complete the Skaven turn');
    skavenModule.handleEvent(new CustomEvent('game-command', { detail: { type: 'skip-react' } }));
  }

  assert.equal(session.heroView.phase, 'hero');
  assert.equal(session.heroView.round, 2);
  assert.equal(session.heroView.command, 2);
  assert.equal(setup.view.phase, 'hero');
});
