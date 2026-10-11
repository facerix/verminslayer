import type { GameState } from '/src/game/gameState.js';
import { v4WithTimestamp } from '/src/uuid.js';

const SCHEMA = {
  SAVED_GAME: 'savedGame',
};

export const SAVE_SCHEMA_VERSION = 1 as const;

/** The single resumable Verminslayer game stored in localStorage. */
export interface DataRecord {
  readonly id: string;
  readonly schemaVersion: typeof SAVE_SCHEMA_VERSION;
  readonly savedAt: string;
  readonly state: GameState;
}

export type ChangeType = 'init' | 'save' | 'clear';

export interface DataStoreChangeDetail {
  readonly savedGame: DataRecord | null;
  readonly changeType: ChangeType;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isDataRecord = (value: unknown): value is DataRecord =>
  isObject(value) &&
  typeof value.id === 'string' &&
  value.schemaVersion === SAVE_SCHEMA_VERSION &&
  typeof value.savedAt === 'string' &&
  isObject(value.state) &&
  typeof value.state.missionId === 'string';

/**
 * Singleton-compatible localStorage boundary for the one resumable game.
 *
 * The storage dependency is injectable so its one-save invariant can be tested without a
 * browser. Application code uses the default singleton exported below.
 */
export class DataStore extends EventTarget {
  readonly #storage: Storage | null;
  #savedGame: DataRecord | null = null;

  constructor(storage?: Storage) {
    super();
    this.#storage = storage ?? null;
  }

  init(): void {
    // we store invididual items at the localStorage root rather than nesting them under a single app-named key
    const json = this.#getStorage().getItem(SCHEMA.SAVED_GAME);
    if (json === null) {
      this.#persist();
      this.#emitChangeEvent('init');
      return;
    }

    try {
      const savedGame: GameState = JSON.parse(json);
      if (savedGame !== undefined && !isDataRecord(savedGame)) {
        throw new TypeError('The saved game has an unsupported or invalid format');
      }
      this.#savedGame = savedGame ?? null;
      this.#persist();
    } catch (error) {
      console.warn('[DataStore] Saved game could not be restored and was cleared.', error);
      this.#savedGame = null;
      this.#persist();
    }

    this.#emitChangeEvent('init');
  }

  get savedGame(): DataRecord | null {
    return this.#savedGame;
  }

  saveGame(state: GameState): void {
    this.#savedGame = Object.freeze({
      id: this.#savedGame?.id ?? v4WithTimestamp(),
      schemaVersion: SAVE_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      state,
    });
    this.#persist();
    this.#emitChangeEvent('save');
  }

  clearSavedGame(): void {
    if (this.#savedGame === null && !this.#getStorage().getItem(SCHEMA.SAVED_GAME)) return;
    this.#savedGame = null;
    this.#persist();
    this.#emitChangeEvent('clear');
  }

  #persist(): void {
    if (this.#savedGame) {
      this.#getStorage().setItem(SCHEMA.SAVED_GAME, JSON.stringify(this.#savedGame));
    } else {
      this.#getStorage().removeItem(SCHEMA.SAVED_GAME);
    }
  }

  #getStorage(): Storage {
    if (this.#storage) return this.#storage;
    if (typeof window === 'undefined') {
      throw new Error('The default DataStore requires browser localStorage');
    }
    return window.localStorage;
  }

  #emitChangeEvent(changeType: ChangeType): void {
    this.dispatchEvent(
      new CustomEvent<DataStoreChangeDetail>('change', {
        detail: { savedGame: this.#savedGame, changeType },
      })
    );
  }
}

const singleton = Object.freeze(new DataStore());

export default singleton;
