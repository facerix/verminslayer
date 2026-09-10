import type { BoardHeroPresentation } from '/src/canvas/boardRenderer.js';
import { HERO_DEFINITIONS } from '/src/game/entities.js';
import type { HeroId } from '/src/game/entities.js';
import type { GameModule } from '/src/game/gameModule.js';
import type { GameSession } from '/src/game/gameSession.js';
import type { GameCommand, GameEvent, HeroGameView } from '/src/game/gameState.js';
import type { Position } from '/src/game/map.js';
import { RulesError } from '/src/game/rulesError.js';

interface SetupView {
  view: HeroGameView;
  announce(events: readonly GameEvent[]): void;
  showError(message: string): void;
  deployAt(position: Position): void;
}

interface BoardView {
  heroes: readonly BoardHeroPresentation[];
  legalSquares: readonly Position[];
}

interface SetupGameModuleOptions {
  readonly session: GameSession;
  readonly setup: SetupView;
  readonly board: BoardView;
}

const HERO_LABELS: Readonly<Record<HeroId, string>> = Object.freeze({
  gotrek: 'Go',
  felix: 'Fe',
  snorri: 'Sn',
  ulrika: 'Ul',
  maximilian: 'Mx',
  malakai: 'Ma',
});

export class SetupGameModule implements GameModule {
  readonly eventTypes = Object.freeze(['game-command', 'board-square-selected']);
  readonly #session: GameSession;
  readonly #setup: SetupView;
  readonly #board: BoardView;

  constructor({ session, setup, board }: SetupGameModuleOptions) {
    this.#session = session;
    this.#setup = setup;
    this.#board = board;
  }

  render(): void {
    const view = this.#session.heroView;
    this.#setup.view = view;
    this.#board.heroes = view.heroes.flatMap(hero => {
      if (!hero.position || !hero.facing) return [];
      return [
        {
          label: HERO_LABELS[HERO_DEFINITIONS[hero.definitionId].id],
          position: hero.position,
          facing: hero.facing,
          woundsRemaining: hero.woundsRemaining,
        },
      ];
    });
    this.#board.legalSquares =
      view.setupStep === 'deploy-heroes' ? this.#session.legalDeploymentPositions : [];
  }

  handleEvent(event: Event): boolean {
    if (event.type === 'game-command') return this.#handleCommand(event);
    if (event.type === 'board-square-selected') return this.#handleBoardSelection(event);
    return false;
  }

  #handleCommand(event: Event): boolean {
    const command = (event as CustomEvent<GameCommand>).detail;
    if (command.type !== 'configure-game' && command.type !== 'deploy-hero') return false;

    try {
      const events = this.#session.dispatch(command);
      this.#setup.announce(events);
      this.render();
    } catch (error) {
      this.#setup.showError(
        error instanceof RulesError ? error.message : 'The command could not be completed.'
      );
      if (!(error instanceof RulesError)) throw error;
    }
    return true;
  }

  #handleBoardSelection(event: Event): boolean {
    if (this.#session.heroView.setupStep !== 'deploy-heroes') return false;
    this.#setup.deployAt((event as CustomEvent<Position>).detail);
    return true;
  }
}
