import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createInitialGameState,
  resolveCommand,
  restoreGameState,
  projectHeroView,
} from '../../src/game/gameState.ts';
import type { GameState, RandomSource } from '../../src/game/gameState.ts';
import type { HeroId, SkavenId } from '../../src/game/entities.ts';
import { THE_NEST } from '../../src/game/missions/theNest.ts';
import { GameSession } from '../../src/game/gameSession.ts';
import { getNextSoloSkavenCommand, runSoloSkavenAi } from '../../src/game/skavenAi.ts';
import { RulesError } from '../../src/game/rulesError.ts';

const rolls = (...values: number[]): RandomSource => {
  let index = 0;
  return { next: () => values[index++] ?? 0 };
};
const arena = (heroId: HeroId = 'gotrek', enemy: SkavenId = 'clanrat'): GameState => ({
  ...createInitialGameState(THE_NEST),
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
      woundsRemaining: 3,
    },
  ],
  skaven: [
    {
      id: 'enemy',
      sourceNoiseId: 'old',
      definitionId: enemy,
      position: { row: 15, column: 3 },
      facing: 'south',
      woundsRemaining: enemy === 'rat-ogor' ? 2 : 1,
    },
  ],
});
const attack = (state: GameState, random: RandomSource) =>
  resolveCommand(
    state,
    { type: 'fight-skaven', heroId: state.heroes[0]!.id, skavenId: 'enemy' },
    random
  );

test('Axe uses printed Wounds even on an injured Rat Ogor; Brute Strength deals two wounds', () => {
  const state = arena('gotrek', 'rat-ogor');
  const result = attack(
    { ...state, skaven: [{ ...state.skaven[0]!, woundsRemaining: 1 }] },
    rolls(0, 0, 0, 0, 0.99, 0, 0)
  );
  assert.equal(result.state.combatLog[0]!.heroRolls.length, 4);
  assert.equal(result.state.heroes[0]!.woundsRemaining, 1);
});

test('Strength in Numbers counts other Clanrats adjacent to the hero and caps at three', () => {
  const base = arena();
  const state = {
    ...base,
    skaven: [
      ...base.skaven,
      ...[2, 3, 4].map(column => ({
        ...base.skaven[0]!,
        id: `support-${column}`,
        position: { row: 17, column },
      })),
    ],
  };
  assert.equal(attack(state, rolls(0)).state.combatLog[0]!.skavenRolls.length, 3);
});

test('Backstab applies only to an attacking Gutter Runner in the rear arc', () => {
  const base = arena('ulrika', 'gutter-runner');
  const state: GameState = {
    ...base,
    phase: 'skaven',
    activeHeroId: null,
    activeSkavenId: 'enemy',
    skavenTurnStep: 'activate-skaven',
    skavenActivationIds: ['enemy'],
    skavenActionsRemaining: 1,
    skavenMovementRemaining: 0,
    skaven: [{ ...base.skaven[0]!, position: { row: 17, column: 4 } }],
  };
  const result = resolveCommand(
    state,
    { type: 'fight-hero', skavenId: 'enemy', heroId: 'ulrika' },
    rolls(0)
  );
  assert.equal(result.state.combatLog[0]!.skavenRolls.length, 3);
  assert.equal(
    attack({ ...base, skaven: state.skaven }, rolls(0)).state.combatLog[0]!.skavenRolls.length,
    2
  );
});

