import { HERO_DEFINITIONS, SKAVEN_DEFINITIONS, isHeroId } from '/src/game/entities.js';
import type { HeroId, SkavenId } from '/src/game/entities.js';
import type { Position } from '/src/game/map.js';
import type { MissionDefinition, NoiseResultId } from '/src/game/missionDefinition.js';
import { getMissionDefinition } from '/src/game/missions/registry.js';
import { RulesError } from '/src/game/rulesError.js';
import { hasLineOfSight } from '/src/game/lineOfSight.js';
import {
  getReachablePaths,
  getShortestAdvancePaths,
  getShortestPathDistance,
  isLegalMovementPath,
} from '/src/game/pathfinding.js';
import type { MovementContext, ReachablePath } from '/src/game/pathfinding.js';
import { resolveOpposedRoll, rollDice } from '/src/game/combat.js';
import {
  EMPTY_ABILITY_USAGE,
  distance,
  inFrontArc,
  getFightDice,
  fightOutcome,
  getRerollAbilities,
} from '/src/game/reactiveCombat.js';
import type {
  AbilityUsage,
  PendingCombat,
  PendingSkavenMovement,
  RerollAbility,
} from '/src/game/reactiveCombat.js';
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

export interface CombatReroll {
  readonly ability: RerollAbility | 'ward';
  readonly dieIndices: readonly number[];
  readonly previousRolls: readonly number[];
  readonly rolls: readonly number[];
}

export interface CombatResult {
  readonly rerolls?: readonly CombatReroll[];
  readonly woundsInflicted?: number;
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

export interface ReactWindow {
  readonly source: 'skaven' | 'noise';
  readonly sourceId: string;
}

export interface ReactFightOption {
  readonly heroId: HeroId;
  readonly skavenId: string;
}

export interface ReactDoorOption {
  readonly heroId: HeroId;
  readonly position: Position;
}

/** A shortest Noise route may spend the activation handling a door instead of moving. */
export interface NoiseMovePath extends ReachablePath {
  readonly doorPosition?: Position;
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
  readonly guards: readonly HeroId[];
  readonly wards: readonly HeroId[];
  readonly abilityUsage: AbilityUsage;
  readonly pendingCombat: PendingCombat | null;
  readonly pendingSkavenMovement: PendingSkavenMovement | null;
  readonly pendingNoise: PendingNoiseState | null;
  readonly nextNoiseSequence: number;
  readonly initialNoiseDrawsResolved: number;
  readonly reinforcementDrawsResolved: number;
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
  readonly pendingReact: ReactWindow | null;
  readonly noiseActivationIds: readonly string[];
  readonly activatedNoiseIds: readonly string[];
  readonly activeNoiseId: string | null;
  readonly noiseActionIds: readonly string[];
}

export type GameCommand =
  | { readonly type: 'guard-hero'; readonly heroId: HeroId }
  | {
      readonly type: 'ward-hero' | 'react-ward-hero';
      readonly heroId: HeroId;
      readonly targetHeroId: HeroId;
    }
  | {
      readonly type: 'reroll-fight-die';
      readonly ability: RerollAbility;
      readonly dieIndex: number;
    }
  | { readonly type: 'accept-fight-rolls' }
  | { readonly type: 'resolve-ward' }
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
    }
  | { readonly type: 'skip-react' }
  | {
      readonly type: 'react-fight-skaven';
      readonly heroId: HeroId;
      readonly skavenId: string;
    }
  | {
      readonly type: 'react-interact-door';
      readonly heroId: HeroId;
      readonly position: Position;
    }
  | { readonly type: 'start-noise-activation'; readonly noiseId: string }
  | {
      readonly type: 'move-noise';
      readonly noiseId: string;
      readonly path: readonly Position[];
      readonly doorPosition?: Position;
    }
  | { readonly type: 'draw-reinforcement-noise' }
  | { readonly type: 'place-reinforcement-noise'; readonly position: Position };

export type GameEvent =
  | {
      readonly type:
        | 'guard-placed'
        | 'guard-triggered'
        | 'guard-expired'
        | 'ward-placed'
        | 'ward-consumed'
        | 'snorri-saved';
      readonly heroId: HeroId;
    }
  | {
      readonly type: 'fight-choice-opened';
      readonly heroId: HeroId;
      readonly stage: 'rerolls' | 'ward';
    }
  | {
      readonly type: 'fight-dice-rerolled';
      readonly heroId: HeroId;
      readonly ability: RerollAbility | 'ward';
      readonly dieIndices: readonly number[];
      readonly rolls: readonly number[];
    }
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
      readonly action: 'dash' | 'interact' | 'fight' | 'guard' | 'ward';
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
  | { readonly type: 'door-destroyed'; readonly position: Position }
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
  | { readonly type: 'react-window-opened'; readonly source: 'skaven' | 'noise' }
  | { readonly type: 'react-skipped' }
  | {
      readonly type: 'hero-reacted';
      readonly heroId: HeroId;
      readonly action: 'fight' | 'interact' | 'ward';
      readonly commandRemaining: number;
    }
  | { readonly type: 'noise-activation-started'; readonly noiseId: string }
  | {
      readonly type: 'noise-moved';
      readonly noiseId: string;
      readonly from: Position;
      readonly to: Position;
    }
  | { readonly type: 'noise-activation-ended'; readonly noiseId: string }
  | { readonly type: 'noise-activations-complete' }
  | { readonly type: 'reinforcement-started' }
  | { readonly type: 'reinforcement-complete' }
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
  readonly pendingReact: ReactWindow | null;
  readonly noiseActivationIds: readonly string[];
  readonly activatedNoiseIds: readonly string[];
  readonly activeNoiseId: string | null;
  readonly noiseActionIds: readonly string[];
  readonly reinforcementDrawsResolved: number;
  readonly reinforcementDrawCount: number;
  readonly legalSkavenMovePaths: readonly ReachablePath[];
  readonly legalSkavenDoorInteractions: readonly Position[];
  readonly legalSkavenFightTargetIds: readonly HeroId[];
  readonly legalNoiseMovePaths: readonly NoiseMovePath[];
  readonly legalReactFightOptions: readonly ReactFightOption[];
  readonly legalReactDoorOptions: readonly ReactDoorOption[];
  readonly legalMovePaths: readonly ReachablePath[];
  readonly legalDoorInteractions: readonly Position[];
  readonly legalFightTargetIds: readonly string[];
  readonly combatLog: readonly CombatResult[];
  readonly guards: readonly HeroId[];
  readonly wards: readonly HeroId[];
  readonly abilityUsage: AbilityUsage;
  readonly pendingCombat: PendingCombat | null;
  readonly pendingSkavenMovement: PendingSkavenMovement | null;
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
    ...(result.rerolls
      ? {
          rerolls: Object.freeze(
            result.rerolls.map(reroll =>
              Object.freeze({
                ...reroll,
                dieIndices: Object.freeze([...reroll.dieIndices]),
                previousRolls: Object.freeze([...reroll.previousRolls]),
                rolls: Object.freeze([...reroll.rolls]),
              })
            )
          ),
        }
      : {}),
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
    guards: Object.freeze([...state.guards]),
    wards: Object.freeze([...state.wards]),
    abilityUsage: Object.freeze({ ...state.abilityUsage }),
    pendingCombat: state.pendingCombat
      ? (Object.freeze({
          ...freezeCombatResult(state.pendingCombat),
          rerolledDice: Object.freeze([...state.pendingCombat.rerolledDice]),
        }) as PendingCombat)
      : null,
    pendingSkavenMovement: state.pendingSkavenMovement
      ? Object.freeze({
          ...state.pendingSkavenMovement,
          remainingPath: Object.freeze(
            state.pendingSkavenMovement.remainingPath.map(freezePosition)
          ),
        })
      : null,
    pendingNoise: state.pendingNoise ? freezePendingNoise(state.pendingNoise) : null,
    pendingReact: state.pendingReact ? Object.freeze({ ...state.pendingReact }) : null,
    remainingNoiseBag: Object.freeze([...state.remainingNoiseBag]),
    activatedHeroIds: Object.freeze([...state.activatedHeroIds]),
    exitedHeroIds: Object.freeze([...state.exitedHeroIds]),
    skavenActivationIds: Object.freeze([...state.skavenActivationIds]),
    activatedSkavenIds: Object.freeze([...state.activatedSkavenIds]),
    noiseActivationIds: Object.freeze([...state.noiseActivationIds]),
    activatedNoiseIds: Object.freeze([...state.activatedNoiseIds]),
    noiseActionIds: Object.freeze([...state.noiseActionIds]),
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
    guards: [],
    wards: [],
    abilityUsage: EMPTY_ABILITY_USAGE,
    pendingCombat: null,
    pendingSkavenMovement: null,
    pendingNoise: null,
    nextNoiseSequence: 1,
    initialNoiseDrawsResolved: 0,
    reinforcementDrawsResolved: 0,
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
    pendingReact: null,
    noiseActivationIds: [],
    activatedNoiseIds: [],
    activeNoiseId: null,
    noiseActionIds: [],
  });

