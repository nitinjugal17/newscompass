
'use server';
/**
 * @fileOverview An AI agent that provides synonyms for a given word.
 *
 * - getSynonymsForWord - A function that returns a list of synonyms.
 * - GetSynonymsInput - The input type for the function.
 * - GetSynonymsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GetSynonymsInputSchema = z.object({
  word: z.string().describe('The word for which to find synonyms.'),
});
export type GetSynonymsInput = z.infer<typeof GetSynonymsInputSchema>;

const GetSynonymsOutputSchema = z.object({
  synonyms: z
    .array(z.string())
    .describe('A list of common synonyms for the input word.'),
});
export type GetSynonymsOutput = z.infer<typeof GetSynonymsOutputSchema>;

export async function getSynonymsForWord(
  input: GetSynonymsInput
): Promise<GetSynonymsOutput> {
  // Basic input validation
  if (!input.word || input.word.trim() === '') {
    return { synonyms: [] };
  }
  try {
    return await getSynonymsFlow(input);
  } catch (error) {
    console.warn(`Synonym generation failed for word "${input.word}":`, error);
    return { synonyms: [] }; // Return empty list on error
  }
}

const prompt = ai.definePrompt({
  name: 'getSynonymsPrompt',
  input: {schema: GetSynonymsInputSchema},
  output: {schema: GetSynonymsOutputSchema},
  prompt: `You are an expert linguist and terminologist. For the word '{{{word}}}', provide an extensive list of related terms.
This list should include:
1. Direct synonyms in the original language of the word.
2. Closely related concepts, hyponyms, or hypernyms.
3. If applicable and commonly known, equivalent terms or common translations in other major languages (e.g., if the word is "car", include "coche" for Spanish or "Auto" for German).
4. Relevant technical or domain-specific terms if the input word has strong connotations in a particular field.

Return the response as a JSON object with a single key "synonyms" which is an array of these strings.
Aim for a comprehensive list, but prioritize relevance. Include up to 10-15 diverse terms if a rich set exists.
If no relevant terms are found, return an empty array.

Word: {{{word}}}
`,
});

const getSynonymsFlow = ai.defineFlow(
  {
    name: 'getSynonymsFlow',
    inputSchema: GetSynonymsInputSchema,
    outputSchema: GetSynonymsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output || { synonyms: [] };
  }
);

