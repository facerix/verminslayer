import type {
  BoardDoorPresentation,
  BoardHeroPresentation,
  BoardNoisePresentation,
  BoardSkavenPresentation,
} from '/src/canvas/boardRenderer.js';
import {
  getSkavenModelIdentifier,
  HERO_DEFINITIONS,
  SKAVEN_DEFINITIONS,
} from '/src/game/entities.js';
import type { HeroId } from '/src/game/entities.js';
import type { GameModule } from '/src/game/gameModule.js';
import type { GameSession } from '/src/game/gameSession.js';
import type { Facing, GameCommand, GameEvent, HeroGameView } from '/src/game/gameState.js';
import type { Position } from '/src/game/map.js';
import type { NoiseResultId } from '/src/game/missionDefinition.js';
import { RulesError } from '/src/game/rulesError.js';

interface SkavenTurnView {
  view: HeroGameView;
  announce(events: readonly GameEvent[]): void;
  showError(message: string): void;
  chooseSkavenMoveDestination(): void;
  chooseSkavenMoveFacing(destination: Position): void;
  clearMoveSelection(): void;
}

interface BoardView {
  heroes: readonly BoardHeroPresentation[];
  legalSquares: readonly Position[];
  selectedSquare: Position | null;
  noiseTokens: readonly BoardNoisePresentation[];
  doors: readonly BoardDoorPresentation[];
  skaven: readonly BoardSkavenPresentation[];
}

interface SkavenTurnGameModuleOptions {
  readonly session: GameSession;
  readonly setup: SkavenTurnView;
  readonly board: BoardView;
}

type SelectionMode = 'move' | 'fight' | 'door' | null;

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

const SKAVEN_COMMAND_TYPES = new Set<GameCommand['type']>([
  'start-skaven-activation',
  'move-skaven',
  'fight-hero',
  'interact-door-skaven',
  'end-skaven-activation',
]);

export class SkavenTurnGameModule implements GameModule {
  readonly eventTypes = Object.freeze([
    'game-command',
    'board-square-selected',
    'skaven-move-requested',
    'skaven-move-facing-selected',
    'skaven-move-cancelled',
    'skaven-fight-requested',
    'skaven-door-requested',
  ]);
  readonly #session: GameSession;
  readonly #setup: SkavenTurnView;
  readonly #board: BoardView;
  #selectionMode: SelectionMode = null;
  #pendingMovePath: readonly Position[] | null = null;
  #pendingMoveDestination: Position | null = null;

  constructor({ session, setup, board }: SkavenTurnGameModuleOptions) {
    this.#session = session;
    this.#setup = setup;
    this.#board = board;
  }

