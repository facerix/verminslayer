export type MapTileKind =
  | 'floor'
  | 'wall'
  | 'door'
  | 'water'
  | 'rubble'
  | 'deployment'
  | 'spawn'
  | 'nest'
  | 'exit';

export interface Position {
  readonly row: number;
  readonly column: number;
}

export interface MapTile extends Position {
  readonly kind: MapTileKind;
}

export interface ParsedMap {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly (readonly MapTile[])[];
  readonly doors: readonly Position[];
  readonly nests: readonly Position[];
  readonly spawns: readonly Position[];
  readonly deployment: Position;
  readonly exit: Position;
}

type FeatureKind = 'door' | 'nest' | 'spawn' | 'deployment' | 'exit';

export interface ParseMapOptions {
  readonly width: number;
  readonly height: number;
  readonly required?: Readonly<Partial<Record<FeatureKind, number>>>;
}

export type RulesErrorCode =
  | 'INVALID_MAP_HEIGHT'
  | 'INVALID_MAP_WIDTH'
  | 'UNKNOWN_MAP_SYMBOL'
  | 'INVALID_FEATURE_COUNT';

export class RulesError extends Error {
  readonly code: RulesErrorCode;

  constructor(code: RulesErrorCode, message: string) {
    super(message);
    this.name = 'RulesError';
    this.code = code;
  }
}

const TILE_KINDS: Readonly<Record<string, MapTileKind>> = Object.freeze({
  '.': 'floor',
  '#': 'wall',
  '+': 'door',
  '~': 'water',
  ':': 'rubble',
  '@': 'deployment',
  S: 'spawn',
  N: 'nest',
  E: 'exit',
});

const positionOf = (tile: MapTile): Position =>
  Object.freeze({ row: tile.row, column: tile.column });

const positionsOfKind = (tiles: readonly (readonly MapTile[])[], kind: MapTileKind) =>
  Object.freeze(
    tiles
      .flat()
      .filter(tile => tile.kind === kind)
      .map(positionOf)
  );

export const parseMap = (source: string, options: ParseMapOptions): ParsedMap => {
  const rows = source.trim().split('\n');
  if (rows.length !== options.height) {
    throw new RulesError(
      'INVALID_MAP_HEIGHT',
      `Expected ${options.height} map rows, received ${rows.length}`
    );
  }

  const tiles = rows.map((row, rowIndex) => {
    if (row.length !== options.width) {
      throw new RulesError(
        'INVALID_MAP_WIDTH',
        `Expected row ${rowIndex + 1} to contain ${options.width} columns, received ${row.length}`
      );
    }

    return Object.freeze(
      [...row].map((symbol, column) => {
        const kind = TILE_KINDS[symbol];
        if (!kind) {
          throw new RulesError(
            'UNKNOWN_MAP_SYMBOL',
            `Unknown map symbol ${JSON.stringify(symbol)} at row ${rowIndex + 1}, column ${column + 1}`
          );
        }

        return Object.freeze({ row: rowIndex, column, kind });
      })
    );
  });

  const frozenTiles = Object.freeze(tiles);
  const doors = positionsOfKind(frozenTiles, 'door');
  const nests = positionsOfKind(frozenTiles, 'nest');
  const spawns = positionsOfKind(frozenTiles, 'spawn');
  const deployments = positionsOfKind(frozenTiles, 'deployment');
  const exits = positionsOfKind(frozenTiles, 'exit');
  const featureCounts: Readonly<Record<FeatureKind, number>> = {
    door: doors.length,
    nest: nests.length,
    spawn: spawns.length,
    deployment: deployments.length,
    exit: exits.length,
  };

  for (const [kind, expected] of Object.entries(options.required ?? {})) {
    const actual = featureCounts[kind as FeatureKind];
    if (actual !== expected) {
      throw new RulesError(
        'INVALID_FEATURE_COUNT',
        `Expected ${String(expected)} ${kind} feature(s), received ${actual}`
      );
    }
  }

  if (deployments.length !== 1 || exits.length !== 1) {
    throw new RulesError(
      'INVALID_FEATURE_COUNT',
      `A playable map requires exactly one deployment and one exit; received ${deployments.length} and ${exits.length}`
    );
  }

  return Object.freeze({
    width: options.width,
    height: options.height,
    tiles: frozenTiles,
    doors,
    nests,
    spawns,
    deployment: deployments[0]!,
    exit: exits[0]!,
  });
};
