'use server';

/**
 * @fileOverview AI flow for generating detailed information about a word,
 * incorporating data from an external dictionary API and Firestore caching.
 *
 * - generateWordDetails - A function that generates detailed information about a word.
 * - GenerateWordDetailsInput - The input type for the generateWordDetails function.
 * - GenerateWordDetailsOutput - The return type for the generateWordDetails function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getDictionaryInfo } from '@/ai/tools/dictionary-tool'; 
import { firestore } from '@/lib/firebase/firebaseConfig'; // Firebase
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'; // Firestore functions
import { checkAndUpdateRateLimit } from './rateLimitFirestore';

const GenerateWordDetailsInputSchema = z.object({
  word: z.string().describe('The word to generate details for.'),
});
export type GenerateWordDetailsInput = z.infer<typeof GenerateWordDetailsInputSchema>;

// Define the structure for cached data, including a timestamp
const CachedWordDetailsSchema = z.object({
  word: z.string(),
  details: z.string(),
  cachedAt: z.custom<Timestamp>() // Firestore Timestamp
});
type CachedWordDetails = z.infer<typeof CachedWordDetailsSchema>;


const GenerateWordDetailsOutputSchema = z.object({
  word: z.string().describe('The word for which details were generated.'),
  details: z.string().describe('Detailed information about the word, including definitions, example sentences, Vietnamese translations, synonyms, antonyms, usage tips, and interesting facts, synthesized from AI knowledge and dictionary API data.'),
});
export type GenerateWordDetailsOutput = z.infer<typeof GenerateWordDetailsOutputSchema>;

export async function generateWordDetails(input: GenerateWordDetailsInput): Promise<GenerateWordDetailsOutput> {
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
  return generateWordDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateWordDetailsPrompt',
  input: {schema: GenerateWordDetailsInputSchema},
  output: {schema: GenerateWordDetailsOutputSchema},
  tools: [getDictionaryInfo], 
  prompt: `You are an AI data generation service. Your SOLE PUSPOSE is to return a valid JSON object adhering EXACTLY to the provided output JSON schema. DO NOT include any introductory text, apologies, or explanations outside of the JSON structure.
The JSON object should contain comprehensive information about the English word: {{{word}}}.

1.  First, use the 'getDictionaryInfo' tool to fetch detailed linguistic information about "{{{word}}}".
    This will provide structured data including definitions, phonetics, example sentences, etymology, etc.

2.  Synthesize the information from the 'getDictionaryInfo' tool with your own extensive knowledge to generate a detailed panel for the 'details' field of the JSON output. The panel should be a single string, formatted with Markdown, covering the following aspects in a natural, non-mechanical way:

    *   **Word Itself:** Clearly state the word (this will also be the 'word' field in the JSON output).
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

Present this information in a well-structured, easy-to-read Markdown format for the 'details' field.
The 'word' field in the output JSON schema should be the exact input word: "{{{word}}}".
Make the 'details' string sound natural and helpful, not like a dry list.
If the dictionary tool returns an error (e.g., "Word not found"), rely on your own knowledge to provide as much information as possible for the requested word in the 'details' field, and mention that external dictionary information could not be retrieved.

Output ONLY the JSON object.
`,
});

const generateWordDetailsFlow = ai.defineFlow(
  {
    name: 'generateWordDetailsFlow',
    inputSchema: GenerateWordDetailsInputSchema,
    outputSchema: GenerateWordDetailsOutputSchema,
  },
  async (input: GenerateWordDetailsInput): Promise<GenerateWordDetailsOutput> => {
    const cacheKey = input.word.toLowerCase();
    const cacheCollectionName = "wordDetailsCache";

    if (!firestore) {
      console.warn("Firestore not initialized. Skipping cache for word details.");
    } else {
      try {
        const cacheDocRef = doc(firestore, cacheCollectionName, cacheKey);
        const cacheDocSnap = await getDoc(cacheDocRef);

        if (cacheDocSnap.exists()) {
          const cachedData = cacheDocSnap.data() as CachedWordDetails;
          // Optional: Add logic to check cache freshness based on cachedData.cachedAt if needed
          console.log(`[AI Cache HIT] Returning cached details for "${input.word}"`);
          return {
            word: cachedData.word, // Use word from cache, which should match input.word
            details: cachedData.details,
          };
        }
        console.log(`[AI Cache MISS] No cached details for "${input.word}". Fetching from AI.`);
      } catch (error) {
        console.error(`Error reading from Firestore cache for word "${input.word}":`, error);
        // Proceed to AI if cache read fails
      }
    }

    let llmResponse;
    try {
      llmResponse = await prompt(input);
    } catch (e) {
      console.error(`[AI Flow Error - generateWordDetails prompt call] Input: ${JSON.stringify(input)}, Error:`, e);
      return {
        word: input.word,
        details: `Unable to retrieve full details for "${input.word}" at this time due to an AI service error.`,
      };
    }
    
    const output = llmResponse?.output;

    if (!output || !output.details || !output.word) {
      const rawText = llmResponse?.text;
      console.warn(
        `[AI Flow Warning - generateWordDetails] AI returned null/undefined or unparseable output. Input: ${JSON.stringify(input)}. Raw LLM Text: ${rawText}. Full LLM Response: ${JSON.stringify(llmResponse)}`
      );
      return {
        word: input.word,
        details: `Unable to retrieve full details for "${input.word}" at this time. The AI model's response was not in the expected format. (Raw: ${rawText ? String(rawText).substring(0, 100) + '...' : 'N/A'})`,
      };
    }

    // If AI call was successful and Firestore is available, save to cache
    // Only cache if the details are substantial (not a fallback message)
    if (firestore && output.details && !output.details.startsWith("Unable to retrieve full details")) {
      try {
        const cacheDocRef = doc(firestore, cacheCollectionName, cacheKey);
        const dataToCache: CachedWordDetails = {
          word: input.word, // Store the original input word casing for consistency
          details: output.details,
          cachedAt: serverTimestamp() as Timestamp, // Firestore server timestamp
        };
        await setDoc(cacheDocRef, dataToCache);
        console.log(`[AI Cache WRITE] Successfully cached details for "${input.word}"`);
      } catch (error) {
        console.error(`Error writing to Firestore cache for word "${input.word}":`, error);
        // Don't let cache write failure prevent returning the details
      }
    }
    
    // Ensure the 'word' field in the output matches the input, as per prompt instructions.
    return {
        word: output.word || input.word, // Prioritize LLM's output word if valid, else fallback
        details: output.details,
    };
  }
);
