import { HERO_DEFINITIONS, isHeroId } from '/src/game/entities.js';
import type { HeroId } from '/src/game/entities.js';
import type { Position } from '/src/game/map.js';
import type { MissionDefinition, NoiseResultId } from '/src/game/missionDefinition.js';
import { getMissionDefinition } from '/src/game/missions/registry.js';
import { RulesError } from '/src/game/rulesError.js';

export type GameMode = 'solo' | 'two-player';
export type SetupStep = 'select-roster' | 'deploy-heroes' | 'initial-noise';
export type Facing = 'north' | 'east' | 'south' | 'west';

export interface RandomSource {
  next(): number;
}

export const browserRandomSource: RandomSource = Object.freeze({
  next: () => crypto.getRandomValues(new Uint32Array(1))[0]! / 0x1_0000_0000,
});

export interface HeroState {
  readonly id: HeroId;
  readonly definitionId: HeroId;
  readonly woundsRemaining: number;
  readonly position: Position | null;
  readonly facing: Facing | null;
}

export interface ConcealedNoiseState {
  readonly id: string;
  readonly resultId: NoiseResultId;
  readonly position: Position;
}

export interface FeatureState {
  readonly position: Position;
  readonly status: 'closed' | 'intact';
}

export interface GameState {
  readonly missionId: string;
  readonly setupStep: SetupStep;
  readonly mode: GameMode | null;
  readonly round: 0;
  readonly phase: 'setup';
  readonly command: 0;
  readonly selectedHeroIds: readonly HeroId[];
  readonly heroes: readonly HeroState[];
  readonly doors: readonly FeatureState[];
  readonly nests: readonly FeatureState[];
  readonly concealedNoise: readonly ConcealedNoiseState[];
  readonly remainingNoiseBag: readonly NoiseResultId[];
}

export type GameCommand =
  | {
      readonly type: 'configure-game';
      readonly mode: GameMode;
      readonly heroIds: readonly HeroId[];
    }
  | {
      readonly type: 'deploy-hero';
      readonly heroId: HeroId;
      readonly position: Position;
      readonly facing: Facing;
    };

export type GameEvent =
  | {
      readonly type: 'game-configured';
      readonly mode: GameMode;
      readonly heroIds: readonly HeroId[];
    }
  | {
      readonly type: 'hero-deployed';
      readonly heroId: HeroId;
      readonly position: Position;
      readonly facing: Facing;
    }
  | { readonly type: 'deployment-complete' };

export interface CommandResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export interface PublicNoiseToken {
  readonly id: string;
  readonly position: Position;
}

export interface HeroGameView {
  readonly missionId: string;
  readonly setupStep: SetupStep;
  readonly mode: GameMode | null;
  readonly selectedHeroIds: readonly HeroId[];
  readonly heroes: readonly HeroState[];
  readonly noiseTokens: readonly PublicNoiseToken[];
  readonly remainingNoiseCount: number;
}

export interface SkavenGameView extends Omit<HeroGameView, 'noiseTokens'> {
  readonly noiseTokens: readonly ConcealedNoiseState[];
}

const freezePosition = (position: Position): Position =>
  Object.freeze({ row: position.row, column: position.column });

const freezeHero = (hero: HeroState): HeroState =>
  Object.freeze({
    ...hero,
    position: hero.position ? freezePosition(hero.position) : null,
  });

const freezeFeature = (feature: FeatureState): FeatureState =>
  Object.freeze({ ...feature, position: freezePosition(feature.position) });

const freezeNoise = (noise: ConcealedNoiseState): ConcealedNoiseState =>
  Object.freeze({ ...noise, position: freezePosition(noise.position) });

const freezeState = (state: GameState): GameState =>
  Object.freeze({
    ...state,
    selectedHeroIds: Object.freeze([...state.selectedHeroIds]),
    heroes: Object.freeze(state.heroes.map(freezeHero)),
    doors: Object.freeze(state.doors.map(freezeFeature)),
    nests: Object.freeze(state.nests.map(freezeFeature)),
    concealedNoise: Object.freeze(state.concealedNoise.map(freezeNoise)),
    remainingNoiseBag: Object.freeze([...state.remainingNoiseBag]),
  });

