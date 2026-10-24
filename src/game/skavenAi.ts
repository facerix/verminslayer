import type { GameSession } from '/src/game/gameSession.js';
import type {
  Facing,
  GameCommand,
  GameEvent,
  HeroState,
  RandomSource,
} from '/src/game/gameState.js';
import type { Position } from '/src/game/map.js';
import type { ReachablePath } from '/src/game/pathfinding.js';
import { RulesError } from '/src/game/rulesError.js';

const isAdjacent = (left: Position, right: Position) =>
  Math.max(Math.abs(left.row - right.row), Math.abs(left.column - right.column)) === 1;

const chooseRandom = <T>(items: readonly T[], randomSource: RandomSource): T => {
  if (items.length === 0) throw new Error('The Skaven AI cannot choose from an empty list');
  const only = items[0];
  if (items.length === 1 && only !== undefined) return only;
  const randomValue = randomSource.next();
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new RulesError(
      'INVALID_RANDOM_VALUE',
      'Random values must be finite numbers from 0 up to 1'
    );
  }
  const choice = items[Math.floor(randomValue * items.length)];
  if (choice === undefined) throw new Error('The Skaven AI failed to choose a legal option');
  return choice;
};

const eligibleHeroes = (heroes: readonly HeroState[]) =>
  heroes.filter(hero => hero.position && hero.woundsRemaining > 0);

export const chooseSoloSkavenPlacement = (
  positions: readonly Position[],
  heroes: readonly HeroState[],
  randomSource: RandomSource
): Position => {
  const livingHeroes = eligibleHeroes(heroes);
  const scores = positions.map(position => ({
    position,
    score: livingHeroes.some(hero => hero.position && isAdjacent(position, hero.position)) ? 1 : 0,
  }));
  const highestScore = Math.max(...scores.map(candidate => candidate.score));
  return chooseRandom(
    scores
      .filter(candidate => candidate.score === highestScore)
      .map(candidate => candidate.position),
    randomSource
  );
};

export const chooseNearestReachableSkavenId = (
  skavenIds: readonly string[],
  distanceFor: (skavenId: string) => number,
  randomSource: RandomSource
): string => {
  const distances = skavenIds.map(id => ({ id, distance: distanceFor(id) }));
  const nearestDistance = Math.min(...distances.map(candidate => candidate.distance));
  return chooseRandom(
    distances
      .filter(candidate => candidate.distance === nearestDistance)
      .map(candidate => candidate.id),
    randomSource
  );
};

export const chooseFacingTowardNearestHero = (
  position: Position,
  heroes: readonly HeroState[]
): Facing => {
  let target: Position | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const hero of eligibleHeroes(heroes)) {
    const heroPosition = hero.position!;
    const distance = Math.max(
      Math.abs(heroPosition.row - position.row),
      Math.abs(heroPosition.column - position.column)
    );
    if (distance >= nearestDistance) continue;
    target = heroPosition;
    nearestDistance = distance;
  }
  if (!target) return 'north';

  const rowDelta = target.row - position.row;
  const columnDelta = target.column - position.column;
  if (Math.abs(rowDelta) >= Math.abs(columnDelta)) {
    return rowDelta >= 0 ? 'south' : 'north';
  }
  return columnDelta >= 0 ? 'east' : 'west';
};

export const chooseSoloSkavenMovementPath = (
  approachPaths: readonly ReachablePath[],
  legalPaths: readonly ReachablePath[],
  randomSource: RandomSource
): ReachablePath => {
  const choices =
    approachPaths.length > 0 ? approachPaths : legalPaths.filter(path => path.steps.length === 0);
  return chooseRandom(choices, randomSource);
};

const choosePlacementCommand = (
  session: GameSession,
  randomSource: RandomSource
): GameCommand | null => {
  const view = session.heroView;
  const noise = view.revealedNoise[0];
  if (!noise) return null;
  const position = chooseSoloSkavenPlacement(
    session.legalSkavenPlacementPositions(noise.id),
    view.heroes,
    randomSource
  );
  return {
    type: 'place-revealed-skaven',
    noiseId: noise.id,
    position,
    facing: chooseFacingTowardNearestHero(position, view.heroes),
  };
};

