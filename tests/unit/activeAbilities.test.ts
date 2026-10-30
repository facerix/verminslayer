import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createInitialGameState,
  getLegalAbilityFightTargetIds,
  getLegalRangedTargetIds,
  getLegalSkavenPlacementPositions,
  resolveCommand,
  restoreGameState,
} from '../../src/game/gameState.ts';
import type { GameState, RandomSource } from '../../src/game/gameState.ts';
import type { HeroId, SkavenId } from '../../src/game/entities.ts';
import { THE_UNDERBURROW } from '../../src/game/missions/theUnderburrow.ts';
import { RulesError } from '../../src/game/rulesError.ts';

const rolls = (...values: number[]): RandomSource => {
  let index = 0;
  return { next: () => values[index++] ?? 0 };
};
const arena = (heroId: HeroId, enemy: SkavenId = 'clanrat'): GameState => ({
  ...createInitialGameState(THE_UNDERBURROW),
  mode: 'two-player',
  setupStep: 'complete',
  phase: 'hero',
  round: 1,
  command: 2,
  selectedHeroIds: [heroId],
  activeHeroId: heroId,
  actionsRemaining: 2,
  movementRemaining: 3,
  facingChangeAvailable: true,
  heroes: [
    {
      id: heroId,
      definitionId: heroId,
      position: { row: 16, column: 3 },
      facing: 'north',
      woundsRemaining: 2,
    },
  ],
  skaven: [
    {
      id: 'enemy',
      sourceNoiseId: 'old',
      definitionId: enemy,
      position: { row: 15, column: 3 },
      facing: 'south',
      woundsRemaining: 1,
    },
  ],
});

test('Slayer Fury survives a save and grants exactly one free follow-up', () => {
  const base = arena('gotrek');
  const state = {
    ...base,
    skaven: [
      ...base.skaven,
      { ...base.skaven[0]!, id: 'second', position: { row: 16, column: 4 } },
    ],
  };
  const first = resolveCommand(
    state,
    { type: 'fight-skaven', heroId: 'gotrek', skavenId: 'enemy' },
    rolls(0.99, 0, 0, 0)
  ).state;
  const restored = restoreGameState(JSON.parse(JSON.stringify(first)), THE_UNDERBURROW);
  assert.equal(restored.pendingAbility?.type, 'slayers-fury');
  const second = resolveCommand(
    restored,
    { type: 'use-slayers-fury', choice: 'fight', skavenId: 'second' },
    rolls(0.99, 0, 0, 0)
  ).state;
  assert.equal(second.actionsRemaining, 1);
  assert.equal(second.pendingAbility, null);
  assert.equal(second.skaven.length, 0);
  assert.throws(
    () =>
      resolveCommand(
        second,
        { type: 'use-slayers-fury', choice: 'move', position: { row: 16, column: 4 } },
        rolls(0)
      ),
    RulesError
  );
});

test('bow and Arcane Bolt use range, line of sight, and their Action costs', () => {
  const ulrika = {
    ...arena('ulrika'),
    skaven: [{ ...arena('ulrika').skaven[0]!, position: { row: 16, column: 5 } }],
  };
  const shot = resolveCommand(
    ulrika,
    { type: 'ranged-attack', heroId: 'ulrika', skavenId: 'enemy' },
    rolls(0.99, 0, 0)
  ).state;
  assert.equal(shot.actionsRemaining, 1);
  assert.equal(shot.pendingAbility?.type, 'hunters-step');
  const maximilian = { ...arena('maximilian'), skaven: ulrika.skaven };
  const bolt = resolveCommand(
    maximilian,
    { type: 'ranged-attack', heroId: 'maximilian', skavenId: 'enemy' },
    rolls(0.99, 0, 0, 0)
  ).state;
  assert.equal(bolt.actionsRemaining, 0);
  assert.equal(bolt.combatLog[0]?.heroRolls.length, 3);
});

