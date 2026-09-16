import type { GameState } from '/src/game/gameState.js';
import { v4WithTimestamp } from '/src/uuid.js';

const STORAGE_KEY = 'games';

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
    const json = this.#getStorage().getItem(STORAGE_KEY);
    if (json === null) {
      this.#persist();
      this.#emitChangeEvent('init');
      return;
    }

    try {
      const records: unknown = JSON.parse(json);
      if (!Array.isArray(records)) {
        throw new TypeError('Expected the saved-games value to be an array');
      }
      if (records.length > 1) {
        console.warn('[DataStore] Multiple saved games found; keeping only the newest record.');
      }
      const record = records[0];
      if (record !== undefined && !isDataRecord(record)) {
        throw new TypeError('The saved game has an unsupported or invalid format');
      }
      this.#savedGame = record ?? null;
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
    if (this.#savedGame === null && this.#getStorage().getItem(STORAGE_KEY) === '[]') return;
    this.#savedGame = null;
    this.#persist();
    this.#emitChangeEvent('clear');
  }

  #persist(): void {
    this.#getStorage().setItem(
      STORAGE_KEY,
      JSON.stringify(this.#savedGame ? [this.#savedGame] : [])
    );
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
