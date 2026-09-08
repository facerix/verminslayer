export type Faction = 'hero' | 'skaven';

export const ALL_HERO_IDS = Object.freeze([
  'gotrek',
  'felix',
  'snorri',
  'ulrika',
  'maximilian',
  'malakai',
] as const);

export type HeroId = (typeof ALL_HERO_IDS)[number];
export type SkavenId = 'clanrat' | 'gutter-runner' | 'rat-ogor';
export type EntityDefinitionId = HeroId | SkavenId;
export type AbilityLimit = 'once-per-activation' | 'once-per-round' | 'once-per-mission';

export interface EntityStats {
  readonly move: number;
  readonly fight: number;
  readonly wounds: number;
}

export interface AbilityDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly actionCost?: number;
  readonly limit?: AbilityLimit;
}

export interface EntityDefinition<Id extends EntityDefinitionId = EntityDefinitionId> {
  readonly id: Id;
  readonly name: string;
  readonly faction: Faction;
  readonly stats: EntityStats;
  readonly abilities: readonly AbilityDefinition[];
}

const ability = (
  id: string,
  name: string,
  description: string,
  options: Pick<AbilityDefinition, 'actionCost' | 'limit'> = {}
): AbilityDefinition => Object.freeze({ id, name, description, ...options });

const entity = <Id extends EntityDefinitionId>(
  id: Id,
  name: string,
  faction: Faction,
  stats: EntityStats,
  abilities: readonly AbilityDefinition[]
): EntityDefinition<Id> =>
  Object.freeze({
    id,
    name,
    faction,
    stats: Object.freeze(stats),
    abilities: Object.freeze(abilities),
  });

export const HERO_DEFINITIONS: Readonly<Record<HeroId, EntityDefinition<HeroId>>> = Object.freeze({
  gotrek: entity('gotrek', 'Gotrek Gurnisson', 'hero', { move: 3, fight: 3, wounds: 3 }, [
    ability(
      'axe-of-grimnir',
      'Axe of Grimnir',
      'Roll +1 Fight die against an enemy whose printed Wounds value is 2 or more.'
    ),
    ability(
      'slayers-fury',
      "Slayer's Fury",
      'After defeating an enemy, immediately move 1 square or attack another adjacent enemy.',
      { limit: 'once-per-activation' }
    ),
  ]),
  felix: entity('felix', 'Felix Jaeger', 'hero', { move: 5, fight: 2, wounds: 2 }, [
    ability('karaghul', 'Karaghul', 'Reroll one of his Fight dice.', {
      limit: 'once-per-round',
    }),
    ability(
      'rememberer',
      'Rememberer',
      'Spend 1 Command to let a hero within 4 squares reroll one die.',
      { limit: 'once-per-round' }
    ),
  ]),
  snorri: entity('snorri', 'Snorri Nosebiter', 'hero', { move: 3, fight: 2, wounds: 3 }, [
    ability(
      'two-fisted',
      'Two-Fisted',
      'After defeating a Clanrat, immediately attack one other adjacent Clanrat.'
    ),
    ability(
      'snorris-not-dead',
      "Snorri's Not Dead!",
      'When Snorri would suffer his last Wound, leave him with 1 Wound instead.',
      { limit: 'once-per-mission' }
    ),
  ]),
  ulrika: entity('ulrika', 'Ulrika Magdova', 'hero', { move: 5, fight: 2, wounds: 2 }, [
    ability(
      'kislevite-bow',
      'Kislevite Bow',
      'Attack an enemy in line of sight within 5 squares with 2 Fight dice.',
      { actionCost: 1 }
    ),
    ability('hunters-step', "Hunter's Step", 'After a ranged attack, move 1 square for free.'),
  ]),
  maximilian: entity(
    'maximilian',
    'Maximilian Schreiber',
    'hero',
    { move: 4, fight: 1, wounds: 2 },
    [
      ability(
        'arcane-bolt',
        'Arcane Bolt',
        'Attack an enemy within 5 squares and line of sight with 3 Fight dice.',
        { actionCost: 2 }
      ),
      ability(
        'ward',
        'Ward',
        'Give a hero within 3 squares a token that rerolls their Fight dice after their next lost Fight.',
        { actionCost: 1 }
      ),
    ]
  ),
  malakai: entity('malakai', 'Malakai Makaisson', 'hero', { move: 3, fight: 2, wounds: 2 }, [
    ability(
      'repeater-handgun',
      'Repeater Handgun',
      'Attack up to 3 different enemies in line of sight within 5 squares with 1 Fight die each.',
      { actionCost: 2 }
    ),
    ability(
      'demolition-charge',
      'Demolition Charge',
      'Spend 1 Action adjacent to a door or objective to place a charge that can be detonated during a Hero turn.',
      { actionCost: 1, limit: 'once-per-mission' }
    ),
  ]),
});

export const SKAVEN_DEFINITIONS: Readonly<Record<SkavenId, EntityDefinition<SkavenId>>> =
  Object.freeze({
    clanrat: entity('clanrat', 'Clanrat', 'skaven', { move: 4, fight: 1, wounds: 1 }, [
      ability(
        'strength-in-numbers',
        'Strength in Numbers',
        'Roll +1 Fight die for each other Clanrat adjacent to the same hero, to a maximum of 3 Fight dice.'
      ),
    ]),
    'gutter-runner': entity(
      'gutter-runner',
      'Gutter Runner',
      'skaven',
      { move: 6, fight: 2, wounds: 1 },
      [
        ability(
          'skitter',
          'Skitter',
          'Move through squares occupied by Clanrats, but do not end movement there.'
        ),
        ability('backstab', 'Backstab', 'Roll +1 Fight die when attacking a hero from the rear.'),
      ]
    ),
    'rat-ogor': entity('rat-ogor', 'Rat Ogor', 'skaven', { move: 3, fight: 3, wounds: 2 }, [
      ability(
        'brute-strength',
        'Brute Strength',
        'When a Rat Ogor wins a Fight, the hero suffers 2 Wounds instead of 1.'
      ),
      ability('smash', 'Smash', 'Move through a closed door and destroy it while doing so.'),
    ]),
  });

export const isHeroId = (value: string): value is HeroId =>
  (ALL_HERO_IDS as readonly string[]).includes(value);
