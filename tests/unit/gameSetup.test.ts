import type {} from '../../components/ConfirmationModal.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameSession } from '../../src/game/gameSession.ts';
import { THE_NEST } from '../../src/game/missions/theNest.ts';
import type { CombatResult, GameEvent } from '../../src/game/gameState.ts';

// Minimal DOM surface for exercising the real component without a dependency.
class TestElement extends EventTarget {
  tagName: string;
  className = '';
  id = '';
  textContent = '';
  children: TestElement[] = [];
  shadowRoot: TestElement | null = null;
  constructor(tagName = '') {
    super();
    this.tagName = tagName;
  }
  attachShadow() {
    this.shadowRoot = new TestElement();
    return this.shadowRoot;
  }
  appendChild(child: TestElement) {
    this.children.push(child);
    return child;
  }
  append(...children: TestElement[]) {
    this.children.push(...children);
  }
  setAttribute() {}
  getBoundingClientRect() {
    return { width: 0, height: 0 };
  }
  replaceChildren(...children: TestElement[]) {
    this.children = children;
  }
  querySelector(selector: string): TestElement | null {
    for (const child of this.children) {
      if (
        selector.startsWith('.')
          ? child.className.split(' ').includes(selector.slice(1))
          : selector.startsWith('#')
            ? child.id === selector.slice(1)
            : child.tagName === selector
      )
        return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
}

Object.defineProperties(globalThis, {
  HTMLElement: { value: TestElement, configurable: true },
  document: { value: { createElement: (tag: string) => new TestElement(tag) }, configurable: true },
  customElements: { value: { define() {} }, configurable: true },
  ResizeObserver: {
    value: class {
      observe() {}
      disconnect() {}
    },
    configurable: true,
  },
});
const { GameSetup } = await import('../../components/GameSetup.ts');
const { GameBoard } = await import('../../components/GameBoard.ts');

const older: CombatResult = {
  heroId: 'gotrek',
  skavenId: 'skaven-1',
  skavenDefinitionId: 'clanrat',
  heroRolls: [6, 2, 3],
  skavenRolls: [1],
  outcome: 'hero-won',
};
const newer: CombatResult = { ...older, heroId: 'felix', heroRolls: [1, 1], outcome: 'skaven-won' };

test('combat log renders newest first without mutating persisted chronology and supports keyboard scrolling', () => {
  const setup = new GameSetup();
  const history = Object.freeze([older, newer]);
  setup.view = {
    ...new GameSession(THE_NEST, { next: () => 0 }).heroView,
    setupStep: 'complete',
    combatLog: history,
  };
  const list = setup.shadowRoot?.querySelector('.combat-log');
  assert.ok(list);
  assert.match(list.children[0]!.textContent!, /^Felix Jaeger/);
  assert.match(list.children[1]!.textContent!, /^Gotrek Gurnisson/);
  assert.equal((list as HTMLOListElement).tabIndex, 0);
  assert.equal((list as HTMLOListElement).reversed, true);
  assert.deepEqual(history, [older, newer]);
});

test('announcing a fight immediately updates the live region and emits a public highlight', () => {
  const setup = new GameSetup();
  setup.connectedCallback();
  const highlights: unknown[] = [];
  setup.addEventListener('game-important-event', event =>
    highlights.push((event as CustomEvent).detail)
  );
  setup.announce([{ type: 'fight-rolled', ...older }]);
  assert.match(setup.shadowRoot!.querySelector('.announcement')!.textContent!, /won the Fight/);
  assert.equal(highlights.length, 1);
  setup.announce([{ type: 'noise-drawn' } as GameEvent]);
  assert.equal(highlights.length, 1, 'private draws do not overwrite public results');
});

test('a smashed door is announced without exposing an unrevealed Noise identity', () => {
  const setup = new GameSetup();
  setup.connectedCallback();
  setup.announce([
    { type: 'door-destroyed', position: { row: 6, column: 4 } },
    { type: 'noise-activation-ended', noiseId: 'noise-1' },
    { type: 'reinforcement-started' },
  ]);
  const announcement = setup.shadowRoot!.querySelector('.announcement')!.textContent!;
  assert.match(announcement, /Door destroyed at row 7, column 5/);
  assert.doesNotMatch(announcement, /Rat Ogor/);
});

test('the board description distinguishes opened doors from doors that cannot be closed again', () => {
  const board = new GameBoard();
  board.doors = [
    { position: { row: 6, column: 4 }, status: 'open' },
    { position: { row: 14, column: 6 }, status: 'destroyed' },
  ];
  const description = board.shadowRoot!.querySelector('.description')!.textContent!;
  assert.match(description, /Open doors: row 7, column 5\./);
  assert.match(description, /Destroyed doors: row 15, column 7.*cannot be closed/i);
});

const contentText = (element: {
  textContent: string | null;
  children: ArrayLike<Element>;
}): string =>
  [element.textContent, ...Array.from(element.children, child => contentText(child))].join(' ');

const buttons = (element: TestElement): TestElement[] => [
  ...(element.tagName === 'button' ? [element] : []),
  ...element.children.flatMap(buttons),
];

test('location based hero abilities offer one action button and a board selection prompt', () => {
  const setup = new GameSetup();
  const base = new GameSession(THE_NEST, { next: () => 0 }).heroView;
  setup.view = {
    ...base,
    setupStep: 'complete',
    phase: 'hero',
    activeHeroId: 'malakai',
    heroes: [
      {
        id: 'malakai',
        definitionId: 'malakai',
        position: { row: 14, column: 5 },
        facing: 'north',
        woundsRemaining: 2,
      },
    ],
    actionsRemaining: 2,
    legalChargePositions: [
      { row: 14, column: 6 },
      { row: 13, column: 5 },
    ],
  };
  const charge = buttons(setup.shadowRoot as unknown as TestElement).filter(button =>
    button.textContent.includes('Place Demolition Charge')
  );
  assert.equal(charge.length, 1);
  assert.doesNotMatch(contentText(setup.shadowRoot!), /Place charge · row/);
  const events: string[] = [];
  setup.addEventListener('hero-charge-requested', () => events.push('charge'));
  charge[0]!.dispatchEvent(new Event('click'));
  assert.deepEqual(events, ['charge']);
  setup.chooseBoardAction('charge');
  assert.match(contentText(setup.shadowRoot!), /Select a highlighted target on the board/);
  assert.match(contentText(setup.shadowRoot!), /Cancel selection/);
});

test('Demolition Charge detonation is disabled while Malakai is in melee range', () => {
  const setup = new GameSetup();
  const base = new GameSession(THE_NEST, { next: () => 0 }).heroView;
  const view = {
    ...base,
    setupStep: 'complete' as const,
    phase: 'hero' as const,
    activeHeroId: 'malakai' as const,
    heroes: [
      {
        id: 'malakai' as const,
        definitionId: 'malakai' as const,
        position: { row: 15, column: 5 },
        facing: 'north' as const,
        woundsRemaining: 2,
      },
    ],
    skaven: [
      {
        id: 'enemy',
        sourceNoiseId: 'old',
        definitionId: 'clanrat' as const,
        position: { row: 15, column: 6 },
        facing: 'south' as const,
        woundsRemaining: 1,
      },
    ],
    demolitionCharge: { position: { row: 14, column: 6 }, feature: 'door' as const },
  };
  setup.view = view;
  const detonate = () =>
    buttons(setup.shadowRoot as unknown as TestElement).find(
      button => button.textContent === 'Detonate Demolition Charge'
    ) as unknown as HTMLButtonElement;
  assert.equal(detonate().disabled, true);
  setup.view = {
    ...view,
    skaven: [{ ...view.skaven[0]!, position: { row: 13, column: 5 } }],
  };
  assert.equal(detonate().disabled, false);
});

test('pending Slayer’s Fury offers one move and one attack choice for map targets', () => {
  const setup = new GameSetup();
  const base = new GameSession(THE_NEST, { next: () => 0 }).heroView;
  setup.view = {
    ...base,
    setupStep: 'complete',
    phase: 'hero',
    pendingAbility: { type: 'slayers-fury', heroId: 'gotrek' },
    legalAbilityFightTargetIds: ['first', 'second'],
    legalAbilityMovePositions: [
      { row: 15, column: 3 },
      { row: 16, column: 4 },
    ],
  };
  assert.deepEqual(
    buttons(setup.shadowRoot as unknown as TestElement)
      .map(button => button.textContent)
      .filter(text => ['Attack', 'Move 1 square', 'Finish ability'].includes(text)),
    ['Attack', 'Move 1 square', 'Finish ability']
  );
  assert.doesNotMatch(contentText(setup.shadowRoot!), /Move to row|Attack Clanrat/);
  setup.chooseBoardAction('ability-move');
  assert.deepEqual(
    buttons(setup.shadowRoot as unknown as TestElement)
      .map(button => button.textContent)
      .filter(text => ['Attack', 'Move 1 square', 'Cancel selection'].includes(text)),
    ['Move 1 square', 'Cancel selection']
  );
});

const fightView = (): import('../../src/game/gameState.ts').HeroGameView => ({
  ...new GameSession(THE_NEST, { next: () => 0 }).heroView,
  setupStep: 'complete',
  phase: 'skaven',
  mode: 'two-player',
  round: 1,
  skavenTurnStep: 'activate-skaven',
  heroes: [
    {
      id: 'felix',
      definitionId: 'felix',
      position: { row: 16, column: 3 },
      facing: 'north',
      woundsRemaining: 2,
    },
  ],
  skaven: [
    {
      id: 'enemy',
      sourceNoiseId: 'old',
      definitionId: 'rat-ogor',
      position: { row: 15, column: 3 },
      facing: 'south',
      woundsRemaining: 2,
    },
  ],
  pendingCombat: {
    heroId: 'felix',
    skavenId: 'enemy',
    skavenDefinitionId: 'rat-ogor',
    heroRolls: [1, 2],
    skavenRolls: [6, 2, 1],
    outcome: 'skaven-won',
    source: 'guard',
    stage: 'rerolls',
    rerolledDice: [],
  },
});

test('shared-device Fight choices require Hero handoff, hide turn controls, and pass back after resolution', () => {
  const setup = new GameSetup();
  const view = fightView();
  setup.view = view;
  assert.match(contentText(setup.shadowRoot!), /Hand the device to the Hero player/);
  assert.doesNotMatch(contentText(setup.shadowRoot!), /Karaghul: reroll/);
  setup.shadowRoot!.querySelector('button')!.dispatchEvent(new Event('click'));
  assert.match(contentText(setup.shadowRoot!), /Karaghul: reroll die 1 \(1\)/);
  assert.doesNotMatch(contentText(setup.shadowRoot!), /Rememberer: reroll/);
  assert.doesNotMatch(contentText(setup.shadowRoot!), /Start activation|Reinforce|Movement ·/);
  setup.view = { ...view, pendingCombat: null };
  assert.match(contentText(setup.shadowRoot!), /Hand the device to the Skaven player/);
});

test('reroll buttons dispatch the die identity and disappear once that die is rerolled', () => {
  const setup = new GameSetup();
  const view = { ...fightView(), phase: 'hero' as const };
  setup.view = view;
  const commands: unknown[] = [];
  setup.addEventListener('game-command', event => commands.push((event as CustomEvent).detail));
  setup.shadowRoot!.querySelector('button')!.dispatchEvent(new Event('click'));
  assert.deepEqual(commands, [{ type: 'reroll-fight-die', ability: 'karaghul', dieIndex: 0 }]);
  setup.view = { ...view, pendingCombat: { ...view.pendingCombat!, rerolledDice: [0] } };
  assert.doesNotMatch(contentText(setup.shadowRoot!), /reroll die 1/);
  assert.match(contentText(setup.shadowRoot!), /reroll die 2/);
});

test('a spent Karaghul is hidden for the rest of the round, including the Skaven turn', () => {
  const setup = new GameSetup();
  const view = fightView();
  setup.view = {
    ...view,
    abilityUsage: { ...view.abilityUsage, karaghulRound: view.round },
  };
  setup.shadowRoot!.querySelector('button')!.dispatchEvent(new Event('click'));
  assert.doesNotMatch(contentText(setup.shadowRoot!), /Karaghul: reroll/);
  assert.doesNotMatch(contentText(setup.shadowRoot!), /Rememberer: reroll/);
});

test('Ward prompts describe forced eligible dice and public combat history includes rerolls and two-wound damage', () => {
  const setup = new GameSetup();
  const view = fightView();
  setup.view = { ...view, phase: 'hero', pendingCombat: { ...view.pendingCombat!, stage: 'ward' } };
  assert.match(contentText(setup.shadowRoot!), /Resolve Ward reroll/);
  assert.doesNotMatch(contentText(setup.shadowRoot!), /Accept Fight dice/);
  setup.view = {
    ...view,
    phase: 'hero',
    pendingCombat: null,
    combatLog: [
      {
        ...newer,
        woundsInflicted: 2,
        rerolls: [{ ability: 'karaghul', dieIndices: [0], previousRolls: [1], rolls: [3] }],
      },
    ],
  };
  assert.match(contentText(setup.shadowRoot!), /hero suffers 2 Wounds/);
  assert.match(contentText(setup.shadowRoot!), /karaghul: dice 1 \[1\] → \[3\]/);
});

test('Guard and Ward are present in accessible board descriptions', () => {
  const board = new GameBoard();
  board.heroes = [
    {
      label: 'Fe',
      position: { row: 16, column: 3 },
      facing: 'north',
      woundsRemaining: 2,
      woundsMaximum: 2,
      guarded: true,
      warded: true,
    },
  ];
  assert.match(
    board.shadowRoot!.querySelector('.description')!.textContent!,
    /Wounds remaining, Guard, Ward/
  );
});

test('Guard combat passes directly into React while the Hero player retains the device', () => {
  const setup = new GameSetup();
  const view = fightView();
  setup.view = view;
  setup.shadowRoot!.querySelector('button')!.dispatchEvent(new Event('click'));
  setup.view = {
    ...view,
    pendingCombat: null,
    pendingReact: { source: 'skaven', sourceId: 'enemy' },
  };
  assert.match(contentText(setup.shadowRoot!), /React · 2 Command/);
  assert.doesNotMatch(
    contentText(setup.shadowRoot!),
    /I am the Skaven player|I am the Hero player/
  );
});
