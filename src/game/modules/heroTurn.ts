import type {
  BoardDoorPresentation,
  BoardHeroPresentation,
  BoardNoisePresentation,
} from '/src/canvas/boardRenderer.js';
import { HERO_DEFINITIONS } from '/src/game/entities.js';
import type { HeroId } from '/src/game/entities.js';
import type { GameModule } from '/src/game/gameModule.js';
import type { GameSession } from '/src/game/gameSession.js';
import type { Facing, GameCommand, GameEvent, HeroGameView } from '/src/game/gameState.js';
import type { Position } from '/src/game/map.js';
import type { NoiseResultId } from '/src/game/missionDefinition.js';
import { RulesError } from '/src/game/rulesError.js';

interface HeroTurnView {
  view: HeroGameView;
  announce(events: readonly GameEvent[]): void;
  showError(message: string): void;
  chooseMoveDestination(): void;
  chooseMoveFacing(destination: Position): void;
  clearMoveSelection(): void;
}

interface BoardView {
  heroes: readonly BoardHeroPresentation[];
  legalSquares: readonly Position[];
  selectedSquare: Position | null;
  noiseTokens: readonly BoardNoisePresentation[];
  doors: readonly BoardDoorPresentation[];
}

interface HeroTurnGameModuleOptions {
  readonly session: GameSession;
  readonly setup: HeroTurnView;
  readonly board: BoardView;
}

type SelectionMode = 'move' | 'door' | null;

const HERO_LABELS: Readonly<Record<HeroId, string>> = Object.freeze({
  gotrek: 'Go',
  felix: 'Fe',
  snorri: 'Sn',
  ulrika: 'Ul',
  maximilian: 'Mx',
  malakai: 'Ma',
});

const NOISE_LABELS: Readonly<Record<NoiseResultId, string>> = Object.freeze({
  'two-clanrats': '2C',
  'three-clanrats': '3C',
  'gutter-runner': 'GR',
  'rat-ogor': 'RO',
  nothing: '—',
});

const NOISE_NAMES: Readonly<Record<NoiseResultId, string>> = Object.freeze({
  'two-clanrats': 'Two Clanrats',
  'three-clanrats': 'Three Clanrats',
  'gutter-runner': 'Gutter Runner',
  'rat-ogor': 'Rat Ogor',
  nothing: 'Nothing',
});

const HERO_COMMAND_TYPES = new Set<GameCommand['type']>([
  'start-hero-activation',
  'move-hero',
  'interact-door',
  'end-hero-activation',
  'end-hero-phase',
]);

export class HeroTurnGameModule implements GameModule {
  readonly eventTypes = Object.freeze([
    'game-command',
    'board-square-selected',
    'hero-move-requested',
    'hero-move-facing-selected',
    'hero-move-cancelled',
    'hero-door-requested',
  ]);
  readonly #session: GameSession;
  readonly #setup: HeroTurnView;
  readonly #board: BoardView;
  #selectionMode: SelectionMode = null;
  #pendingMovePath: readonly Position[] | null = null;
  #pendingMoveDestination: Position | null = null;

  constructor({ session, setup, board }: HeroTurnGameModuleOptions) {
    this.#session = session;
    this.#setup = setup;
    this.#board = board;
  }

