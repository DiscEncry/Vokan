
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-word-details.ts';
import '@/ai/flows/generate-cloze-question.ts';
import '@/ai/tools/dictionary-tool.ts'; // Added import for the new tool
