'use server';
/**
 * @fileOverview Generates a text input question for a given word, including a sentence with a blank
 * and a Vietnamese translation of the original sentence.
 *
 * - generateTextInputQuestion - A function that generates a text input question.
 * - GenerateTextInputQuestionInput - The input type for the generateTextInputQuestion function.
 * - GenerateTextInputQuestionOutput - The return type for the generateTextInputQuestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { checkAndUpdateRateLimit } from './rateLimitFirestore';

const GenerateTextInputQuestionInputSchema = z.object({
  word: z.string().describe('The word to generate a text input question for.'),
});
export type GenerateTextInputQuestionInput = z.infer<typeof GenerateTextInputQuestionInputSchema>;

const GenerateTextInputQuestionOutputSchema = z.object({
  sentenceWithBlank: z.string().describe('An English sentence that uses the target word, with the target word replaced by "___".'),
  translatedHint: z.string().describe('The Vietnamese translation of the original English sentence (before the word was blanked out).'),
  targetWord: z.string().describe('The target word that was blanked out in the sentence.'),
});
export type GenerateTextInputQuestionOutput = z.infer<typeof GenerateTextInputQuestionOutputSchema>;

const prompt = ai.definePrompt({
  name: 'generateTextInputQuestionPrompt',
  input: {
    schema: GenerateTextInputQuestionInputSchema,
  },
  output: {
    schema: GenerateTextInputQuestionOutputSchema,
  },
  prompt: `You are an AI assistant specialized in creating language learning exercises.
For the given English word: {{{word}}}

1.  Create a natural-sounding English sentence that clearly uses this word in context.
2.  Then, take that exact sentence and replace the target word "{{{word}}}" with "___" (three underscores). This will be the 'sentenceWithBlank'.
3.  Provide a Vietnamese translation of the original, complete English sentence (the one from step 1, before the word was blanked out). This will be the 'translatedHint'.
4.  The 'targetWord' field should be the original word: "{{{word}}}".

Ensure your output is a valid JSON object adhering to the provided schema.

Example:
If the input word is "ubiquitous":

Expected output structure:
{
  "sentenceWithBlank": "Smartphones have become ___ in modern society.",
  "translatedHint": "Điện thoại thông minh đã trở nên phổ biến khắp nơi trong xã hội hiện đại.",
  "targetWord": "ubiquitous"
}
`,
});

const generateTextInputQuestionFlow = ai.defineFlow(
  {
    name: 'generateTextInputQuestionFlow',
    inputSchema: GenerateTextInputQuestionInputSchema,
    outputSchema: GenerateTextInputQuestionOutputSchema,
  },
  async (input: GenerateTextInputQuestionInput) => {
    const llmResponse = await prompt(input);
    const output = llmResponse.output;

    if (!output) {
      const rawText = llmResponse.text;
      console.warn(
        `AI (generateTextInputQuestionFlow) returned null/undefined or unparseable output. Input: ${JSON.stringify(input)}. Raw LLM Text: ${rawText}. Full LLM Response: ${JSON.stringify(llmResponse)}`
      );
      // Construct a fallback or throw, depending on how robust you want this vs. relying on the null return from the wrapper
      throw new Error(`AI failed to generate text input question for "${input.word}". Output was null or unparseable.`);
    }
    // Ensure targetWord in output matches input word, even if LLM hallucinates.
    return {
        ...output,
        targetWord: input.word
    };
  }
);

export async function generateTextInputQuestion(input: GenerateTextInputQuestionInput): Promise<GenerateTextInputQuestionOutput | null> {
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
    return await generateTextInputQuestionFlow(input);
  } catch (error) {
    console.error('[AI Flow Error - generateTextInputQuestion]', error);
    return null; // Return null on error to be handled by the calling component
  }
}
