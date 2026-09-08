import { calculateBoardGeometry } from '/src/canvas/boardGeometry.js';
import type { BoardGeometry } from '/src/canvas/boardGeometry.js';
import type { MapTile, ParsedMap } from '/src/game/map.js';

const TILE_COLORS = Object.freeze({
  floor: '#3b342d',
  wall: '#171310',
  door: '#9a6938',
  water: '#244854',
  rubble: '#6b6259',
  deployment: '#435d3c',
  spawn: '#612a2d',
  nest: '#70402f',
  exit: '#171310',
});

const drawMarker = (context: CanvasRenderingContext2D, tile: MapTile, geometry: BoardGeometry) => {
  const { squareSize } = geometry;
  const x = geometry.x + tile.column * squareSize;
  const y = geometry.y + tile.row * squareSize;
  const centerX = x + squareSize / 2;
  const centerY = y + squareSize / 2;

  context.save();
  context.translate(centerX, centerY);
  context.strokeStyle = '#eadfc9';
  context.fillStyle = '#eadfc9';
  context.lineWidth = Math.max(1.5, squareSize * 0.06);

  if (tile.kind === 'door') {
    context.beginPath();
    context.moveTo(-squareSize * 0.3, squareSize * 0.22);
    context.lineTo(squareSize * 0.3, -squareSize * 0.22);
    context.stroke();
  } else if (tile.kind === 'nest') {
    context.beginPath();
    context.arc(0, 0, squareSize * 0.26, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(0, 0, squareSize * 0.08, 0, Math.PI * 2);
    context.fill();
  } else if (tile.kind === 'spawn') {
    context.beginPath();
    context.moveTo(0, -squareSize * 0.28);
    context.lineTo(squareSize * 0.27, squareSize * 0.23);
    context.lineTo(-squareSize * 0.27, squareSize * 0.23);
    context.closePath();
    context.stroke();
  } else if (tile.kind === 'deployment') {
    context.beginPath();
    context.arc(0, 0, squareSize * 0.24, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(-squareSize * 0.12, 0);
    context.lineTo(squareSize * 0.12, 0);
    context.moveTo(0, -squareSize * 0.12);
    context.lineTo(0, squareSize * 0.12);
    context.stroke();
  } else if (tile.kind === 'exit') {
    context.strokeStyle = '#d9a849';
    context.strokeRect(
      -squareSize * 0.32,
      -squareSize * 0.32,
      squareSize * 0.64,
      squareSize * 0.64
    );
    context.beginPath();
    context.moveTo(-squareSize * 0.12, 0);
    context.lineTo(squareSize * 0.14, 0);
    context.lineTo(squareSize * 0.04, -squareSize * 0.1);
    context.moveTo(squareSize * 0.14, 0);
    context.lineTo(squareSize * 0.04, squareSize * 0.1);
    context.stroke();
  } else if (tile.kind === 'rubble') {
    context.fillStyle = '#2b2723';
    for (const [offsetX, offsetY] of [
      [-0.2, -0.13],
      [0.12, -0.08],
      [-0.05, 0.18],
    ] as const) {
      context.beginPath();
      context.arc(offsetX * squareSize, offsetY * squareSize, squareSize * 0.055, 0, Math.PI * 2);
      context.fill();
    }
  } else if (tile.kind === 'water') {
    context.strokeStyle = '#75a7b4';
    context.lineWidth = Math.max(1, squareSize * 0.035);
    for (const offset of [-0.13, 0.13]) {
      context.beginPath();
      context.moveTo(-squareSize * 0.27, offset * squareSize);
      context.quadraticCurveTo(
        0,
        (offset - 0.12) * squareSize,
        squareSize * 0.27,
        offset * squareSize
      );
      context.stroke();
    }
  }

  context.restore();
};

export const renderBoard = (
  context: CanvasRenderingContext2D,
  board: ParsedMap,
  viewportWidth: number,
  viewportHeight: number
): BoardGeometry => {
  const geometry = calculateBoardGeometry(viewportWidth, viewportHeight, board.width, board.height);

  context.clearRect(0, 0, viewportWidth, viewportHeight);
  context.fillStyle = '#221c18';
  context.fillRect(0, 0, viewportWidth, viewportHeight);

  for (const row of board.tiles) {
    for (const tile of row) {
      const x = geometry.x + tile.column * geometry.squareSize;
      const y = geometry.y + tile.row * geometry.squareSize;
      context.fillStyle = TILE_COLORS[tile.kind];
      context.fillRect(x, y, geometry.squareSize, geometry.squareSize);
      context.strokeStyle = tile.kind === 'wall' || tile.kind === 'exit' ? '#302a25' : '#554b42';
      context.lineWidth = 1;
      context.strokeRect(x + 0.5, y + 0.5, geometry.squareSize - 1, geometry.squareSize - 1);
      drawMarker(context, tile, geometry);
    }
  }

  return geometry;
};
