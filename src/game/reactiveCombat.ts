import { HERO_DEFINITIONS, SKAVEN_DEFINITIONS } from '/src/game/entities.js';
import type { HeroId } from '/src/game/entities.js';
import type {
  CombatResult,
  Facing,
  GameState,
  HeroState,
  SkavenState,
} from '/src/game/gameState.js';
import type { Position } from '/src/game/map.js';

export type RerollAbility = 'karaghul' | 'rememberer';
export interface AbilityUsage {
  readonly karaghulRound: number | null;
  readonly remembererRound: number | null;
  readonly snorriSaved: boolean;
}
export interface PendingCombat extends CombatResult {
  readonly source: 'hero' | 'skaven' | 'react' | 'guard';
  readonly stage: 'rerolls' | 'ward';
  readonly rerolledDice: readonly number[];
}
export interface PendingSkavenMovement {
  readonly skavenId: string;
  readonly remainingPath: readonly Position[];
  readonly facing: Facing;
  readonly spacesMoved: number;
}
export const EMPTY_ABILITY_USAGE: AbilityUsage = Object.freeze({
  karaghulRound: null,
  remembererRound: null,
  snorriSaved: false,
});
export const distance = (left: Position, right: Position): number =>
  Math.max(Math.abs(left.row - right.row), Math.abs(left.column - right.column));
export const inFrontArc = (hero: HeroState, position: Position): boolean => {
  if (!hero.position || distance(hero.position, position) !== 1) return false;
  switch (hero.facing) {
    case 'north':
      return position.row === hero.position.row - 1;
    case 'south':
      return position.row === hero.position.row + 1;
    case 'east':
      return position.column === hero.position.column + 1;
    case 'west':
      return position.column === hero.position.column - 1;
    default:
      return false;
  }
};
export const getFightDice = (
  state: GameState,
  hero: HeroState,
  skaven: SkavenState,
  skavenAttacking: boolean
): { heroDice: number; skavenDice: number } => {
  let heroDice = HERO_DEFINITIONS[hero.definitionId].stats.fight;
  let skavenDice = SKAVEN_DEFINITIONS[skaven.definitionId].stats.fight;
  if (hero.definitionId === 'gotrek' && SKAVEN_DEFINITIONS[skaven.definitionId].stats.wounds >= 2)
    heroDice++;
  if (skaven.definitionId === 'clanrat' && hero.position) {
    skavenDice = Math.min(
      3,
      1 +
        state.skaven.filter(
          other =>
            other.id !== skaven.id &&
            other.definitionId === 'clanrat' &&
            distance(other.position, hero.position!) === 1
        ).length
    );
  }
  if (skavenAttacking && skaven.definitionId === 'gutter-runner') {
    const opposite: Record<Facing, Facing> = {
      north: 'south',
      south: 'north',
      east: 'west',
      west: 'east',
    };
    if (hero.facing && inFrontArc({ ...hero, facing: opposite[hero.facing] }, skaven.position))
      skavenDice++;
  }
  return { heroDice, skavenDice };
};
export const fightOutcome = (
  heroRolls: readonly number[],
  skavenRolls: readonly number[]
): CombatResult['outcome'] => {
  const heroHigh = Math.max(...heroRolls);
  const skavenHigh = Math.max(...skavenRolls);
  return heroHigh > skavenHigh ? 'hero-won' : skavenHigh > heroHigh ? 'skaven-won' : 'tie';
};
export const getRerollAbilities = (
  state: Pick<GameState, 'heroes' | 'exitedHeroIds' | 'round' | 'abilityUsage'>,
  heroId: HeroId
): readonly RerollAbility[] => {
  const hero = state.heroes.find(candidate => candidate.id === heroId);
  const felix = state.heroes.find(
    candidate =>
      candidate.definitionId === 'felix' &&
      candidate.position &&
      candidate.woundsRemaining > 0 &&
      !state.exitedHeroIds.includes(candidate.id)
  );
  if (!hero?.position || !felix?.position || hero.woundsRemaining <= 0) return [];
  const abilities: RerollAbility[] = [];
  if (hero.definitionId === 'felix' && state.abilityUsage.karaghulRound !== state.round)
    abilities.push('karaghul');
  if (
    hero.definitionId !== 'felix' &&
    distance(hero.position, felix.position) <= 4 &&
    state.abilityUsage.remembererRound !== state.round
  )
    abilities.push('rememberer');
  return Object.freeze(abilities);
};