test('losing a bow or Arcane Bolt roll causes no counterattack damage or Ward use', () => {
  for (const heroId of ['ulrika', 'maximilian'] as const) {
    const base = arena(heroId, 'rat-ogor');
    const state = {
      ...base,
      wards: [heroId],
      skaven: [{ ...base.skaven[0]!, position: { row: 16, column: 5 }, woundsRemaining: 2 }],
    };
    const result = resolveCommand(
      state,
      { type: 'ranged-attack', heroId, skavenId: 'enemy' },
      rolls(0, 0, 0, 0.99, 0.99, 0.99)
    );
    assert.equal(result.state.pendingCombat, null);
    assert.equal(result.state.heroes[0]?.woundsRemaining, 2);
    assert.deepEqual(result.state.wards, [heroId]);
    assert.equal(result.state.combatLog[0]?.outcome, 'skaven-won');
    assert.equal(result.state.combatLog[0]?.woundsInflicted, 0);
    assert.equal(result.state.actionsRemaining, heroId === 'ulrika' ? 1 : 0);
    assert.equal(
      result.events.some(event => event.type === 'model-wounded'),
      false
    );
    assert.equal(
      result.events.some(event => event.type === 'ward-consumed'),
      false
    );
    if (heroId === 'ulrika') assert.equal(result.state.pendingAbility?.type, 'hunters-step');
  }
});

test('an adjacent enemy blocks every ranged target, including a more distant one', () => {
  for (const heroId of ['ulrika', 'maximilian', 'malakai'] as const) {
    const base = arena(heroId);
    const state: GameState = {
      ...base,
      skaven: [
        { ...base.skaven[0]!, position: { row: 15, column: 4 } },
        { ...base.skaven[0]!, id: 'distant', position: { row: 16, column: 5 } },
      ],
    };
    assert.deepEqual(getLegalRangedTargetIds(state, THE_UNDERBURROW), []);
    assert.throws(
      () =>
        resolveCommand(
          state,
          { type: 'ranged-attack', heroId, skavenId: 'distant' },
          rolls(0.99, 0)
        ),
      RulesError
    );
    assert.equal(state.actionsRemaining, 2);
    assert.equal(state.combatLog.length, 0);
  }
});

test('Gutter Runner crosses a Clanrat while Rat Ogor smashes a closed door', () => {
  const base = arena('gotrek', 'gutter-runner');
  const runner = {
    ...base,
    phase: 'skaven' as const,
    activeHeroId: null,
    activeSkavenId: 'enemy',
    skavenTurnStep: 'activate-skaven' as const,
    skavenMovementRemaining: 6,
    skavenActionsRemaining: 1,
    skaven: [
      { ...base.skaven[0]!, position: { row: 17, column: 2 } },
      {
        ...base.skaven[0]!,
        id: 'blocker',
        definitionId: 'clanrat' as const,
        position: { row: 17, column: 3 },
      },
    ],
  };
  const moved = resolveCommand(
    runner,
    {
      type: 'move-skaven',
      skavenId: 'enemy',
      path: [
        { row: 17, column: 3 },
        { row: 17, column: 4 },
      ],
      facing: 'east',
    },
    rolls(0)
  ).state;
  assert.deepEqual(moved.skaven[0]?.position, { row: 17, column: 4 });
  assert.throws(
    () =>
      resolveCommand(
        runner,
        { type: 'move-skaven', skavenId: 'enemy', path: [{ row: 17, column: 3 }], facing: 'east' },
        rolls(0)
      ),
    RulesError
  );
  const ogor = {
    ...runner,
    skaven: [
      {
        ...runner.skaven[0]!,
        definitionId: 'rat-ogor' as const,
        position: { row: 14, column: 5 },
        woundsRemaining: 2,
      },
    ],
    skavenMovementRemaining: 3,
  };
  const smashed = resolveCommand(
    ogor,
    {
      type: 'move-skaven',
      skavenId: 'enemy',
      path: [
        { row: 14, column: 6 },
        { row: 14, column: 7 },
      ],
      facing: 'east',
    },
    rolls(0)
  ).state;
  assert.equal(
    smashed.doors.find(door => door.position.row === 14 && door.position.column === 6)?.status,
    'destroyed'
  );
  assert.deepEqual(smashed.skaven[0]?.position, { row: 14, column: 7 });
});

