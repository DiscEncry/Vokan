
export type FamiliarityLevel = 'New' | 'Learning' | 'Familiar' | 'Mastered';

export interface Word {
  id: string;
  text: string;
  dateAdded: string; // Store as ISO string for easier serialization
  familiarity: FamiliarityLevel;
  lastReviewed?: string; // Store as ISO string
  nextReviewDate?: string; // Store as ISO string
  // srsData?: any; // Placeholder for FSRS specific data, like stability, difficulty
  // For simplicity in this phase, we'll mainly use familiarity
}

export interface ClozeQuestion {
  sentenceWithBlank: string; // e.g., "The quick ___ fox..."
  options: string[]; // e.g., ["brown", "red", "blue", "green"]
  correctAnswer: string; // e.g., "brown"
  targetWord: string; // The word that was originally in the blank
}

export interface TextInputQuestion {
  sentenceWithBlank: string; // e.g., "The quick ___ fox..."
  translatedHint: string; // Vietnamese translation of the original sentence
  correctAnswer: string; // e.g., "brown"
  targetWord: string; // The word that was originally in the blank
}

export interface GeneratedWordDetails {
  word: string; // The word for which details were generated.
  details: string; // The AI-generated block of text with markdown.
}

export type ValidateWordStatus = 'valid' | 'not_found' | 'api_error' | 'invalid_input';

export interface ValidateWordResult {
  word: string;
  status: ValidateWordStatus;
  message: string;
  apiResponse?: any; // Optional: include raw API response for debugging
}
