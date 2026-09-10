import { calculateBoardGeometry } from '/src/canvas/boardGeometry.js';
import type { BoardGeometry } from '/src/canvas/boardGeometry.js';
import type { MapTile, ParsedMap } from '/src/game/map.js';
import type { Facing } from '/src/game/gameState.js';
import type { Position } from '/src/game/map.js';

export interface BoardHeroPresentation {
  readonly label: string;
  readonly position: Position;
  readonly facing: Facing;
  readonly woundsRemaining: number;
  readonly activationStatus?: 'ready' | 'active' | 'activated';
}

export interface BoardNoisePresentation {
  readonly position: Position;
  readonly revealedLabel?: string;
  readonly accessibleLabel?: string;
}

export interface BoardDoorPresentation {
  readonly position: Position;
  readonly status: 'closed' | 'open' | 'destroyed';
}

export interface BoardPresentation {
  readonly heroes?: readonly BoardHeroPresentation[];
  readonly noiseTokens?: readonly BoardNoisePresentation[];
  readonly legalSquares?: readonly Position[];
  readonly selectedSquare?: Position | null;
  readonly doors?: readonly BoardDoorPresentation[];
}

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

const drawMarker = (
  context: CanvasRenderingContext2D,
  tile: MapTile,
  geometry: BoardGeometry,
  doorStatus: BoardDoorPresentation['status'] = 'closed'
) => {
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
    if (doorStatus === 'open' || doorStatus === 'destroyed') {
      context.moveTo(-squareSize * 0.3, -squareSize * 0.28);
      context.lineTo(squareSize * 0.3, -squareSize * 0.28);
    } else {
      context.moveTo(-squareSize * 0.3, squareSize * 0.22);
      context.lineTo(squareSize * 0.3, -squareSize * 0.22);
    }
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
  viewportHeight: number,
  presentation: BoardPresentation = {}
): BoardGeometry => {
  const geometry = calculateBoardGeometry(viewportWidth, viewportHeight, board.width, board.height);
  const doorStatuses = new Map(
    (presentation.doors ?? []).map(door => [
      `${String(door.position.row)},${String(door.position.column)}`,
      door.status,
    ])
  );

  context.clearRect(0, 0, viewportWidth, viewportHeight);
  context.fillStyle = '#221c18';
  context.fillRect(0, 0, viewportWidth, viewportHeight);

  for (const row of board.tiles) {
    for (const tile of row) {
      const x = geometry.x + tile.column * geometry.squareSize;
      const y = geometry.y + tile.row * geometry.squareSize;
      const doorStatus = doorStatuses.get(`${String(tile.row)},${String(tile.column)}`);
      context.fillStyle =
        tile.kind === 'door' && doorStatus && doorStatus !== 'closed'
          ? TILE_COLORS.floor
          : TILE_COLORS[tile.kind];
      context.fillRect(x, y, geometry.squareSize, geometry.squareSize);
      context.strokeStyle = tile.kind === 'wall' || tile.kind === 'exit' ? '#302a25' : '#554b42';
      context.lineWidth = 1;
      context.strokeRect(x + 0.5, y + 0.5, geometry.squareSize - 1, geometry.squareSize - 1);
      drawMarker(context, tile, geometry, doorStatus);
    }
  }

  for (const position of presentation.legalSquares ?? []) {
    const x = geometry.x + position.column * geometry.squareSize;
    const y = geometry.y + position.row * geometry.squareSize;
    context.save();
    context.fillStyle = 'rgb(212 85 46 / 28%)';
    context.strokeStyle = '#f08a63';
    context.lineWidth = Math.max(2, geometry.squareSize * 0.07);
    context.fillRect(x + 1, y + 1, geometry.squareSize - 2, geometry.squareSize - 2);
    context.strokeRect(
      x + context.lineWidth / 2,
      y + context.lineWidth / 2,
      geometry.squareSize - context.lineWidth,
      geometry.squareSize - context.lineWidth
    );
    context.restore();
  }

  if (presentation.selectedSquare) {
    const { row, column } = presentation.selectedSquare;
    const x = geometry.x + column * geometry.squareSize;
    const y = geometry.y + row * geometry.squareSize;
    context.save();
    context.fillStyle = 'rgb(217 168 73 / 42%)';
    context.strokeStyle = '#f3d38b';
    context.lineWidth = Math.max(3, geometry.squareSize * 0.11);
    context.fillRect(x + 1, y + 1, geometry.squareSize - 2, geometry.squareSize - 2);
    context.strokeRect(
      x + context.lineWidth / 2,
      y + context.lineWidth / 2,
      geometry.squareSize - context.lineWidth,
      geometry.squareSize - context.lineWidth
    );
    context.restore();
  }

  for (const noise of presentation.noiseTokens ?? []) {
    const centerX = geometry.x + (noise.position.column + 0.5) * geometry.squareSize;
    const centerY = geometry.y + (noise.position.row + 0.5) * geometry.squareSize;
    const radius = geometry.squareSize * 0.31;

    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fillStyle = noise.revealedLabel ? '#d9a849' : '#171310';
    context.fill();
    context.strokeStyle = noise.revealedLabel ? '#eadfc9' : '#d9a849';
    context.lineWidth = Math.max(2, geometry.squareSize * 0.07);
    context.stroke();
    context.fillStyle = noise.revealedLabel ? '#241914' : '#eadfc9';
    context.font = `700 ${Math.max(9, geometry.squareSize * 0.28)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(noise.revealedLabel ?? '?', centerX, centerY);
    context.restore();
  }

  for (const hero of presentation.heroes ?? []) {
    const centerX = geometry.x + (hero.position.column + 0.5) * geometry.squareSize;
    const centerY = geometry.y + (hero.position.row + 0.5) * geometry.squareSize;
    const radius = geometry.squareSize * 0.36;
    const facingOffset: Readonly<Record<Facing, readonly [number, number]>> = {
      north: [0, -1],
      east: [1, 0],
      south: [0, 1],
      west: [-1, 0],
    };
    const [dx, dy] = facingOffset[hero.facing];

    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fillStyle = hero.activationStatus === 'activated' ? '#80786b' : '#d8c7a8';
    context.fill();
    context.strokeStyle = hero.activationStatus === 'active' ? '#f08a63' : '#4a251b';
    context.lineWidth = Math.max(2, geometry.squareSize * 0.07);
    context.stroke();
    context.beginPath();
    context.moveTo(centerX + dx * radius * 0.35, centerY + dy * radius * 0.35);
    context.lineTo(centerX + dx * radius * 1.15, centerY + dy * radius * 1.15);
    context.strokeStyle = '#f08a63';
    context.lineWidth = Math.max(2, geometry.squareSize * 0.09);
    context.lineCap = 'round';
    context.stroke();
    context.fillStyle = '#241914';
    context.font = `700 ${Math.max(9, geometry.squareSize * 0.28)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(hero.label, centerX, centerY);
    context.restore();
  }

  return geometry;
};