test('optional rerolls delay damage, survive JSON resume, and reject rerolling the same die twice', () => {
  const base = arena('felix');
  const result = attack(base, rolls(0, 0, 0.99));
  assert.ok(result.state.pendingCombat);
  assert.equal(result.state.heroes[0]!.woundsRemaining, 3);
  assert.equal(result.state.combatLog.length, 0);
  const restored = restoreGameState(JSON.parse(JSON.stringify(result.state)), THE_NEST);
  assert.ok(Object.isFrozen(restored.pendingCombat!.heroRolls));
  const rerolled = resolveCommand(
    restored,
    { type: 'reroll-fight-die', ability: 'karaghul', dieIndex: 0 },
    rolls(0.99)
  ).state;
  assert.throws(
    () =>
      resolveCommand(
        rerolled,
        { type: 'reroll-fight-die', ability: 'rememberer', dieIndex: 0 },
        rolls(0)
      ),
    RulesError
  );
  const finished = rerolled;
  assert.equal(finished.heroes[0]!.woundsRemaining, 3);
  assert.equal(finished.combatLog[0]!.outcome, 'tie');
  assert.equal(finished.abilityUsage.karaghulRound, 1);
});

test('Rememberer uses Chebyshev range and requires living deployed Felix', () => {
  const base = arena('ulrika');
  const felix = {
    ...base.heroes[0]!,
    id: 'felix' as const,
    definitionId: 'felix' as const,
    position: { row: 12, column: 7 },
  };
  assert.ok(attack({ ...base, heroes: [...base.heroes, felix] }, rolls(0)).state.pendingCombat);
  assert.equal(
    attack(
      { ...base, heroes: [...base.heroes, { ...felix, position: { row: 11, column: 7 } }] },
      rolls(0)
    ).state.pendingCombat,
    null
  );
  assert.equal(
    attack({ ...base, heroes: [...base.heroes, { ...felix, woundsRemaining: 0 }] }, rolls(0)).state
      .pendingCombat,
    null
  );
});

test('Karaghul belongs to Felix, while Rememberer belongs to another hero', () => {
  const base = arena('ulrika');
  const felix = {
    ...base.heroes[0]!,
    id: 'felix' as const,
    definitionId: 'felix' as const,
    position: { row: 16, column: 4 },
  };
  const felixFight = attack(
    { ...base, activeHeroId: 'felix', heroes: [felix, base.heroes[0]!] },
    rolls(0, 0, 0.99)
  ).state;
  assert.ok(felixFight.pendingCombat);
  assert.throws(
    () =>
      resolveCommand(
        felixFight,
        { type: 'reroll-fight-die', ability: 'rememberer', dieIndex: 0 },
        rolls(0)
      ),
    RulesError
  );
  const otherFight = attack({ ...base, heroes: [base.heroes[0]!, felix] }, rolls(0, 0, 0.99)).state;
  assert.ok(otherFight.pendingCombat);
  assert.throws(
    () =>
      resolveCommand(
        otherFight,
        { type: 'reroll-fight-die', ability: 'karaghul', dieIndex: 0 },
        rolls(0)
      ),
    RulesError
  );
});

test('a hero win resolves immediately without offering Felix rerolls', () => {
  const win = attack(arena('felix', 'rat-ogor'), rolls(0.99, 0, 0, 0, 0));
  assert.equal(win.state.pendingCombat, null);
  assert.equal(win.state.combatLog[0]!.outcome, 'hero-won');
  assert.equal(
    win.events.some(event => event.type === 'fight-choice-opened'),
    false
  );
});

test('Karaghul remains spent through Push and the Skaven turn, then returns next round', () => {
  const first = attack(arena('felix', 'rat-ogor'), rolls(0, 0, 0.99, 0, 0)).state;
  const spent = resolveCommand(
    first,
    { type: 'reroll-fight-die', ability: 'karaghul', dieIndex: 0 },
    rolls(0.99)
  ).state;
  assert.equal(spent.pendingCombat, null);
  assert.equal(spent.abilityUsage.karaghulRound, 1);
  const pushed = { ...spent, actionsRemaining: 2, pushUsed: true, command: 1 };
  const nextFight = attack(pushed, rolls(0, 0, 0.99, 0, 0)).state;
  assert.equal(nextFight.pendingCombat, null);
  const enemyTurn: GameState = {
    ...nextFight,
    phase: 'skaven',
    activeHeroId: null,
    activeSkavenId: 'enemy',
    skavenTurnStep: 'activate-skaven',
    skavenActivationIds: ['enemy'],
    skavenActionsRemaining: 1,
    skavenMovementRemaining: 0,
  };
  const defense = resolveCommand(
    enemyTurn,
    { type: 'fight-hero', skavenId: 'enemy', heroId: 'felix' },
    rolls(0, 0, 0.99, 0, 0)
  );
  assert.equal(defense.state.pendingCombat, null);
  assert.equal(
    defense.events.some(event => event.type === 'fight-choice-opened'),
    false
  );
  assert.ok(attack({ ...pushed, round: 2 }, rolls(0, 0, 0.99, 0, 0)).state.pendingCombat);
});

