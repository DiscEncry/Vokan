
/**
 * @fileOverview A Genkit tool to fetch word definitions and information from the DictionaryAPI.
 * Also includes a helper function to check if a word exists in the dictionary.
 *
 * - getDictionaryInfo - Genkit Tool: Fetches detailed data for a given word.
 * - checkDictionaryWord - Helper Function: Checks if a word is found by the API.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DictionaryToolInputSchema = z.object({
  word: z.string().describe('The word to look up in the dictionary.'),
});
export type DictionaryToolInput = z.infer<typeof DictionaryToolInputSchema>;

// The API can return a complex array of objects. We'll return it as a stringified JSON for the Genkit tool.
const DictionaryToolOutputSchema = z.string().describe('A JSON string representing the dictionary information for the word, or an error message.');

export const getDictionaryInfo = ai.defineTool(
  {
    name: 'getDictionaryInfo',
    description: 'Fetches definitions, phonetics, and other linguistic information for a given word from an external dictionary API. Returns a JSON string of the API response.',
    inputSchema: DictionaryToolInputSchema,
    outputSchema: DictionaryToolOutputSchema,
  },
  async (input: DictionaryToolInput) => {
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${input.word}`);
      if (!response.ok) {
        if (response.status === 404) {
          return JSON.stringify({ error: 'Word not found in the dictionary.' });
        }
        // For other errors, we might still want to return the status text if available
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        return JSON.stringify({ error: `Dictionary API request failed with status ${response.status}`, details: errorData });
      }
      const data = await response.json();
      return JSON.stringify(data);
    } catch (error: any) {
      console.error('Error fetching from Dictionary API for getDictionaryInfo tool:', error);
      return JSON.stringify({ error: `Failed to fetch dictionary data: ${error.message}` });
    }
  }
);

// Helper function for direct word validation (not a Genkit tool, used by server actions)
interface DictionaryAPIPhonetic {
  text?: string;
  audio?: string;
  sourceUrl?: string;
  license?: { name: string; url: string };
}
interface DictionaryAPIMeaningDefinition {
  definition: string;
  synonyms: string[];
  antonyms: string[];
  example?: string;
}
interface DictionaryAPIMeaning {
  partOfSpeech: string;
  definitions: DictionaryAPIMeaningDefinition[];
  synonyms: string[];
  antonyms: string[];
}
interface DictionaryAPILicense {
  name: string;
  url: string;
}
interface DictionaryAPIResponseItem {
  word: string;
  phonetic?: string;
  phonetics: DictionaryAPIPhonetic[];
  meanings: DictionaryAPIMeaning[];
  license: DictionaryAPILicense;
  sourceUrls: string[];
}
export type DictionaryAPIResponse = DictionaryAPIResponseItem[];


interface CheckWordResult {
  data?: DictionaryAPIResponse | null;
  error?: string;
  status?: number; // HTTP status code
}

export async function checkDictionaryWord(word: string): Promise<CheckWordResult> {
  if (!word || word.trim().length === 0) {
    return { error: 'Input word is empty or invalid.', status: 400 };
  }
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.trim()}`);
    if (!response.ok) {
      if (response.status === 404) {
        // Word not found is not an "error" in the sense of API failure, but a result.
        return { error: 'Word not found in the dictionary.', status: 404 };
      }
      // Other HTTP errors
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error(`Dictionary API error for "${word}": ${response.status}`, errorData);
      return { error: `Dictionary API request failed: ${response.statusText}`, status: response.status, data: errorData };
    }
    const data: DictionaryAPIResponse = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return { data, status: 200 };
    } else {
      // API returned 200 but empty array or unexpected format. Treat as not found.
      return { error: 'Word not found (API returned empty or unexpected data).', status: 404 };
    }
  } catch (error: any) {
    console.error(`Exception during checkDictionaryWord for "${word}":`, error);
    return { error: `Failed to fetch dictionary data: ${error.message}`, status: 500 };
  }
}
