// src/lib/wordCache.ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

const DB_NAME = 'lexify-dictionary-cache';
const DB_VERSION = 1;
const STORE_NAME = 'wordChunks';

interface LexifyDB extends DBSchema {
  [STORE_NAME]: {
    key: string; // The letter (e.g., 'a', 'b')
    value: string[]; // Array of words for that letter
  };
}

let dbPromise: Promise<IDBPDatabase<LexifyDB>> | null = null;

const getDb = (): Promise<IDBPDatabase<LexifyDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<LexifyDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`[wordCache] Upgrading IndexedDB from version ${oldVersion} to ${newVersion}`);
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
          console.log(`[wordCache] Object store "${STORE_NAME}" created.`);
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
      console.log(`[wordCache] Saved chunk for letter "${letter}" to IndexedDB.`);
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
        console.log(`[wordCache] Retrieved chunk for letter "${letter}" from IndexedDB.`);
      } else {
        console.log(`[wordCache] No chunk found for letter "${letter}" in IndexedDB.`);
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
      console.log('[wordCache] Cleared all word chunks from IndexedDB.');
    } catch (error) {
      console.error('[wordCache] Error clearing IndexedDB:', error);
    }
  }
};
