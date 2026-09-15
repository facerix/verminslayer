import { HERO_DEFINITIONS, SKAVEN_DEFINITIONS, isHeroId } from '/src/game/entities.js';
import type { HeroId, SkavenId } from '/src/game/entities.js';
import type { Position } from '/src/game/map.js';
import type { MissionDefinition, NoiseResultId } from '/src/game/missionDefinition.js';
import { getMissionDefinition } from '/src/game/missions/registry.js';
import { RulesError } from '/src/game/rulesError.js';
import { hasLineOfSight } from '/src/game/lineOfSight.js';
import { getReachablePaths, isLegalMovementPath } from '/src/game/pathfinding.js';
import type { MovementContext, ReachablePath } from '/src/game/pathfinding.js';
import { resolveOpposedRoll } from '/src/game/combat.js';
import { getNearestReachablePositions } from '/src/game/skavenPlacement.js';

export type GameMode = 'solo' | 'two-player';
export type SetupStep = 'select-roster' | 'deploy-heroes' | 'initial-noise' | 'complete';
export type Facing = 'north' | 'east' | 'south' | 'west';
export type GamePhase = 'setup' | 'hero' | 'skaven';
export type SkavenTurnStep = 'activate-skaven' | 'activate-noise' | 'reinforce';

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

export interface RevealedNoiseState extends ConcealedNoiseState {
  readonly remainingModels: readonly SkavenId[];
}

export interface SkavenState {
  readonly id: string;
  readonly sourceNoiseId: string;
  readonly definitionId: SkavenId;
  readonly woundsRemaining: number;
  readonly position: Position;
  readonly facing: Facing;
}

export interface CombatResult {
  readonly heroId: HeroId;
  readonly skavenId: string;
  readonly skavenDefinitionId: SkavenId;
  readonly heroRolls: readonly number[];
  readonly skavenRolls: readonly number[];
  readonly outcome: 'hero-won' | 'skaven-won' | 'tie';
}

export interface DoorState {
  readonly position: Position;
  readonly status: 'closed' | 'open' | 'destroyed';
}

export interface NestState {
  readonly position: Position;
  readonly status: 'intact' | 'destroyed';
}