test('Smash reveals Noise before the Rat Ogor continues its saved Movement', () => {
  const base = arena('gotrek', 'rat-ogor');
  const state: GameState = {
    ...base,
    phase: 'skaven',
    activeHeroId: null,
    activeSkavenId: 'enemy',
    skavenTurnStep: 'activate-skaven',
    skavenMovementRemaining: 3,
    skavenActionsRemaining: 1,
    heroes: [{ ...base.heroes[0]!, position: { row: 14, column: 8 } }],
    skaven: [{ ...base.skaven[0]!, position: { row: 14, column: 5 }, woundsRemaining: 2 }],
    concealedNoise: [{ id: 'noise-1', resultId: 'two-clanrats', position: { row: 14, column: 4 } }],
  };
  const interrupted = resolveCommand(
    state,
    {
      type: 'move-skaven',
      skavenId: 'enemy',
      path: [
        { row: 14, column: 6 },
        { row: 14, column: 7 },
      ],
      facing: 'east',
    },
    rolls(0)
  ).state;
  assert.deepEqual(interrupted.skaven[0]?.position, { row: 14, column: 6 });
  assert.equal(interrupted.revealedNoise.length, 1);
  assert.deepEqual(interrupted.pendingSkavenMovement?.remainingPath, [{ row: 14, column: 7 }]);
  assert.equal(
    restoreGameState(JSON.parse(JSON.stringify(interrupted)), THE_UNDERBURROW).revealedNoise.length,
    1
  );
  let placed = interrupted;
  while (placed.revealedNoise[0]) {
    const noiseId = placed.revealedNoise[0].id;
    const position = getLegalSkavenPlacementPositions(placed, THE_UNDERBURROW, noiseId)[0]!;
    placed = resolveCommand(
      placed,
      { type: 'place-revealed-skaven', noiseId, position, facing: 'east' },
      rolls(0)
    ).state;
  }
  assert.deepEqual(placed.skaven.find(skaven => skaven.id === 'enemy')?.position, {
    row: 14,
    column: 7,
  });
  assert.equal(placed.pendingSkavenMovement, null);
});

test('Two-Fisted offers one free Clanrat attack and does not chain', () => {
  const base = arena('snorri');
  const state = {
    ...base,
    skaven: [
      ...base.skaven,
      { ...base.skaven[0]!, id: 'second', position: { row: 16, column: 4 } },
      { ...base.skaven[0]!, id: 'third', position: { row: 17, column: 3 } },
    ],
  };
  const first = resolveCommand(
    state,
    { type: 'fight-skaven', heroId: 'snorri', skavenId: 'enemy' },
    rolls(0.99, 0, 0)
  ).state;
  assert.equal(first.pendingAbility?.type, 'two-fisted');
  const second = resolveCommand(
    first,
    { type: 'use-two-fisted', skavenId: 'second' },
    rolls(0.99, 0, 0)
  ).state;
  assert.equal(second.pendingAbility, null);
  assert.equal(second.actionsRemaining, 1);
  assert.equal(second.skaven.length, 1);
});

test('Hunter’s Step is free, optional, and persists through reload', () => {
  const base = arena('ulrika');
  const state = {
    ...base,
    skaven: [{ ...base.skaven[0]!, position: { row: 16, column: 5 } }],
  };
  const shot = resolveCommand(
    state,
    { type: 'ranged-attack', heroId: 'ulrika', skavenId: 'enemy' },
    rolls(0.99, 0, 0)
  ).state;
  const restored = restoreGameState(JSON.parse(JSON.stringify(shot)), THE_UNDERBURROW);
  const moved = resolveCommand(
    restored,
    { type: 'use-hunters-step', position: { row: 17, column: 3 } },
    rolls(0)
  ).state;
  assert.deepEqual(moved.heroes[0]?.position, { row: 17, column: 3 });
  assert.equal(moved.movementRemaining, shot.movementRemaining);
  assert.equal(moved.pendingAbility, null);
});

