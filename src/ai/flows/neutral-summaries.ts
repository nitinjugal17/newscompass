
'use server';

/**
 * @fileOverview Generates neutral summaries of news articles, highlighting key points from various perspectives.
 *
 * - generateNeutralSummary - A function that generates a neutral summary of a news article.
 * - NeutralSummaryInput - The input type for the generateNeutralSummary function.
 * - NeutralSummaryOutput - The return type for the generateNeutralSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const NeutralSummaryInputSchema = z.object({
  articleContent: z
    .string()
    .describe('The content of the news article to summarize.'),
  customPromptInstructions: z.string().optional().describe('Optional custom instructions to guide the neutral summary generation.'),
});
export type NeutralSummaryInput = z.infer<typeof NeutralSummaryInputSchema>;

const NeutralSummaryOutputSchema = z.object({
  neutralSummary: z
    .string()
    .describe(
      'A concise, neutral summary of the news article, highlighting key points from across the political spectrum.'
    ),
});
export type NeutralSummaryOutput = z.infer<typeof NeutralSummaryOutputSchema>;

export async function generateNeutralSummary(
  input: NeutralSummaryInput
): Promise<NeutralSummaryOutput> {
  return neutralSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'neutralSummaryPrompt',
  input: {schema: NeutralSummaryInputSchema},
  output: {schema: NeutralSummaryOutputSchema},
  prompt: `You are an AI assistant tasked with creating neutral summaries of news articles.

Please read the following news article and create a concise summary that highlights the key points from across the political spectrum. The summary should be neutral and avoid expressing any personal opinions or biases.

Article Content:
{{{articleContent}}}

{{#if customPromptInstructions}}
---
Additional User Instructions for Neutral Summary:
{{{customPromptInstructions}}}
---
{{/if}}
  `,
});

const neutralSummaryFlow = ai.defineFlow(
  {
    name: 'neutralSummaryFlow',
    inputSchema: NeutralSummaryInputSchema,
    outputSchema: NeutralSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
