import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DataStore, SAVE_SCHEMA_VERSION } from '../../src/DataStore.ts';
import { createInitialGameState } from '../../src/game/gameState.ts';
import { THE_NEST } from '../../src/game/missions/theNest.ts';

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>();

  get length(): number {
    return this.#values.size;
  }

  clear(): void {
    this.#values.clear();
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }
}

test('the data store keeps at most one complete saved game and can clear it', () => {
  const storage = new MemoryStorage();
  const store = new DataStore(storage);
  store.init();

  const firstState = createInitialGameState(THE_NEST);
  store.saveGame(firstState);
  store.saveGame({ ...firstState, round: 3, phase: 'hero' });

  const storedRecords = JSON.parse(storage.getItem('games') ?? 'null') as unknown[];
  assert.equal(storedRecords.length, 1);
  assert.equal(store.savedGame?.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.equal(store.savedGame?.state.round, 3);

  store.clearSavedGame();

  assert.equal(store.savedGame, null);
  assert.equal(storage.getItem('games'), '[]');
});

test('the data store restores the single saved game from localStorage', () => {
  const storage = new MemoryStorage();
  const state = { ...createInitialGameState(THE_NEST), round: 2, phase: 'skaven' as const };
  storage.setItem(
    'games',
    JSON.stringify([
      {
        id: 'saved-game',
        schemaVersion: SAVE_SCHEMA_VERSION,
        savedAt: '2026-09-15T12:00:00.000Z',
        state,
      },
    ])
  );
  const store = new DataStore(storage);

  store.init();

  assert.equal(store.savedGame?.id, 'saved-game');
  assert.equal(store.savedGame?.state.round, 2);
  assert.equal(store.savedGame?.state.phase, 'skaven');
});
