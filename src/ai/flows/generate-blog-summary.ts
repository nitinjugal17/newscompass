
'use server';
/**
 * @fileOverview Generates a blog-style summary or introduction from article content.
 *
 * - generateBlogSummary - A function that generates a blog summary.
 * - BlogSummaryInput - The input type for the generateBlogSummary function.
 * - BlogSummaryOutput - The return type for the generateBlogSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const BlogSummaryInputSchema = z.object({
  articleContent: z
    .string()
    .describe('The full content of the article to summarize for a blog post.'),
  articleTitle: z.string().optional().describe('The original title of the article, for context.'),
});
export type BlogSummaryInput = z.infer<typeof BlogSummaryInputSchema>;

const BlogSummaryOutputSchema = z.object({
  blogSummary: z
    .string()
    .describe(
      'A compelling summary or introduction suitable for a blog post, derived from the article content.'
    ),
});
export type BlogSummaryOutput = z.infer<typeof BlogSummaryOutputSchema>;

export async function generateBlogSummary(
  input: BlogSummaryInput
): Promise<BlogSummaryOutput> {
  return generateBlogSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateBlogSummaryPrompt',
  input: {schema: BlogSummaryInputSchema},
  output: {schema: BlogSummaryOutputSchema},
  prompt: `Based on the following article content{{#if articleTitle}} (titled "{{articleTitle}}"){{/if}}, generate a compelling summary or introduction that would be suitable for a blog post.
Make it engaging and give a good overview of what the article is about. Aim for 2-4 sentences.

Article Content:
{{{articleContent}}}
`,
});

const generateBlogSummaryFlow = ai.defineFlow(
  {
    name: 'generateBlogSummaryFlow',
    inputSchema: BlogSummaryInputSchema,
    outputSchema: BlogSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
