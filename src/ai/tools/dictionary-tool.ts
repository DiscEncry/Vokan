
/**
 * @fileOverview A Genkit tool to fetch word definitions and information from the DictionaryAPI.
 *
 * - getDictionaryInfo - Fetches data for a given word.
 * - DictionaryToolInput - Input type for the tool.
 * - DictionaryToolOutputSchema - Output schema for the tool (stringified JSON of API response).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DictionaryToolInputSchema = z.object({
  word: z.string().describe('The word to look up in the dictionary.'),
});
export type DictionaryToolInput = z.infer<typeof DictionaryToolInputSchema>;

// The API can return a complex array of objects. We'll return it as a stringified JSON.
// The LLM can then parse or use this information as needed.
const DictionaryToolOutputSchema = z.string().describe('A JSON string representing the dictionary information for the word, or an error message.');
// Note: Type for output is implicitly string based on schema.

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
        throw new Error(`Dictionary API request failed with status ${response.status}`);
      }
      const data = await response.json();
      return JSON.stringify(data);
    } catch (error: any) {
      console.error('Error fetching from Dictionary API:', error);
      return JSON.stringify({ error: `Failed to fetch dictionary data: ${error.message}` });
    }
  }
);
