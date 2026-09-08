import type { BoardHeroPresentation, BoardNoisePresentation } from '/src/canvas/boardRenderer.js';
import { HERO_DEFINITIONS } from '/src/game/entities.js';
import type { HeroId } from '/src/game/entities.js';
import type { GameModule } from '/src/game/gameModule.js';
import type { GameSession } from '/src/game/gameSession.js';
import type {
  GameCommand,
  GameEvent,
  HeroGameView,
  RandomSource,
  SkavenGameView,
} from '/src/game/gameState.js';
import type { Position } from '/src/game/map.js';
import type { NoiseResultId } from '/src/game/missionDefinition.js';
import { RulesError } from '/src/game/rulesError.js';

interface InitialNoiseView {
  view: HeroGameView;
  privateNoiseView: SkavenGameView | null;
  announce(events: readonly GameEvent[]): void;
  showError(message: string): void;
}

interface BoardView {
  heroes: readonly BoardHeroPresentation[];
  legalSquares: readonly Position[];
  noiseTokens: readonly BoardNoisePresentation[];
}

interface InitialNoiseGameModuleOptions {
  readonly session: GameSession;
  readonly setup: InitialNoiseView;
  readonly board: BoardView;
  readonly randomSource: RandomSource;
}

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

export class InitialNoiseGameModule implements GameModule {
  readonly eventTypes = Object.freeze(['game-command', 'board-square-selected']);
  readonly #session: GameSession;
  readonly #setup: InitialNoiseView;
  readonly #board: BoardView;
  readonly #randomSource: RandomSource;

  constructor({ session, setup, board, randomSource }: InitialNoiseGameModuleOptions) {
    this.#session = session;
    this.#setup = setup;
    this.#board = board;
    this.#randomSource = randomSource;
  }

  render(): void {
    const publicView = this.#session.heroView;
    this.#setup.view = publicView;
    this.#renderBoard(publicView);
    if (publicView.setupStep === 'initial-noise' && this.#session.skavenView.pendingNoise) {
      this.#setup.privateNoiseView = this.#session.skavenView;
      this.#board.legalSquares = this.#session.legalNoiseSpawnPositions;
    }
  }

  handleEvent(event: Event): boolean {
    if (event.type === 'game-command') return this.#handleCommand(event);
    if (event.type === 'board-square-selected') return this.#handleBoardSelection(event);
    return false;
  }

  #renderBoard(view: HeroGameView) {
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
    this.#board.noiseTokens = [
      ...view.noiseTokens.map(noise => ({ position: noise.position })),
      ...view.revealedNoise.map(noise => ({
        position: noise.position,
        revealedLabel: NOISE_LABELS[noise.resultId],
        accessibleLabel: NOISE_NAMES[noise.resultId],
      })),
    ];
    this.#board.legalSquares = [];
  }

  #handleCommand(event: Event): boolean {
    const command = (event as CustomEvent<GameCommand>).detail;
    if (
      command.type !== 'draw-initial-noise' ||
      this.#session.heroView.setupStep !== 'initial-noise'
    ) {
      return false;
    }

    try {
      const events =
        this.#session.heroView.mode === 'solo'
          ? this.#runSoloInitialNoise()
          : this.#drawForSkavenPlayer();
      this.#setup.announce(events);
      this.render();
    } catch (error) {
      this.#reportError(error);
    }
    return true;
  }

  #handleBoardSelection(event: Event): boolean {
    const view = this.#session.skavenView;
    if (view.setupStep !== 'initial-noise' || view.mode !== 'two-player' || !view.pendingNoise) {
      return false;
    }

    try {
      const events = [
        ...this.#session.dispatch({
          type: 'place-initial-noise',
          position: (event as CustomEvent<Position>).detail,
        }),
      ];
      if (this.#session.heroView.setupStep === 'initial-noise') {
        events.push(...this.#drawForSkavenPlayer());
      }
      this.#setup.announce(events);
      this.render();
    } catch (error) {
      this.#reportError(error);
    }
    return true;
  }

  #drawForSkavenPlayer(): readonly GameEvent[] {
    const events: GameEvent[] = [];
    do {
      events.push(...this.#session.dispatch({ type: 'draw-initial-noise' }));
    } while (
      this.#session.heroView.setupStep === 'initial-noise' &&
      !this.#session.skavenView.pendingNoise
    );
    return events;
  }

  #runSoloInitialNoise(): readonly GameEvent[] {
    const events: GameEvent[] = [];
    while (this.#session.heroView.setupStep === 'initial-noise') {
      if (!this.#session.skavenView.pendingNoise) {
        events.push(...this.#session.dispatch({ type: 'draw-initial-noise' }));
      }
      if (!this.#session.skavenView.pendingNoise) continue;

      const positions = this.#session.legalNoiseSpawnPositions;
      const randomValue = this.#randomSource.next();
      if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
        throw new RulesError(
          'INVALID_RANDOM_VALUE',
          'Random values must be finite numbers from 0 up to 1'
        );
      }
      const position = positions[Math.floor(randomValue * positions.length)];
      if (!position) {
        throw new RulesError('INVALID_NOISE_SPAWN', 'No legal Skaven spawn is available');
      }
      events.push(...this.#session.dispatch({ type: 'place-initial-noise', position }));
    }
    return events;
  }

  #reportError(error: unknown) {
    this.#setup.showError(
      error instanceof RulesError ? error.message : 'The command could not be completed.'
    );
    if (!(error instanceof RulesError)) throw error;
  }
}
