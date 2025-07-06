
'use server';

/**
 * @fileOverview Server actions for AI-powered content analysis.
 */

import { summarizeNewsArticle, type SummarizeNewsArticleInput, type SummarizeNewsArticleOutput } from '@/ai/flows/summarize-news-article';
import { assessArticleBias, type AssessArticleBiasInput, type AssessArticleBiasOutput } from '@/ai/flows/assess-article-bias';
import { generateNeutralSummary, type NeutralSummaryInput, type NeutralSummaryOutput } from '@/ai/flows/neutral-summaries';
import type { AnalyzedArticleOutput, SavedAnalyzedArticle } from '@/types';
import { AnalyzeArticleContentInputSchema } from '@/types';
import { findSavedAnalysisByLink } from './articleActions';


export async function analyzeArticleContent(
  input: AnalyzeArticleContentInput // Updated to use the full input type
): Promise<AnalyzedArticleOutput> {
  try {
    const validationResult = AnalyzeArticleContentInputSchema.safeParse(input);
    if (!validationResult.success) {
      throw new Error(validationResult.error.issues.map(i => i.message).join(', '));
    }

    const { 
      articleContent, 
      sourceName, 
      category, 
      generateNeutralPerspective, 
      articleLink, 
      originalContentForSave, 
      forceRefresh,
      customPromptInstructions // New field
    } = validationResult.data;

    if (articleLink && !forceRefresh) {
      const cachedAnalysis: SavedAnalyzedArticle | null = await findSavedAnalysisByLink(articleLink);
      if (cachedAnalysis) {
        let finalNeutralSummary = cachedAnalysis.neutralSummary;
        if (generateNeutralPerspective && !cachedAnalysis.neutralSummary) {
          console.log(`AI Caching: Found analysis for ${articleLink}, but neutral summary is missing and requested. Re-generating neutral summary.`);
          const neutralSummaryRes = await generateNeutralSummary({ articleContent: cachedAnalysis.originalContent || articleContent, customPromptInstructions } as NeutralSummaryInput);
          finalNeutralSummary = (neutralSummaryRes as NeutralSummaryOutput).neutralSummary;
        } else {
          console.log(`AI Caching: Returning cached analysis for ${articleLink}. Neutral perspective requested: ${generateNeutralPerspective}, Cached has neutral: ${!!cachedAnalysis.neutralSummary}, ForceRefresh: ${forceRefresh}`);
        }
        return {
          summary: cachedAnalysis.summary,
          biasScore: cachedAnalysis.biasScore,
          biasExplanation: cachedAnalysis.biasExplanation,
          neutralSummary: finalNeutralSummary,
          sourceName: cachedAnalysis.sourceName,
          category: cachedAnalysis.category,
          articleLink: cachedAnalysis.articleLink,
          originalContent: cachedAnalysis.originalContent,
        };
      } else {
        console.log(`AI Caching: No cache found for ${articleLink} (or forceRefresh active). Proceeding with full analysis.`);
      }
    } else if (forceRefresh) {
        console.log(`AI Analysis: Force refresh requested for ${articleLink || 'article'}. Proceeding with full analysis, bypassing cache.`);
    }


    let summary: string;
    let biasScore: 'Left' | 'Center' | 'Right' | string;
    let biasExplanation: string;
    let neutralSummary: string | undefined = undefined;

    // Prepare inputs for AI flows, including custom instructions
    const summaryInput: SummarizeNewsArticleInput = { articleContent, customPromptInstructions };
    const biasInput: AssessArticleBiasInput = { articleContent, customPromptInstructions };
    const neutralInput: NeutralSummaryInput = { articleContent, customPromptInstructions };

    if (generateNeutralPerspective) {
      const [summaryResult, biasResult, neutralSummaryRes] = await Promise.all([
        summarizeNewsArticle(summaryInput),
        assessArticleBias(biasInput),
        generateNeutralSummary(neutralInput),
      ]);
      summary = (summaryResult as SummarizeNewsArticleOutput).summary;
      biasScore = (biasResult as AssessArticleBiasOutput).biasScore;
      biasExplanation = (biasResult as AssessArticleBiasOutput).explanation;
      neutralSummary = (neutralSummaryRes as NeutralSummaryOutput).neutralSummary;
    } else {
      const [summaryResult, biasResult] = await Promise.all([
        summarizeNewsArticle(summaryInput),
        assessArticleBias(biasInput),
      ]);
      summary = (summaryResult as SummarizeNewsArticleOutput).summary;
      biasScore = (biasResult as AssessArticleBiasOutput).biasScore;
      biasExplanation = (biasResult as AssessArticleBiasOutput).explanation;
    }

    return {
      summary,
      biasScore,
      biasExplanation,
      neutralSummary,
      sourceName,
      category,
      articleLink, 
      originalContent: originalContentForSave || articleContent,
    };
  } catch (error) {
    console.warn('AI analysis step failed within analyzeArticleContent:');
    console.debug('Original error in analyzeArticleContent:', error);
    if (error instanceof Error) {
        throw new Error(`Failed to analyze article content via AI: ${error.message}`);
    }
    throw new Error('An unknown error occurred during AI article content analysis.');
  }
}
