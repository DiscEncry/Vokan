// Remove FamiliarityLevel and related fields

export interface FSRSCard {
  due: string; // ISO string for next due date/time
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: 'New' | 'Learning' | 'Review' | 'Relearning';
  last_review?: string; // ISO string
  reviewChange?: 'up' | 'down' | 'none'; // Direction of last review state change
  // v6: Add new fields if required by ts-fsrs v6 (e.g., new lapse/recall/forget fields)
  // If you use custom parameters, add them here as needed
}

export interface Word {
  id: string;
  text: string;
  dateAdded: string; // Store as ISO string for easier serialization
  fsrsCard: FSRSCard;
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

// ValidateWordStatus and ValidateWordResult types are removed as the validation system is no longer in use.
// export type ValidateWordStatus = 'valid' | 'not_found' | 'api_error' | 'invalid_input';
//
// export interface ValidateWordResult {
//   word: string;
//   status: ValidateWordStatus;
//   message: string;
//   apiResponse?: any; // Optional: include raw API response for debugging
// }
