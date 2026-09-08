import type { HeroId, SkavenId } from '/src/game/entities.js';
import type { ParsedMap } from '/src/game/map.js';

export type NoiseResultId =
  | 'two-clanrats'
  | 'three-clanrats'
  | 'gutter-runner'
  | 'rat-ogor'
  | 'nothing';

export interface NoiseResultDefinition {
  readonly id: NoiseResultId;
  readonly models: readonly SkavenId[];
}

export interface MissionDefinition {
  readonly id: string;
  readonly name: string;
  readonly board: ParsedMap;
  readonly roundLimit: number;
  readonly firstPhase: 'hero';
  readonly allowedHeroes: readonly HeroId[];
  readonly skavenTypes: readonly SkavenId[];
  readonly initialNoiseCount: number;
  readonly noisePerTurn: number;
  readonly noiseResults: Readonly<Record<NoiseResultId, NoiseResultDefinition>>;
  readonly noiseBag: readonly NoiseResultId[];
}
