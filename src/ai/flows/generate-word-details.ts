'use server';

/**
 * @fileOverview AI flow for generating detailed information about a word.
 *
 * - generateWordDetails - A function that generates detailed information about a word.
 * - GenerateWordDetailsInput - The input type for the generateWordDetails function.
 * - GenerateWordDetailsOutput - The return type for the generateWordDetails function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateWordDetailsInputSchema = z.object({
  word: z.string().describe('The word to generate details for.'),
});
export type GenerateWordDetailsInput = z.infer<typeof GenerateWordDetailsInputSchema>;

const GenerateWordDetailsOutputSchema = z.object({
  details: z.string().describe('Detailed information about the word, including definitions, example sentences, translations, synonyms, and usage tips.'),
});
export type GenerateWordDetailsOutput = z.infer<typeof GenerateWordDetailsOutputSchema>;

export async function generateWordDetails(input: GenerateWordDetailsInput): Promise<GenerateWordDetailsOutput> {
  return generateWordDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateWordDetailsPrompt',
  input: {schema: GenerateWordDetailsInputSchema},
  output: {schema: GenerateWordDetailsOutputSchema},
  prompt: `You are an AI assistant designed to provide comprehensive information about words for language learners.

  Given the word: {{{word}}}, generate a detailed panel with the following information:

  - Definitions: Provide clear and concise definitions of the word.
  - Usage Examples: Create several example sentences showcasing the word in different contexts.
  - Contextual Meanings: Explain nuances of the word’s meaning in Vietnamese and English. For each meaning or sense of the word, provide a brief definition plus a Vietnamese translation, helping learners understand usage.
  - Synonyms/Antonyms: List common synonyms and how they are different from the word (compare their use case).
  - Usage Tips: Notes on common collocations or usage patterns (e.g., prepositions or adjectives that typically go with the word).
  - Interesting Facts: Include any additional facts or interesting information about the word.
  Make it sound natural, not mechanical.
  `,
});

const generateWordDetailsFlow = ai.defineFlow(
  {
    name: 'generateWordDetailsFlow',
    inputSchema: GenerateWordDetailsInputSchema,
    outputSchema: GenerateWordDetailsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
