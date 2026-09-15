import type { ParsedMap, Position } from '/src/game/map.js';

export interface MovementContext {
  readonly board: ParsedMap;
  readonly start: Position;
  readonly maximumSteps: number;
  readonly closedDoors: readonly Position[];
  readonly blockedPositions: readonly Position[];
  readonly exitOpen: boolean;
}

export interface ReachablePath {
  readonly destination: Position;
  readonly steps: readonly Position[];
}

const freezePosition = (position: Position): Position =>
  Object.freeze({ row: position.row, column: position.column });

const positionKey = (position: Position) => `${String(position.row)},${String(position.column)}`;

const isOrthogonallyAdjacent = (left: Position, right: Position) =>
  Math.abs(left.row - right.row) + Math.abs(left.column - right.column) === 1;

const isPassable = (context: MovementContext, position: Position): boolean => {
  const tile = context.board.tiles[position.row]?.[position.column];
  if (!tile) return false;
  if (context.blockedPositions.some(blocked => positionKey(blocked) === positionKey(position))) {
    return false;
  }
  if (tile.kind === 'wall' || tile.kind === 'rubble' || tile.kind === 'water') return false;
  if (tile.kind === 'exit') return context.exitOpen;
  if (tile.kind === 'door') {
    return !context.closedDoors.some(door => positionKey(door) === positionKey(position));
  }
  return true;
};

const NEIGHBOR_OFFSETS = Object.freeze([
  Object.freeze({ row: -1, column: 0 }),
  Object.freeze({ row: 0, column: 1 }),
  Object.freeze({ row: 1, column: 0 }),
  Object.freeze({ row: 0, column: -1 }),
]);

export const getReachablePaths = (context: MovementContext): readonly ReachablePath[] => {
  if (!Number.isInteger(context.maximumSteps) || context.maximumSteps < 0) {
    throw new RangeError('Maximum movement must be a non-negative integer');
  }

  const start = freezePosition(context.start);
  const paths: ReachablePath[] = [Object.freeze({ destination: start, steps: Object.freeze([]) })];
  const visited = new Set([positionKey(start)]);
  const queue: { readonly position: Position; readonly steps: readonly Position[] }[] = [
    { position: start, steps: Object.freeze([]) },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.steps.length >= context.maximumSteps) continue;

    for (const offset of NEIGHBOR_OFFSETS) {
      const next = freezePosition({
        row: current.position.row + offset.row,
        column: current.position.column + offset.column,
      });
      const key = positionKey(next);
      if (visited.has(key) || !isPassable(context, next)) continue;

      const steps = Object.freeze([...current.steps, next]);
      visited.add(key);
      queue.push({ position: next, steps });
      paths.push(Object.freeze({ destination: next, steps }));
    }
  }

  return Object.freeze(paths);
};

export const isLegalMovementPath = (
  context: MovementContext,
  steps: readonly Position[]
): boolean => {
  if (steps.length > context.maximumSteps) return false;
  let current = context.start;
  for (const step of steps) {
    if (!isOrthogonallyAdjacent(current, step) || !isPassable(context, step)) return false;
    current = step;
  }
  return true;
};

/**
 * Returns every shortest-route advance toward the nearest reachable goal. Paths stop at
 * the goal or after the movement allowance, whichever comes first.
 */
export const getShortestAdvancePaths = (
  context: MovementContext,
  goals: readonly Position[]
): readonly ReachablePath[] => {
  if (!Number.isInteger(context.maximumSteps) || context.maximumSteps < 0) {
    throw new RangeError('Maximum movement must be a non-negative integer');
  }

  const goalKeys = new Set(goals.map(positionKey));
  const distances = new Map<string, number>();
  const queue: Position[] = [];
  for (const goal of goals) {
    if (!isPassable(context, goal)) continue;
    const key = positionKey(goal);
    if (distances.has(key)) continue;
    distances.set(key, 0);
    queue.push(freezePosition(goal));
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const distance = distances.get(positionKey(current))!;
    for (const offset of NEIGHBOR_OFFSETS) {
      const next = freezePosition({
        row: current.row + offset.row,
        column: current.column + offset.column,
      });
      const key = positionKey(next);
      if (
        distances.has(key) ||
        (!isPassable(context, next) && key !== positionKey(context.start))
      ) {
        continue;
      }
      distances.set(key, distance + 1);
      queue.push(next);
    }
  }

  const startDistance = distances.get(positionKey(context.start));
  if (startDistance === undefined) return Object.freeze([]);
  if (startDistance === 0 || context.maximumSteps === 0) {
    return Object.freeze([
      Object.freeze({ destination: freezePosition(context.start), steps: Object.freeze([]) }),
    ]);
  }

  const paths: ReachablePath[] = [];
  const walk = (position: Position, steps: readonly Position[]) => {
    const distance = distances.get(positionKey(position));
    if (
      distance === undefined ||
      distance === 0 ||
      steps.length === context.maximumSteps ||
      goalKeys.has(positionKey(position))
    ) {
      paths.push(
        Object.freeze({
          destination: freezePosition(position),
          steps: Object.freeze([...steps]),
        })
      );
      return;
    }
    for (const offset of NEIGHBOR_OFFSETS) {
      const next = freezePosition({
        row: position.row + offset.row,
        column: position.column + offset.column,
      });
      if (distances.get(positionKey(next)) === distance - 1 && isPassable(context, next)) {
        walk(next, [...steps, next]);
      }
    }
  };
  walk(context.start, []);
  return Object.freeze(paths);
};
