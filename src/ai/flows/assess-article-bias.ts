
'use server';

/**
 * @fileOverview An AI agent that assesses the bias of a news article.
 *
 * - assessArticleBias - A function that handles the bias assessment process.
 * - AssessArticleBiasInput - The input type for the assessArticleBias function.
 * - AssessArticleBiasOutput - The return type for the assessArticleBias function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AssessArticleBiasInputSchema = z.object({
  articleContent: z
    .string()
    .describe('The content of the news article to assess for bias.'),
  customPromptInstructions: z.string().optional().describe('Optional custom instructions to guide the bias assessment.'),
});
export type AssessArticleBiasInput = z.infer<typeof AssessArticleBiasInputSchema>;

const AssessArticleBiasOutputSchema = z.object({
  biasScore: z
    .enum(['Left', 'Center', 'Right'])
    .describe('The assessed bias of the news article.'),
  explanation: z
    .string()
    .describe('The reasoning behind the bias assessment.'),
});
export type AssessArticleBiasOutput = z.infer<typeof AssessArticleBiasOutputSchema>;

export async function assessArticleBias(input: AssessArticleBiasInput): Promise<AssessArticleBiasOutput> {
  return assessArticleBiasFlow(input);
}

const prompt = ai.definePrompt({
  name: 'assessArticleBiasPrompt',
  input: {schema: AssessArticleBiasInputSchema},
  output: {schema: AssessArticleBiasOutputSchema},
  prompt: `You are an expert in identifying bias in news articles.

Analyze the following news article and determine its bias (Left, Center, or Right).
Provide a brief explanation for your assessment.

Article Content:
{{{articleContent}}}

{{#if customPromptInstructions}}
---
Additional User Instructions for Bias Assessment:
{{{customPromptInstructions}}}
---
{{/if}}

Format your response as a JSON object with 'biasScore' and 'explanation' fields.
  `,
});

const assessArticleBiasFlow = ai.defineFlow(
  {
    name: 'assessArticleBiasFlow',
    inputSchema: AssessArticleBiasInputSchema,
    outputSchema: AssessArticleBiasOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
