
// src/lib/localWordValidator.ts
"use client";

import { wordCache } from './wordCache';

/**
 * Checks if a word is valid by looking it up in local, chunked word lists.
 * @param word The word to validate.
 * @returns Promise<boolean> True if the word is found, false otherwise.
 */
export async function isValidWordLocally(word: string): Promise<boolean> {
  const trimmedWord = word.trim().toLowerCase();

  if (!trimmedWord) {
    return false;
  }

  const firstLetter = trimmedWord.charAt(0);

  // Basic check: only proceed if the first letter is a-z
  if (!/^[a-z]$/.test(firstLetter)) {
    console.warn(`[localWordValidator] Invalid first letter for validation: ${firstLetter}`);
    return false; // Or handle as per requirements, e.g., if non-alpha words are allowed
  }

  try {
    let wordChunk = await wordCache.getChunk(firstLetter);

    if (!wordChunk) {
      // console.log(`[localWordValidator] Chunk for '${firstLetter}' not in cache. Fetching...`);
      const response = await fetch(`/wordlists/chunks/${firstLetter}.json`);
      if (!response.ok) {
        console.error(`[localWordValidator] Failed to fetch word chunk for '${firstLetter}': ${response.status} ${response.statusText}`);
        return false; // Could not validate
      }
      const jsonData = await response.json();
      if (!Array.isArray(jsonData) || !jsonData.every(item => typeof item === 'string')) {
        console.error(`[localWordValidator] Fetched data for '${firstLetter}' is not an array of strings.`);
        return false; // Invalid data format
      }
      wordChunk = jsonData as string[];
      await wordCache.saveChunk(firstLetter, wordChunk);
      // console.log(`[localWordValidator] Fetched and cached chunk for '${firstLetter}'.`);
    }

    // Efficiently check if the word exists in the chunk
    // Assuming words in chunks are already reasonably clean, but good to ensure comparison is fair
    return wordChunk.some(chunkWord => chunkWord.trim().toLowerCase() === trimmedWord);

  } catch (error) {
    console.error('[localWordValidator] Error validating word locally:', error);
    return false; // If any error occurs, treat as invalid or could not validate
  }
}
