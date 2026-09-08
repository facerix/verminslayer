import {
  createInitialGameState,
  getLegalDeploymentPositions,
  projectHeroView,
  resolveCommand,
} from '/src/game/gameState.js';
import type {
  GameCommand,
  GameEvent,
  GameState,
  HeroGameView,
  RandomSource,
} from '/src/game/gameState.js';
import type { Position } from '/src/game/map.js';
import type { MissionDefinition } from '/src/game/missionDefinition.js';

/**
 * Mutable application boundary around the immutable rules engine.
 *
 * UI modules share this session while engine commands remain pure and transactional.
 */
export class GameSession {
  readonly #mission: MissionDefinition;
  readonly #randomSource: RandomSource;
  #state: GameState;

  constructor(mission: MissionDefinition, randomSource: RandomSource) {
    this.#mission = mission;
    this.#randomSource = randomSource;
    this.#state = createInitialGameState(mission);
  }

  get heroView(): HeroGameView {
    return projectHeroView(this.#state);
  }

  get legalDeploymentPositions(): readonly Position[] {
    return getLegalDeploymentPositions(this.#state, this.#mission);
  }

  dispatch(command: GameCommand): readonly GameEvent[] {
    const result = resolveCommand(this.#state, command, this.#randomSource);
    this.#state = result.state;
    return result.events;
  }
}
