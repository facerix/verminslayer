import {
  createInitialGameState,
  getLegalDeploymentPositions,
  getLegalNoiseSpawnPositions,
  getLegalNoiseMovePaths,
  getLegalSkavenDoorInteractions,
  getLegalSkavenFightTargetIds,
  getLegalSkavenMovePaths,
  getSkavenApproachPaths,
  getSkavenDistanceToNearestReachableHero,
  getLegalSkavenPlacementPositions,
  projectHeroView,
  projectSkavenView,
  resolveCommand,
  restoreGameState,
} from '/src/game/gameState.js';
import type {
  Facing,
  GameCommand,
  GameEvent,
  GameState,
  HeroGameView,
  RandomSource,
  SkavenGameView,
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
  readonly #onStateChange: (state: GameState) => void;
  #state: GameState;

  constructor(
    mission: MissionDefinition,
    randomSource: RandomSource,
    initialState?: GameState,
    onStateChange: (state: GameState) => void = () => {}
  ) {
    this.#mission = mission;
    this.#randomSource = randomSource;
    this.#onStateChange = onStateChange;
    this.#state = initialState
      ? restoreGameState(initialState, mission)
      : createInitialGameState(mission);
  }

  get state(): GameState {
    return this.#state;
  }

  get heroView(): HeroGameView {
    return projectHeroView(this.#state);
  }

  get skavenView(): SkavenGameView {
    return projectSkavenView(this.#state);
  }

  get legalDeploymentPositions(): readonly Position[] {
    return getLegalDeploymentPositions(this.#state, this.#mission);
  }

  get legalNoiseSpawnPositions(): readonly Position[] {
    return getLegalNoiseSpawnPositions(this.#state, this.#mission);
  }

  get legalNoiseMovePaths() {
    return getLegalNoiseMovePaths(this.#state, this.#mission);
  }

  legalSkavenPlacementPositions(noiseId: string): readonly Position[] {
    return getLegalSkavenPlacementPositions(this.#state, this.#mission, noiseId);
  }

  get legalSkavenMovePaths() {
    return getLegalSkavenMovePaths(this.#state, this.#mission);
  }

  get legalSkavenDoorInteractions(): readonly Position[] {
    return getLegalSkavenDoorInteractions(this.#state, this.#mission);
  }

  get legalSkavenFightTargetIds() {
    return getLegalSkavenFightTargetIds(this.#state);
  }

  skavenApproachPaths(skavenId: string) {
    return getSkavenApproachPaths(this.#state, this.#mission, skavenId);
  }

  skavenDistanceToNearestReachableHero(skavenId: string): number {
    return getSkavenDistanceToNearestReachableHero(this.#state, this.#mission, skavenId);
  }

  dispatch(command: GameCommand): readonly GameEvent[] {
    let result = resolveCommand(this.#state, command, this.#randomSource);
    this.#state = result.state;
    const events = [...result.events];

    while (this.#state.revealedNoise[0]) {
      const noise = this.#state.revealedNoise[0];
      const positions = getLegalSkavenPlacementPositions(this.#state, this.#mission, noise.id);
      if (positions.length !== 1) break;

      const position = positions[0]!;
      result = resolveCommand(
        this.#state,
        {
          type: 'place-revealed-skaven',
          noiseId: noise.id,
          position,
          facing: this.#facingTowardNearestHero(position),
        },
        this.#randomSource
      );
      this.#state = result.state;
      events.push(...result.events);
    }

    this.#onStateChange(this.#state);
    return Object.freeze(events);
  }

  #facingTowardNearestHero(position: Position): Facing {
    let target: Position | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const hero of this.#state.heroes) {
      if (!hero.position || hero.woundsRemaining <= 0) continue;
      const distance = Math.max(
        Math.abs(hero.position.row - position.row),
        Math.abs(hero.position.column - position.column)
      );
      if (distance >= nearestDistance) continue;
      target = hero.position;
      nearestDistance = distance;
    }
    if (!target) return 'north';

    const rowDelta = target.row - position.row;
    const columnDelta = target.column - position.column;
    if (Math.abs(rowDelta) >= Math.abs(columnDelta)) {
      return rowDelta >= 0 ? 'south' : 'north';
    }
    return columnDelta >= 0 ? 'east' : 'west';
  }
}
