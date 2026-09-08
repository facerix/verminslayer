import type { ParsedMap, Position } from '/src/game/map.js';

const freezePosition = (row: number, column: number): Position => Object.freeze({ row, column });

const positionKey = (position: Position) => `${String(position.row)},${String(position.column)}`;

/**
 * Trace a ray between square centers, including both orthogonal squares touched whenever
 * the ray crosses a grid corner.
 */
export const traceSupercoverLine = (from: Position, to: Position): readonly Position[] => {
  const deltaColumn = to.column - from.column;
  const deltaRow = to.row - from.row;
  const columnSteps = Math.abs(deltaColumn);
  const rowSteps = Math.abs(deltaRow);
  const columnDirection = Math.sign(deltaColumn);
  const rowDirection = Math.sign(deltaRow);
  const positions: Position[] = [freezePosition(from.row, from.column)];
  let column = from.column;
  let row = from.row;
  let columnsCrossed = 0;
  let rowsCrossed = 0;

  while (columnsCrossed < columnSteps || rowsCrossed < rowSteps) {
    const decision = (1 + 2 * columnsCrossed) * rowSteps - (1 + 2 * rowsCrossed) * columnSteps;

    if (decision === 0) {
      positions.push(freezePosition(row, column + columnDirection));
      positions.push(freezePosition(row + rowDirection, column));
      column += columnDirection;
      row += rowDirection;
      columnsCrossed++;
      rowsCrossed++;
      positions.push(freezePosition(row, column));
    } else if (decision < 0) {
      column += columnDirection;
      columnsCrossed++;
      positions.push(freezePosition(row, column));
    } else {
      row += rowDirection;
      rowsCrossed++;
      positions.push(freezePosition(row, column));
    }
  }

  const uniquePositions = positions.filter(
    (position, index) =>
      positions.findIndex(candidate => positionKey(candidate) === positionKey(position)) === index
  );
  return Object.freeze(uniquePositions);
};

export const hasLineOfSight = (
  board: ParsedMap,
  from: Position,
  to: Position,
  closedDoors: readonly Position[] = board.doors
): boolean => {
  const closedDoorKeys = new Set(closedDoors.map(positionKey));
  const blockingKinds = new Set(['wall', 'rubble', 'exit']);

  return traceSupercoverLine(from, to)
    .slice(1)
    .every(position => {
      const tile = board.tiles[position.row]?.[position.column];
      if (!tile) return false;
      if (blockingKinds.has(tile.kind)) return false;
      return tile.kind !== 'door' || !closedDoorKeys.has(positionKey(position));
    });
};
