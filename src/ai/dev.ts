
import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-news-article.ts';
import '@/ai/flows/assess-article-bias.ts';
import '@/ai/flows/neutral-summaries.ts';
import '@/ai/flows/generate-blog-summary.ts'; // Ensure new flow is registered
import '@/ai/flows/assess-text-pair-similarity.ts'; // Register the new similarity flow
import '@/ai/flows/get-synonyms-flow.ts'; // Register the new synonym flow
// Ensure all flows are registered for development environment
