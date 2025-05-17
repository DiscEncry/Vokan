
'use server';

import { checkDictionaryWord } from '@/ai/tools/dictionary-tool';
import type { ValidateWordResult } from '@/types';

export async function validateWord(word: string): Promise<ValidateWordResult> {
  const trimmedWord = word.trim();

  if (!trimmedWord) {
    return {
      word: trimmedWord,
      status: 'invalid_input',
      message: 'Word cannot be empty.',
    };
  }
  // Basic regex for common English words (alphabetic, hyphens, apostrophes)
  // This is a loose check; the API is the main validator.
  if (!/^[a-zA-Z'-]+$/.test(trimmedWord)) {
    return {
      word: trimmedWord,
      status: 'invalid_input',
      message: 'Word contains invalid characters.',
    };
  }

  const result = await checkDictionaryWord(trimmedWord);

  if (result.status === 200 && result.data && result.data.length > 0) {
    return {
      word: trimmedWord,
      status: 'valid',
      message: `"${trimmedWord}" is a valid word.`,
      apiResponse: result.data // Optional: pass data if needed for further processing
    };
  } else if (result.status === 404) {
    return {
      word: trimmedWord,
      status: 'not_found',
      message: `"${trimmedWord}" was not found in the dictionary. Please check spelling.`,
      apiResponse: result.error // Pass the error message from checkDictionaryWord
    };
  } else {
    // Includes other API errors or internal errors from checkDictionaryWord
    return {
      word: trimmedWord,
      status: 'api_error',
      message: result.error || 'An unexpected error occurred during word validation.',
      apiResponse: result.data || result.error
    };
  }
}
