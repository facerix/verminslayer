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
  replaceChildren(...children: TestElement[]) {
    this.children = children;
  }
  querySelector(selector: string): TestElement | null {
    for (const child of this.children) {
      if (
        selector.startsWith('.')
          ? child.className.split(' ').includes(selector.slice(1))
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
});
const { GameSetup } = await import('../../components/GameSetup.ts');

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
