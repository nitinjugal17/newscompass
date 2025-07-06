
'use server';
/**
 * @fileOverview An AI agent that assesses the similarity between two pieces of text.
 *
 * - assessTextPairSimilarity - A function that handles the similarity assessment.
 * - AssessTextPairSimilarityInput - The input type for the function.
 * - AssessTextPairSimilarityOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AssessTextPairSimilarityInputSchema = z.object({
  textA: z.string().describe('The first piece of text to compare.'),
  textB: z.string().describe('The second piece of text to compare.'),
});
export type AssessTextPairSimilarityInput = z.infer<typeof AssessTextPairSimilarityInputSchema>;

const AssessTextPairSimilarityOutputSchema = z.object({
  isSimilar: z
    .boolean()
    .describe(
      'True if the two texts are considered to be discussing the same core event or very closely related topics, false otherwise.'
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      'An optional confidence score (0.0 to 1.0) for the similarity assessment.'
    ),
  reasoning: z
    .string()
    .optional()
    .describe('A brief explanation for the similarity assessment.'),
});
export type AssessTextPairSimilarityOutput = z.infer<typeof AssessTextPairSimilarityOutputSchema>;

export async function assessTextPairSimilarity(
  input: AssessTextPairSimilarityInput
): Promise<AssessTextPairSimilarityOutput> {
  return assessTextPairSimilarityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'assessTextPairSimilarityPrompt',
  input: {schema: AssessTextPairSimilarityInputSchema},
  output: {schema: AssessTextPairSimilarityOutputSchema},
  prompt: `You are an expert news analyst. Your task is to compare two news article excerpts and determine if they are discussing the same core event or very closely related topics.

Consider the main subjects, key entities mentioned, and the overall narrative.
**Pay close attention to whether the articles use synonymous terms or discuss closely related concepts, even if the exact wording is different. For example, if one mentions "automotive industry" and the other "car manufacturers", or if one uses "climate change" and another "global warming", these should be seen as highly related.**
Your analysis should go beyond surface-level keyword matching and delve into the semantic meaning and context, identifying shared themes even if expressed with different vocabulary or phrasings.

Article A:
{{{textA}}}

Article B:
{{{textB}}}

Are these two articles highly similar in topic? Provide a confidence score if possible, and a brief reasoning.
Respond with isSimilar (boolean), confidence (number, optional), and reasoning (string, optional).
Focus on substantial topical overlap, not just minor keyword matches.
If confidence is high (e.g. > 0.8) and they are about the same event, set isSimilar to true.
`,
});

const assessTextPairSimilarityFlow = ai.defineFlow(
  {
    name: 'assessTextPairSimilarityFlow',
    inputSchema: AssessTextPairSimilarityInputSchema,
    outputSchema: AssessTextPairSimilarityOutputSchema,
  },
  async input => {
    // For very short texts, similarity assessment can be unreliable or not meaningful.
    // Let's set a minimum length. If either text is too short, assume not similar.
    const MIN_TEXT_LENGTH = 100; // characters
    if (input.textA.length < MIN_TEXT_LENGTH || input.textB.length < MIN_TEXT_LENGTH) {
      return {
        isSimilar: false,
        confidence: 0,
        reasoning: 'One or both texts are too short for reliable similarity assessment.',
      };
    }

    const {output} = await prompt(input);
    return output!;
  }
);