test('Ward is placed in range for one Action and resolves a loss before damage', () => {
  const base = arena('maximilian');
  const warded = resolveCommand(
    base,
    { type: 'ward-hero', heroId: 'maximilian', targetHeroId: 'maximilian' },
    rolls(0)
  ).state;
  assert.deepEqual(warded.wards, ['maximilian']);
  assert.equal(warded.actionsRemaining, 1);
  const pending = attack(warded, rolls(0, 0.8)).state;
  assert.equal(pending.pendingCombat!.stage, 'ward');
  assert.equal(pending.heroes[0]!.woundsRemaining, 3);
  const finished = resolveCommand(pending, { type: 'resolve-ward' }, rolls(0.99)).state;
  assert.deepEqual(finished.wards, []);
  assert.equal(finished.combatLog[0]!.outcome, 'hero-won');
});

test('Snorri survives lethal Rat Ogor damage once per mission', () => {
  const base = arena('snorri', 'rat-ogor');
  const saved = attack(
    { ...base, heroes: [{ ...base.heroes[0]!, woundsRemaining: 2 }] },
    rolls(0, 0, 0.99, 0, 0)
  ).state;
  assert.equal(saved.heroes[0]!.woundsRemaining, 1);
  assert.equal(saved.abilityUsage.snorriSaved, true);
  const dead = attack(saved, rolls(0, 0, 0.99, 0, 0)).state;
  assert.equal(dead.heroes[0]!.position, null);
});

test('Guard interrupts at entry, consumes its marker, and ends a defeated mover before React', () => {
  const base = arena();
  const state: GameState = {
    ...base,
    guards: ['gotrek'],
    phase: 'skaven',
    activeHeroId: null,
    activeSkavenId: 'enemy',
    skavenTurnStep: 'activate-skaven',
    skavenActivationIds: ['enemy'],
    skavenActionsRemaining: 1,
    skavenMovementRemaining: 4,
    skaven: [{ ...base.skaven[0]!, position: { row: 14, column: 4 } }],
  };
  const result = resolveCommand(
    state,
    {
      type: 'move-skaven',
      skavenId: 'enemy',
      path: [
        { row: 15, column: 4 },
        { row: 16, column: 4 },
      ],
      facing: 'south',
    },
    rolls(0.99, 0, 0, 0)
  );
  assert.deepEqual(result.state.guards, []);
  assert.equal(result.state.skaven.length, 0);
  assert.equal(result.state.pendingReact, null);
  assert.equal(result.events.filter(e => e.type === 'skaven-moved').length, 1);
});

