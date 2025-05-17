
// This file is no longer needed as validation is now client-side using local word chunks.
// Please delete this file from your project.
// 'use server';
//
// import { checkDictionaryWord } from '@/ai/tools/dictionary-tool';
// import type { ValidateWordResult, DictionaryAPIResponse } from '@/types';
//
// export async function validateWord(word: string): Promise<ValidateWordResult> {
//   const trimmedWord = word.trim();
//
//   if (!trimmedWord) {
//     return {
//       word: trimmedWord,
//       status: 'invalid_input',
//       message: 'Word cannot be empty.',
//     };
//   }
//
//   if (!/^[a-zA-Z'-]+$/.test(trimmedWord)) {
//     return {
//       word: trimmedWord,
//       status: 'invalid_input',
//       message: 'Word contains invalid characters.',
//     };
//   }
//
//   const result = await checkDictionaryWord(trimmedWord);
//
//   if (result.status === 200 && result.data && result.data.length > 0) {
//     return {
//       word: trimmedWord,
//       status: 'valid',
//       message: `"${trimmedWord}" is a valid word.`,
//       apiResponse: result.data
//     };
//   } else if (result.status === 404) {
//     return {
//       word: trimmedWord,
//       status: 'not_found',
//       message: `"${trimmedWord}" was not found in the dictionary. Please check spelling.`,
//       apiResponse: result.error
//     };
//   } else {
//     return {
//       word: trimmedWord,
//       status: 'api_error',
//       message: result.error || 'An unexpected error occurred during word validation.',
//       apiResponse: result.data || result.error
//     };
//   }
// }
