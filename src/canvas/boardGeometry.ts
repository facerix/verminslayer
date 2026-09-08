import type { Position } from '/src/game/map.js';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface BoardGeometry {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly squareSize: number;
  readonly columns: number;
  readonly rows: number;
}

export const calculateBoardGeometry = (
  viewportWidth: number,
  viewportHeight: number,
  columns: number,
  rows: number
): BoardGeometry => {
  if (
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    !Number.isInteger(columns) ||
    !Number.isInteger(rows) ||
    columns <= 0 ||
    rows <= 0
  ) {
    throw new RangeError('Board and viewport dimensions must be positive');
  }

  const squareSize = Math.min(viewportWidth / columns, viewportHeight / rows);
  const width = squareSize * columns;
  const height = squareSize * rows;

  return Object.freeze({
    x: (viewportWidth - width) / 2,
    y: (viewportHeight - height) / 2,
    width,
    height,
    squareSize,
    columns,
    rows,
  });
};

export const pointToSquare = (point: Point, geometry: BoardGeometry): Position | null => {
  if (
    point.x < geometry.x ||
    point.y < geometry.y ||
    point.x >= geometry.x + geometry.width ||
    point.y >= geometry.y + geometry.height
  ) {
    return null;
  }

  return Object.freeze({
    row: Math.floor((point.y - geometry.y) / geometry.squareSize),
    column: Math.floor((point.x - geometry.x) / geometry.squareSize),
  });
};