test('Guard reroll interruption resumes the submitted path after reload and opens React only at completion', () => {
  const base = arena('felix', 'rat-ogor');
  const state: GameState = {
    ...base,
    guards: ['felix'],
    phase: 'skaven',
    activeHeroId: null,
    activeSkavenId: 'enemy',
    skavenTurnStep: 'activate-skaven',
    skavenActivationIds: ['enemy'],
    skavenActionsRemaining: 1,
    skavenMovementRemaining: 3,
    skaven: [{ ...base.skaven[0]!, position: { row: 14, column: 4 } }],
  };
  const pending = resolveCommand(
    state,
    {
      type: 'move-skaven',
      skavenId: 'enemy',
      path: [
        { row: 15, column: 4 },
        { row: 16, column: 4 },
      ],
      facing: 'south',
    },
    rolls(0.5, 0, 0.5, 0, 0)
  ).state;
  assert.deepEqual(pending.skaven[0]!.position, { row: 15, column: 4 });
  assert.equal(pending.pendingReact, null);
  assert.deepEqual(projectHeroView(pending).legalSkavenMovePaths, []);
  assert.throws(
    () =>
      resolveCommand(
        pending,
        { type: 'end-skaven-activation', skavenId: 'enemy', confirmed: true },
        rolls(0)
      ),
    RulesError
  );
  const resumed = restoreGameState(JSON.parse(JSON.stringify(pending)), THE_NEST);
  const finished = resolveCommand(resumed, { type: 'accept-fight-rolls' }, rolls(0)).state;
  assert.deepEqual(finished.skaven[0]!.position, { row: 16, column: 4 });
  assert.equal(finished.pendingReact!.source, 'skaven');
});

test('Guard ends activation, forfeits unused actions and movement, and expires on next activation', () => {
  const placed = resolveCommand(arena(), { type: 'guard-hero', heroId: 'gotrek' }, rolls(0)).state;
  assert.equal(placed.activeHeroId, null);
  assert.equal(placed.movementRemaining, null);
  assert.deepEqual(placed.activatedHeroIds, ['gotrek']);
  assert.deepEqual(placed.guards, ['gotrek']);
  const next = resolveCommand(
    { ...placed, activatedHeroIds: [], round: 2 },
    { type: 'start-hero-activation', heroId: 'gotrek' },
    rolls(0)
  );
  assert.deepEqual(next.state.guards, []);
  assert.ok(next.events.some(event => event.type === 'guard-expired'));
  assert.throws(
    () =>
      resolveCommand(
        { ...arena(), actionsRemaining: 0 },
        { type: 'guard-hero', heroId: 'gotrek' },
        rolls(0)
      ),
    RulesError
  );
});

test('Guard ignores side and rear movement and an enemy already adjacent that holds', () => {
  const base = arena();
  const state: GameState = {
    ...base,
    guards: ['gotrek'],
    phase: 'skaven',
    activeHeroId: null,
    activeSkavenId: 'enemy',
    skavenTurnStep: 'activate-skaven',
    skavenActivationIds: ['enemy'],
    skavenActionsRemaining: 1,
    skavenMovementRemaining: 4,
    skaven: [{ ...base.skaven[0]!, position: { row: 17, column: 4 } }],
  };
  for (const path of [[], [{ row: 16, column: 4 }], [{ row: 17, column: 3 }]]) {
    const result = resolveCommand(
      state,
      { type: 'move-skaven', skavenId: 'enemy', path, facing: 'north' },
      rolls(0)
    );
    assert.deepEqual(result.state.guards, ['gotrek']);
    assert.equal(result.state.combatLog.length, 0);
  }
});

