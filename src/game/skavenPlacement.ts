import { getReachablePaths } from '/src/game/pathfinding.js';
import type { MovementContext } from '/src/game/pathfinding.js';
import type { Position } from '/src/game/map.js';

interface SkavenPlacementContext extends MovementContext {
  readonly unavailableDestinations: readonly Position[];
}

const samePosition = (left: Position, right: Position) =>
  left.row === right.row && left.column === right.column;

export const getNearestReachablePositions = (
  context: SkavenPlacementContext
): readonly Position[] => {
  const reachable = getReachablePaths(context).filter(
    path =>
      !context.unavailableDestinations.some(position => samePosition(position, path.destination))
  );
  const nearestDistance = reachable[0]?.steps.length;
  if (nearestDistance === undefined) return Object.freeze([]);
  return Object.freeze(
    reachable
      .filter(path => path.steps.length === nearestDistance)
      .map(path => Object.freeze({ ...path.destination }))
  );
};
