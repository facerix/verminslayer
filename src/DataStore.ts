// singleton class to manage the user's data

import { v4WithTimestamp } from '/src/uuid.js';

export type TurnPhase = 'hero' | 'skaven';

/**
 * One tracked hero in a saved game.
 */
export interface HeroState {
  /** Hero card name, e.g. "GOTREK GURNISSON". */
  name: string;
  /** Current wounds remaining (starts at the card's Wounds value). */
  wounds: number;
  /** Once-per-mission abilities already spent this game. */
  spentAbilities?: string[];
}

/**
 * A saved Verminslayer game. The store keys these under localStorage `games`.
 *
 * TODO(rylee): firm up this shape as the tracker UI takes form — the board
 * state (model positions, door open/closed, noise token placement) is not
 * modelled yet and currently rides on the `[key: string]: unknown` index
 * signature.
 */
export interface DataRecord {
  id: string;
  /** Mission being played, e.g. "THE NEST". */
  mission?: string;
  /** Current round number (1-based). */
  round?: number;
  /** Whose turn it is. */
  phase?: TurnPhase;
  /** Command pool available to the heroes this round (Hero turn grants 3). */
  command?: number;
  /** Number of Nest markers destroyed (mission-specific). */
  nestsDestroyed?: number;
  heroes?: HeroState[];
  /** Free-form notes the player jots during play. */
  notes?: string;
  [key: string]: unknown;
}

export type ChangeType = 'init' | 'add' | 'update' | 'delete';

export interface DataStoreChangeDetail {
  items: DataRecord[];
  changeType: ChangeType;
  affectedRecords: DataRecord | DataRecord[] | string[];
}

let instance: DataStore | null = null;

class DataStore extends EventTarget {
  #items: DataRecord[] = [];
  #itemsById: Map<string, DataRecord> = new Map();

  constructor() {
    if (instance) {
      throw new Error('New instance cannot be created!!');
    }
    super();

    // Singleton: cache `this` so a second `new DataStore()` throws above.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    instance = this;
  }

  #loadRecordsFromJson(json: string): DataRecord[] {
    try {
      const records: unknown = JSON.parse(json);
      if (!Array.isArray(records)) {
        console.warn('[DataStore] Expected array JSON, falling back to empty list.');
        return [];
      }
      records.forEach((item: DataRecord, index: number) => {
        if (!item.id) {
          records[index].id = v4WithTimestamp();
        }
      });
      return records as DataRecord[];
    } catch (error) {
      console.warn('[DataStore] Failed to parse stored JSON, resetting items.', error);
      try {
        window.localStorage.setItem('games', '[]');
      } catch (storageError) {
        console.warn('[DataStore] Failed to reset stored items.', storageError);
      }
      return [];
    }
  }

  async init(): Promise<void> {
    let savedItemsJson = window.localStorage.getItem('games');
    if (!savedItemsJson) {
      savedItemsJson = '[]';
      window.localStorage.setItem('games', savedItemsJson);
    }
    this.#items = this.#loadRecordsFromJson(savedItemsJson);
    this.#reindex();

    setTimeout(() => {
      this.#emitChangeEvent('init', ['*']);
    }, 0);
  }

  import(jsonData: string): void {
    const newItems = this.#loadRecordsFromJson(jsonData);
    Array.prototype.unshift.apply(this.#items, newItems);
    this.#reindex();

    setTimeout(() => {
      this.#emitChangeEvent('init', ['*']);
    }, 0);
  }

  #saveItems(): void {
    window.localStorage.setItem('games', JSON.stringify(this.#items));
  }

  #emitChangeEvent(
    changeType: ChangeType,
    affectedRecords: DataStoreChangeDetail['affectedRecords']
  ): void {
    const changeEvent = new CustomEvent<DataStoreChangeDetail>('change', {
      detail: {
        items: this.#items,
        changeType,
        affectedRecords,
      },
    });
    this.dispatchEvent(changeEvent);
  }

  #reindex(): void {
    this.#itemsById = new Map();
    this.#items.forEach(item => {
      this.#itemsById.set(item.id, item);
    });
    this.#saveItems();
  }

  get items(): DataRecord[] {
    return this.#items;
  }

  getItemById(id: string): DataRecord | undefined {
    return this.#itemsById.get(id);
  }

  addItem(record: DataRecord): void {
    record.id = v4WithTimestamp();
    this.#items.unshift(record);
    this.#reindex();
    this.#emitChangeEvent('add', record);
  }

  updateItem(record: DataRecord): void {
    const index = this.#items.findIndex(rec => rec.id === record.id);
    if (index > -1) {
      this.#items[index] = record;
      this.#reindex();
      this.#emitChangeEvent('update', record);
    }
  }

  deleteItem(id: string): void {
    if (this.#itemsById.has(id)) {
      this.#items = this.#items.filter(r => r.id !== id);
      this.#reindex();
      this.#emitChangeEvent('delete', [id]);
    }
  }
}

const singleton = Object.freeze(new DataStore());

export default singleton;