export interface GameState {
  readonly missionId: string;
  readonly setupStep: SetupStep;
  readonly mode: GameMode | null;
  readonly round: number;
  readonly phase: GamePhase;
  readonly command: number;
  readonly selectedHeroIds: readonly HeroId[];
  readonly heroes: readonly HeroState[];
  readonly doors: readonly DoorState[];
  readonly nests: readonly NestState[];
  readonly concealedNoise: readonly ConcealedNoiseState[];
  readonly revealedNoise: readonly RevealedNoiseState[];
  readonly skaven: readonly SkavenState[];
  readonly nextSkavenSequence: number;
  readonly combatLog: readonly CombatResult[];
  readonly pendingNoise: PendingNoiseState | null;
  readonly initialNoiseDrawsResolved: number;
  readonly remainingNoiseBag: readonly NoiseResultId[];
  readonly activeHeroId: HeroId | null;
  readonly actionsRemaining: number | null;
  readonly movementRemaining: number | null;
  readonly facingChangeAvailable: boolean;
  readonly dashUsed: boolean;
  readonly pushUsed: boolean;
  readonly activatedHeroIds: readonly HeroId[];
  readonly exitedHeroIds: readonly HeroId[];
  readonly skavenTurnStep: SkavenTurnStep | null;
  readonly skavenActivationIds: readonly string[];
  readonly activatedSkavenIds: readonly string[];
  readonly activeSkavenId: string | null;
  readonly skavenActionsRemaining: number | null;
  readonly skavenMovementRemaining: number | null;
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
    }
  | {
      readonly type: 'start-hero-activation';
      readonly heroId: HeroId;
    }
  | {
      readonly type: 'move-hero';
      readonly heroId: HeroId;
      readonly path: readonly Position[];
      readonly facing: Facing;
    }
  | {
      readonly type: 'dash-hero';
      readonly heroId: HeroId;
    }
  | {
      readonly type: 'push-hero';
      readonly heroId: HeroId;
    }
  | {
      readonly type: 'interact-door';
      readonly heroId: HeroId;
      readonly position: Position;
    }
  | {
      readonly type: 'place-revealed-skaven';
      readonly noiseId: string;
      readonly position: Position;
      readonly facing: Facing;
    }
  | {
      readonly type: 'fight-skaven';
      readonly heroId: HeroId;
      readonly skavenId: string;
    }
  | {
      readonly type: 'end-hero-activation';
      readonly heroId: HeroId;
      readonly confirmed: boolean;
    }
  | {
      readonly type: 'end-hero-phase';
      readonly confirmed: boolean;
    }
  | {
      readonly type: 'start-skaven-activation';
      readonly skavenId: string;
    }
  | {
      readonly type: 'move-skaven';
      readonly skavenId: string;
      readonly path: readonly Position[];
      readonly facing: Facing;
    }
  | {
      readonly type: 'fight-hero';
      readonly skavenId: string;
      readonly heroId: HeroId;
    }
  | {
      readonly type: 'interact-door-skaven';
      readonly skavenId: string;
      readonly position: Position;
    }
  | {
      readonly type: 'end-skaven-activation';
      readonly skavenId: string;
      readonly confirmed: boolean;
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
  | { readonly type: 'hero-turn-started'; readonly round: number; readonly command: number }
  | {
      readonly type: 'hero-activation-started';
      readonly heroId: HeroId;
      readonly movement: number;
      readonly actions: number;
    }
  | {
      readonly type: 'hero-moved';
      readonly heroId: HeroId;
      readonly from: Position;
      readonly to: Position;
    }
  | {
      readonly type: 'hero-facing-changed';
      readonly heroId: HeroId;
      readonly facing: Facing;
    }
  | {
      readonly type: 'action-spent';
      readonly heroId: HeroId;
      readonly action: 'dash' | 'interact' | 'fight';
      readonly actionsRemaining: number;
    }
  | {
      readonly type: 'movement-spent';
      readonly heroId: HeroId;
      readonly spaces: number;
      readonly movementRemaining: number;
    }
  | {
      readonly type: 'hero-pushed';
      readonly heroId: HeroId;
      readonly commandRemaining: number;
      readonly actionsRemaining: number;
    }
  | { readonly type: 'door-opened'; readonly position: Position }
  | { readonly type: 'door-closed'; readonly position: Position }
  | { readonly type: 'hero-activation-ended'; readonly heroId: HeroId }
  | { readonly type: 'hero-phase-ended'; readonly round: number }
  | { readonly type: 'skaven-turn-started'; readonly round: number }
  | {
      readonly type: 'skaven-activation-started';
      readonly skavenId: string;
      readonly movement: number;
      readonly actions: number;
    }
  | {
      readonly type: 'skaven-moved';
      readonly skavenId: string;
      readonly from: Position;
      readonly to: Position;
    }
  | {
      readonly type: 'skaven-facing-changed';
      readonly skavenId: string;
      readonly facing: Facing;
    }
  | {
      readonly type: 'skaven-movement-completed';
      readonly skavenId: string;
      readonly spaces: number;
    }
  | {
      readonly type: 'skaven-action-spent';
      readonly skavenId: string;
      readonly action: 'fight' | 'interact';
      readonly actionsRemaining: number;
    }
  | { readonly type: 'skaven-activation-ended'; readonly skavenId: string }
  | { readonly type: 'revealed-skaven-activations-complete' }
  | {
      readonly type: 'skaven-placed';
      readonly skavenId: string;
      readonly definitionId: SkavenId;
      readonly position: Position;
      readonly facing: Facing;
    }
  | { readonly type: 'revealed-noise-resolved'; readonly noiseId: string }
  | ({ readonly type: 'fight-rolled' } & CombatResult)
  | {
      readonly type: 'model-wounded';
      readonly faction: 'hero' | 'skaven';
      readonly modelId: string;
      readonly woundsRemaining: number;
    }
  | {
      readonly type: 'model-defeated';
      readonly faction: 'hero' | 'skaven';
      readonly modelId: string;
    };

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
  readonly phase: GamePhase;
  readonly command: number;
  readonly selectedHeroIds: readonly HeroId[];
  readonly heroes: readonly HeroState[];
  readonly skaven: readonly SkavenState[];
  readonly noiseTokens: readonly PublicNoiseToken[];
  readonly revealedNoise: readonly RevealedNoiseState[];
  readonly initialNoiseDrawsResolved: number;
  readonly initialNoiseCount: number;
  readonly remainingNoiseCount: number;
  readonly doors: readonly DoorState[];
  readonly activeHeroId: HeroId | null;
  readonly actionsRemaining: number | null;
  readonly movementRemaining: number | null;
  readonly facingChangeAvailable: boolean;
  readonly dashUsed: boolean;
  readonly pushUsed: boolean;
  readonly activatedHeroIds: readonly HeroId[];
  readonly exitedHeroIds: readonly HeroId[];
  readonly skavenTurnStep: SkavenTurnStep | null;
  readonly skavenActivationIds: readonly string[];
  readonly activatedSkavenIds: readonly string[];
  readonly activeSkavenId: string | null;
  readonly skavenActionsRemaining: number | null;
  readonly skavenMovementRemaining: number | null;
  readonly legalSkavenMovePaths: readonly ReachablePath[];
  readonly legalSkavenDoorInteractions: readonly Position[];
  readonly legalSkavenFightTargetIds: readonly HeroId[];
  readonly legalMovePaths: readonly ReachablePath[];
  readonly legalDoorInteractions: readonly Position[];
  readonly legalFightTargetIds: readonly string[];
  readonly combatLog: readonly CombatResult[];
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

const freezeDoor = (door: DoorState): DoorState =>
  Object.freeze({ ...door, position: freezePosition(door.position) });

const freezeNest = (nest: NestState): NestState =>
  Object.freeze({ ...nest, position: freezePosition(nest.position) });

const freezeNoise = (noise: ConcealedNoiseState): ConcealedNoiseState =>
  Object.freeze({ ...noise, position: freezePosition(noise.position) });

const freezeRevealedNoise = (noise: RevealedNoiseState): RevealedNoiseState =>
  Object.freeze({
    ...noise,
    position: freezePosition(noise.position),
    remainingModels: Object.freeze([...noise.remainingModels]),
  });

const freezeSkaven = (skaven: SkavenState): SkavenState =>
  Object.freeze({ ...skaven, position: freezePosition(skaven.position) });

const freezeCombatResult = (result: CombatResult): CombatResult =>
  Object.freeze({
    ...result,
    heroRolls: Object.freeze([...result.heroRolls]),
    skavenRolls: Object.freeze([...result.skavenRolls]),
  });

const freezePendingNoise = (noise: PendingNoiseState): PendingNoiseState =>
  Object.freeze({ ...noise });

const revealNoiseState = (
  noise: ConcealedNoiseState,
  mission: MissionDefinition
): RevealedNoiseState =>
  freezeRevealedNoise({
    ...noise,
    remainingModels: mission.noiseResults[noise.resultId].models,
  });

const freezeState = (state: GameState): GameState =>
  Object.freeze({
    ...state,
    selectedHeroIds: Object.freeze([...state.selectedHeroIds]),
    heroes: Object.freeze(state.heroes.map(freezeHero)),
    doors: Object.freeze(state.doors.map(freezeDoor)),
    nests: Object.freeze(state.nests.map(freezeNest)),
    concealedNoise: Object.freeze(state.concealedNoise.map(freezeNoise)),
    revealedNoise: Object.freeze(state.revealedNoise.map(freezeRevealedNoise)),
    skaven: Object.freeze(state.skaven.map(freezeSkaven)),
    combatLog: Object.freeze(state.combatLog.map(freezeCombatResult)),
    pendingNoise: state.pendingNoise ? freezePendingNoise(state.pendingNoise) : null,
    remainingNoiseBag: Object.freeze([...state.remainingNoiseBag]),
    activatedHeroIds: Object.freeze([...state.activatedHeroIds]),
    exitedHeroIds: Object.freeze([...state.exitedHeroIds]),
    skavenActivationIds: Object.freeze([...state.skavenActivationIds]),
    activatedSkavenIds: Object.freeze([...state.activatedSkavenIds]),
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
    skaven: [],
    nextSkavenSequence: 1,
    combatLog: [],
    pendingNoise: null,
    initialNoiseDrawsResolved: 0,
    remainingNoiseBag: mission.noiseBag,
    activeHeroId: null,
    actionsRemaining: null,
    movementRemaining: null,
    facingChangeAvailable: false,
    dashUsed: false,
    pushUsed: false,
    activatedHeroIds: [],
    exitedHeroIds: [],
    skavenTurnStep: null,
    skavenActivationIds: [],
    activatedSkavenIds: [],
    activeSkavenId: null,
    skavenActionsRemaining: null,
    skavenMovementRemaining: null,
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

const isAdjacent = (left: Position, right: Position) =>
  Math.max(Math.abs(left.row - right.row), Math.abs(left.column - right.column)) === 1;

const isHeroEligible = (state: GameState, hero: HeroState) =>
  hero.woundsRemaining > 0 && hero.position !== null && !state.exitedHeroIds.includes(hero.id);

const isPositionOccupied = (state: GameState, position: Position) =>
  [
    ...state.heroes.flatMap(hero => (hero.position ? [hero.position] : [])),
    ...state.skaven.map(skaven => skaven.position),
    ...state.concealedNoise.map(noise => noise.position),
    ...state.revealedNoise.map(noise => noise.position),
  ].some(occupant => samePosition(occupant, position));

const getMovementContext = (
  state: GameState,
  mission: MissionDefinition,
  hero: HeroState,
  maximumSteps = state.movementRemaining ?? 0
): MovementContext => {
  if (!hero.position) {
    throw new RulesError('HERO_NOT_ELIGIBLE', 'Only a deployed, living hero can move');
  }
  return {
    board: mission.board,
    start: hero.position,
    maximumSteps,
    closedDoors: state.doors.filter(door => door.status === 'closed').map(door => door.position),
    blockedPositions: [
      ...state.heroes.flatMap(candidate =>
        candidate.id !== hero.id && candidate.position ? [candidate.position] : []
      ),
      ...state.concealedNoise.map(noise => noise.position),
      ...state.revealedNoise.map(noise => noise.position),
      ...state.skaven.map(skaven => skaven.position),
      ...state.nests.filter(nest => nest.status === 'intact').map(nest => nest.position),
    ],
    exitOpen: state.nests.every(nest => nest.status === 'destroyed'),
  };
};

const getSkavenMovementContext = (
  state: GameState,
  mission: MissionDefinition,
  skaven: SkavenState
): MovementContext => ({
  board: mission.board,
  start: skaven.position,
  maximumSteps: state.skavenMovementRemaining ?? 0,
  closedDoors: state.doors.filter(door => door.status === 'closed').map(door => door.position),
  blockedPositions: [
    ...state.heroes.flatMap(hero => (hero.position ? [hero.position] : [])),
    ...state.skaven
      .filter(candidate => candidate.id !== skaven.id)
      .map(candidate => candidate.position),
    ...state.concealedNoise.map(noise => noise.position),
    ...state.revealedNoise.map(noise => noise.position),
  ],
  exitOpen: state.nests.every(nest => nest.status === 'destroyed'),
});

export const getLegalSkavenMovePaths = (
  state: GameState,
  mission: MissionDefinition
): readonly ReachablePath[] => {
  assertMissionMatches(state, mission);
  if (
    state.phase !== 'skaven' ||
    state.skavenTurnStep !== 'activate-skaven' ||
    !state.activeSkavenId ||
    (state.skavenMovementRemaining ?? 0) < 1 ||
    state.revealedNoise.length > 0
  ) {
    return Object.freeze([]);
  }
  const skaven = state.skaven.find(candidate => candidate.id === state.activeSkavenId);
  return skaven
    ? getReachablePaths(getSkavenMovementContext(state, mission, skaven))
    : Object.freeze([]);
};

export const getLegalSkavenFightTargetIds = (state: GameState): readonly HeroId[] => {
  if (
    state.phase !== 'skaven' ||
    state.skavenTurnStep !== 'activate-skaven' ||
    !state.activeSkavenId ||
    state.skavenMovementRemaining !== 0 ||
    (state.skavenActionsRemaining ?? 0) < 1 ||
    state.revealedNoise.length > 0
  ) {
    return Object.freeze([]);
  }
  const skaven = state.skaven.find(candidate => candidate.id === state.activeSkavenId);
  if (!skaven) return Object.freeze([]);
  return Object.freeze(
    state.heroes
      .filter(
        hero =>
          hero.position && hero.woundsRemaining > 0 && isAdjacent(skaven.position, hero.position)
      )
      .map(hero => hero.id)
  );
};

export const getLegalSkavenDoorInteractions = (
  state: GameState,
  mission: MissionDefinition
): readonly Position[] => {
  assertMissionMatches(state, mission);
  if (
    state.phase !== 'skaven' ||
    state.skavenTurnStep !== 'activate-skaven' ||
    !state.activeSkavenId ||
    state.skavenMovementRemaining !== 0 ||
    (state.skavenActionsRemaining ?? 0) < 1 ||
    state.revealedNoise.length > 0
  ) {
    return Object.freeze([]);
  }
  const skaven = state.skaven.find(candidate => candidate.id === state.activeSkavenId);
  if (!skaven || skaven.definitionId !== 'clanrat') return Object.freeze([]);
  return Object.freeze(
    state.doors
      .filter(
        door =>
          door.status !== 'destroyed' &&
          (door.status === 'closed' || !isPositionOccupied(state, door.position)) &&
          isAdjacent(skaven.position, door.position)
      )
      .map(door => freezePosition(door.position))
  );
};

export const getLegalFightTargetIds = (state: GameState): readonly string[] => {
  if (
    state.phase !== 'hero' ||
    !state.activeHeroId ||
    (state.actionsRemaining ?? 0) < 1 ||
    state.revealedNoise.length > 0
  ) {
    return Object.freeze([]);
  }
  const hero = state.heroes.find(candidate => candidate.id === state.activeHeroId);
  if (!hero?.position) return Object.freeze([]);
  return Object.freeze(
    state.skaven
      .filter(
        skaven =>
          Math.max(
            Math.abs(skaven.position.row - hero.position!.row),
            Math.abs(skaven.position.column - hero.position!.column)
          ) === 1
      )
      .map(skaven => skaven.id)
  );
};

export const getLegalSkavenPlacementPositions = (
  state: GameState,
  mission: MissionDefinition,
  noiseId: string
): readonly Position[] => {
  assertMissionMatches(state, mission);
  const noise = state.revealedNoise.find(candidate => candidate.id === noiseId);
  if (!noise || noise.remainingModels.length === 0) return Object.freeze([]);

  const unavailableDestinations = [
    ...state.heroes.flatMap(hero => (hero.position ? [hero.position] : [])),
    ...state.skaven.map(skaven => skaven.position),
    ...state.concealedNoise.map(candidate => candidate.position),
    ...state.revealedNoise
      .filter(candidate => candidate.id !== noise.id)
      .map(candidate => candidate.position),
  ];
  const blockedPositions = [
    ...state.heroes.flatMap(hero => (hero.position ? [hero.position] : [])),
    ...state.skaven
      .filter(skaven => skaven.sourceNoiseId !== noise.id)
      .map(skaven => skaven.position),
    ...state.concealedNoise.map(candidate => candidate.position),
    ...state.revealedNoise
      .filter(candidate => candidate.id !== noise.id)
      .map(candidate => candidate.position),
  ];
  return getNearestReachablePositions({
    board: mission.board,
    start: noise.position,
    maximumSteps: mission.board.width * mission.board.height,
    closedDoors: state.doors.filter(door => door.status === 'closed').map(door => door.position),
    blockedPositions,
    unavailableDestinations,
    exitOpen: state.nests.every(nest => nest.status === 'destroyed'),
  });
};

export const getLegalHeroMovePaths = (
  state: GameState,
  mission: MissionDefinition
): readonly ReachablePath[] => {
  assertMissionMatches(state, mission);
  if (
    state.phase !== 'hero' ||
    !state.activeHeroId ||
    ((state.movementRemaining ?? 0) < 1 && !state.facingChangeAvailable) ||
    state.revealedNoise.length > 0
  ) {
    return Object.freeze([]);
  }
  const hero = state.heroes.find(candidate => candidate.id === state.activeHeroId);
  if (!hero) return Object.freeze([]);
  const paths = getReachablePaths(getMovementContext(state, mission, hero));
  return state.facingChangeAvailable
    ? paths
    : Object.freeze(paths.filter(path => path.steps.length > 0));
};

export const getLegalDoorInteractions = (
  state: GameState,
  mission: MissionDefinition
): readonly Position[] => {
  assertMissionMatches(state, mission);
  if (
    state.phase !== 'hero' ||
    !state.activeHeroId ||
    (state.actionsRemaining ?? 0) < 1 ||
    state.revealedNoise.length > 0
  ) {
    return Object.freeze([]);
  }
  const hero = state.heroes.find(candidate => candidate.id === state.activeHeroId);
  if (!hero?.position) return Object.freeze([]);

  return Object.freeze(
    state.doors
      .filter(
        door =>
          door.status !== 'destroyed' &&
          (door.status === 'closed' || !isPositionOccupied(state, door.position)) &&
          Math.max(
            Math.abs(door.position.row - hero.position!.row),
            Math.abs(door.position.column - hero.position!.column)
          ) === 1
      )
      .map(door => freezePosition(door.position))
  );
};

export const getLegalNoiseSpawnPositions = (
  state: GameState,
  mission: MissionDefinition
): readonly Position[] => {
  assertMissionMatches(state, mission);
  const occupied = [...state.concealedNoise, ...state.revealedNoise].map(noise => noise.position);
  occupied.push(...state.heroes.flatMap(hero => (hero.position ? [hero.position] : [])));
  occupied.push(...state.skaven.map(skaven => skaven.position));
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
  const command = 2;
  return Object.freeze({
    state: freezeState({
      ...state,
      setupStep: 'complete',
      phase: 'hero',
      round,
      command,
      pendingNoise: null,
      activeHeroId: null,
      actionsRemaining: null,
      movementRemaining: null,
      facingChangeAvailable: false,
      dashUsed: false,
      pushUsed: false,
      activatedHeroIds: [],
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
      hero.position &&
      (isAdjacent(hero.position, command.position) ||
        hasLineOfSight(mission.board, hero.position, command.position, closedDoors))
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
          ? [...state.revealedNoise, revealNoiseState(noise, mission)]
          : state.revealedNoise,
    },
    mission,
    events
  );
};

const assertHeroPhase = (state: GameState) => {
  if (state.setupStep !== 'complete' || state.phase !== 'hero') {
    throw new RulesError('NOT_HERO_PHASE', 'This command can only be used during a Hero turn');
  }
};

const getActiveHero = (state: GameState, heroId: HeroId): HeroState => {
  assertHeroPhase(state);
  if (state.revealedNoise.length > 0) {
    throw new RulesError(
      'SKAVEN_PLACEMENT_REQUIRED',
      'Place every model from revealed noise before continuing the Hero activation'
    );
  }
  if (!state.activeHeroId || state.actionsRemaining === null) {
    throw new RulesError('NO_ACTIVE_HERO', 'Choose a hero to activate first');
  }
  if (state.activeHeroId !== heroId) {
    throw new RulesError('WRONG_ACTIVE_HERO', 'Only the active hero can take an action');
  }
  const hero = state.heroes.find(candidate => candidate.id === heroId);
  if (!hero || !isHeroEligible(state, hero)) {
    throw new RulesError('HERO_NOT_ELIGIBLE', 'Only a deployed, living hero can act');
  }
  return hero;
};

const assertActionAvailable = (state: GameState) => {
  if ((state.actionsRemaining ?? 0) < 1) {
    throw new RulesError('NO_ACTIONS_REMAINING', 'The active hero has no Actions remaining');
  }
};

const revealVisibleNoise = (
  state: GameState,
  mission: MissionDefinition
): { readonly state: GameState; readonly events: readonly GameEvent[] } => {
  const closedDoors = state.doors
    .filter(door => door.status === 'closed')
    .map(door => door.position);
  const visible = state.concealedNoise.filter(noise =>
    state.heroes.some(
      hero =>
        isHeroEligible(state, hero) &&
        hero.position &&
        (isAdjacent(hero.position, noise.position) ||
          hasLineOfSight(mission.board, hero.position, noise.position, closedDoors))
    )
  );
  if (visible.length === 0) return { state, events: Object.freeze([]) };

  const visibleIds = new Set(visible.map(noise => noise.id));
  return {
    state: {
      ...state,
      concealedNoise: state.concealedNoise.filter(noise => !visibleIds.has(noise.id)),
      revealedNoise: [
        ...state.revealedNoise,
        ...visible
          .filter(noise => noise.resultId !== 'nothing')
          .map(noise => revealNoiseState(noise, mission)),
      ],
    },
    events: Object.freeze(
      visible.map(noise =>
        Object.freeze({
          type: 'noise-revealed' as const,
          resultId: noise.resultId,
          position: freezePosition(noise.position),
        })
      )
    ),
  };
};

const startHeroActivation = (
  state: GameState,
  command: Extract<GameCommand, { type: 'start-hero-activation' }>
): CommandResult => {
  assertHeroPhase(state);
  if (state.revealedNoise.length > 0) {
    throw new RulesError(
      'SKAVEN_PLACEMENT_REQUIRED',
      'Place every model from revealed noise before starting an activation'
    );
  }
  if (state.activeHeroId) {
    throw new RulesError('ACTIVATION_IN_PROGRESS', 'End the current activation first');
  }
  const hero = state.heroes.find(candidate => candidate.id === command.heroId);
  if (!hero || !isHeroEligible(state, hero)) {
    throw new RulesError('HERO_NOT_ELIGIBLE', 'Choose a deployed, living, non-exited hero');
  }
  if (state.activatedHeroIds.includes(hero.id)) {
    throw new RulesError(
      'HERO_ALREADY_ACTIVATED',
      `${HERO_DEFINITIONS[hero.id].name} already activated`
    );
  }
  const movement = HERO_DEFINITIONS[hero.definitionId].stats.move;
  const actions = 2;
  return Object.freeze({
    state: freezeState({
      ...state,
      activeHeroId: hero.id,
      actionsRemaining: actions,
      movementRemaining: movement,
      facingChangeAvailable: true,
      dashUsed: false,
      pushUsed: false,
    }),
    events: Object.freeze([
      Object.freeze({
        type: 'hero-activation-started' as const,
        heroId: hero.id,
        movement,
        actions,
      }),
    ]),
  });
};

const moveHero = (
  state: GameState,
  command: Extract<GameCommand, { type: 'move-hero' }>,
  mission: MissionDefinition
): CommandResult => {
  const hero = getActiveHero(state, command.heroId);
  if (!isFacing(command.facing)) {
    throw new RulesError('INVALID_FACING', 'Choose north, east, south, or west facing');
  }
  const facingChanged = hero.facing !== command.facing;
  if (command.path.length === 0 && !facingChanged) {
    throw new RulesError(
      'INVALID_MOVEMENT_PATH',
      'A zero-square Movement must change the hero’s facing'
    );
  }
  if (facingChanged && !state.facingChangeAvailable) {
    throw new RulesError(
      'FACING_CHANGE_USED',
      'A hero may only change facing once during an activation'
    );
  }
  if (!isLegalMovementPath(getMovementContext(state, mission, hero), command.path)) {
    throw new RulesError(
      'INVALID_MOVEMENT_PATH',
      'Move orthogonally through passable, unoccupied squares within the hero’s Move allowance'
    );
  }

  let workingState = state;
  const events: GameEvent[] = [];
  let from = hero.position!;
  for (const rawStep of command.path) {
    const step = freezePosition(rawStep);
    workingState = {
      ...workingState,
      heroes: workingState.heroes.map(candidate =>
        candidate.id === hero.id ? { ...candidate, position: step } : candidate
      ),
    };
    events.push(
      Object.freeze({
        type: 'hero-moved' as const,
        heroId: hero.id,
        from: freezePosition(from),
        to: step,
      })
    );
    const reveals = revealVisibleNoise(workingState, mission);
    workingState = reveals.state;
    events.push(...reveals.events);
    from = step;
  }

  if (facingChanged) {
    workingState = {
      ...workingState,
      heroes: workingState.heroes.map(candidate =>
        candidate.id === hero.id ? { ...candidate, facing: command.facing } : candidate
      ),
    };
    events.push(
      Object.freeze({
        type: 'hero-facing-changed' as const,
        heroId: hero.id,
        facing: command.facing,
      })
    );
  }

  const movementRemaining = state.movementRemaining! - command.path.length;
  events.push(
    Object.freeze({
      type: 'movement-spent' as const,
      heroId: hero.id,
      spaces: command.path.length,
      movementRemaining,
    })
  );
  return Object.freeze({
    state: freezeState({
      ...workingState,
      movementRemaining,
      facingChangeAvailable: state.facingChangeAvailable && !facingChanged,
    }),
    events: Object.freeze(events),
  });
};

const dashHero = (
  state: GameState,
  command: Extract<GameCommand, { type: 'dash-hero' }>
): CommandResult => {
  const hero = getActiveHero(state, command.heroId);
  assertActionAvailable(state);
  if (state.dashUsed) {
    throw new RulesError('DASH_ALREADY_USED', 'A hero may only Dash once per activation');
  }
  const actionsRemaining = state.actionsRemaining! - 1;
  return Object.freeze({
    state: freezeState({
      ...state,
      actionsRemaining,
      movementRemaining:
        (state.movementRemaining ?? 0) + HERO_DEFINITIONS[hero.definitionId].stats.move,
      dashUsed: true,
    }),
    events: Object.freeze([
      Object.freeze({
        type: 'action-spent' as const,
        heroId: hero.id,
        action: 'dash' as const,
        actionsRemaining,
      }),
    ]),
  });
};

const pushHero = (
  state: GameState,
  command: Extract<GameCommand, { type: 'push-hero' }>
): CommandResult => {
  const hero = getActiveHero(state, command.heroId);
  if (state.pushUsed) {
    throw new RulesError('PUSH_ALREADY_USED', 'A hero may only be Pushed once per activation');
  }
  if (state.command < 1) {
    throw new RulesError('NOT_ENOUGH_COMMAND', 'Push requires 1 Command');
  }
  const commandRemaining = state.command - 1;
  const actionsRemaining = state.actionsRemaining! + 1;
  return Object.freeze({
    state: freezeState({
      ...state,
      command: commandRemaining,
      actionsRemaining,
      pushUsed: true,
    }),
    events: Object.freeze([
      Object.freeze({
        type: 'hero-pushed' as const,
        heroId: hero.id,
        commandRemaining,
        actionsRemaining,
      }),
    ]),
  });
};

const interactDoor = (
  state: GameState,
  command: Extract<GameCommand, { type: 'interact-door' }>,
  mission: MissionDefinition
): CommandResult => {
  const hero = getActiveHero(state, command.heroId);
  assertActionAvailable(state);
  const door = state.doors.find(candidate => samePosition(candidate.position, command.position));
  if (!door || door.status === 'destroyed') {
    throw new RulesError('INVALID_DOOR', 'Choose an intact door');
  }
  if (
    !hero.position ||
    Math.max(
      Math.abs(hero.position.row - door.position.row),
      Math.abs(hero.position.column - door.position.column)
    ) !== 1
  ) {
    throw new RulesError('DOOR_NOT_ADJACENT', 'Interact with an adjacent door');
  }

  const nextStatus = door.status === 'closed' ? 'open' : 'closed';
  if (nextStatus === 'closed' && isPositionOccupied(state, door.position)) {
    throw new RulesError('DOOR_OCCUPIED', 'An occupied doorway cannot be closed');
  }

  const actionsRemaining = state.actionsRemaining! - 1;
  let workingState: GameState = {
    ...state,
    doors: state.doors.map(candidate =>
      samePosition(candidate.position, door.position)
        ? { ...candidate, status: nextStatus }
        : candidate
    ),
    actionsRemaining,
  };
  const events: GameEvent[] = [
    Object.freeze({
      type: nextStatus === 'open' ? ('door-opened' as const) : ('door-closed' as const),
      position: freezePosition(door.position),
    }),
  ];
  if (nextStatus === 'open') {
    const reveals = revealVisibleNoise(workingState, mission);
    workingState = reveals.state;
    events.push(...reveals.events);
  }
  events.push(
    Object.freeze({
      type: 'action-spent' as const,
      heroId: hero.id,
      action: 'interact' as const,
      actionsRemaining,
    })
  );
  return Object.freeze({ state: freezeState(workingState), events: Object.freeze(events) });
};

const placeRevealedSkaven = (
  state: GameState,
  command: Extract<GameCommand, { type: 'place-revealed-skaven' }>,
  mission: MissionDefinition
): CommandResult => {
  const noise = state.revealedNoise.find(candidate => candidate.id === command.noiseId);
  if (!noise) {
    throw new RulesError('UNKNOWN_REVEALED_NOISE', 'Choose a revealed noise group to resolve');
  }
  if (!isFacing(command.facing)) {
    throw new RulesError('INVALID_FACING', 'Choose north, east, south, or west facing');
  }
  const legalPositions = getLegalSkavenPlacementPositions(state, mission, noise.id);
  if (!legalPositions.some(position => samePosition(position, command.position))) {
    throw new RulesError(
      'INVALID_SKAVEN_PLACEMENT',
      'Place the model on a highlighted nearest empty reachable square'
    );
  }

  const definitionId = noise.remainingModels[0];
  if (!definitionId) {
    throw new RulesError('UNKNOWN_REVEALED_NOISE', 'This revealed noise group is already resolved');
  }
  const skavenId = `skaven-${String(state.nextSkavenSequence)}`;
  const skaven: SkavenState = {
    id: skavenId,
    sourceNoiseId: noise.id,
    definitionId,
    woundsRemaining: SKAVEN_DEFINITIONS[definitionId].stats.wounds,
    position: command.position,
    facing: command.facing,
  };
  const remainingModels = noise.remainingModels.slice(1);
  const resolved = remainingModels.length === 0;
  const events: GameEvent[] = [
    Object.freeze({
      type: 'skaven-placed' as const,
      skavenId,
      definitionId,
      position: freezePosition(command.position),
      facing: command.facing,
    }),
  ];
  if (resolved) {
    events.push(Object.freeze({ type: 'revealed-noise-resolved' as const, noiseId: noise.id }));
  }

  return Object.freeze({
    state: freezeState({
      ...state,
      skaven: [...state.skaven, skaven],
      nextSkavenSequence: state.nextSkavenSequence + 1,
      revealedNoise: resolved
        ? state.revealedNoise.filter(candidate => candidate.id !== noise.id)
        : state.revealedNoise.map(candidate =>
            candidate.id === noise.id ? { ...candidate, remainingModels } : candidate
          ),
    }),
    events: Object.freeze(events),
  });
};

const fightSkaven = (
  state: GameState,
  command: Extract<GameCommand, { type: 'fight-skaven' }>,
  randomSource: RandomSource
): CommandResult => {
  const hero = getActiveHero(state, command.heroId);
  assertActionAvailable(state);
  const skaven = state.skaven.find(candidate => candidate.id === command.skavenId);
  if (!skaven) {
    throw new RulesError('UNKNOWN_FIGHT_TARGET', 'Choose a living Skaven model to fight');
  }
  if (
    !hero.position ||
    Math.max(
      Math.abs(hero.position.row - skaven.position.row),
      Math.abs(hero.position.column - skaven.position.column)
    ) !== 1
  ) {
    throw new RulesError('FIGHT_TARGET_NOT_ADJACENT', 'Fight an adjacent Skaven model');
  }

  const { heroRolls, skavenRolls, outcome } = resolveOpposedRoll(
    HERO_DEFINITIONS[hero.definitionId].stats.fight,
    SKAVEN_DEFINITIONS[skaven.definitionId].stats.fight,
    randomSource
  );
  const combatResult = freezeCombatResult({
    heroId: hero.id,
    skavenId: skaven.id,
    skavenDefinitionId: skaven.definitionId,
    heroRolls,
    skavenRolls,
    outcome,
  });
  const events: GameEvent[] = [Object.freeze({ type: 'fight-rolled' as const, ...combatResult })];
  let heroes = state.heroes;
  let skavenModels = state.skaven;

  if (outcome === 'hero-won') {
    const woundsRemaining = Math.max(0, skaven.woundsRemaining - 1);
    events.push(
      Object.freeze({
        type: 'model-wounded' as const,
        faction: 'skaven' as const,
        modelId: skaven.id,
        woundsRemaining,
      })
    );
    skavenModels =
      woundsRemaining === 0
        ? state.skaven.filter(candidate => candidate.id !== skaven.id)
        : state.skaven.map(candidate =>
            candidate.id === skaven.id ? { ...candidate, woundsRemaining } : candidate
          );
    if (woundsRemaining === 0) {
      events.push(
        Object.freeze({
          type: 'model-defeated' as const,
          faction: 'skaven' as const,
          modelId: skaven.id,
        })
      );
    }
  } else if (outcome === 'skaven-won') {
    const woundsRemaining = Math.max(0, hero.woundsRemaining - 1);
    events.push(
      Object.freeze({
        type: 'model-wounded' as const,
        faction: 'hero' as const,
        modelId: hero.id,
        woundsRemaining,
      })
    );
    heroes = state.heroes.map(candidate =>
      candidate.id === hero.id
        ? {
            ...candidate,
            woundsRemaining,
            position: woundsRemaining === 0 ? null : candidate.position,
          }
        : candidate
    );
    if (woundsRemaining === 0) {
      events.push(
        Object.freeze({
          type: 'model-defeated' as const,
          faction: 'hero' as const,
          modelId: hero.id,
        }),
        Object.freeze({ type: 'hero-activation-ended' as const, heroId: hero.id })
      );
      return Object.freeze({
        state: freezeState({
          ...state,
          heroes,
          combatLog: [...state.combatLog, combatResult],
          activeHeroId: null,
          actionsRemaining: null,
          movementRemaining: null,
          facingChangeAvailable: false,
          dashUsed: false,
          pushUsed: false,
          activatedHeroIds: [...state.activatedHeroIds, hero.id],
        }),
        events: Object.freeze(events),
      });
    }
  }

  const actionsRemaining = state.actionsRemaining! - 1;
  events.push(
    Object.freeze({
      type: 'action-spent' as const,
      heroId: hero.id,
      action: 'fight' as const,
      actionsRemaining,
    })
  );
  return Object.freeze({
    state: freezeState({
      ...state,
      heroes,
      skaven: skavenModels,
      combatLog: [...state.combatLog, combatResult],
      actionsRemaining,
    }),
    events: Object.freeze(events),
  });
};

const endHeroActivation = (
  state: GameState,
  command: Extract<GameCommand, { type: 'end-hero-activation' }>
): CommandResult => {
  const hero = getActiveHero(state, command.heroId);
  if ((state.actionsRemaining ?? 0) > 0 && !command.confirmed) {
    throw new RulesError(
      'CONFIRMATION_REQUIRED',
      `Confirm ending ${HERO_DEFINITIONS[hero.id].name}’s activation with Actions remaining`
    );
  }
  return Object.freeze({
    state: freezeState({
      ...state,
      activeHeroId: null,
      actionsRemaining: null,
      movementRemaining: null,
      facingChangeAvailable: false,
      dashUsed: false,
      pushUsed: false,
      activatedHeroIds: [...state.activatedHeroIds, hero.id],
    }),
    events: Object.freeze([
      Object.freeze({ type: 'hero-activation-ended' as const, heroId: hero.id }),
    ]),
  });
};

const endHeroPhase = (
  state: GameState,
  command: Extract<GameCommand, { type: 'end-hero-phase' }>
): CommandResult => {
  assertHeroPhase(state);
  if (state.revealedNoise.length > 0) {
    throw new RulesError(
      'SKAVEN_PLACEMENT_REQUIRED',
      'Place every model from revealed noise before ending the Hero phase'
    );
  }
  if (state.activeHeroId) {
    throw new RulesError('ACTIVATION_IN_PROGRESS', 'End the current activation first');
  }
  const eligibleHeroIds = state.heroes
    .filter(hero => isHeroEligible(state, hero))
    .map(hero => hero.id);
  if (!eligibleHeroIds.every(heroId => state.activatedHeroIds.includes(heroId))) {
    throw new RulesError('HEROES_NOT_ACTIVATED', 'Every living, non-exited hero must activate');
  }
  if (!command.confirmed) {
    throw new RulesError('CONFIRMATION_REQUIRED', 'Confirm ending the Hero phase');
  }
  const skavenActivationIds = state.skaven.map(skaven => skaven.id);
  const skavenTurnStep = skavenActivationIds.length > 0 ? 'activate-skaven' : 'activate-noise';
  return Object.freeze({
    state: freezeState({
      ...state,
      phase: 'skaven',
      actionsRemaining: null,
      movementRemaining: null,
      facingChangeAvailable: false,
      dashUsed: false,
      pushUsed: false,
      skavenTurnStep,
      skavenActivationIds,
      activatedSkavenIds: [],
      activeSkavenId: null,
      skavenActionsRemaining: null,
      skavenMovementRemaining: null,
    }),
    events: Object.freeze([
      Object.freeze({ type: 'hero-phase-ended' as const, round: state.round }),
      Object.freeze({ type: 'skaven-turn-started' as const, round: state.round }),
      ...(skavenTurnStep === 'activate-noise'
        ? [Object.freeze({ type: 'revealed-skaven-activations-complete' as const })]
        : []),
    ]),
  });
};

const assertSkavenActivationStep = (state: GameState) => {
  if (
    state.setupStep !== 'complete' ||
    state.phase !== 'skaven' ||
    state.skavenTurnStep !== 'activate-skaven'
  ) {
    throw new RulesError(
      'NOT_SKAVEN_PHASE',
      'This command can only be used while revealed Skaven are activating'
    );
  }
};

const getActiveSkaven = (state: GameState, skavenId: string): SkavenState => {
  assertSkavenActivationStep(state);
  if (state.revealedNoise.length > 0) {
    throw new RulesError(
      'SKAVEN_PLACEMENT_REQUIRED',
      'Place every model from revealed noise before continuing the Skaven activation'
    );
  }
  if (!state.activeSkavenId) {
    throw new RulesError('NO_ACTIVE_SKAVEN', 'Choose a Skaven model to activate first');
  }
  if (state.activeSkavenId !== skavenId) {
    throw new RulesError('WRONG_ACTIVE_SKAVEN', 'Only the active Skaven can act');
  }
  const skaven = state.skaven.find(candidate => candidate.id === skavenId);
  if (!skaven) {
    throw new RulesError('SKAVEN_NOT_ELIGIBLE', 'Only a living Skaven model can act');
  }
  return skaven;
};

const startSkavenActivation = (
  state: GameState,
  command: Extract<GameCommand, { type: 'start-skaven-activation' }>
): CommandResult => {
  assertSkavenActivationStep(state);
  if (state.revealedNoise.length > 0) {
    throw new RulesError(
      'SKAVEN_PLACEMENT_REQUIRED',
      'Place every model from revealed noise before starting an activation'
    );
  }
  if (state.activeSkavenId) {
    throw new RulesError('ACTIVATION_IN_PROGRESS', 'End the current activation first');
  }
  const skaven = state.skaven.find(candidate => candidate.id === command.skavenId);
  if (!skaven || !state.skavenActivationIds.includes(skaven.id)) {
    throw new RulesError(
      'SKAVEN_NOT_ELIGIBLE',
      'Choose a living Skaven that was revealed when this turn began'
    );
  }
  if (state.activatedSkavenIds.includes(skaven.id)) {
    throw new RulesError(
      'SKAVEN_ALREADY_ACTIVATED',
      `${SKAVEN_DEFINITIONS[skaven.definitionId].name} already activated`
    );
  }
  const movement = SKAVEN_DEFINITIONS[skaven.definitionId].stats.move;
  const actions = 1;
  return Object.freeze({
    state: freezeState({
      ...state,
      activeSkavenId: skaven.id,
      skavenActionsRemaining: actions,
      skavenMovementRemaining: movement,
    }),
    events: Object.freeze([
      Object.freeze({
        type: 'skaven-activation-started' as const,
        skavenId: skaven.id,
        movement,
        actions,
      }),
    ]),
  });
};

const moveSkaven = (
  state: GameState,
  command: Extract<GameCommand, { type: 'move-skaven' }>,
  mission: MissionDefinition
): CommandResult => {
  const skaven = getActiveSkaven(state, command.skavenId);
  if ((state.skavenMovementRemaining ?? 0) < 1) {
    throw new RulesError('SKAVEN_MOVEMENT_USED', 'This Skaven already completed its Movement');
  }
  if (!isFacing(command.facing)) {
    throw new RulesError('INVALID_FACING', 'Choose north, east, south, or west facing');
  }
  if (!isLegalMovementPath(getSkavenMovementContext(state, mission, skaven), command.path)) {
    throw new RulesError(
      'INVALID_MOVEMENT_PATH',
      'Move orthogonally through passable, unoccupied squares within the Skaven’s Move allowance'
    );
  }

  const destination = command.path.at(-1) ?? skaven.position;
  const events: GameEvent[] = [];
  let from = skaven.position;
  for (const rawStep of command.path) {
    const step = freezePosition(rawStep);
    events.push(
      Object.freeze({
        type: 'skaven-moved' as const,
        skavenId: skaven.id,
        from: freezePosition(from),
        to: step,
      })
    );
    from = step;
  }
  if (skaven.facing !== command.facing) {
    events.push(
      Object.freeze({
        type: 'skaven-facing-changed' as const,
        skavenId: skaven.id,
        facing: command.facing,
      })
    );
  }
  events.push(
    Object.freeze({
      type: 'skaven-movement-completed' as const,
      skavenId: skaven.id,
      spaces: command.path.length,
    })
  );
  return Object.freeze({
    state: freezeState({
      ...state,
      skaven: state.skaven.map(candidate =>
        candidate.id === skaven.id
          ? { ...candidate, position: destination, facing: command.facing }
          : candidate
      ),
      skavenMovementRemaining: 0,
    }),
    events: Object.freeze(events),
  });
};

const assertSkavenActionAvailable = (state: GameState) => {
  if (state.skavenMovementRemaining !== 0) {
    throw new RulesError(
      'SKAVEN_MOVEMENT_REQUIRED',
      'Complete this Skaven’s Movement before taking its Action'
    );
  }
  if ((state.skavenActionsRemaining ?? 0) < 1) {
    throw new RulesError(
      'NO_SKAVEN_ACTIONS_REMAINING',
      'The active Skaven has no Actions remaining'
    );
  }
};

const finishSkavenActivation = (
  state: GameState,
  skavenId: string
): { readonly state: GameState; readonly events: readonly GameEvent[] } => {
  const activatedSkavenIds = state.activatedSkavenIds.includes(skavenId)
    ? state.activatedSkavenIds
    : [...state.activatedSkavenIds, skavenId];
  const everyActivated = state.skavenActivationIds.every(
    id => activatedSkavenIds.includes(id) || !state.skaven.some(skaven => skaven.id === id)
  );
  return {
    state: {
      ...state,
      activeSkavenId: null,
      skavenActionsRemaining: null,
      skavenMovementRemaining: null,
      activatedSkavenIds,
      skavenTurnStep: everyActivated ? 'activate-noise' : state.skavenTurnStep,
    },
    events: Object.freeze([
      Object.freeze({ type: 'skaven-activation-ended' as const, skavenId }),
      ...(everyActivated
        ? [Object.freeze({ type: 'revealed-skaven-activations-complete' as const })]
        : []),
    ]),
  };
};

const fightHero = (
  state: GameState,
  command: Extract<GameCommand, { type: 'fight-hero' }>,
  randomSource: RandomSource
): CommandResult => {
  const skaven = getActiveSkaven(state, command.skavenId);
  assertSkavenActionAvailable(state);
  const hero = state.heroes.find(candidate => candidate.id === command.heroId);
  if (!hero?.position || hero.woundsRemaining <= 0) {
    throw new RulesError('UNKNOWN_FIGHT_TARGET', 'Choose a living hero to fight');
  }
  if (!isAdjacent(skaven.position, hero.position)) {
    throw new RulesError('FIGHT_TARGET_NOT_ADJACENT', 'Fight an adjacent hero');
  }

  const { heroRolls, skavenRolls, outcome } = resolveOpposedRoll(
    HERO_DEFINITIONS[hero.definitionId].stats.fight,
    SKAVEN_DEFINITIONS[skaven.definitionId].stats.fight,
    randomSource
  );
  const combatResult = freezeCombatResult({
    heroId: hero.id,
    skavenId: skaven.id,
    skavenDefinitionId: skaven.definitionId,
    heroRolls,
    skavenRolls,
    outcome,
  });
  const events: GameEvent[] = [Object.freeze({ type: 'fight-rolled' as const, ...combatResult })];
  let heroes = state.heroes;
  let skavenModels = state.skaven;

  if (outcome === 'hero-won') {
    const woundsRemaining = Math.max(0, skaven.woundsRemaining - 1);
    events.push(
      Object.freeze({
        type: 'model-wounded' as const,
        faction: 'skaven' as const,
        modelId: skaven.id,
        woundsRemaining,
      })
    );
    skavenModels =
      woundsRemaining === 0
        ? state.skaven.filter(candidate => candidate.id !== skaven.id)
        : state.skaven.map(candidate =>
            candidate.id === skaven.id ? { ...candidate, woundsRemaining } : candidate
          );
    if (woundsRemaining === 0) {
      events.push(
        Object.freeze({
          type: 'model-defeated' as const,
          faction: 'skaven' as const,
          modelId: skaven.id,
        })
      );
    }
  } else if (outcome === 'skaven-won') {
    const woundsRemaining = Math.max(0, hero.woundsRemaining - 1);
    events.push(
      Object.freeze({
        type: 'model-wounded' as const,
        faction: 'hero' as const,
        modelId: hero.id,
        woundsRemaining,
      })
    );
    heroes = state.heroes.map(candidate =>
      candidate.id === hero.id
        ? {
            ...candidate,
            woundsRemaining,
            position: woundsRemaining === 0 ? null : candidate.position,
          }
        : candidate
    );
    if (woundsRemaining === 0) {
      events.push(
        Object.freeze({
          type: 'model-defeated' as const,
          faction: 'hero' as const,
          modelId: hero.id,
        })
      );
    }
  }

  const actionEvent = Object.freeze({
    type: 'skaven-action-spent' as const,
    skavenId: skaven.id,
    action: 'fight' as const,
    actionsRemaining: 0,
  });
  const nextState: GameState = {
    ...state,
    heroes,
    skaven: skavenModels,
    combatLog: [...state.combatLog, combatResult],
    skavenActionsRemaining: 0,
  };
  if (outcome === 'hero-won' && !skavenModels.some(candidate => candidate.id === skaven.id)) {
    const finished = finishSkavenActivation(nextState, skaven.id);
    return Object.freeze({
      state: freezeState(finished.state),
      events: Object.freeze([...events, actionEvent, ...finished.events]),
    });
  }
  return Object.freeze({
    state: freezeState(nextState),
    events: Object.freeze([...events, actionEvent]),
  });
};

const interactDoorSkaven = (
  state: GameState,
  command: Extract<GameCommand, { type: 'interact-door-skaven' }>,
  mission: MissionDefinition
): CommandResult => {
  const skaven = getActiveSkaven(state, command.skavenId);
  assertSkavenActionAvailable(state);
  if (skaven.definitionId !== 'clanrat') {
    throw new RulesError('CLANRAT_DOOR_ONLY', 'Only a Clanrat may use a Door action');
  }
  const door = state.doors.find(candidate => samePosition(candidate.position, command.position));
  if (!door || door.status === 'destroyed') {
    throw new RulesError('INVALID_DOOR', 'Choose an intact door');
  }
  if (!isAdjacent(skaven.position, door.position)) {
    throw new RulesError('DOOR_NOT_ADJACENT', 'Interact with an adjacent door');
  }
  const nextStatus = door.status === 'closed' ? 'open' : 'closed';
  if (nextStatus === 'closed' && isPositionOccupied(state, door.position)) {
    throw new RulesError('DOOR_OCCUPIED', 'An occupied doorway cannot be closed');
  }

  let workingState: GameState = {
    ...state,
    doors: state.doors.map(candidate =>
      samePosition(candidate.position, door.position)
        ? { ...candidate, status: nextStatus }
        : candidate
    ),
    skavenActionsRemaining: 0,
  };
  const events: GameEvent[] = [
    Object.freeze({
      type: nextStatus === 'open' ? ('door-opened' as const) : ('door-closed' as const),
      position: freezePosition(door.position),
    }),
  ];
  if (nextStatus === 'open') {
    const reveals = revealVisibleNoise(workingState, mission);
    workingState = reveals.state;
    events.push(...reveals.events);
  }
  events.push(
    Object.freeze({
      type: 'skaven-action-spent' as const,
      skavenId: skaven.id,
      action: 'interact' as const,
      actionsRemaining: 0,
    })
  );
  return Object.freeze({ state: freezeState(workingState), events: Object.freeze(events) });
};

const endSkavenActivation = (
  state: GameState,
  command: Extract<GameCommand, { type: 'end-skaven-activation' }>
): CommandResult => {
  const skaven = getActiveSkaven(state, command.skavenId);
  if (
    ((state.skavenMovementRemaining ?? 0) > 0 || (state.skavenActionsRemaining ?? 0) > 0) &&
    !command.confirmed
  ) {
    throw new RulesError(
      'CONFIRMATION_REQUIRED',
      `Confirm ending ${SKAVEN_DEFINITIONS[skaven.definitionId].name}’s activation early`
    );
  }
  const finished = finishSkavenActivation(state, skaven.id);
  return Object.freeze({
    state: freezeState(finished.state),
    events: finished.events,
  });
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
    case 'start-hero-activation':
      return startHeroActivation(state, command);
    case 'move-hero':
      return moveHero(state, command, mission);
    case 'dash-hero':
      return dashHero(state, command);
    case 'push-hero':
      return pushHero(state, command);
    case 'interact-door':
      return interactDoor(state, command, mission);
    case 'place-revealed-skaven':
      return placeRevealedSkaven(state, command, mission);
    case 'fight-skaven':
      return fightSkaven(state, command, randomSource);
    case 'end-hero-activation':
      return endHeroActivation(state, command);
    case 'end-hero-phase':
      return endHeroPhase(state, command);
    case 'start-skaven-activation':
      return startSkavenActivation(state, command);
    case 'move-skaven':
      return moveSkaven(state, command, mission);
    case 'fight-hero':
      return fightHero(state, command, randomSource);
    case 'interact-door-skaven':
      return interactDoorSkaven(state, command, mission);
    case 'end-skaven-activation':
      return endSkavenActivation(state, command);
    default:
      throw new RulesError(
        'INVALID_COMMAND',
        `Unknown game command ${(command as { readonly type: string }).type}`
      );
  }
};

export const projectHeroView = (state: GameState): HeroGameView =>
  (() => {
    const mission = getMissionDefinition(state.missionId);
    return Object.freeze({
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
      revealedNoise: Object.freeze(state.revealedNoise.map(freezeRevealedNoise)),
      skaven: Object.freeze(state.skaven.map(freezeSkaven)),
      initialNoiseDrawsResolved: state.initialNoiseDrawsResolved,
      initialNoiseCount: mission.initialNoiseCount,
      remainingNoiseCount: state.remainingNoiseBag.length,
      doors: Object.freeze(state.doors.map(freezeDoor)),
      activeHeroId: state.activeHeroId,
      actionsRemaining: state.actionsRemaining,
      movementRemaining: state.movementRemaining,
      facingChangeAvailable: state.facingChangeAvailable,
      dashUsed: state.dashUsed,
      pushUsed: state.pushUsed,
      activatedHeroIds: Object.freeze([...state.activatedHeroIds]),
      exitedHeroIds: Object.freeze([...state.exitedHeroIds]),
      skavenTurnStep: state.skavenTurnStep,
      skavenActivationIds: Object.freeze([...state.skavenActivationIds]),
      activatedSkavenIds: Object.freeze([...state.activatedSkavenIds]),
      activeSkavenId: state.activeSkavenId,
      skavenActionsRemaining: state.skavenActionsRemaining,
      skavenMovementRemaining: state.skavenMovementRemaining,
      legalSkavenMovePaths: getLegalSkavenMovePaths(state, mission),
      legalSkavenDoorInteractions: getLegalSkavenDoorInteractions(state, mission),
      legalSkavenFightTargetIds: getLegalSkavenFightTargetIds(state),
      legalMovePaths: getLegalHeroMovePaths(state, mission),
      legalDoorInteractions: getLegalDoorInteractions(state, mission),
      legalFightTargetIds: getLegalFightTargetIds(state),
      combatLog: Object.freeze(state.combatLog.map(freezeCombatResult)),
    });
  })();

export const projectSkavenView = (state: GameState): SkavenGameView =>
  (() => {
    const heroView = projectHeroView(state);
    return Object.freeze({
      ...heroView,
      noiseTokens: Object.freeze(state.concealedNoise.map(freezeNoise)),
      pendingNoise: state.pendingNoise ? freezePendingNoise(state.pendingNoise) : null,
    });
  })();