const assertMissionMatches = (state: GameState, mission: MissionDefinition) => {
  if (state.missionId !== mission.id) {
    throw new RulesError(
      'INVALID_SETUP_STEP',
      `State belongs to mission ${state.missionId}, not ${mission.id}`
    );
  }
};

const isDeployableTile = (kind: string) => kind === 'floor' || kind === 'deployment';

const isInDeploymentZone = (position: Position, mission: MissionDefinition) =>
  Math.max(
    Math.abs(position.row - mission.board.deployment.row),
    Math.abs(position.column - mission.board.deployment.column)
  ) <= 1;

const isOnBoard = (position: Position, mission: MissionDefinition) =>
  Number.isInteger(position.row) &&
  Number.isInteger(position.column) &&
  position.row >= 0 &&
  position.column >= 0 &&
  position.row < mission.board.height &&
  position.column < mission.board.width;

const assertValidRoster = (heroIds: readonly HeroId[], mission: MissionDefinition) => {
  const uniqueIds = new Set(heroIds);
  const allKnown = heroIds.every(
    id => typeof id === 'string' && isHeroId(id) && mission.allowedHeroes.includes(id)
  );
  if (heroIds.length < 1 || heroIds.length > 5 || uniqueIds.size !== heroIds.length || !allKnown) {
    throw new RulesError(
      'INVALID_HERO_ROSTER',
      'Select between 1 and 5 unique heroes available in this mission'
    );
  }
};

const isFacing = (value: string): value is Facing =>
  value === 'north' || value === 'east' || value === 'south' || value === 'west';

export const createInitialGameState = (mission: MissionDefinition): GameState =>
  freezeState({
    missionId: mission.id,
    setupStep: 'select-roster',
    mode: null,
    round: 0,
    phase: 'setup',
    command: 0,
    selectedHeroIds: ['gotrek', 'felix'],
    heroes: [],
    doors: mission.board.doors.map(position => ({ position, status: 'closed' as const })),
    nests: mission.board.nests.map(position => ({ position, status: 'intact' as const })),
    concealedNoise: [],
    remainingNoiseBag: mission.noiseBag,
  });

export const getLegalDeploymentPositions = (
  state: GameState,
  mission: MissionDefinition
): readonly Position[] => {
  assertMissionMatches(state, mission);
  const occupied = new Set(
    state.heroes
      .filter(hero => hero.position)
      .map(hero => `${String(hero.position!.row)},${String(hero.position!.column)}`)
  );
  const positions: Position[] = [];

  for (let row = mission.board.deployment.row - 1; row <= mission.board.deployment.row + 1; row++) {
    for (
      let column = mission.board.deployment.column - 1;
      column <= mission.board.deployment.column + 1;
      column++
    ) {
      const position = { row, column };
      const tile = mission.board.tiles[row]?.[column];
      if (
        tile &&
        isDeployableTile(tile.kind) &&
        !occupied.has(`${String(row)},${String(column)}`)
      ) {
        positions.push(freezePosition(position));
      }
    }
  }

  return Object.freeze(positions);
};

const configureGame = (
  state: GameState,
  command: Extract<GameCommand, { type: 'configure-game' }>,
  mission: MissionDefinition
): CommandResult => {
  if (state.setupStep !== 'select-roster') {
    throw new RulesError('INVALID_SETUP_STEP', 'The roster can only be chosen before deployment');
  }
  if (command.mode !== 'solo' && command.mode !== 'two-player') {
    throw new RulesError('INVALID_MODE', 'Choose solo or two-player mode');
  }
  assertValidRoster(command.heroIds, mission);

  const selectedHeroIds = Object.freeze([...command.heroIds]);
  const heroes = command.heroIds.map(id =>
    freezeHero({
      id,
      definitionId: id,
      woundsRemaining: HERO_DEFINITIONS[id].stats.wounds,
      position: null,
      facing: null,
    })
  );
  const nextState = freezeState({
    ...state,
    setupStep: 'deploy-heroes',
    mode: command.mode,
    selectedHeroIds,
    heroes,
  });

  return Object.freeze({
    state: nextState,
    events: Object.freeze([
      Object.freeze({
        type: 'game-configured' as const,
        mode: command.mode,
        heroIds: selectedHeroIds,
      }),
    ]),
  });
};

