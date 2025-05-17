
/**
 * @fileOverview A Genkit tool to fetch word definitions and information from the DictionaryAPI.
 * This file previously contained a helper function for direct word validation, which has been removed
 * as the validation system is no longer in use.
 *
 * - getDictionaryInfo - Genkit Tool: Fetches detailed data for a given word.
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

// Internal type definitions for understanding the Dictionary API response structure if needed within this file.
// Not exported as checkDictionaryWord function is removed.
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
type DictionaryAPIResponse = DictionaryAPIResponseItem[];

// The checkDictionaryWord helper function has been removed as the validation system is no longer in use.