test('Repeater Handgun attacks up to three distinct targets for two Actions', () => {
  const base = arena('malakai');
  const state = {
    ...base,
    skaven: [
      { ...base.skaven[0]!, position: { row: 15, column: 5 } },
      { ...base.skaven[0]!, id: 'second', position: { row: 16, column: 5 } },
      { ...base.skaven[0]!, id: 'third', position: { row: 17, column: 5 } },
    ],
  };
  const first = resolveCommand(
    state,
    { type: 'ranged-attack', heroId: 'malakai', skavenId: 'enemy' },
    rolls(0.99, 0)
  ).state;
  assert.equal(first.actionsRemaining, 0);
  assert.equal(first.pendingAbility?.type, 'repeater');
  assert.equal(first.combatLog[0]?.heroRolls.length, 1);
  assert.throws(
    () => resolveCommand(first, { type: 'repeater-attack', skavenId: 'enemy' }, rolls(0)),
    RulesError
  );
  const second = resolveCommand(
    first,
    { type: 'repeater-attack', skavenId: 'second' },
    rolls(0.99, 0)
  ).state;
  const third = resolveCommand(
    second,
    { type: 'repeater-attack', skavenId: 'third' },
    rolls(0.99, 0)
  ).state;
  assert.equal(third.pendingAbility, null);
  assert.equal(third.combatLog.length, 3);
});

test('a Repeater shot pauses for a saved Rememberer reroll and then resumes', () => {
  const base = arena('malakai');
  const state: GameState = {
    ...base,
    selectedHeroIds: ['malakai', 'felix'],
    heroes: [
      ...base.heroes,
      {
        id: 'felix',
        definitionId: 'felix',
        position: { row: 17, column: 3 },
        facing: 'north',
        woundsRemaining: 2,
      },
    ],
    skaven: [
      { ...base.skaven[0]!, position: { row: 15, column: 5 } },
      { ...base.skaven[0]!, id: 'second', position: { row: 16, column: 5 } },
    ],
  };
  const shot = resolveCommand(
    state,
    { type: 'ranged-attack', heroId: 'malakai', skavenId: 'enemy' },
    rolls(0, 0.99)
  ).state;
  assert.equal(shot.pendingCombat?.stage, 'rerolls');
  const restored = restoreGameState(JSON.parse(JSON.stringify(shot)), THE_UNDERBURROW);
  const accepted = resolveCommand(restored, { type: 'accept-fight-rolls' }, rolls(0)).state;
  assert.equal(accepted.pendingCombat, null);
  assert.equal(accepted.pendingAbility?.type, 'repeater');
  assert.equal(accepted.actionsRemaining, 0);
  assert.equal(accepted.heroes.find(hero => hero.id === 'malakai')?.woundsRemaining, 2);
  assert.equal(accepted.combatLog[0]?.woundsInflicted, 0);
});

test('an adjacent enemy blocks a pending Repeater shot', () => {
  const base = arena('malakai');
  const state: GameState = {
    ...base,
    actionsRemaining: 0,
    pendingAbility: { type: 'repeater', heroId: 'malakai', attackedIds: ['first'] },
    skaven: [
      { ...base.skaven[0]!, id: 'first', position: { row: 15, column: 5 } },
      { ...base.skaven[0]!, id: 'blocker', position: { row: 15, column: 4 } },
      { ...base.skaven[0]!, id: 'distant', position: { row: 16, column: 5 } },
    ],
  };
  assert.deepEqual(getLegalAbilityFightTargetIds(state, THE_UNDERBURROW), []);
  assert.throws(
    () => resolveCommand(state, { type: 'repeater-attack', skavenId: 'distant' }, rolls(0.99, 0)),
    RulesError
  );
});

test('Demolition Charge destroys its feature and attacks every adjacent enemy once', () => {
  const base = arena('malakai');
  const state = {
    ...base,
    heroes: [{ ...base.heroes[0]!, position: { row: 15, column: 5 } }],
    skaven: [
      { ...base.skaven[0]!, position: { row: 13, column: 5 } },
      { ...base.skaven[0]!, id: 'second', position: { row: 14, column: 7 } },
    ],
  };
  const position = { row: 14, column: 6 };
  const placed = resolveCommand(
    state,
    { type: 'place-demolition-charge', heroId: 'malakai', position },
    rolls(0)
  ).state;
  assert.equal(placed.abilityUsage.demolitionChargeUsed, true);
  assert.throws(
    () =>
      resolveCommand(placed, { type: 'detonate-demolition-charge', confirmed: false }, rolls(0)),
    RulesError
  );
  const detonated = resolveCommand(
    placed,
    { type: 'detonate-demolition-charge', confirmed: true },
    rolls(0)
  ).state;
  assert.equal(
    detonated.doors.find(door => door.position.row === 14 && door.position.column === 6)?.status,
    'destroyed'
  );
  assert.equal(detonated.pendingAbility?.type, 'charge');
  const first = resolveCommand(
    detonated,
    { type: 'continue-charge', skavenId: 'enemy' },
    rolls(0.99, 0, 0, 0)
  ).state;
  const second = resolveCommand(
    first,
    { type: 'continue-charge', skavenId: 'second' },
    rolls(0.99, 0, 0, 0)
  ).state;
  assert.equal(second.pendingAbility, null);
  assert.equal(second.combatLog.length, 2);
  assert.equal(second.actionsRemaining, 1);
});

