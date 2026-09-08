import { HERO_DEFINITIONS, isHeroId } from '/src/game/entities.js';
import type { HeroId } from '/src/game/entities.js';
import type { Position } from '/src/game/map.js';
import type { MissionDefinition, NoiseResultId } from '/src/game/missionDefinition.js';
import { getMissionDefinition } from '/src/game/missions/registry.js';
import { RulesError } from '/src/game/rulesError.js';
import { hasLineOfSight } from '/src/game/lineOfSight.js';

export type GameMode = 'solo' | 'two-player';
export type SetupStep = 'select-roster' | 'deploy-heroes' | 'initial-noise' | 'complete';
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

export interface PendingNoiseState {
  readonly id: string;
  readonly resultId: NoiseResultId;
}

export type RevealedNoiseState = ConcealedNoiseState;

export interface FeatureState {
  readonly position: Position;
  readonly status: 'closed' | 'intact';
}

export interface GameState {
  readonly missionId: string;
  readonly setupStep: SetupStep;
  readonly mode: GameMode | null;
  readonly round: number;
  readonly phase: 'setup' | 'hero';
  readonly command: number;
  readonly selectedHeroIds: readonly HeroId[];
  readonly heroes: readonly HeroState[];
  readonly doors: readonly FeatureState[];
  readonly nests: readonly FeatureState[];
  readonly concealedNoise: readonly ConcealedNoiseState[];
  readonly revealedNoise: readonly RevealedNoiseState[];
  readonly pendingNoise: PendingNoiseState | null;
  readonly initialNoiseDrawsResolved: number;
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
    }
  | {
      readonly type: 'draw-initial-noise';
    }
  | {
      readonly type: 'place-initial-noise';
      readonly position: Position;
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
  | { readonly type: 'deployment-complete' }
  | { readonly type: 'noise-drawn' }
  | { readonly type: 'noise-draw-consumed' }
  | {
      readonly type: 'noise-placed';
      readonly position: Position;
    }
  | {
      readonly type: 'noise-revealed';
      readonly resultId: NoiseResultId;
      readonly position: Position;
    }
  | { readonly type: 'initial-noise-complete' }
  | { readonly type: 'hero-turn-started'; readonly round: number; readonly command: number };

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
  readonly round: number;
  readonly phase: 'setup' | 'hero';
  readonly command: number;
  readonly selectedHeroIds: readonly HeroId[];
  readonly heroes: readonly HeroState[];
  readonly noiseTokens: readonly PublicNoiseToken[];
  readonly revealedNoise: readonly RevealedNoiseState[];
  readonly initialNoiseDrawsResolved: number;
  readonly initialNoiseCount: number;
  readonly remainingNoiseCount: number;
}