/** Rebuild the immutable engine boundary around a JSON-deserialized saved state. */
export const restoreGameState = (state: GameState, mission: MissionDefinition): GameState => {
  assertMissionMatches(state, mission);
  // Explicit additive migration of saves written before reactive combat existed.
  const restored = freezeState({
    ...state,
    guards: state.guards ?? [],
    wards: state.wards ?? [],
    abilityUsage: state.abilityUsage ?? EMPTY_ABILITY_USAGE,
    pendingCombat: state.pendingCombat ?? null,
    pendingSkavenMovement: state.pendingSkavenMovement ?? null,
  });
  projectHeroView(restored);
  return restored;
};

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
  skaven: SkavenState,
  maximumSteps = state.skavenMovementRemaining ?? 0
): MovementContext => ({
  board: mission.board,
  start: skaven.position,
  maximumSteps,
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

const getSkavenApproachGoals = (state: GameState): readonly Position[] =>
  state.heroes.flatMap(hero =>
    isHeroEligible(state, hero) && hero.position ? adjacentPositions(hero.position) : []
  );

export const getSkavenApproachPaths = (
  state: GameState,
  mission: MissionDefinition,
  skavenId: string
): readonly ReachablePath[] => {
  assertMissionMatches(state, mission);
  const skaven = state.skaven.find(candidate => candidate.id === skavenId);
  if (!skaven) return Object.freeze([]);
  const maximumSteps =
    state.activeSkavenId === skaven.id
      ? (state.skavenMovementRemaining ?? 0)
      : SKAVEN_DEFINITIONS[skaven.definitionId].stats.move;
  return getShortestAdvancePaths(
    getSkavenMovementContext(state, mission, skaven, maximumSteps),
    getSkavenApproachGoals(state)
  );
};

export const getSkavenDistanceToNearestReachableHero = (
  state: GameState,
  mission: MissionDefinition,
  skavenId: string
): number => {
  assertMissionMatches(state, mission);
  const skaven = state.skaven.find(candidate => candidate.id === skavenId);
  if (!skaven) return Number.POSITIVE_INFINITY;
  return getShortestPathDistance(
    getSkavenMovementContext(state, mission, skaven),
    getSkavenApproachGoals(state)
  );
};

const getNoiseMovementContext = (
  state: GameState,
  mission: MissionDefinition,
  noise: ConcealedNoiseState
): MovementContext => ({
  board: mission.board,
  start: noise.position,
  maximumSteps: 5,
  closedDoors: state.doors.filter(door => door.status === 'closed').map(door => door.position),
  blockedPositions: [
    ...state.heroes.flatMap(hero => (hero.position ? [hero.position] : [])),
    ...state.skaven.map(skaven => skaven.position),
    ...state.concealedNoise
      .filter(candidate => candidate.id !== noise.id)
      .map(candidate => candidate.position),
    ...state.revealedNoise.map(candidate => candidate.position),
  ],
  exitOpen: state.nests.every(nest => nest.status === 'destroyed'),
});

const adjacentPositions = (position: Position): readonly Position[] => {
  const positions: Position[] = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset++) {
      if (rowOffset === 0 && columnOffset === 0) continue;
      positions.push(
        freezePosition({ row: position.row + rowOffset, column: position.column + columnOffset })
      );
    }
  }
  return Object.freeze(positions);
};

const isNoiseVisibleAt = (state: GameState, mission: MissionDefinition, position: Position) => {
  const closedDoors = state.doors
    .filter(door => door.status === 'closed')
    .map(door => door.position);
  return state.heroes.some(
    hero =>
      isHeroEligible(state, hero) &&
      hero.position &&
      (isAdjacent(hero.position, position) ||
        hasLineOfSight(mission.board, hero.position, position, closedDoors))
  );
};

export const getLegalNoiseMovePaths = (
  state: GameState,
  mission: MissionDefinition
): readonly NoiseMovePath[] => {
  if (state.pendingCombat) return Object.freeze([]);
  assertMissionMatches(state, mission);
  if (
    state.phase !== 'skaven' ||
    state.skavenTurnStep !== 'activate-noise' ||
    !state.activeNoiseId ||
    state.activatedNoiseIds.includes(state.activeNoiseId) ||
    state.pendingReact ||
    state.revealedNoise.length > 0 ||
    state.noiseActionIds.length > 0
  ) {
    return Object.freeze([]);
  }
  const noise = state.concealedNoise.find(candidate => candidate.id === state.activeNoiseId);
  if (!noise) return Object.freeze([]);
  const goals = state.heroes.flatMap(hero =>
    isHeroEligible(state, hero) && hero.position ? adjacentPositions(hero.position) : []
  );
  const movementContext = getNoiseMovementContext(state, mission, noise);
  const paths = getShortestAdvancePaths({ ...movementContext, closedDoors: [] }, goals);
  if (paths.length === 0) {
    return Object.freeze([
      Object.freeze({ destination: freezePosition(noise.position), steps: Object.freeze([]) }),
    ]);
  }
  const unique = new Map<string, NoiseMovePath>();
  for (const path of paths) {
    const doorIndex = path.steps.findIndex(position =>
      movementContext.closedDoors.some(door => samePosition(door, position))
    );
    const blockingDoor = doorIndex >= 0 ? path.steps[doorIndex] : undefined;
    const doorPosition =
      blockingDoor && isAdjacent(noise.position, blockingDoor) ? blockingDoor : undefined;
    const legalSteps = doorPosition
      ? []
      : doorIndex >= 0
        ? path.steps.slice(0, doorIndex)
        : path.steps;
    const revealIndex = legalSteps.findIndex(position =>
      isNoiseVisibleAt(state, mission, position)
    );
    const steps = revealIndex >= 0 ? legalSteps.slice(0, revealIndex + 1) : legalSteps;
    const destination = steps.at(-1) ?? noise.position;
    const key =
      steps.map(position => `${String(position.row)},${String(position.column)}`).join(';') +
      (doorPosition ? `;door:${doorPosition.row},${doorPosition.column}` : '');
    unique.set(
      key,
      Object.freeze({
        destination: freezePosition(destination),
        steps: Object.freeze(steps.map(freezePosition)),
        ...(doorPosition ? { doorPosition: freezePosition(doorPosition) } : {}),
      })
    );
  }
  return Object.freeze([...unique.values()]);
};

export const getLegalReactFightOptions = (state: GameState): readonly ReactFightOption[] => {
  if (state.pendingCombat) return Object.freeze([]);
  if (!state.pendingReact || state.command < 2 || state.revealedNoise.length > 0) {
    return Object.freeze([]);
  }
  return Object.freeze(
    state.heroes.flatMap(hero =>
      isHeroEligible(state, hero) && hero.position
        ? state.skaven
            .filter(skaven => isAdjacent(hero.position!, skaven.position))
            .map(skaven => Object.freeze({ heroId: hero.id, skavenId: skaven.id }))
        : []
    )
  );
};

export const getLegalReactDoorOptions = (
  state: GameState,
  mission: MissionDefinition
): readonly ReactDoorOption[] => {
  if (state.pendingCombat) return Object.freeze([]);
  assertMissionMatches(state, mission);
  if (!state.pendingReact || state.command < 2 || state.revealedNoise.length > 0) {
    return Object.freeze([]);
  }
  return Object.freeze(
    state.heroes.flatMap(hero =>
      isHeroEligible(state, hero) && hero.position
        ? state.doors
            .filter(
              door =>
                door.status !== 'destroyed' &&
                (door.status === 'closed' || !isPositionOccupied(state, door.position)) &&
                isAdjacent(hero.position!, door.position)
            )
            .map(door =>
              Object.freeze({ heroId: hero.id, position: freezePosition(door.position) })
            )
        : []
    )
  );
};

