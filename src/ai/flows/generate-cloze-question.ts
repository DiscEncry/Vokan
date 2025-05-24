// src/ai/flows/generate-cloze-question.ts
'use server';

/**
 * @fileOverview Generates a cloze question for a given word using AI.
 *
 * - generateClozeQuestion - A function that generates a cloze question.
 * - GenerateClozeQuestionInput - The input type for the generateClozeQuestion function.
 * - GenerateClozeQuestionOutput - The return type for the generateClozeQuestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { checkAndUpdateRateLimit } from './rateLimitFirestore';

const GenerateClozeQuestionInputSchema = z.object({
  word: z.string().describe('The word to generate a cloze question for.'),
  libraryWords: z.array(z.string()).describe('An array of words from the user library to use as decoys.'),
});
export type GenerateClozeQuestionInput = z.infer<typeof GenerateClozeQuestionInputSchema>;

const GenerateClozeQuestionOutputSchema = z.object({
  sentence: z.string().describe('The sentence with a blank for the word.'),
  options: z.array(z.string()).describe('The options for the cloze question, including the correct word and decoys.'),
});
export type GenerateClozeQuestionOutput = z.infer<typeof GenerateClozeQuestionOutputSchema>;

export async function generateClozeQuestion(input: GenerateClozeQuestionInput): Promise<GenerateClozeQuestionOutput | null> {
  // Use user ID or IP as key. For demo, use word as fallback (not ideal for real abuse prevention)
  // In production, pass user ID or req.ip from API route/server action
  const key = input.word.toLowerCase();
  const rateLimitResult = await checkAndUpdateRateLimit({
    key,
    limit: 10,
    windowMs: 60 * 1000,
  });
  if (!rateLimitResult.allowed) {
    throw new Error(`Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.retryAfter || 0)/1000)}s.`);
  }
  try {
    return await generateClozeQuestionFlow(input);
  } catch (error) {
    console.error('[AI Flow Error - generateClozeQuestion]', error);
    return null;
  }
}

const prompt = ai.definePrompt({
  name: 'generateClozeQuestionPrompt',
  input: {
    schema: GenerateClozeQuestionInputSchema,
  },
  output: {
    schema: GenerateClozeQuestionOutputSchema,
  },
  prompt: `You are a helpful AI that generates cloze questions for vocabulary learning.

Given a word and a list of other words, create a sentence that uses the word, replacing the word with a blank (___).
Also, create an array of four words that include the correct word and three random words from the given list.

Word: {{{word}}}
Other words: {{#each libraryWords}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

Make sure the options array contains the word and three random words from the other words array. The cloze question options should make sense in the context of the question.
The output should follow the json schema.
`,
});

const generateClozeQuestionFlow = ai.defineFlow(
  {
    name: 'generateClozeQuestionFlow',
    inputSchema: GenerateClozeQuestionInputSchema,
    outputSchema: GenerateClozeQuestionOutputSchema,
  },
  async (input) => {
    // Ensure the word is included in the library words for creating options
    const allWords = [...input.libraryWords];
    if (!allWords.includes(input.word)) {
      allWords.push(input.word);
    }
    // Call the prompt with the input (word and libraryWords)
    const { output } = await prompt({ ...input, libraryWords: allWords });
    return output!;
  }
);