export interface SkavenGameView extends Omit<HeroGameView, 'noiseTokens'> {
  readonly noiseTokens: readonly ConcealedNoiseState[];
  readonly pendingNoise: PendingNoiseState | null;
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

const freezePendingNoise = (noise: PendingNoiseState): PendingNoiseState =>
  Object.freeze({ ...noise });

const freezeState = (state: GameState): GameState =>
  Object.freeze({
    ...state,
    selectedHeroIds: Object.freeze([...state.selectedHeroIds]),
    heroes: Object.freeze(state.heroes.map(freezeHero)),
    doors: Object.freeze(state.doors.map(freezeFeature)),
    nests: Object.freeze(state.nests.map(freezeFeature)),
    concealedNoise: Object.freeze(state.concealedNoise.map(freezeNoise)),
    revealedNoise: Object.freeze(state.revealedNoise.map(freezeNoise)),
    pendingNoise: state.pendingNoise ? freezePendingNoise(state.pendingNoise) : null,
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
    revealedNoise: [],
    pendingNoise: null,
    initialNoiseDrawsResolved: 0,
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

const samePosition = (left: Position, right: Position) =>
  left.row === right.row && left.column === right.column;

export const getLegalNoiseSpawnPositions = (
  state: GameState,
  mission: MissionDefinition
): readonly Position[] => {
  assertMissionMatches(state, mission);
  const occupied = [...state.concealedNoise, ...state.revealedNoise].map(noise => noise.position);
  occupied.push(...state.heroes.flatMap(hero => (hero.position ? [hero.position] : [])));
  return Object.freeze(
    mission.board.spawns
      .filter(spawn => !occupied.some(position => samePosition(position, spawn)))
      .map(freezePosition)
  );
};

const completeInitialNoiseIfReady = (
  state: GameState,
  mission: MissionDefinition,
  events: readonly GameEvent[]
): CommandResult => {
  if (state.initialNoiseDrawsResolved < mission.initialNoiseCount) {
    return Object.freeze({ state: freezeState(state), events: Object.freeze([...events]) });
  }

  const round = 1;
  const command = state.command + 3;
  return Object.freeze({
    state: freezeState({
      ...state,
      setupStep: 'complete',
      phase: 'hero',
      round,
      command,
      pendingNoise: null,
    }),
    events: Object.freeze([
      ...events,
      Object.freeze({ type: 'initial-noise-complete' as const }),
      Object.freeze({ type: 'hero-turn-started' as const, round, command }),
    ]),
  });
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

const assertInitialNoiseStep = (state: GameState) => {
  if (state.setupStep !== 'initial-noise') {
    throw new RulesError(
      'INVALID_SETUP_STEP',
      'Initial noise can only be drawn and placed after hero deployment'
    );
  }
};

const drawInitialNoise = (
  state: GameState,
  mission: MissionDefinition,
  randomSource: RandomSource
): CommandResult => {
  assertInitialNoiseStep(state);
  if (state.pendingNoise) {
    throw new RulesError(
      'NOISE_ALREADY_DRAWN',
      'Place the current noise result before drawing again'
    );
  }
  if (state.initialNoiseDrawsResolved >= mission.initialNoiseCount) {
    throw new RulesError('INITIAL_NOISE_COMPLETE', 'All initial noise draws are already resolved');
  }

  if (state.remainingNoiseBag.length === 0) {
    return completeInitialNoiseIfReady(
      { ...state, initialNoiseDrawsResolved: state.initialNoiseDrawsResolved + 1 },
      mission,
      [Object.freeze({ type: 'noise-draw-consumed' as const })]
    );
  }

  const randomValue = randomSource.next();
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new RulesError(
      'INVALID_RANDOM_VALUE',
      'Random values must be finite numbers from 0 up to 1'
    );
  }
  const drawIndex = Math.floor(randomValue * state.remainingNoiseBag.length);
  const resultId = state.remainingNoiseBag[drawIndex]!;
  const remainingNoiseBag = state.remainingNoiseBag.filter((_, index) => index !== drawIndex);

  if (getLegalNoiseSpawnPositions(state, mission).length === 0) {
    return completeInitialNoiseIfReady(
      {
        ...state,
        remainingNoiseBag,
        initialNoiseDrawsResolved: state.initialNoiseDrawsResolved + 1,
      },
      mission,
      [Object.freeze({ type: 'noise-draw-consumed' as const })]
    );
  }

  return Object.freeze({
    state: freezeState({
      ...state,
      remainingNoiseBag,
      pendingNoise: {
        id: `noise-${String(state.initialNoiseDrawsResolved + 1)}`,
        resultId,
      },
    }),
    events: Object.freeze([Object.freeze({ type: 'noise-drawn' as const })]),
  });
};

const placeInitialNoise = (
  state: GameState,
  command: Extract<GameCommand, { type: 'place-initial-noise' }>,
  mission: MissionDefinition
): CommandResult => {
  assertInitialNoiseStep(state);
  if (!state.pendingNoise) {
    throw new RulesError('NO_NOISE_DRAWN', 'Draw a noise result before choosing its spawn');
  }
  const isSpawn = mission.board.spawns.some(spawn => samePosition(spawn, command.position));
  if (!isSpawn) {
    throw new RulesError('INVALID_NOISE_SPAWN', 'Place noise on a Skaven spawn square');
  }
  const isAvailable = getLegalNoiseSpawnPositions(state, mission).some(spawn =>
    samePosition(spawn, command.position)
  );
  if (!isAvailable) {
    throw new RulesError('NOISE_SPAWN_OCCUPIED', 'Noise tokens cannot share a spawn square');
  }

  const noise = freezeNoise({ ...state.pendingNoise, position: command.position });
  const closedDoors = state.doors
    .filter(door => door.status === 'closed')
    .map(door => door.position);
  const revealed = state.heroes.some(
    hero =>
      hero.position && hasLineOfSight(mission.board, hero.position, command.position, closedDoors)
  );
  const events: GameEvent[] = [
    Object.freeze({ type: 'noise-placed' as const, position: freezePosition(command.position) }),
  ];
  if (revealed) {
    events.push(
      Object.freeze({
        type: 'noise-revealed' as const,
        resultId: noise.resultId,
        position: freezePosition(command.position),
      })
    );
  }

  return completeInitialNoiseIfReady(
    {
      ...state,
      pendingNoise: null,
      initialNoiseDrawsResolved: state.initialNoiseDrawsResolved + 1,
      concealedNoise: revealed ? state.concealedNoise : [...state.concealedNoise, noise],
      revealedNoise:
        revealed && noise.resultId !== 'nothing'
          ? [...state.revealedNoise, noise]
          : state.revealedNoise,
    },
    mission,
    events
  );
};

export const resolveCommand = (
  state: GameState,
  command: GameCommand,
  randomSource: RandomSource
): CommandResult => {
  const mission = getMissionDefinition(state.missionId);
  assertMissionMatches(state, mission);
  switch (command.type) {
    case 'configure-game':
      return configureGame(state, command, mission);
    case 'deploy-hero':
      return deployHero(state, command, mission);
    case 'draw-initial-noise':
      return drawInitialNoise(state, mission, randomSource);
    case 'place-initial-noise':
      return placeInitialNoise(state, command, mission);
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
    round: state.round,
    phase: state.phase,
    command: state.command,
    selectedHeroIds: Object.freeze([...state.selectedHeroIds]),
    heroes: Object.freeze(state.heroes.map(freezeHero)),
    noiseTokens: Object.freeze(
      state.concealedNoise.map(noise =>
        Object.freeze({ id: noise.id, position: freezePosition(noise.position) })
      )
    ),
    revealedNoise: Object.freeze(state.revealedNoise.map(freezeNoise)),
    initialNoiseDrawsResolved: state.initialNoiseDrawsResolved,
    initialNoiseCount: getMissionDefinition(state.missionId).initialNoiseCount,
    remainingNoiseCount: state.remainingNoiseBag.length,
  });

export const projectSkavenView = (state: GameState): SkavenGameView =>
  Object.freeze({
    missionId: state.missionId,
    setupStep: state.setupStep,
    mode: state.mode,
    round: state.round,
    phase: state.phase,
    command: state.command,
    selectedHeroIds: Object.freeze([...state.selectedHeroIds]),
    heroes: Object.freeze(state.heroes.map(freezeHero)),
    noiseTokens: Object.freeze(state.concealedNoise.map(freezeNoise)),
    revealedNoise: Object.freeze(state.revealedNoise.map(freezeNoise)),
    pendingNoise: state.pendingNoise ? freezePendingNoise(state.pendingNoise) : null,
    initialNoiseDrawsResolved: state.initialNoiseDrawsResolved,
    initialNoiseCount: getMissionDefinition(state.missionId).initialNoiseCount,
    remainingNoiseCount: state.remainingNoiseBag.length,
  });