  render(): void {
    const view = this.#session.heroView;
    if (view.phase !== 'skaven') return;
    this.#setup.view = view;
    this.#board.heroes = view.heroes.flatMap(hero =>
      hero.position && hero.facing
        ? [
            {
              label: HERO_LABELS[HERO_DEFINITIONS[hero.definitionId].id],
              position: hero.position,
              facing: hero.facing,
              woundsRemaining: hero.woundsRemaining,
            },
          ]
        : []
    );
    this.#board.skaven = view.skaven.map(skaven => ({
      id: skaven.id,
      identifier: getSkavenModelIdentifier(skaven.id),
      label:
        skaven.definitionId === 'clanrat'
          ? 'CR'
          : skaven.definitionId === 'gutter-runner'
            ? 'GR'
            : 'RO',
      accessibleLabel: SKAVEN_DEFINITIONS[skaven.definitionId].name,
      position: skaven.position,
      facing: skaven.facing,
      woundsRemaining: skaven.woundsRemaining,
      activationStatus:
        view.activeSkavenId === skaven.id
          ? ('active' as const)
          : view.activatedSkavenIds.includes(skaven.id)
            ? ('activated' as const)
            : ('ready' as const),
    }));
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
      status: door.status,
    }));
    this.#renderLegalSquares(view);
  }

  handleEvent(event: Event): boolean {
    if (event.type === 'game-command') return this.#handleCommand(event);
    if (event.type === 'skaven-move-requested') return this.#handleMoveRequest();
    if (event.type === 'skaven-move-facing-selected') return this.#handleMoveFacing(event);
    if (event.type === 'skaven-move-cancelled') return this.#handleMoveCancel();
    if (event.type === 'skaven-fight-requested') return this.#handleFightRequest();
    if (event.type === 'skaven-door-requested') return this.#handleDoorRequest();
    if (event.type === 'board-square-selected') return this.#handleBoardSelection(event);
    return false;
  }

  #handleCommand(event: Event): boolean {
    const command = (event as CustomEvent<GameCommand>).detail;
    if (!SKAVEN_COMMAND_TYPES.has(command.type)) return false;
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
    if (view.phase !== 'skaven' || !view.activeSkavenId) return false;
    const onlyLegalPath =
      view.legalSkavenMovePaths.length === 1 ? view.legalSkavenMovePaths[0] : null;
    if (onlyLegalPath?.steps.length === 0) {
      this.#selectionMode = null;
      this.#pendingMovePath = onlyLegalPath.steps;
      this.#pendingMoveDestination = onlyLegalPath.destination;
      this.#renderLegalSquares(view);
      this.#setup.chooseSkavenMoveFacing(onlyLegalPath.destination);
      return true;
    }
    this.#selectionMode = 'move';
    this.#pendingMovePath = null;
    this.#pendingMoveDestination = null;
    this.#setup.chooseSkavenMoveDestination();
    this.#renderLegalSquares(view);
    return true;
  }

  #handleMoveFacing(event: Event): boolean {
    const view = this.#session.heroView;
    if (!view.activeSkavenId || this.#pendingMovePath === null) return false;
    try {
      const events = this.#session.dispatch({
        type: 'move-skaven',
        skavenId: view.activeSkavenId,
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

  #handleFightRequest(): boolean {
    const view = this.#session.heroView;
    if (!view.activeSkavenId || view.legalSkavenFightTargetIds.length === 0) return false;
    this.#selectionMode = 'fight';
    this.#setup.clearMoveSelection();
    this.#renderLegalSquares(view);
    return true;
  }

  #handleDoorRequest(): boolean {
    const view = this.#session.heroView;
    if (!view.activeSkavenId || view.legalSkavenDoorInteractions.length === 0) return false;
    this.#selectionMode = 'door';
    this.#setup.clearMoveSelection();
    this.#renderLegalSquares(view);
    return true;
  }

  #handleBoardSelection(event: Event): boolean {
    const view = this.#session.heroView;
    if (!this.#selectionMode || !view.activeSkavenId) return false;
    const position = (event as CustomEvent<Position>).detail;
    try {
      let events: readonly GameEvent[];
      if (this.#selectionMode === 'move') {
        const path = view.legalSkavenMovePaths.find(candidate =>
          this.#samePosition(candidate.destination, position)
        );
        if (!path) {
          throw new RulesError('INVALID_MOVEMENT_PATH', 'Choose a highlighted movement target');
        }
        this.#selectionMode = null;
        this.#pendingMovePath = path.steps;
        this.#pendingMoveDestination = path.destination;
        this.#renderLegalSquares(view);
        this.#setup.chooseSkavenMoveFacing(path.destination);
        return true;
      }
      if (this.#selectionMode === 'fight') {
        const hero = view.heroes.find(candidate =>
          candidate.position ? this.#samePosition(candidate.position, position) : false
        );
        if (!hero || !view.legalSkavenFightTargetIds.includes(hero.id)) {
          throw new RulesError('UNKNOWN_FIGHT_TARGET', 'Choose a highlighted hero');
        }
        events = this.#session.dispatch({
          type: 'fight-hero',
          skavenId: view.activeSkavenId,
          heroId: hero.id,
        });
      } else {
        events = this.#session.dispatch({
          type: 'interact-door-skaven',
          skavenId: view.activeSkavenId,
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
        ? view.legalSkavenMovePaths.map(path => path.destination)
        : this.#selectionMode === 'fight'
          ? view.heroes.flatMap(hero =>
              hero.position && view.legalSkavenFightTargetIds.includes(hero.id)
                ? [hero.position]
                : []
            )
          : this.#selectionMode === 'door'
            ? view.legalSkavenDoorInteractions
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
