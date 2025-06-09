// src/lib/wordCache.ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

const DB_NAME = 'vokan-dictionary-cache';
const DB_VERSION = 1;
const STORE_NAME = 'wordChunks';

interface VokanDB extends DBSchema {
  [STORE_NAME]: {
    key: string; // The letter (e.g., 'a', 'b')
    value: string[]; // Array of words for that letter
  };
}

let dbPromise: Promise<IDBPDatabase<VokanDB>> | null = null;

const getDb = (): Promise<IDBPDatabase<VokanDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<VokanDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
      blocked() {
        console.warn('[wordCache] IndexedDB upgrade is blocked. Please close other tabs using this app.');
        // Potentially show a notification to the user
      },
      blocking() {
        console.warn('[wordCache] IndexedDB upgrade is blocking other tabs. Please refresh them after upgrade.');
         // Potentially show a notification to the user
      },
      terminated() {
        console.error('[wordCache] IndexedDB connection terminated unexpectedly. The database is no longer available.');
        // This is a critical error, might need to re-initialize or inform the user
        dbPromise = null; // Allow re-initialization on next call
      }
    });
  }
  return dbPromise;
};


export const wordCache = {
  async saveChunk(letter: string, words: string[]): Promise<void> {
    try {
      const db = await getDb();
      await db.put(STORE_NAME, words, letter.toLowerCase());
    } catch (error) {
      console.error(`[wordCache] Error saving chunk for letter "${letter}" to IndexedDB:`, error);
      // Optionally, handle specific errors or re-throw
    }
  },

  async getChunk(letter: string): Promise<string[] | undefined> {
    try {
      const db = await getDb();
      const chunk = await db.get(STORE_NAME, letter.toLowerCase());
      if (chunk) {
      } else {
      }
      return chunk;
    } catch (error) {
      console.error(`[wordCache] Error getting chunk for letter "${letter}" from IndexedDB:`, error);
      return undefined;
    }
  },

  async clearCache(): Promise<void> {
    try {
      const db = await getDb();
      await db.clear(STORE_NAME);
    } catch (error) {
      console.error('[wordCache] Error clearing IndexedDB:', error);
    }
  }
};