test('multiple Guards resolve in roster order, with a survivor continuing movement', () => {
  const base = arena('gotrek', 'rat-ogor');
  const state: GameState = {
    ...base,
    guards: ['gotrek', 'ulrika'],
    heroes: [
      ...base.heroes,
      {
        id: 'ulrika',
        definitionId: 'ulrika',
        position: { row: 16, column: 5 },
        facing: 'north',
        woundsRemaining: 2,
      },
    ],
    phase: 'skaven',
    activeHeroId: null,
    activeSkavenId: 'enemy',
    skavenTurnStep: 'activate-skaven',
    skavenActivationIds: ['enemy'],
    skavenActionsRemaining: 1,
    skavenMovementRemaining: 3,
    skaven: [{ ...base.skaven[0]!, position: { row: 14, column: 4 } }],
  };
  const result = resolveCommand(
    state,
    {
      type: 'move-skaven',
      skavenId: 'enemy',
      path: [
        { row: 15, column: 4 },
        { row: 16, column: 4 },
      ],
      facing: 'south',
    },
    rolls(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
  );
  assert.deepEqual(result.state.guards, []);
  assert.deepEqual(
    result.state.combatLog.map(fight => fight.heroId),
    ['gotrek', 'ulrika']
  );
  assert.deepEqual(result.state.skaven[0]!.position, { row: 16, column: 4 });
});

test('a model placed from revealed Noise triggers Guard and never rolls hidden Nothing', () => {
  const base = arena();
  const state: GameState = {
    ...base,
    skaven: [],
    guards: ['gotrek'],
    revealedNoise: [
      {
        id: 'noise',
        resultId: 'gutter-runner',
        position: { row: 15, column: 4 },
        remainingModels: ['gutter-runner'],
      },
    ],
  };
  const result = resolveCommand(
    state,
    {
      type: 'place-revealed-skaven',
      noiseId: 'noise',
      position: { row: 15, column: 4 },
      facing: 'south',
    },
    rolls(0.99, 0, 0, 0, 0)
  );
  assert.equal(result.state.skaven.length, 0);
  assert.equal(result.state.guards.length, 0);
  assert.equal(result.state.combatLog.length, 1);
});

test('Rememberer is available to another hero once per round', () => {
  const base = arena('ulrika');
  const felix = { ...base.heroes[0]!, id: 'felix' as const, definitionId: 'felix' as const };
  const pending = attack({ ...base, heroes: [base.heroes[0]!, felix] }, rolls(0, 0, 0.99)).state;
  const spent = resolveCommand(
    pending,
    { type: 'reroll-fight-die', ability: 'rememberer', dieIndex: 0 },
    rolls(0)
  ).state;
  assert.equal(spent.abilityUsage.remembererRound, 1);
  assert.equal(attack(spent, rolls(0, 0, 0.99)).state.pendingCombat, null);
  assert.ok(attack({ ...spent, round: 2 }, rolls(0, 0, 0.99)).state.pendingCombat);
});

test('Ward rerolls only eligible dice and consumes itself even if every die was already rerolled', () => {
  const pending = attack({ ...arena('felix'), wards: ['felix'] }, rolls(0, 0, 0.99)).state;
  const one = resolveCommand(
    pending,
    { type: 'reroll-fight-die', ability: 'karaghul', dieIndex: 0 },
    rolls(0.4)
  ).state;
  const ward = one;
  const finished = resolveCommand(ward, { type: 'resolve-ward' }, rolls(0.99));
  assert.deepEqual(finished.state.combatLog[0]!.heroRolls, [3, 6]);
  assert.deepEqual(finished.state.wards, []);
  const noDice: GameState = {
    ...ward,
    pendingCombat: { ...ward.pendingCombat!, rerolledDice: [0, 1] },
  };
  const noReroll = resolveCommand(
    noDice,
    { type: 'resolve-ward' },
    {
      next: () => {
        throw new Error('No die is eligible');
      },
    }
  ).state;
  assert.equal(noReroll.heroes[0]!.woundsRemaining, 2);
  assert.deepEqual(noReroll.wards, []);
});

test('Ward remains on a win or tie and rejects duplicate, out-of-range, and non-Maximilian placement', () => {
  const base = arena('maximilian');
  const warded = { ...base, wards: ['maximilian' as const] };
  assert.deepEqual(attack(warded, rolls(0.99, 0)).state.wards, ['maximilian']);
  assert.deepEqual(attack(warded, rolls(0, 0)).state.wards, ['maximilian']);
  assert.throws(
    () =>
      resolveCommand(
        warded,
        { type: 'ward-hero', heroId: 'maximilian', targetHeroId: 'maximilian' },
        rolls(0)
      ),
    RulesError
  );
  assert.throws(
    () =>
      resolveCommand(
        arena(),
        { type: 'ward-hero', heroId: 'gotrek', targetHeroId: 'gotrek' },
        rolls(0)
      ),
    RulesError
  );
  assert.throws(
    () =>
      resolveCommand(
        {
          ...base,
          heroes: [
            ...base.heroes,
            {
              ...base.heroes[0]!,
              id: 'felix',
              definitionId: 'felix',
              position: { row: 12, column: 3 },
            },
          ],
        },
        { type: 'ward-hero', heroId: 'maximilian', targetHeroId: 'felix' },
        rolls(0)
      ),
    RulesError
  );
});

test('Ward is an eligible React action that costs Command and preserves Hero activation state', () => {
  const base = arena('maximilian');
  const state: GameState = {
    ...base,
    phase: 'skaven',
    activeHeroId: null,
    pendingReact: { source: 'skaven', sourceId: 'enemy' },
  };
  const result = resolveCommand(
    state,
    { type: 'react-ward-hero', heroId: 'maximilian', targetHeroId: 'maximilian' },
    rolls(0)
  ).state;
  assert.deepEqual(result.wards, ['maximilian']);
  assert.equal(result.command, 0);
  assert.equal(result.pendingReact, null);
  assert.equal(result.actionsRemaining, 2);
});

test('React combat retains its interruption and spends Command only once after rerolls', () => {
  const base = arena('felix');
  const state: GameState = {
    ...base,
    phase: 'skaven',
    activeHeroId: null,
    activeSkavenId: 'enemy',
    skavenTurnStep: 'activate-skaven',
    skavenActivationIds: ['enemy'],
    skavenActionsRemaining: 1,
    skavenMovementRemaining: 0,
    pendingReact: { source: 'skaven', sourceId: 'enemy' },
  };
  const pending = resolveCommand(
    state,
    { type: 'react-fight-skaven', heroId: 'felix', skavenId: 'enemy' },
    rolls(0.5, 0, 0.5)
  ).state;
  assert.equal(pending.command, 2);
  assert.ok(pending.pendingCombat);
  assert.throws(() => resolveCommand(pending, { type: 'skip-react' }, rolls(0)), RulesError);
  const done = resolveCommand(pending, { type: 'accept-fight-rolls' }, rolls(0)).state;
  assert.equal(done.command, 0);
  assert.equal(done.pendingReact, null);
  assert.equal(done.skavenActionsRemaining, 1);
});

test('rejected reroll and Ward randomness leave saved choices and usage unchanged', () => {
  const pending = attack(arena('felix'), rolls(0)).state;
  const before = JSON.stringify(pending);
  for (const dieIndex of [-1, 0.5, 2, NaN]) {
    assert.throws(
      () =>
        resolveCommand(
          pending,
          { type: 'reroll-fight-die', ability: 'karaghul', dieIndex },
          rolls(0)
        ),
      RulesError
    );
  }
  assert.throws(
    () =>
      resolveCommand(
        pending,
        { type: 'reroll-fight-die', ability: 'karaghul', dieIndex: 0 },
        rolls(1)
      ),
    RulesError
  );
  assert.equal(JSON.stringify(pending), before);
  const ward = attack({ ...arena('maximilian'), wards: ['maximilian'] }, rolls(0, 0.99)).state;
  const wardBefore = JSON.stringify(ward);
  assert.throws(() => resolveCommand(ward, { type: 'resolve-ward' }, rolls(NaN)), RulesError);
  assert.equal(JSON.stringify(ward), wardBefore);
});

test('legacy saves migrate markers and usage explicitly', () => {
  const legacy = JSON.parse(JSON.stringify(arena()));
  for (const field of ['guards', 'wards', 'abilityUsage', 'pendingCombat', 'pendingSkavenMovement'])
    delete legacy[field];
  const restored = restoreGameState(legacy, THE_NEST);
  assert.deepEqual(restored.guards, []);
  assert.deepEqual(restored.wards, []);
  assert.equal(restored.pendingCombat, null);
});

test('automatic placement failures reject the entire session transaction without saving partial movement', () => {
  const base = arena('ulrika');
  const state: GameState = {
    ...base,
    skaven: [],
    guards: ['gotrek'],
    heroes: [
      ...base.heroes,
      {
        id: 'gotrek',
        definitionId: 'gotrek',
        position: { row: 16, column: 5 },
        facing: 'north',
        woundsRemaining: 3,
      },
    ],
    concealedNoise: [{ id: 'noise', resultId: 'gutter-runner', position: { row: 15, column: 4 } }],
  };
  const saves: GameState[] = [];
  const session = new GameSession(THE_NEST, rolls(1), state, next => saves.push(next));
  const before = session.state;
  assert.throws(
    () =>
      session.dispatch({
        type: 'move-hero',
        heroId: 'ulrika',
        path: [{ row: 16, column: 4 }],
        facing: 'north',
      }),
    RulesError
  );
  assert.equal(session.state, before);
  assert.deepEqual(saves, []);
});

test('solo AI stops for Guard rerolls and resumes through React into the next round', () => {
  const base = arena('felix', 'rat-ogor');
  const state: GameState = {
    ...base,
    mode: 'solo',
    guards: ['felix'],
    phase: 'skaven',
    activeHeroId: null,
    activeSkavenId: 'enemy',
    skavenTurnStep: 'activate-skaven',
    skavenActivationIds: ['enemy'],
    skavenActionsRemaining: 1,
    skavenMovementRemaining: 3,
    remainingNoiseBag: [],
    skaven: [{ ...base.skaven[0]!, position: { row: 14, column: 4 } }],
  };
  const session = new GameSession(THE_NEST, rolls(0.5, 0, 0.5, 0, 0), state);
  session.dispatch({
    type: 'move-skaven',
    skavenId: 'enemy',
    path: [
      { row: 15, column: 4 },
      { row: 16, column: 4 },
    ],
    facing: 'south',
  });
  const before = session.state;
  assert.equal(getNextSoloSkavenCommand(session, rolls(0)), null);
  assert.deepEqual(runSoloSkavenAi(session, rolls(0)), []);
  assert.equal(session.state, before);
  session.dispatch({ type: 'accept-fight-rolls' });
  assert.ok(session.state.pendingReact);
  session.dispatch({ type: 'skip-react' });
  runSoloSkavenAi(session, rolls(0));
  if (session.state.pendingCombat) session.dispatch({ type: 'accept-fight-rolls' });
  runSoloSkavenAi(session, rolls(0));
  assert.equal(session.state.phase, 'hero');
  assert.equal(session.state.round, 2);
});

test('reroll history preserves old and new dice and every nested value is immutable', () => {
  const pending = attack(arena('felix'), rolls(0, 0, 0.99)).state;
  const rerolled = resolveCommand(
    pending,
    { type: 'reroll-fight-die', ability: 'karaghul', dieIndex: 0 },
    rolls(0.4)
  );
  assert.deepEqual(rerolled.state.combatLog[0]!.rerolls![0]!.previousRolls, [1]);
  assert.deepEqual(rerolled.state.combatLog[0]!.rerolls![0]!.rolls, [3]);
  assert.ok(Object.isFrozen(rerolled.state.combatLog[0]!.rerolls![0]!.rolls));
  assert.ok(Object.isFrozen(rerolled.events[0]));
  assert.ok(Object.isFrozen((rerolled.events[0] as { rolls: readonly number[] }).rolls));
});

test('Guard on the final reinforcement resolves in the old round before Command and reroll usage reset', () => {
  const base = arena('felix', 'rat-ogor');
  const state: GameState = {
    ...base,
    phase: 'skaven',
    activeHeroId: null,
    skavenTurnStep: 'reinforce',
    reinforcementDrawsResolved: 2,
    skaven: [],
    guards: ['felix'],
    wards: ['felix'],
    heroes: [{ ...base.heroes[0]!, position: { row: 1, column: 11 } }],
    revealedNoise: [
      {
        id: 'new',
        resultId: 'rat-ogor',
        position: { row: 0, column: 10 },
        remainingModels: ['rat-ogor'],
      },
    ],
    abilityUsage: { ...base.abilityUsage, karaghulRound: 1 },
  };
  const pending = resolveCommand(
    state,
    {
      type: 'place-revealed-skaven',
      noiseId: 'new',
      position: { row: 0, column: 10 },
      facing: 'south',
    },
    rolls(0, 0, 0.99, 0, 0)
  ).state;
  assert.equal(pending.round, 1);
  assert.equal(pending.phase, 'skaven');
  assert.equal(pending.pendingCombat?.stage, 'ward');
  const done = resolveCommand(pending, { type: 'resolve-ward' }, rolls(0)).state;
  assert.equal(done.round, 2);
  assert.equal(done.phase, 'hero');
  assert.equal(done.command, 2);
});

test('Guard after active Noise placement resolves before React and a slain group cannot stall without Command', () => {
  const base = arena();
  const state: GameState = {
    ...base,
    phase: 'skaven',
    activeHeroId: null,
    skavenTurnStep: 'activate-noise',
    activeNoiseId: 'new',
    noiseActivationIds: ['new'],
    skaven: [],
    guards: ['gotrek'],
    revealedNoise: [
      {
        id: 'new',
        resultId: 'gutter-runner',
        position: { row: 15, column: 4 },
        remainingModels: ['gutter-runner'],
      },
    ],
  };
  const result = resolveCommand(
    { ...state, command: 0 },
    {
      type: 'place-revealed-skaven',
      noiseId: 'new',
      position: { row: 15, column: 4 },
      facing: 'south',
    },
    rolls(0.99, 0, 0, 0, 0)
  );
  assert.equal(result.state.skaven.length, 0);
  assert.equal(result.state.skavenTurnStep, 'reinforce');
  const guardedFelix: GameState = {
    ...state,
    heroes: [{ ...base.heroes[0]!, id: 'felix', definitionId: 'felix' }],
    guards: ['felix'],
  };
  const pending = resolveCommand(
    guardedFelix,
    {
      type: 'place-revealed-skaven',
      noiseId: 'new',
      position: { row: 15, column: 4 },
      facing: 'south',
    },
    rolls(0.5, 0.5, 0.5, 0.5)
  ).state;
  assert.ok(pending.pendingCombat);
  assert.equal(pending.pendingReact, null);
  const done = resolveCommand(pending, { type: 'accept-fight-rolls' }, rolls(0)).state;
  assert.equal(done.pendingReact!.source, 'noise');
});

test('Brute Strength reports two wounds even when its damage exceeds remaining HP', () => {
  const base = arena('gotrek', 'rat-ogor');
  const result = attack(
    { ...base, heroes: [{ ...base.heroes[0]!, woundsRemaining: 1 }] },
    rolls(0, 0, 0, 0, 0.99, 0, 0)
  );
  assert.equal(result.state.heroes[0]!.woundsRemaining, 0);
  assert.equal(result.state.combatLog[0]!.woundsInflicted, 2);
});

test('pending Fight and movement projections exclude concealed and pending Noise identities', () => {
  const pending = attack(arena('felix'), rolls(0)).state;
  const publicView = projectHeroView({
    ...pending,
    concealedNoise: [
      { id: 'hidden', resultId: 'three-clanrats', position: { row: 0, column: 10 } },
    ],
    pendingNoise: { id: 'drawn', resultId: 'two-clanrats' },
  });
  const serialized = JSON.stringify(publicView);
  assert.doesNotMatch(serialized, /three-clanrats|two-clanrats|resultId|pendingNoise/);
  assert.ok(publicView.pendingCombat);
});