  render(): void {
    const view = this.#session.heroView;
    if (view.setupStep !== 'complete') return;
    this.#setup.view = view;
    this.#board.heroes = view.heroes.flatMap(hero => {
      if (!hero.position || !hero.facing) return [];
      return [
        {
          label: HERO_LABELS[HERO_DEFINITIONS[hero.definitionId].id],
          position: hero.position,
          facing: hero.facing,
          woundsRemaining: hero.woundsRemaining,
          activationStatus:
            view.activeHeroId === hero.id
              ? ('active' as const)
              : view.activatedHeroIds.includes(hero.id)
                ? ('activated' as const)
                : ('ready' as const),
        },
      ];
    });
    this.#board.noiseTokens = [
      ...view.noiseTokens.map(noise => ({ position: noise.position })),
      ...view.revealedNoise.map(noise => ({
        position: noise.position,
        revealedLabel: NOISE_LABELS[noise.resultId],
        accessibleLabel: NOISE_NAMES[noise.resultId],
      })),
    ];
    this.#board.doors = view.doors.map(door => ({
      position: door.position,
      status:
        door.status === 'open' || door.status === 'destroyed' ? door.status : ('closed' as const),
    }));
    this.#renderLegalSquares(view);
  }

  handleEvent(event: Event): boolean {
    if (event.type === 'game-command') return this.#handleCommand(event);
    if (event.type === 'hero-move-requested') return this.#handleMoveRequest();
    if (event.type === 'hero-move-facing-selected') return this.#handleMoveFacing(event);
    if (event.type === 'hero-move-cancelled') return this.#handleMoveCancel();
    if (event.type === 'hero-door-requested') return this.#handleDoorRequest();
    if (event.type === 'board-square-selected') return this.#handleBoardSelection(event);
    return false;
  }

  #handleCommand(event: Event): boolean {
    const command = (event as CustomEvent<GameCommand>).detail;
    if (!HERO_COMMAND_TYPES.has(command.type)) return false;
    try {
      const events = this.#session.dispatch(command);
      this.#clearSelection();
      this.#setup.announce(events);
      this.render();
    } catch (error) {
      this.#reportError(error);
    }
    return true;
  }

  #handleMoveRequest(): boolean {
    const view = this.#session.heroView;
    if (view.setupStep !== 'complete' || view.phase !== 'hero' || !view.activeHeroId) return false;
    this.#selectionMode = 'move';
    this.#pendingMovePath = null;
    this.#pendingMoveDestination = null;
    this.#setup.chooseMoveDestination();
    this.#renderLegalSquares(view);
    return true;
  }

  #handleMoveFacing(event: Event): boolean {
    const view = this.#session.heroView;
    if (
      view.setupStep !== 'complete' ||
      view.phase !== 'hero' ||
      !view.activeHeroId ||
      this.#pendingMovePath === null
    ) {
      return false;
    }
    try {
      const events = this.#session.dispatch({
        type: 'move-hero',
        heroId: view.activeHeroId,
        path: this.#pendingMovePath,
        facing: (event as CustomEvent<Facing>).detail,
      });
      this.#clearSelection();
      this.#setup.announce(events);
      this.render();
    } catch (error) {
      this.#reportError(error);
    }
    return true;
  }

  #handleMoveCancel(): boolean {
    if (this.#selectionMode !== 'move' && this.#pendingMovePath === null) return false;
    this.#clearSelection();
    return true;
  }

  #handleDoorRequest(): boolean {
    const view = this.#session.heroView;
    if (view.setupStep !== 'complete' || view.phase !== 'hero' || !view.activeHeroId) return false;
    this.#selectionMode = 'door';
    this.#pendingMovePath = null;
    this.#pendingMoveDestination = null;
    this.#setup.clearMoveSelection();
    this.#renderLegalSquares(view);
    return true;
  }

  #handleBoardSelection(event: Event): boolean {
    const view = this.#session.heroView;
    if (!this.#selectionMode || !view.activeHeroId) return false;
    const position = (event as CustomEvent<Position>).detail;
    try {
      let events: readonly GameEvent[];
      if (this.#selectionMode === 'move') {
        const path = view.legalMovePaths.find(candidate =>
          this.#samePosition(candidate.destination, position)
        );
        if (!path) {
          throw new RulesError('INVALID_MOVEMENT_PATH', 'Choose a highlighted movement target');
        }
        this.#selectionMode = null;
        this.#pendingMovePath = path.steps;
        this.#pendingMoveDestination = path.destination;
        this.#renderLegalSquares(view);
        this.#setup.chooseMoveFacing(path.destination);
        return true;
      } else {
        events = this.#session.dispatch({
          type: 'interact-door',
          heroId: view.activeHeroId,
          position,
        });
      }
      this.#clearSelection();
      this.#setup.announce(events);
      this.render();
    } catch (error) {
      this.#reportError(error);
    }
    return true;
  }

  #renderLegalSquares(view: HeroGameView) {
    this.#board.legalSquares =
      this.#selectionMode === 'move'
        ? view.legalMovePaths.map(path => path.destination)
        : this.#selectionMode === 'door'
          ? view.legalDoorInteractions
          : [];
    this.#board.selectedSquare = this.#pendingMoveDestination;
  }

  #samePosition(left: Position, right: Position) {
    return left.row === right.row && left.column === right.column;
  }

  #clearSelection() {
    this.#selectionMode = null;
    this.#pendingMovePath = null;
    this.#pendingMoveDestination = null;
    this.#board.legalSquares = [];
    this.#board.selectedSquare = null;
    this.#setup.clearMoveSelection();
  }

  #reportError(error: unknown) {
    this.#setup.showError(
      error instanceof RulesError ? error.message : 'The command could not be completed.'
    );
    if (!(error instanceof RulesError)) throw error;
  }
}
