import { RulesError } from '/src/game/rulesError.js';

export interface CombatRandomSource {
  next(): number;
}

export interface OpposedRollResult {
  readonly heroRolls: readonly number[];
  readonly skavenRolls: readonly number[];
  readonly outcome: 'hero-won' | 'skaven-won' | 'tie';
}

const rollDice = (count: number, randomSource: CombatRandomSource): readonly number[] => {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError('A Fight must roll at least one die for each model');
  }
  const rolls: number[] = [];
  for (let index = 0; index < count; index++) {
    const randomValue = randomSource.next();
    if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
      throw new RulesError(
        'INVALID_RANDOM_VALUE',
        'Random values must be finite numbers from 0 up to 1'
      );
    }
    rolls.push(Math.floor(randomValue * 6) + 1);
  }
  return Object.freeze(rolls);
};

export const resolveOpposedRoll = (
  heroDice: number,
  skavenDice: number,
  randomSource: CombatRandomSource
): OpposedRollResult => {
  const heroRolls = rollDice(heroDice, randomSource);
  const skavenRolls = rollDice(skavenDice, randomSource);
  const heroHigh = Math.max(...heroRolls);
  const skavenHigh = Math.max(...skavenRolls);
  return Object.freeze({
    heroRolls,
    skavenRolls,
    outcome: heroHigh > skavenHigh ? 'hero-won' : skavenHigh > heroHigh ? 'skaven-won' : 'tie',
  });
};