const chooseActiveSkavenCommand = (
  session: GameSession,
  randomSource: RandomSource
): GameCommand => {
  const view = session.heroView;
  const skavenId = view.activeSkavenId;
  if (!skavenId) throw new Error('The Skaven AI requires an active model');

  if ((view.skavenMovementRemaining ?? 0) > 0) {
    const path = chooseSoloSkavenMovementPath(
      session.skavenApproachPaths(skavenId),
      view.legalSkavenMovePaths,
      randomSource
    );
    return {
      type: 'move-skaven',
      skavenId,
      path: path.steps,
      facing: chooseFacingTowardNearestHero(path.destination, view.heroes),
    };
  }

  if (view.legalSkavenFightTargetIds.length > 0) {
    return {
      type: 'fight-hero',
      skavenId,
      heroId: chooseRandom(view.legalSkavenFightTargetIds, randomSource),
    };
  }

  const closedDoors = view.legalSkavenDoorInteractions.filter(position =>
    view.doors.some(
      door =>
        door.status === 'closed' &&
        door.position.row === position.row &&
        door.position.column === position.column
    )
  );
  if (closedDoors.length > 0) {
    return {
      type: 'interact-door-skaven',
      skavenId,
      position: chooseRandom(closedDoors, randomSource),
    };
  }

  return { type: 'end-skaven-activation', skavenId, confirmed: true };
};

const chooseActivationCommand = (
  session: GameSession,
  eligibleIds: readonly string[],
  randomSource: RandomSource
): GameCommand => {
  const view = session.heroView;
  const remainingIds = eligibleIds.filter(
    id => !view.activatedSkavenIds.includes(id) && view.skaven.some(skaven => skaven.id === id)
  );
  return {
    type: 'start-skaven-activation',
    skavenId: chooseNearestReachableSkavenId(
      remainingIds,
      id => session.skavenDistanceToNearestReachableHero(id),
      randomSource
    ),
  };
};

export const getNextSoloSkavenCommand = (
  session: GameSession,
  randomSource: RandomSource
): GameCommand | null => {
  const view = session.heroView;
  if (view.mode !== 'solo' || view.result || view.pendingCombat || view.pendingAbility) return null;

  const placement = choosePlacementCommand(session, randomSource);
  if (placement) return placement;
  if (view.phase !== 'skaven' || view.pendingReact) return null;
  if (view.activeSkavenId) return chooseActiveSkavenCommand(session, randomSource);

  if (view.skavenTurnStep === 'activate-skaven') {
    return chooseActivationCommand(session, view.skavenActivationIds, randomSource);
  }
  if (view.skavenTurnStep === 'activate-noise') {
    if (view.noiseActionIds.length > 0) {
      return chooseActivationCommand(session, view.noiseActionIds, randomSource);
    }
    if (view.activeNoiseId) {
      const path = chooseRandom(view.legalNoiseMovePaths, randomSource);
      return {
        type: 'move-noise',
        noiseId: view.activeNoiseId,
        path: path.steps,
        doorPosition: path.doorPosition,
      };
    }
    const remainingNoiseIds = view.noiseActivationIds.filter(
      id => !view.activatedNoiseIds.includes(id) && view.noiseTokens.some(noise => noise.id === id)
    );
    return {
      type: 'start-noise-activation',
      noiseId: chooseRandom(remainingNoiseIds, randomSource),
    };
  }
  if (view.skavenTurnStep === 'reinforce') {
    if (session.skavenView.pendingNoise) {
      return {
        type: 'place-reinforcement-noise',
        position: chooseRandom(session.legalNoiseSpawnPositions, randomSource),
      };
    }
    return { type: 'draw-reinforcement-noise' };
  }
  return null;
};

export const runSoloSkavenAi = (
  session: GameSession,
  randomSource: RandomSource
): readonly GameEvent[] => {
  const events: GameEvent[] = [];
  for (let commandCount = 0; commandCount < 10_000; commandCount++) {
    const command = getNextSoloSkavenCommand(session, randomSource);
    if (!command) return Object.freeze(events);
    events.push(...session.dispatch(command));
  }
  throw new Error('The Skaven AI exceeded its command safety limit');
};