export const getLegalSkavenMovePaths = (
  state: GameState,
  mission: MissionDefinition
): readonly ReachablePath[] => {
  if (state.pendingCombat) return Object.freeze([]);
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
  if (state.pendingCombat) return Object.freeze([]);
  if (
    state.phase !== 'skaven' ||
    (state.skavenTurnStep !== 'activate-skaven' && state.skavenTurnStep !== 'activate-noise') ||
    !state.activeSkavenId ||
    state.skavenMovementRemaining !== 0 ||
    (state.skavenActionsRemaining ?? 0) < 1 ||
    state.pendingReact ||
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
  if (state.pendingCombat) return Object.freeze([]);
  assertMissionMatches(state, mission);
  if (
    state.phase !== 'skaven' ||
    (state.skavenTurnStep !== 'activate-skaven' && state.skavenTurnStep !== 'activate-noise') ||
    !state.activeSkavenId ||
    state.skavenMovementRemaining !== 0 ||
    (state.skavenActionsRemaining ?? 0) < 1 ||
    state.pendingReact ||
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
  if (state.pendingCombat) return Object.freeze([]);
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
  if (state.pendingCombat) return Object.freeze([]);
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
  const blockedNoisePositions = [
    // Spawning groups spill through occupied Skaven, but unavailableDestinations still
    // prevents two models from finishing on the same square.
    ...state.concealedNoise.map(candidate => candidate.position),
    ...state.revealedNoise
      .filter(candidate => candidate.id !== noise.id)
      .map(candidate => candidate.position),
  ];
  const context = {
    board: mission.board,
    start: noise.position,
    maximumSteps: mission.board.width * mission.board.height,
    closedDoors: state.doors.filter(door => door.status === 'closed').map(door => door.position),
    blockedPositions: [
      ...state.heroes.flatMap(hero => (hero.position ? [hero.position] : [])),
      ...blockedNoisePositions,
    ],
    unavailableDestinations,
    exitOpen: state.nests.every(nest => nest.status === 'destroyed'),
  };
  const positions = getNearestReachablePositions(context);
  const models = mission.noiseResults[noise.resultId].models;
  const canSpillPastHeroes =
    models.length > 1 &&
    models.every(model => model === 'clanrat') &&
    noise.remainingModels.length < models.length &&
    mission.board.spawns.some(spawn => samePosition(spawn, noise.position));
  if (positions.length > 0 || !canSpillPastHeroes) return positions;

  // Extra Clanrats stranded at an entry may spill past heroes, but every occupied
  // square remains unavailable as a destination.
  return getNearestReachablePositions({ ...context, blockedPositions: blockedNoisePositions });
};

export const getLegalHeroMovePaths = (
  state: GameState,
  mission: MissionDefinition
): readonly ReachablePath[] => {
  if (state.pendingCombat) return Object.freeze([]);
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
  if (state.pendingCombat) return Object.freeze([]);
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
        id: `noise-${String(state.nextNoiseSequence)}`,
        resultId,
      },
      nextNoiseSequence: state.nextNoiseSequence + 1,
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
      guards: state.guards.filter(id => id !== hero.id),
      actionsRemaining: actions,
      movementRemaining: movement,
      facingChangeAvailable: true,
      dashUsed: false,
      pushUsed: false,
    }),
    events: Object.freeze([
      ...(state.guards.includes(hero.id)
        ? [Object.freeze({ type: 'guard-expired' as const, heroId: hero.id })]
        : []),
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
  mission: MissionDefinition,
  randomSource: RandomSource
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

  const skavenModels = [...state.skaven, skaven];
  const resolvedActiveNoise =
    resolved && state.skavenTurnStep === 'activate-noise' && state.activeNoiseId === noise.id;
  // Door handling consumes the activation before any forced-reveal placement or React.
  const doorActivationEnded =
    state.activeNoiseId === noise.id && state.activatedNoiseIds.includes(noise.id);
  const noiseActionIds =
    resolvedActiveNoise && !doorActivationEnded
      ? skavenModels
          .filter(candidate => candidate.sourceNoiseId === noise.id)
          .map(candidate => candidate.id)
      : state.noiseActionIds;
  const guardWillTrigger = state.heroes.some(
    hero =>
      state.guards.includes(hero.id) &&
      isHeroEligible(state, hero) &&
      inFrontArc(hero, skaven.position)
  );
  const pendingReact: ReactWindow | null =
    resolvedActiveNoise && state.command >= 2 && !guardWillTrigger
      ? Object.freeze({ source: 'noise', sourceId: noise.id })
      : state.pendingReact;
  if (pendingReact && pendingReact !== state.pendingReact) {
    events.push(Object.freeze({ type: 'react-window-opened' as const, source: 'noise' as const }));
  }

  let nextState: GameState = {
    ...state,
    skaven: skavenModels,
    nextSkavenSequence: state.nextSkavenSequence + 1,
    revealedNoise: resolved
      ? state.revealedNoise.filter(candidate => candidate.id !== noise.id)
      : state.revealedNoise.map(candidate =>
          candidate.id === noise.id ? { ...candidate, remainingModels } : candidate
        ),
    noiseActionIds,
    pendingReact,
    activatedSkavenIds: doorActivationEnded
      ? [...state.activatedSkavenIds, skavenId]
      : state.activatedSkavenIds,
  };
  const guarded = triggerGuard(nextState, skavenId, randomSource);
  if (guarded) return commandResult(guarded.state, [...events, ...guarded.events]);
  if (resolvedActiveNoise && doorActivationEnded && !pendingReact) {
    const finished = finishNoiseActivation(nextState, noise.id);
    nextState = finished.state;
    events.push(...finished.events);
  }
  if (
    resolved &&
    state.skavenTurnStep === 'reinforce' &&
    nextState.reinforcementDrawsResolved >= mission.noisePerTurn
  ) {
    const completed = completeReinforcement(nextState);
    nextState = completed.state;
    events.push(...completed.events);
  }
  return Object.freeze({ state: freezeState(nextState), events: Object.freeze(events) });
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

  return beginCombat(state, hero, skaven, 'hero', randomSource);
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
  const noiseActivationIds = state.concealedNoise.map(noise => noise.id);
  const skavenTurnStep =
    skavenActivationIds.length > 0
      ? 'activate-skaven'
      : noiseActivationIds.length > 0
        ? 'activate-noise'
        : 'reinforce';
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
      pendingReact: null,
      noiseActivationIds,
      activatedNoiseIds: [],
      activeNoiseId: null,
      noiseActionIds: [],
      reinforcementDrawsResolved: 0,
    }),
    events: Object.freeze([
      Object.freeze({ type: 'hero-phase-ended' as const, round: state.round }),
      Object.freeze({ type: 'skaven-turn-started' as const, round: state.round }),
      ...(skavenTurnStep === 'activate-noise'
        ? [Object.freeze({ type: 'revealed-skaven-activations-complete' as const })]
        : []),
      ...(skavenTurnStep === 'reinforce'
        ? [
            Object.freeze({ type: 'revealed-skaven-activations-complete' as const }),
            Object.freeze({ type: 'noise-activations-complete' as const }),
            Object.freeze({ type: 'reinforcement-started' as const }),
          ]
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
  if (
    state.setupStep !== 'complete' ||
    state.phase !== 'skaven' ||
    (state.skavenTurnStep !== 'activate-skaven' && state.skavenTurnStep !== 'activate-noise')
  ) {
    throw new RulesError('NOT_SKAVEN_PHASE', 'This command requires a Skaven activation');
  }
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
  if (state.skavenTurnStep === 'activate-skaven') {
    assertSkavenActivationStep(state);
  } else if (
    state.setupStep !== 'complete' ||
    state.phase !== 'skaven' ||
    state.skavenTurnStep !== 'activate-noise'
  ) {
    throw new RulesError('NOT_SKAVEN_PHASE', 'This command requires a Skaven activation');
  }
  if (state.pendingReact) {
    throw new RulesError('REACT_WINDOW_OPEN', 'Resolve the Hero React window first');
  }
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
  const eligibleIds =
    state.skavenTurnStep === 'activate-noise' ? state.noiseActionIds : state.skavenActivationIds;
  if (!skaven || !eligibleIds.includes(skaven.id)) {
    throw new RulesError(
      'SKAVEN_NOT_ELIGIBLE',
      'Choose a living Skaven eligible to act in this step'
    );
  }
  if (state.activatedSkavenIds.includes(skaven.id)) {
    throw new RulesError(
      'SKAVEN_ALREADY_ACTIVATED',
      `${SKAVEN_DEFINITIONS[skaven.definitionId].name} already activated`
    );
  }
  const movement =
    state.skavenTurnStep === 'activate-noise'
      ? 0
      : SKAVEN_DEFINITIONS[skaven.definitionId].stats.move;
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
  mission: MissionDefinition,
  randomSource: RandomSource
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

  const pendingSkavenMovement: PendingSkavenMovement = {
    skavenId: skaven.id,
    remainingPath: command.path,
    facing: command.facing,
    spacesMoved: 0,
  };
  return continueSkavenMovement({ ...state, pendingSkavenMovement }, mission, randomSource);
};

const assertSkavenActionAvailable = (state: GameState) => {
  if (state.pendingReact) {
    throw new RulesError('REACT_WINDOW_OPEN', 'Resolve the Hero React window first');
  }
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
  if (state.skavenTurnStep === 'activate-noise') {
    const everyNoiseModelActed = state.noiseActionIds.every(
      id => activatedSkavenIds.includes(id) || !state.skaven.some(skaven => skaven.id === id)
    );
    if (!everyNoiseModelActed) {
      return {
        state: {
          ...state,
          activeSkavenId: null,
          skavenActionsRemaining: null,
          skavenMovementRemaining: null,
          activatedSkavenIds,
        },
        events: Object.freeze([
          Object.freeze({ type: 'skaven-activation-ended' as const, skavenId }),
        ]),
      };
    }
    const noiseId = state.activeNoiseId;
    const activatedNoiseIds = noiseId
      ? [...state.activatedNoiseIds, noiseId]
      : state.activatedNoiseIds;
    const everyNoiseActivated = state.noiseActivationIds.every(
      id => activatedNoiseIds.includes(id) || !state.concealedNoise.some(noise => noise.id === id)
    );
    return {
      state: {
        ...state,
        activeSkavenId: null,
        skavenActionsRemaining: null,
        skavenMovementRemaining: null,
        activatedSkavenIds,
        activeNoiseId: null,
        noiseActionIds: [],
        activatedNoiseIds,
        skavenTurnStep: everyNoiseActivated ? 'reinforce' : 'activate-noise',
      },
      events: Object.freeze([
        Object.freeze({ type: 'skaven-activation-ended' as const, skavenId }),
        ...(noiseId ? [Object.freeze({ type: 'noise-activation-ended' as const, noiseId })] : []),
        ...(everyNoiseActivated
          ? [
              Object.freeze({ type: 'noise-activations-complete' as const }),
              Object.freeze({ type: 'reinforcement-started' as const }),
            ]
          : []),
      ]),
    };
  }
  const nextStep = state.noiseActivationIds.some(id =>
    state.concealedNoise.some(noise => noise.id === id)
  )
    ? 'activate-noise'
    : 'reinforce';
  return {
    state: {
      ...state,
      activeSkavenId: null,
      skavenActionsRemaining: null,
      skavenMovementRemaining: null,
      activatedSkavenIds,
      skavenTurnStep: everyActivated ? nextStep : state.skavenTurnStep,
    },
    events: Object.freeze([
      Object.freeze({ type: 'skaven-activation-ended' as const, skavenId }),
      ...(everyActivated
        ? [
            Object.freeze({ type: 'revealed-skaven-activations-complete' as const }),
            ...(nextStep === 'reinforce'
              ? [
                  Object.freeze({ type: 'noise-activations-complete' as const }),
                  Object.freeze({ type: 'reinforcement-started' as const }),
                ]
              : []),
          ]
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

  return beginCombat(state, hero, skaven, 'skaven', randomSource);
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
  if (state.pendingReact) {
    throw new RulesError('REACT_WINDOW_OPEN', 'Resolve the Hero React window first');
  }
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

const assertReactWindow = (state: GameState): ReactWindow => {
  if (!state.pendingReact) {
    throw new RulesError('NO_REACT_WINDOW', 'React is only available after enemy Movement');
  }
  if (state.revealedNoise.length > 0) {
    throw new RulesError('SKAVEN_PLACEMENT_REQUIRED', 'Place the complete revealed group first');
  }
  return state.pendingReact;
};

const finishReact = (state: GameState, events: readonly GameEvent[]): CommandResult => {
  const source = assertReactWindow(state);
  let nextState: GameState = { ...state, pendingReact: null };
  const nextEvents = [...events];
  if (source.source === 'skaven' && !state.skaven.some(skaven => skaven.id === source.sourceId)) {
    const finished = finishSkavenActivation(nextState, source.sourceId);
    nextState = finished.state;
    nextEvents.push(...finished.events);
  } else if (
    source.source === 'noise' &&
    state.noiseActionIds.every(id => !state.skaven.some(skaven => skaven.id === id))
  ) {
    const finished = finishNoiseActivation(nextState, source.sourceId);
    nextState = finished.state;
    nextEvents.push(...finished.events);
  }
  return Object.freeze({ state: freezeState(nextState), events: Object.freeze(nextEvents) });
};

const skipReact = (state: GameState): CommandResult => {
  assertReactWindow(state);
  return finishReact(state, [Object.freeze({ type: 'react-skipped' as const })]);
};

const getReactingHero = (state: GameState, heroId: HeroId): HeroState => {
  assertReactWindow(state);
  if (state.command < 2) throw new RulesError('NOT_ENOUGH_COMMAND', 'React requires 2 Command');
  const hero = state.heroes.find(candidate => candidate.id === heroId);
  if (!hero || !isHeroEligible(state, hero)) {
    throw new RulesError('HERO_NOT_ELIGIBLE', 'Choose a deployed, living, non-exited hero');
  }
  return hero;
};

const reactFightSkaven = (
  state: GameState,
  command: Extract<GameCommand, { type: 'react-fight-skaven' }>,
  randomSource: RandomSource
): CommandResult => {
  const hero = getReactingHero(state, command.heroId);
  const skaven = state.skaven.find(candidate => candidate.id === command.skavenId);
  if (!skaven) throw new RulesError('UNKNOWN_FIGHT_TARGET', 'Choose a living Skaven to fight');
  if (!hero.position || !isAdjacent(hero.position, skaven.position)) {
    throw new RulesError(
      'FIGHT_TARGET_NOT_ADJACENT',
      'React with Fight against an adjacent Skaven'
    );
  }
  return beginCombat(state, hero, skaven, 'react', randomSource);
};

const reactInteractDoor = (
  state: GameState,
  command: Extract<GameCommand, { type: 'react-interact-door' }>,
  mission: MissionDefinition
): CommandResult => {
  const hero = getReactingHero(state, command.heroId);
  const door = state.doors.find(candidate => samePosition(candidate.position, command.position));
  if (!door || door.status === 'destroyed')
    throw new RulesError('INVALID_DOOR', 'Choose an intact door');
  if (!hero.position || !isAdjacent(hero.position, door.position)) {
    throw new RulesError('DOOR_NOT_ADJACENT', 'React with an adjacent Door action');
  }
  const nextStatus = door.status === 'closed' ? 'open' : 'closed';
  if (nextStatus === 'closed' && isPositionOccupied(state, door.position)) {
    throw new RulesError('DOOR_OCCUPIED', 'An occupied doorway cannot be closed');
  }
  const commandRemaining = state.command - 2;
  let workingState: GameState = {
    ...state,
    command: commandRemaining,
    doors: state.doors.map(candidate =>
      samePosition(candidate.position, door.position)
        ? { ...candidate, status: nextStatus }
        : candidate
    ),
  };
  let events: GameEvent[] = [
    Object.freeze({
      type: nextStatus === 'open' ? ('door-opened' as const) : ('door-closed' as const),
      position: freezePosition(door.position),
    }),
    Object.freeze({
      type: 'hero-reacted' as const,
      heroId: hero.id,
      action: 'interact' as const,
      commandRemaining,
    }),
  ];
  const finished = finishReact(workingState, events);
  workingState = finished.state;
  events = [...finished.events];
  if (nextStatus === 'open') {
    const reveals = revealVisibleNoise(workingState, mission);
    workingState = reveals.state;
    events.push(...reveals.events);
  }
  return Object.freeze({ state: freezeState(workingState), events: Object.freeze(events) });
};

const assertNoiseActivationStep = (state: GameState) => {
  if (state.phase !== 'skaven' || state.skavenTurnStep !== 'activate-noise') {
    throw new RulesError('NOT_NOISE_STEP', 'This command can only be used while Noise activates');
  }
  if (state.pendingReact) throw new RulesError('REACT_WINDOW_OPEN', 'Resolve React first');
  if (state.revealedNoise.length > 0) {
    throw new RulesError('SKAVEN_PLACEMENT_REQUIRED', 'Place the revealed Skaven first');
  }
};

const finishNoiseActivation = (state: GameState, noiseId: string): CommandResult => {
  const activatedNoiseIds = state.activatedNoiseIds.includes(noiseId)
    ? state.activatedNoiseIds
    : [...state.activatedNoiseIds, noiseId];
  const complete = state.noiseActivationIds.every(
    id => activatedNoiseIds.includes(id) || !state.concealedNoise.some(noise => noise.id === id)
  );
  return Object.freeze({
    state: freezeState({
      ...state,
      activeNoiseId: null,
      activatedNoiseIds,
      noiseActionIds: [],
      skavenTurnStep: complete ? 'reinforce' : 'activate-noise',
    }),
    events: Object.freeze([
      Object.freeze({ type: 'noise-activation-ended' as const, noiseId }),
      ...(complete
        ? [
            Object.freeze({ type: 'noise-activations-complete' as const }),
            Object.freeze({ type: 'reinforcement-started' as const }),
          ]
        : []),
    ]),
  });
};

const startNoiseActivation = (
  state: GameState,
  command: Extract<GameCommand, { type: 'start-noise-activation' }>
): CommandResult => {
  assertNoiseActivationStep(state);
  if (state.activeNoiseId || state.activeSkavenId || state.noiseActionIds.length > 0) {
    throw new RulesError('ACTIVATION_IN_PROGRESS', 'Finish the current Noise activation first');
  }
  const noise = state.concealedNoise.find(candidate => candidate.id === command.noiseId);
  if (!noise || !state.noiseActivationIds.includes(noise.id)) {
    throw new RulesError(
      'NOISE_NOT_ELIGIBLE',
      'Choose Noise that existed at the start of this step'
    );
  }
  if (state.activatedNoiseIds.includes(noise.id)) {
    throw new RulesError('NOISE_ALREADY_ACTIVATED', 'This Noise already activated');
  }
  return Object.freeze({
    state: freezeState({ ...state, activeNoiseId: noise.id }),
    events: Object.freeze([
      Object.freeze({ type: 'noise-activation-started' as const, noiseId: noise.id }),
    ]),
  });
};

const moveNoise = (
  state: GameState,
  command: Extract<GameCommand, { type: 'move-noise' }>,
  mission: MissionDefinition
): CommandResult => {
  assertNoiseActivationStep(state);
  if (state.activeNoiseId !== command.noiseId) {
    throw new RulesError('WRONG_ACTIVE_NOISE', 'Only the active Noise can move');
  }
  const noise = state.concealedNoise.find(candidate => candidate.id === command.noiseId);
  if (!noise) throw new RulesError('NOISE_NOT_ELIGIBLE', 'Choose a concealed Noise token');
  const legal = getLegalNoiseMovePaths(state, mission);
  const path = legal.find(
    candidate =>
      candidate.steps.length === command.path.length &&
      candidate.steps.every((step, index) => samePosition(step, command.path[index]!)) &&
      (candidate.doorPosition
        ? command.doorPosition && samePosition(candidate.doorPosition, command.doorPosition)
        : !command.doorPosition)
  );
  if (!path) throw new RulesError('INVALID_NOISE_PATH', 'Noise must follow a shortest legal route');

  const doorPosition = path.doorPosition;
  if (doorPosition) {
    if (noise.resultId === 'nothing') return finishNoiseActivation(state, noise.id);
    const status = noise.resultId === 'rat-ogor' ? 'destroyed' : 'open';
    const changedState: GameState = {
      ...state,
      doors: state.doors.map(door =>
        samePosition(door.position, doorPosition) ? { ...door, status } : door
      ),
      activatedNoiseIds: [...state.activatedNoiseIds, noise.id],
    };
    const reveals = revealVisibleNoise(changedState, mission);
    const events: GameEvent[] = [
      Object.freeze({
        type: status === 'destroyed' ? 'door-destroyed' : 'door-opened',
        position: freezePosition(doorPosition),
      }),
      ...reveals.events,
    ];
    // Keep the active group only until its placement and normal React window resolve.
    if (reveals.state.revealedNoise.some(candidate => candidate.id === noise.id)) {
      return Object.freeze({ state: freezeState(reveals.state), events: Object.freeze(events) });
    }
    const finished = finishNoiseActivation(reveals.state, noise.id);
    return Object.freeze({
      state: finished.state,
      events: Object.freeze([...events, ...finished.events]),
    });
  }

  let from = noise.position;
  let revealed = false;
  const events: GameEvent[] = [];
  for (const step of path.steps) {
    events.push(
      Object.freeze({
        type: 'noise-moved' as const,
        noiseId: noise.id,
        from: freezePosition(from),
        to: freezePosition(step),
      })
    );
    from = step;
    if (isNoiseVisibleAt(state, mission, step)) {
      revealed = true;
      break;
    }
  }
  if (!revealed) {
    const movedState = {
      ...state,
      concealedNoise: state.concealedNoise.map(candidate =>
        candidate.id === noise.id ? { ...candidate, position: from } : candidate
      ),
    };
    const finished = finishNoiseActivation(movedState, noise.id);
    return Object.freeze({
      state: finished.state,
      events: Object.freeze([...events, ...finished.events]),
    });
  }

  events.push(
    Object.freeze({
      type: 'noise-revealed' as const,
      resultId: noise.resultId,
      position: freezePosition(from),
    })
  );
  const revealedState: GameState = {
    ...state,
    concealedNoise: state.concealedNoise.filter(candidate => candidate.id !== noise.id),
    revealedNoise:
      noise.resultId === 'nothing'
        ? state.revealedNoise
        : [...state.revealedNoise, revealNoiseState({ ...noise, position: from }, mission)],
  };
  if (noise.resultId === 'nothing') {
    const finished = finishNoiseActivation(revealedState, noise.id);
    return Object.freeze({
      state: finished.state,
      events: Object.freeze([...events, ...finished.events]),
    });
  }
  return Object.freeze({ state: freezeState(revealedState), events: Object.freeze(events) });
};

const completeReinforcement = (
  state: GameState
): { readonly state: GameState; readonly events: readonly GameEvent[] } => {
  const round = state.round + 1;
  const command = 2;
  return {
    state: {
      ...state,
      phase: 'hero',
      round,
      command,
      pendingNoise: null,
      activatedHeroIds: [],
      skavenTurnStep: null,
      skavenActivationIds: [],
      activatedSkavenIds: [],
      activeSkavenId: null,
      skavenActionsRemaining: null,
      skavenMovementRemaining: null,
      pendingReact: null,
      noiseActivationIds: [],
      activatedNoiseIds: [],
      activeNoiseId: null,
      noiseActionIds: [],
      reinforcementDrawsResolved: 0,
    },
    events: Object.freeze([
      Object.freeze({ type: 'reinforcement-complete' as const }),
      Object.freeze({ type: 'hero-turn-started' as const, round, command }),
    ]),
  };
};

const drawReinforcementNoise = (
  state: GameState,
  mission: MissionDefinition,
  randomSource: RandomSource
): CommandResult => {
  if (state.phase !== 'skaven' || state.skavenTurnStep !== 'reinforce') {
    throw new RulesError('NOT_REINFORCEMENT_STEP', 'Reinforcement happens after Noise activation');
  }
  if (state.pendingNoise || state.revealedNoise.length > 0) {
    throw new RulesError('NOISE_ALREADY_DRAWN', 'Resolve the current reinforcement first');
  }
  if (state.reinforcementDrawsResolved >= mission.noisePerTurn) {
    throw new RulesError('REINFORCEMENT_COMPLETE', 'All reinforcement draws are resolved');
  }
  if (state.remainingNoiseBag.length === 0) {
    const nextState = {
      ...state,
      reinforcementDrawsResolved: state.reinforcementDrawsResolved + 1,
    };
    if (nextState.reinforcementDrawsResolved >= mission.noisePerTurn) {
      const completed = completeReinforcement(nextState);
      return Object.freeze({
        state: freezeState(completed.state),
        events: Object.freeze([
          Object.freeze({ type: 'noise-draw-consumed' as const }),
          ...completed.events,
        ]),
      });
    }
    return Object.freeze({
      state: freezeState(nextState),
      events: Object.freeze([Object.freeze({ type: 'noise-draw-consumed' as const })]),
    });
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
    const nextState = {
      ...state,
      remainingNoiseBag,
      reinforcementDrawsResolved: state.reinforcementDrawsResolved + 1,
    };
    if (nextState.reinforcementDrawsResolved >= mission.noisePerTurn) {
      const completed = completeReinforcement(nextState);
      return Object.freeze({
        state: freezeState(completed.state),
        events: Object.freeze([
          Object.freeze({ type: 'noise-draw-consumed' as const }),
          ...completed.events,
        ]),
      });
    }
    return Object.freeze({
      state: freezeState(nextState),
      events: Object.freeze([Object.freeze({ type: 'noise-draw-consumed' as const })]),
    });
  }
  return Object.freeze({
    state: freezeState({
      ...state,
      remainingNoiseBag,
      pendingNoise: { id: `noise-${String(state.nextNoiseSequence)}`, resultId },
      nextNoiseSequence: state.nextNoiseSequence + 1,
    }),
    events: Object.freeze([Object.freeze({ type: 'noise-drawn' as const })]),
  });
};

const placeReinforcementNoise = (
  state: GameState,
  command: Extract<GameCommand, { type: 'place-reinforcement-noise' }>,
  mission: MissionDefinition
): CommandResult => {
  if (state.phase !== 'skaven' || state.skavenTurnStep !== 'reinforce') {
    throw new RulesError('NOT_REINFORCEMENT_STEP', 'Reinforcement happens after Noise activation');
  }
  if (!state.pendingNoise) throw new RulesError('NO_NOISE_DRAWN', 'Draw reinforcement first');
  if (!mission.board.spawns.some(spawn => samePosition(spawn, command.position))) {
    throw new RulesError('INVALID_NOISE_SPAWN', 'Place reinforcement on a Skaven spawn');
  }
  if (
    !getLegalNoiseSpawnPositions(state, mission).some(spawn =>
      samePosition(spawn, command.position)
    )
  ) {
    throw new RulesError('NOISE_SPAWN_OCCUPIED', 'Choose an empty Skaven spawn');
  }
  const noise = freezeNoise({ ...state.pendingNoise, position: command.position });
  const revealed = isNoiseVisibleAt(state, mission, command.position);
  const reinforcementDrawsResolved = state.reinforcementDrawsResolved + 1;
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
  const nextState: GameState = {
    ...state,
    pendingNoise: null,
    reinforcementDrawsResolved,
    concealedNoise: revealed ? state.concealedNoise : [...state.concealedNoise, noise],
    revealedNoise:
      revealed && noise.resultId !== 'nothing'
        ? [...state.revealedNoise, revealNoiseState(noise, mission)]
        : state.revealedNoise,
  };
  if (reinforcementDrawsResolved >= mission.noisePerTurn && nextState.revealedNoise.length === 0) {
    const completed = completeReinforcement(nextState);
    return Object.freeze({
      state: freezeState(completed.state),
      events: Object.freeze([...events, ...completed.events]),
    });
  }
  return Object.freeze({ state: freezeState(nextState), events: Object.freeze(events) });
};

const freezeEvent = (event: GameEvent): GameEvent => {
  const clone = structuredClone(event);
  const freeze = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  };
  freeze(clone);
  return clone;
};

const commandResult = (state: GameState, events: readonly GameEvent[]): CommandResult =>
  Object.freeze({
    state: freezeState(state),
    events: Object.freeze(events.map(event => freezeEvent(event))),
  });

const guardHero = (
  state: GameState,
  command: Extract<GameCommand, { type: 'guard-hero' }>
): CommandResult => {
  const hero = getActiveHero(state, command.heroId);
  assertActionAvailable(state);
  const placed = {
    ...state,
    guards: [...state.guards.filter(id => id !== hero.id), hero.id],
    actionsRemaining: 0,
  };
  const ended = endHeroActivation(placed, {
    type: 'end-hero-activation',
    heroId: hero.id,
    confirmed: true,
  });
  return commandResult(ended.state, [
    { type: 'action-spent', heroId: hero.id, action: 'guard', actionsRemaining: 0 },
    { type: 'guard-placed', heroId: hero.id },
    ...ended.events,
  ]);
};

const wardHero = (
  state: GameState,
  command: Extract<GameCommand, { type: 'ward-hero' | 'react-ward-hero' }>
): CommandResult => {
  const reacting = command.type === 'react-ward-hero';
  const hero = reacting
    ? getReactingHero(state, command.heroId)
    : getActiveHero(state, command.heroId);
  if (!reacting) assertActionAvailable(state);
  if (hero.definitionId !== 'maximilian')
    throw new RulesError('ABILITY_NOT_AVAILABLE', 'Only Maximilian can place a Ward');
  const target = state.heroes.find(candidate => candidate.id === command.targetHeroId);
  if (
    !target ||
    !isHeroEligible(state, target) ||
    !hero.position ||
    !target.position ||
    distance(hero.position, target.position) > 3
  ) {
    throw new RulesError('INVALID_WARD_TARGET', 'Choose a living hero within 3 squares');
  }
  if (state.wards.includes(target.id))
    throw new RulesError('WARD_ALREADY_PRESENT', 'This hero already has a Ward');
  if (reacting)
    return finishReact(
      { ...state, wards: [...state.wards, target.id], command: state.command - 2 },
      [
        { type: 'ward-placed', heroId: target.id },
        {
          type: 'hero-reacted',
          heroId: hero.id,
          action: 'ward',
          commandRemaining: state.command - 2,
        },
      ]
    );
  const actionsRemaining = state.actionsRemaining! - 1;
  return commandResult({ ...state, wards: [...state.wards, target.id], actionsRemaining }, [
    { type: 'action-spent', heroId: hero.id, action: 'ward', actionsRemaining },
    { type: 'ward-placed', heroId: target.id },
  ]);
};

const beginCombat = (
  state: GameState,
  hero: HeroState,
  skaven: SkavenState,
  source: PendingCombat['source'],
  randomSource: RandomSource
): CommandResult => {
  const { heroDice, skavenDice } = getFightDice(state, hero, skaven, source === 'skaven');
  const roll = resolveOpposedRoll(heroDice, skavenDice, randomSource);
  const pendingCombat: PendingCombat = {
    ...roll,
    heroId: hero.id,
    skavenId: skaven.id,
    skavenDefinitionId: skaven.definitionId,
    source,
    stage: 'rerolls',
    rerolledDice: [],
  };
  const nextState = { ...state, pendingCombat };
  if (hasRerollChoice(nextState, pendingCombat)) {
    return commandResult(nextState, [
      { type: 'fight-choice-opened', heroId: hero.id, stage: 'rerolls' },
    ]);
  }
  return acceptFightRolls(nextState, randomSource);
};

const hasRerollChoice = (state: GameState, combat: PendingCombat): boolean =>
  combat.outcome !== 'hero-won' &&
  combat.heroRolls.some((_, index) => !combat.rerolledDice.includes(index)) &&
  getRerollAbilities(state, combat.heroId).length > 0;

const requireCombat = (state: GameState, stage: PendingCombat['stage']): PendingCombat => {
  if (!state.pendingCombat) throw new RulesError('NO_PENDING_COMBAT', 'There is no pending Fight');
  if (state.pendingCombat.stage !== stage)
    throw new RulesError(
      'COMBAT_CHOICE_REQUIRED',
      `Resolve the ${state.pendingCombat.stage} choice first`
    );
  return state.pendingCombat;
};

const rerollFightDie = (
  state: GameState,
  command: Extract<GameCommand, { type: 'reroll-fight-die' }>,
  randomSource: RandomSource
): CommandResult => {
  const combat = requireCombat(state, 'rerolls');
  const index = command.dieIndex;
  if (
    !hasRerollChoice(state, combat) ||
    !getRerollAbilities(state, combat.heroId).includes(command.ability) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= combat.heroRolls.length ||
    combat.rerolledDice.includes(index)
  ) {
    throw new RulesError(
      'INVALID_REROLL',
      'Choose an available ability and a Fight die that has not been rerolled'
    );
  }
  const value = rollDice(1, randomSource)[0]!;
  const heroRolls = combat.heroRolls.map((die, dieIndex) => (dieIndex === index ? value : die));
  const abilityUsage = {
    ...state.abilityUsage,
    [command.ability === 'karaghul' ? 'karaghulRound' : 'remembererRound']: state.round,
  };
  const pendingCombat: PendingCombat = {
    ...combat,
    heroRolls,
    outcome: fightOutcome(heroRolls, combat.skavenRolls),
    rerolledDice: [...combat.rerolledDice, index],
    rerolls: [
      ...(combat.rerolls ?? []),
      {
        ability: command.ability,
        dieIndices: [index],
        previousRolls: [combat.heroRolls[index]!],
        rolls: [value],
      },
    ],
  };
  const nextState = { ...state, abilityUsage, pendingCombat };
  const event: GameEvent = {
    type: 'fight-dice-rerolled',
    heroId: combat.heroId,
    ability: command.ability,
    dieIndices: [index],
    rolls: [value],
  };
  if (hasRerollChoice(nextState, pendingCombat)) return commandResult(nextState, [event]);
  const finished = acceptFightRolls(nextState, randomSource);
  return commandResult(finished.state, [event, ...finished.events]);
};

const acceptFightRolls = (state: GameState, randomSource: RandomSource): CommandResult => {
  const combat = requireCombat(state, 'rerolls');
  if (combat.outcome === 'skaven-won' && state.wards.includes(combat.heroId)) {
    return commandResult({ ...state, pendingCombat: { ...combat, stage: 'ward' } }, [
      { type: 'fight-choice-opened', heroId: combat.heroId, stage: 'ward' },
    ]);
  }
  return finishCombat(state, randomSource);
};

const resolveWard = (state: GameState, randomSource: RandomSource): CommandResult => {
  const combat = requireCombat(state, 'ward');
  const indices = combat.heroRolls.flatMap((_, index) =>
    combat.rerolledDice.includes(index) ? [] : [index]
  );
  const values = indices.length > 0 ? rollDice(indices.length, randomSource) : [];
  const heroRolls = [...combat.heroRolls];
  indices.forEach((index, valueIndex) => {
    heroRolls[index] = values[valueIndex]!;
  });
  const nextState: GameState = {
    ...state,
    wards: state.wards.filter(id => id !== combat.heroId),
    pendingCombat: {
      ...combat,
      heroRolls,
      outcome: fightOutcome(heroRolls, combat.skavenRolls),
      rerolledDice: [...combat.rerolledDice, ...indices],
      rerolls: [
        ...(combat.rerolls ?? []),
        {
          ability: 'ward',
          dieIndices: indices,
          previousRolls: indices.map(index => combat.heroRolls[index]!),
          rolls: values,
        },
      ],
    },
  };
  const finished = finishCombat(nextState, randomSource);
  return commandResult(finished.state, [
    { type: 'ward-consumed', heroId: combat.heroId },
    {
      type: 'fight-dice-rerolled',
      heroId: combat.heroId,
      ability: 'ward',
      dieIndices: indices,
      rolls: values,
    },
    ...finished.events,
  ]);
};

const finishCombat = (state: GameState, randomSource: RandomSource): CommandResult => {
  const combat = state.pendingCombat;
  if (!combat) throw new RulesError('NO_PENDING_COMBAT', 'There is no Fight to finish');
  const hero = state.heroes.find(candidate => candidate.id === combat.heroId)!;
  const skaven = state.skaven.find(candidate => candidate.id === combat.skavenId)!;
  let result: CombatResult = {
    ...(combat.rerolls ? { rerolls: combat.rerolls } : {}),
    heroId: hero.id,
    skavenId: skaven.id,
    skavenDefinitionId: skaven.definitionId,
    heroRolls: combat.heroRolls,
    skavenRolls: combat.skavenRolls,
    outcome: combat.outcome,
  };
  const events: GameEvent[] = [{ type: 'fight-rolled', ...result }];
  let next: GameState = { ...state, pendingCombat: null, combatLog: [...state.combatLog, result] };
  let heroDefeated = false;
  let skavenDefeated = false;
  if (combat.outcome !== 'tie') {
    const heroLoses = combat.outcome === 'skaven-won';
    const damage = heroLoses && skaven.definitionId === 'rat-ogor' ? 2 : 1;
    let woundsRemaining = Math.max(
      0,
      (heroLoses ? hero.woundsRemaining : skaven.woundsRemaining) - damage
    );
    if (
      heroLoses &&
      woundsRemaining === 0 &&
      hero.definitionId === 'snorri' &&
      !state.abilityUsage.snorriSaved
    ) {
      woundsRemaining = 1;
      next = { ...next, abilityUsage: { ...next.abilityUsage, snorriSaved: true } };
      events.push({ type: 'snorri-saved', heroId: hero.id });
    }
    const woundsInflicted =
      next.abilityUsage.snorriSaved !== state.abilityUsage.snorriSaved
        ? hero.woundsRemaining - woundsRemaining
        : damage;
    if (woundsInflicted !== 1) result = { ...result, woundsInflicted };
    const modelId = heroLoses ? hero.id : skaven.id;
    const faction = heroLoses ? 'hero' : 'skaven';
    events.push({ type: 'model-wounded', modelId, faction, woundsRemaining });
    if (heroLoses) {
      heroDefeated = woundsRemaining === 0;
      next = {
        ...next,
        heroes: next.heroes.map(candidate =>
          candidate.id === hero.id
            ? { ...candidate, woundsRemaining, position: heroDefeated ? null : candidate.position }
            : candidate
        ),
      };
      if (heroDefeated)
        next = {
          ...next,
          guards: next.guards.filter(id => id !== hero.id),
          wards: next.wards.filter(id => id !== hero.id),
        };
    } else {
      skavenDefeated = woundsRemaining === 0;
      next = {
        ...next,
        skaven: skavenDefeated
          ? next.skaven.filter(candidate => candidate.id !== skaven.id)
          : next.skaven.map(candidate =>
              candidate.id === skaven.id ? { ...candidate, woundsRemaining } : candidate
            ),
      };
    }
    if (woundsRemaining === 0) events.push({ type: 'model-defeated', modelId, faction });
  }
  events[0] = { type: 'fight-rolled', ...result };
  next = { ...next, combatLog: [...state.combatLog, result] };
  if (combat.source === 'hero') {
    if (heroDefeated) {
      next = {
        ...next,
        activeHeroId: null,
        actionsRemaining: null,
        movementRemaining: null,
        facingChangeAvailable: false,
        dashUsed: false,
        pushUsed: false,
        activatedHeroIds: [...next.activatedHeroIds, hero.id],
      };
      events.push({ type: 'hero-activation-ended', heroId: hero.id });
    } else {
      const actionsRemaining = next.actionsRemaining! - 1;
      next = { ...next, actionsRemaining };
      events.push({ type: 'action-spent', heroId: hero.id, action: 'fight', actionsRemaining });
    }
  } else if (combat.source === 'skaven') {
    next = { ...next, skavenActionsRemaining: 0 };
    events.push({
      type: 'skaven-action-spent',
      skavenId: skaven.id,
      action: 'fight',
      actionsRemaining: 0,
    });
    if (skavenDefeated) {
      const finished = finishSkavenActivation(next, skaven.id);
      next = finished.state;
      events.push(...finished.events);
    }
  } else if (combat.source === 'react') {
    next = { ...next, command: next.command - 2 };
    events.push({
      type: 'hero-reacted',
      heroId: hero.id,
      action: 'fight',
      commandRemaining: next.command,
    });
    return finishReact(next, events);
  } else if (combat.source === 'guard') {
    if (skavenDefeated && next.pendingSkavenMovement) {
      next = { ...next, pendingSkavenMovement: null };
      const finished = finishSkavenActivation(next, skaven.id);
      return commandResult(finished.state, [...events, ...finished.events]);
    }
    const anotherGuard = skavenDefeated ? null : triggerGuard(next, skaven.id, randomSource);
    if (anotherGuard) return commandResult(anotherGuard.state, [...events, ...anotherGuard.events]);
    if (next.pendingSkavenMovement) {
      const resumed = continueSkavenMovement(
        next,
        getMissionDefinition(next.missionId),
        randomSource
      );
      return commandResult(resumed.state, [...events, ...resumed.events]);
    }
    const placed = finishGuardPlacement(next, skaven.sourceNoiseId);
    return commandResult(placed.state, [...events, ...placed.events]);
  }
  return commandResult(next, events);
};

const finishGuardPlacement = (state: GameState, noiseId: string): CommandResult => {
  if (state.revealedNoise.some(noise => noise.id === noiseId)) return commandResult(state, []);
  if (
    state.skavenTurnStep === 'reinforce' &&
    state.revealedNoise.length === 0 &&
    state.reinforcementDrawsResolved >= getMissionDefinition(state.missionId).noisePerTurn
  ) {
    const completed = completeReinforcement(state);
    return commandResult(completed.state, completed.events);
  }
  if (state.skavenTurnStep === 'activate-noise' && state.activeNoiseId === noiseId) {
    if (state.command >= 2)
      return commandResult({ ...state, pendingReact: { source: 'noise', sourceId: noiseId } }, [
        { type: 'react-window-opened', source: 'noise' },
      ]);
    if (
      state.activatedNoiseIds.includes(noiseId) ||
      state.noiseActionIds.every(id => !state.skaven.some(skaven => skaven.id === id))
    )
      return finishNoiseActivation(state, noiseId);
  }
  return commandResult(state, []);
};

const triggerGuard = (
  state: GameState,
  skavenId: string,
  randomSource: RandomSource
): CommandResult | null => {
  const skaven = state.skaven.find(candidate => candidate.id === skavenId);
  if (!skaven) return null;
  // Simultaneous Guards resolve in the selected roster order, independent of placement order.
  const hero = state.heroes.find(
    candidate =>
      state.guards.includes(candidate.id) &&
      isHeroEligible(state, candidate) &&
      inFrontArc(candidate, skaven.position)
  );
  if (!hero) return null;
  const guarded = { ...state, guards: state.guards.filter(id => id !== hero.id) };
  const fought = beginCombat(guarded, hero, skaven, 'guard', randomSource);
  return commandResult(fought.state, [
    { type: 'guard-triggered', heroId: hero.id },
    ...fought.events,
  ]);
};

const continueSkavenMovement = (
  state: GameState,
  mission: MissionDefinition,
  randomSource: RandomSource
): CommandResult => {
  const movement = state.pendingSkavenMovement;
  if (!movement) throw new Error('A movement continuation requires a submitted path');
  const skaven = state.skaven.find(candidate => candidate.id === movement.skavenId);
  if (!skaven) throw new Error('The moving Skaven must exist');
  let next: GameState = state;
  const events: GameEvent[] = [];
  let from = skaven.position;
  for (let index = 0; index < movement.remainingPath.length; index++) {
    const to = movement.remainingPath[index]!;
    next = {
      ...next,
      skaven: next.skaven.map(candidate =>
        candidate.id === skaven.id ? { ...candidate, position: to } : candidate
      ),
      pendingSkavenMovement: {
        ...movement,
        remainingPath: movement.remainingPath.slice(index + 1),
        spacesMoved: movement.spacesMoved + index + 1,
      },
    };
    events.push({ type: 'skaven-moved', skavenId: skaven.id, from, to });
    const guarded = triggerGuard(next, skaven.id, randomSource);
    if (guarded) return commandResult(guarded.state, [...events, ...guarded.events]);
    from = to;
  }
  if (skaven.facing !== movement.facing)
    events.push({ type: 'skaven-facing-changed', skavenId: skaven.id, facing: movement.facing });
  events.push({
    type: 'skaven-movement-completed',
    skavenId: skaven.id,
    spaces: movement.spacesMoved + movement.remainingPath.length,
  });
  const pendingReact: ReactWindow | null =
    next.command >= 2 ? { source: 'skaven', sourceId: skaven.id } : null;
  if (pendingReact) events.push({ type: 'react-window-opened', source: 'skaven' });
  return commandResult(
    {
      ...next,
      skaven: next.skaven.map(candidate =>
        candidate.id === skaven.id ? { ...candidate, facing: movement.facing } : candidate
      ),
      pendingSkavenMovement: null,
      skavenMovementRemaining: 0,
      pendingReact,
    },
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
  if (
    state.pendingCombat &&
    !['reroll-fight-die', 'accept-fight-rolls', 'resolve-ward'].includes(command.type)
  ) {
    throw new RulesError('COMBAT_CHOICE_REQUIRED', 'Resolve the pending Fight before continuing');
  }
  switch (command.type) {
    case 'guard-hero':
      return guardHero(state, command);
    case 'ward-hero':
    case 'react-ward-hero':
      return wardHero(state, command);
    case 'reroll-fight-die':
      return rerollFightDie(state, command, randomSource);
    case 'accept-fight-rolls':
      return acceptFightRolls(state, randomSource);
    case 'resolve-ward':
      return resolveWard(state, randomSource);
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
      return placeRevealedSkaven(state, command, mission, randomSource);
    case 'fight-skaven':
      return fightSkaven(state, command, randomSource);
    case 'end-hero-activation':
      return endHeroActivation(state, command);
    case 'end-hero-phase':
      return endHeroPhase(state, command);
    case 'start-skaven-activation':
      return startSkavenActivation(state, command);
    case 'move-skaven':
      return moveSkaven(state, command, mission, randomSource);
    case 'fight-hero':
      return fightHero(state, command, randomSource);
    case 'interact-door-skaven':
      return interactDoorSkaven(state, command, mission);
    case 'end-skaven-activation':
      return endSkavenActivation(state, command);
    case 'skip-react':
      return skipReact(state);
    case 'react-fight-skaven':
      return reactFightSkaven(state, command, randomSource);
    case 'react-interact-door':
      return reactInteractDoor(state, command, mission);
    case 'start-noise-activation':
      return startNoiseActivation(state, command);
    case 'move-noise':
      return moveNoise(state, command, mission);
    case 'draw-reinforcement-noise':
      return drawReinforcementNoise(state, mission, randomSource);
    case 'place-reinforcement-noise':
      return placeReinforcementNoise(state, command, mission);
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
      pendingReact: state.pendingReact ? Object.freeze({ ...state.pendingReact }) : null,
      noiseActivationIds: Object.freeze([...state.noiseActivationIds]),
      activatedNoiseIds: Object.freeze([...state.activatedNoiseIds]),
      activeNoiseId: state.activeNoiseId,
      noiseActionIds: Object.freeze([...state.noiseActionIds]),
      reinforcementDrawsResolved: state.reinforcementDrawsResolved,
      reinforcementDrawCount: mission.noisePerTurn,
      legalSkavenMovePaths: getLegalSkavenMovePaths(state, mission),
      legalSkavenDoorInteractions: getLegalSkavenDoorInteractions(state, mission),
      legalSkavenFightTargetIds: getLegalSkavenFightTargetIds(state),
      legalNoiseMovePaths: getLegalNoiseMovePaths(state, mission),
      legalReactFightOptions: getLegalReactFightOptions(state),
      legalReactDoorOptions: getLegalReactDoorOptions(state, mission),
      legalMovePaths: getLegalHeroMovePaths(state, mission),
      legalDoorInteractions: getLegalDoorInteractions(state, mission),
      legalFightTargetIds: getLegalFightTargetIds(state),
      combatLog: Object.freeze(state.combatLog.map(freezeCombatResult)),
      guards: Object.freeze([...state.guards]),
      wards: Object.freeze([...state.wards]),
      abilityUsage: Object.freeze({ ...state.abilityUsage }),
      pendingCombat: state.pendingCombat
        ? (Object.freeze({
            ...freezeCombatResult(state.pendingCombat),
            rerolledDice: Object.freeze([...state.pendingCombat.rerolledDice]),
          }) as PendingCombat)
        : null,
      pendingSkavenMovement: state.pendingSkavenMovement
        ? Object.freeze({
            ...state.pendingSkavenMovement,
            remainingPath: Object.freeze(
              state.pendingSkavenMovement.remainingPath.map(freezePosition)
            ),
          })
        : null,
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
