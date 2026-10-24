import assert from 'node:assert/strict';
import { test } from 'node:test';
import { latestImportantEvent } from '../../src/game/eventPresentation.ts';
import type { GameEvent } from '../../src/game/gameState.ts';

const fight: GameEvent = {
  type: 'fight-rolled',
  heroId: 'gotrek',
  skavenId: 'skaven-4',
  skavenDefinitionId: 'rat-ogor',
  heroRolls: [6, 3, 2],
  skavenRolls: [4, 1, 2],
  outcome: 'hero-won',
};

test('combat highlight includes both dice pools, wound outcome, and defeat', () => {
  const result = latestImportantEvent([
    fight,
    { type: 'model-wounded', faction: 'skaven', modelId: 'skaven-4', woundsRemaining: 0 },
    { type: 'model-defeated', faction: 'skaven', modelId: 'skaven-4' },
    { type: 'action-spent', heroId: 'gotrek', action: 'fight', actionsRemaining: 1 },
  ]);
  assert.equal(result?.title, 'Gotrek Gurnisson wins');
  assert.match(result!.detail, /Rat Ogor #4/);
  assert.match(result!.detail, /6, 3, 2/);
  assert.match(result!.detail, /4, 1, 2/);
  assert.match(result!.detail, /defeated/i);
});

test('ties and hero losses describe the actual wound result', () => {
  assert.match(latestImportantEvent([{ ...fight, outcome: 'tie' }])!.detail, /no Wound/i);
  assert.match(
    latestImportantEvent([{ ...fight, outcome: 'skaven-won' }])!.detail,
    /Gotrek Gurnisson suffers 1 Wound/
  );
});

test('latest important event wins over an earlier fight and routine bookkeeping', () => {
  const result = latestImportantEvent([
    fight,
    { type: 'noise-revealed', resultId: 'nothing', position: { row: 3, column: 2 } },
    { type: 'reinforcement-complete' },
  ]);
  assert.equal(result?.title, 'Noise revealed: Nothing');
  assert.match(result!.detail, /row 4, column 3/);
});

test('private draws and routine movement never produce public highlights', () => {
  assert.equal(latestImportantEvent([{ type: 'noise-drawn' }]), null);
  assert.equal(latestImportantEvent([{ type: 'hero-turn-started', round: 2, command: 2 }]), null);
  assert.equal(latestImportantEvent([]), null);
});

test('Brute Strength and Snorri survival highlights describe the effective damage', () => {
  assert.match(
    latestImportantEvent([{ ...fight, outcome: 'skaven-won', woundsInflicted: 2 }])!.detail,
    /suffers 2 Wounds/
  );
  const saved = latestImportantEvent([
    { ...fight, heroId: 'snorri', outcome: 'skaven-won', woundsInflicted: 0 },
    { type: 'snorri-saved', heroId: 'snorri' },
    { type: 'model-wounded', faction: 'hero', modelId: 'snorri', woundsRemaining: 1 },
  ]);
  assert.match(saved!.detail, /suffers 0 Wounds/);
  assert.match(saved!.detail, /leaves him with 1 Wound/);
  assert.doesNotMatch(saved!.detail, /is defeated/);
});

test('mission result takes priority over nest and Fight bookkeeping', () => {
  const result = latestImportantEvent([
    fight,
    { type: 'nest-destroyed', position: { row: 9, column: 1 } },
    { type: 'exit-opened' },
    { type: 'game-ended', result: { winner: 'heroes', reason: 'exit' } },
  ]);
  assert.equal(result?.title, 'Hero victory');
  assert.match(result!.detail, /Watch Post/);
});