const deployHero = (
  state: GameState,
  command: Extract<GameCommand, { type: 'deploy-hero' }>,
  mission: MissionDefinition
): CommandResult => {
  if (state.setupStep !== 'deploy-heroes') {
    throw new RulesError('INVALID_SETUP_STEP', 'Heroes can only deploy during deployment');
  }
  const hero = state.heroes.find(candidate => candidate.id === command.heroId);
  if (!hero) {
    throw new RulesError('HERO_NOT_SELECTED', `${command.heroId} is not in the selected roster`);
  }
  if (hero.position) {
    throw new RulesError('HERO_ALREADY_DEPLOYED', `${HERO_DEFINITIONS[hero.id].name} is deployed`);
  }
  if (!isFacing(command.facing)) {
    throw new RulesError('INVALID_FACING', 'Choose north, east, south, or west facing');
  }
  if (
    state.heroes.some(
      candidate =>
        candidate.position?.row === command.position.row &&
        candidate.position.column === command.position.column
    )
  ) {
    throw new RulesError('DEPLOYMENT_OCCUPIED', 'Models cannot share a deployment square');
  }
  const tile = isOnBoard(command.position, mission)
    ? mission.board.tiles[command.position.row]![command.position.column]!
    : null;
  if (!tile || !isInDeploymentZone(command.position, mission) || !isDeployableTile(tile.kind)) {
    throw new RulesError(
      'INVALID_DEPLOYMENT_SQUARE',
      'Deploy on the marker or an empty, passable adjacent square'
    );
  }

  const heroes = state.heroes.map(candidate =>
    candidate.id === command.heroId
      ? freezeHero({ ...candidate, position: command.position, facing: command.facing })
      : candidate
  );
  const deploymentComplete = heroes.every(candidate => candidate.position !== null);
  const nextState = freezeState({
    ...state,
    setupStep: deploymentComplete ? 'initial-noise' : 'deploy-heroes',
    heroes,
  });
  const deployedEvent = Object.freeze({
    type: 'hero-deployed' as const,
    heroId: command.heroId,
    position: freezePosition(command.position),
    facing: command.facing,
  });
  const events: readonly GameEvent[] = deploymentComplete
    ? Object.freeze([deployedEvent, Object.freeze({ type: 'deployment-complete' as const })])
    : Object.freeze([deployedEvent]);

  return Object.freeze({ state: nextState, events });
};

export const resolveCommand = (
  state: GameState,
  command: GameCommand,
  randomSource: RandomSource
): CommandResult => {
  const mission = getMissionDefinition(state.missionId);
  assertMissionMatches(state, mission);
  void randomSource;
  switch (command.type) {
    case 'configure-game':
      return configureGame(state, command, mission);
    case 'deploy-hero':
      return deployHero(state, command, mission);
    default:
      throw new RulesError(
        'INVALID_COMMAND',
        `Unknown game command ${(command as { readonly type: string }).type}`
      );
  }
};

export const projectHeroView = (state: GameState): HeroGameView =>
  Object.freeze({
    missionId: state.missionId,
    setupStep: state.setupStep,
    mode: state.mode,
    selectedHeroIds: Object.freeze([...state.selectedHeroIds]),
    heroes: Object.freeze(state.heroes.map(freezeHero)),
    noiseTokens: Object.freeze(
      state.concealedNoise.map(noise =>
        Object.freeze({ id: noise.id, position: freezePosition(noise.position) })
      )
    ),
    remainingNoiseCount: state.remainingNoiseBag.length,
  });

export const projectSkavenView = (state: GameState): SkavenGameView =>
  Object.freeze({
    missionId: state.missionId,
    setupStep: state.setupStep,
    mode: state.mode,
    selectedHeroIds: Object.freeze([...state.selectedHeroIds]),
    heroes: Object.freeze(state.heroes.map(freezeHero)),
    noiseTokens: Object.freeze(state.concealedNoise.map(freezeNoise)),
    remainingNoiseCount: state.remainingNoiseBag.length,
  });