test('Malakai cannot detonate a charge while an enemy is adjacent', () => {
  const base = arena('malakai');
  const state: GameState = {
    ...base,
    heroes: [{ ...base.heroes[0]!, position: { row: 15, column: 5 } }],
    skaven: [{ ...base.skaven[0]!, position: { row: 15, column: 6 } }],
  };
  const placed = resolveCommand(
    state,
    { type: 'place-demolition-charge', heroId: 'malakai', position: { row: 14, column: 6 } },
    rolls(0)
  ).state;
  assert.throws(
    () => resolveCommand(placed, { type: 'detonate-demolition-charge', confirmed: true }, rolls(0)),
    RulesError
  );
  assert.equal(placed.demolitionCharge?.feature, 'door');
});

test('Demolition Charge can destroy a nest and is spent for the mission', () => {
  const base = arena('malakai');
  const state: GameState = {
    ...base,
    heroes: [{ ...base.heroes[0]!, position: { row: 8, column: 1 } }],
    skaven: [],
  };
  const position = { row: 9, column: 1 };
  const placed = resolveCommand(
    state,
    { type: 'place-demolition-charge', heroId: 'malakai', position },
    rolls(0)
  ).state;
  const detonated = resolveCommand(
    placed,
    { type: 'detonate-demolition-charge', confirmed: true },
    rolls(0)
  ).state;
  assert.equal(
    detonated.nests.find(nest => nest.position.row === 9 && nest.position.column === 1)?.status,
    'destroyed'
  );
  assert.equal(detonated.pendingAbility, null);
  assert.throws(
    () =>
      resolveCommand(
        detonated,
        { type: 'place-demolition-charge', heroId: 'malakai', position },
        rolls(0)
      ),
    RulesError
  );
});

test('a detonated charge cannot wound Malakai when its targets win the roll-offs', () => {
  const base = arena('malakai');
  const position = { row: 14, column: 6 };
  const state: GameState = {
    ...base,
    heroes: [{ ...base.heroes[0]!, position: { row: 15, column: 5 }, woundsRemaining: 1 }],
    skaven: [
      { ...base.skaven[0]!, position: { row: 13, column: 5 } },
      { ...base.skaven[0]!, id: 'second', position: { row: 14, column: 7 } },
    ],
  };
  const placed = resolveCommand(
    state,
    { type: 'place-demolition-charge', heroId: 'malakai', position },
    rolls(0)
  ).state;
  const detonated = resolveCommand(
    placed,
    { type: 'detonate-demolition-charge', confirmed: true },
    rolls(0)
  ).state;
  const first = resolveCommand(
    detonated,
    { type: 'continue-charge', skavenId: 'enemy' },
    rolls(0, 0, 0, 0.99)
  ).state;
  assert.equal(first.heroes[0]?.woundsRemaining, 1);
  assert.equal(first.combatLog[0]?.woundsInflicted, 0);
  const second = resolveCommand(
    first,
    { type: 'continue-charge', skavenId: 'second' },
    rolls(0, 0, 0, 0.99)
  );
  assert.equal(second.state.pendingAbility, null);
  assert.equal(second.state.heroes[0]?.woundsRemaining, 1);
  assert.equal(second.state.combatLog[1]?.woundsInflicted, 0);
  assert.equal(second.events.filter(event => event.type === 'model-defeated').length, 0);
});
