
'use server';

/**
 * @fileOverview AI flow for generating detailed information about a word,
 * incorporating data from an external dictionary API.
 *
 * - generateWordDetails - A function that generates detailed information about a word.
 * - GenerateWordDetailsInput - The input type for the generateWordDetails function.
 * - GenerateWordDetailsOutput - The return type for the generateWordDetails function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getDictionaryInfo } from '@/ai/tools/dictionary-tool'; // Import the tool

const GenerateWordDetailsInputSchema = z.object({
  word: z.string().describe('The word to generate details for.'),
});
export type GenerateWordDetailsInput = z.infer<typeof GenerateWordDetailsInputSchema>;

const GenerateWordDetailsOutputSchema = z.object({
  // The word itself might be useful to return if the input word was slightly different (e.g. case)
  // or to confirm what the AI processed.
  word: z.string().describe('The word for which details were generated.'),
  details: z.string().describe('Detailed information about the word, including definitions, example sentences, Vietnamese translations, synonyms, antonyms, usage tips, and interesting facts, synthesized from AI knowledge and dictionary API data.'),
});
export type GenerateWordDetailsOutput = z.infer<typeof GenerateWordDetailsOutputSchema>;

export async function generateWordDetails(input: GenerateWordDetailsInput): Promise<GenerateWordDetailsOutput> {
  return generateWordDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateWordDetailsPrompt',
  input: {schema: GenerateWordDetailsInputSchema},
  output: {schema: GenerateWordDetailsOutputSchema},
  tools: [getDictionaryInfo], // Make the tool available to the LLM
  prompt: `You are an AI assistant designed to provide comprehensive information about English words for language learners.
Your goal is to create a rich, informative, and engaging explanation that helps users deeply understand the word.

For the given word: {{{word}}}

1.  First, use the 'getDictionaryInfo' tool to fetch detailed linguistic information about "{{{word}}}".
    This will provide structured data including definitions, phonetics, example sentences, etymology, etc.

2.  Synthesize the information from the 'getDictionaryInfo' tool with your own extensive knowledge to generate a detailed panel. The panel should cover the following aspects in a natural, non-mechanical way:

    *   **Word Itself:** Clearly state the word.
    *   **Definitions:** Provide clear, concise definitions. If there are multiple meanings, explain the most common ones. Use the dictionary data as a primary source but rephrase in an accessible way.
    *   **Usage Examples:** Create AT LEAST THREE distinct example sentences showcasing the word in different contexts. These should be original and illustrative. You can draw inspiration from examples provided by the dictionary tool.
    *   **Contextual Meanings & Vietnamese Translation:** For each key meaning or sense of the word:
        *   Explain any nuances in English.
        *   Provide a concise Vietnamese translation for that specific sense. (e.g., "Bank (financial institution): ngân hàng; Bank (of a river): bờ sông").
    *   **Synonyms & Antonyms:**
        *   List common synonyms. For 1-2 key synonyms, briefly explain how their usage or connotation might differ from "{{{word}}}".
        *   List common antonyms if applicable.
    *   **Usage Tips:** Note any common collocations (words that frequently go together, e.g., "commit a crime", "heavy rain"), typical grammatical patterns (e.g., prepositions used with the word: "rely on"), or common mistakes learners make.
    *   **Interesting Facts/Etymology:** Include any interesting facts, the origin of the word (etymology if available from the tool and seems relevant), or other memorable details that can aid learning.

Present this information in a well-structured, easy-to-read format. Use markdown for formatting (bolding, bullet points) where appropriate.
The entire output should be a single block of text for the 'details' field. The 'word' field in the output schema should be the input word.
Make it sound natural and helpful, not like a dry list.
If the dictionary tool returns an error (e.g., "Word not found"), rely on your own knowledge to provide as much information as possible for the requested word, and mention that external dictionary information could not be retrieved.
`,
});

const generateWordDetailsFlow = ai.defineFlow(
  {
    name: 'generateWordDetailsFlow',
    inputSchema: GenerateWordDetailsInputSchema,
    outputSchema: GenerateWordDetailsOutputSchema,
  },
  async (input: GenerateWordDetailsInput) => {
    const {output} = await prompt(input);

    if (!output) {
        throw new Error("AI failed to generate word details.");
    }
    // Ensure the 'word' field in the output matches the input, as per prompt instructions.
    // The LLM should fill this, but as a fallback:
    return {
        word: output.word || input.word,
        details: output.details,
    };
  }
);
