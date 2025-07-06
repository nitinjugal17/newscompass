
'use server';

import type { SavedAnalyzedArticle, SaveAnalyzedArticleResult } from '@/types';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { assessTextPairSimilarity, type AssessTextPairSimilarityOutput } from '@/ai/flows/assess-text-pair-similarity';
import { getSynonymsForWord, type GetSynonymsOutput } from '@/ai/flows/get-synonyms-flow';


const dataDir = path.join(process.cwd(), 'data');
const articlesFilePath = path.join(dataDir, 'articles.csv');

// Updated CSV Header to include 'category' and 'similarArticlesData' for JSON string
const CSV_HEADER_LINE = '"id","savedDate","sourceName","articleLink","category","summary","biasScore","biasExplanation","neutralSummary","originalContent","similarArticlesData"\n';
const EXPECTED_CSV_HEADERS = ['id', 'saveddate', 'sourcename', 'articlelink', 'category', 'summary', 'biasscore', 'biasexplanation', 'neutralsummary', 'originalcontent', 'similararticlesdata'];

const MAX_CANDIDATES_FOR_SIMILARITY_CHECK = 10;
const SIMILARITY_CONFIDENCE_THRESHOLD = 0.7;

async function ensureDataDirectory(): Promise<void> {
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.error('Error creating data directory for articles:');
      console.error('Original error object:', error);
      throw new Error('Failed to ensure data directory for articles.');
    }
  }
}

function escapeCsvField(field: string | undefined | null): string {
  if (field === undefined || field === null) return '""';
  const str = String(field);
  // For general fields, escape normally. JSON strings will be handled by being quoted as a whole.
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`; // Always quote fields for consistency, even if not strictly necessary
}


async function readSavedArticlesFromCSV(): Promise<SavedAnalyzedArticle[]> {
  await ensureDataDirectory();

  try {
    await fs.access(articlesFilePath);
  } catch (error) {
    // File doesn't exist, create it with header
    try {
      await fs.writeFile(articlesFilePath, CSV_HEADER_LINE, 'utf-8');
      console.log('Initialized empty articles.csv with header.');
      return [];
    } catch (writeError) {
      console.error('Failed to create initial articles.csv:', writeError);
      console.error('Original error object:', writeError);
      throw new Error('Failed to initialize articles data file.');
    }
  }

  let csvData;
  try {
    csvData = await fs.readFile(articlesFilePath, 'utf-8');
  } catch (readError) {
    console.error('Critical error reading articles.csv:', readError);
    console.error('Original error object:', readError);
    throw new Error('Failed to read articles data.');
  }

  if (!csvData.trim()) {
    // File exists but is empty
    try {
        await fs.writeFile(articlesFilePath, CSV_HEADER_LINE, 'utf-8');
        console.log('articles.csv was empty, re-initialized with header.');
        return [];
    } catch (writeError) {
        console.error('Failed to write header to empty articles.csv:', writeError);
        console.error('Original error object:', writeError);
        throw new Error('Failed to initialize empty articles data file.');
    }
  }

  const lines = csvData.split('\n').filter(line => line.trim() !== '');

  if (lines.length === 0) {
      // This case should ideally be caught by !csvData.trim() but is a safeguard
      try {
        await fs.writeFile(articlesFilePath, CSV_HEADER_LINE, 'utf-8');
        console.log('articles.csv was empty after filter, re-initialized with header.');
        return [];
      } catch (writeError) {
        console.error('Failed to re-initialize (was empty after filter) articles.csv:', writeError);
        console.error('Original error object:', writeError);
        throw new Error('Failed to initialize empty articles data file (post-filter).');
      }
  }
  
  const headerLineFromFile = lines[0].trim().toLowerCase().replace(/"/g, '');
  const expectedHeaderLine = CSV_HEADER_LINE.trim().toLowerCase().replace(/"/g, '').slice(0,-1); // remove trailing newline from constant for comparison

  // If only header line exists and it matches, return empty array
  if (lines.length === 1 && headerLineFromFile === expectedHeaderLine) {
    return []; 
  }

  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
  const missingHeaders = EXPECTED_CSV_HEADERS.filter(eh => !header.includes(eh));

  if (missingHeaders.length > 0 || header.length !== EXPECTED_CSV_HEADERS.length) {
      console.warn(`Saved articles CSV header is malformed or missing columns. Expected: ${EXPECTED_CSV_HEADERS.join(',')}. Found: ${header.join(',')}. Re-initializing file.`);
      try {
        await fs.writeFile(articlesFilePath, CSV_HEADER_LINE, 'utf-8');
        return []; // Return empty array after re-initializing
      } catch (writeError) {
        console.error('Failed to re-initialize malformed articles.csv:', writeError);
        console.error('Original error object:', writeError);
        throw new Error('Failed to repair malformed articles data file.');
      }
  }

  return lines.slice(1).map(line => {
      // Enhanced CSV parsing logic to handle quoted fields with escaped quotes
      const values: string[] = [];
      let inQuotes = false;
      let currentValue = '';
      for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
              // If in quotes and next char is also a quote, it's an escaped quote
              if (inQuotes && i + 1 < line.length && line[i+1] === '"') {
                  currentValue += '"';
                  i++; // Skip next quote
              } else {
                  inQuotes = !inQuotes;
              }
          } else if (char === ',' && !inQuotes) {
              values.push(currentValue);
              currentValue = '';
          } else {
              currentValue += char;
          }
      }
      values.push(currentValue); // Add the last value

    const article: Partial<SavedAnalyzedArticle> = {};
    header.forEach((colName, index) => {
      const val = values[index] !== undefined ? values[index] : ''; // Handle cases where line might have fewer values than header
      // Unescape: remove surrounding quotes only if they exist, and replace "" with "
      const unescapedVal = val.startsWith('"') && val.endsWith('"') ? val.slice(1, -1).replace(/""/g, '"') : val;

      switch (colName) {
        case 'id': article.id = unescapedVal; break;
        case 'saveddate': article.savedDate = unescapedVal; break;
        case 'sourcename': article.sourceName = unescapedVal === '' ? undefined : unescapedVal; break;
        case 'articlelink': article.articleLink = unescapedVal === '' ? undefined : unescapedVal; break;
        case 'category': article.category = unescapedVal === '' ? undefined : unescapedVal; break;
        case 'summary': article.summary = unescapedVal; break;
        case 'biasscore': article.biasScore = unescapedVal; break;
        case 'biasexplanation': article.biasExplanation = unescapedVal; break;
        case 'neutralsummary': article.neutralSummary = unescapedVal === '' ? undefined : unescapedVal; break;
        case 'originalcontent': article.originalContent = unescapedVal === '' ? undefined : unescapedVal; break;
        case 'similararticlesdata':
          if (unescapedVal && unescapedVal.trim() !== '') {
            try {
              article.similarArticles = JSON.parse(unescapedVal);
            } catch (e) {
              console.warn(`Failed to parse similarArticlesData for article ID ${article.id || 'unknown'}:`, unescapedVal, e);
              article.similarArticles = []; // Default to empty array on parse error
            }
          } else {
            article.similarArticles = []; // Default to empty array if field is empty or missing
          }
          break;
      }
    });
    // Filter out potentially malformed records if critical fields are missing
    return article as SavedAnalyzedArticle;
  }).filter(article => article.id && article.savedDate && article.summary);
}

async function writeSavedArticlesToCSV(articles: SavedAnalyzedArticle[]): Promise<void> {
  await ensureDataDirectory();
  const csvContent = [
    CSV_HEADER_LINE.trim(), // Use .trim() to ensure no leading/trailing whitespace from the constant
    ...articles.map(a =>
      [
        escapeCsvField(a.id),
        escapeCsvField(a.savedDate),
        escapeCsvField(a.sourceName),
        escapeCsvField(a.articleLink),
        escapeCsvField(a.category),
        escapeCsvField(a.summary),
        escapeCsvField(a.biasScore),
        escapeCsvField(a.biasExplanation),
        escapeCsvField(a.neutralSummary),
        escapeCsvField(a.originalContent),
        // JSON.stringify the similarArticles array and then escape the resulting string for CSV
        escapeCsvField(a.similarArticles && a.similarArticles.length > 0 ? JSON.stringify(a.similarArticles) : null),
      ].join(',')
    )
  ].join('\n');
  try {
    await fs.writeFile(articlesFilePath, csvContent + '\n', 'utf-8'); // Ensure trailing newline
  } catch (error) {
    console.error('Error writing to articles.csv:', error);
    console.error('Original error object:', error);
    throw new Error('Failed to save articles to data file.');
  }
}

// --- Server Actions ---

export async function getSavedArticles(): Promise<SavedAnalyzedArticle[]> {
  try {
    const articles = await readSavedArticlesFromCSV();
    return articles.sort((a, b) => new Date(b.savedDate).getTime() - new Date(a.savedDate).getTime());
  } catch (error) {
    console.error("Error in getSavedArticles:", error);
    console.error('Original error object:', error);
    const message = error instanceof Error ? error.message : 'Could not fetch saved articles.';
    throw new Error(message);
  }
}

export async function findSavedAnalysisByLink(articleLink: string): Promise<SavedAnalyzedArticle | null> {
  try {
    if (!articleLink || !articleLink.trim()) return null;
    const articles = await readSavedArticlesFromCSV();
    const foundArticle = articles.find(article => article.articleLink === articleLink);
    return foundArticle || null;
  } catch (error) {
    console.warn(`Error finding saved analysis by link "${articleLink}":`, error);
    console.warn('Original error object:', error);
    return null; // Return null on error to allow main flow to continue
  }
}

export async function getSavedArticleById(id: string): Promise<SavedAnalyzedArticle | null> {
  try {
    if (!id || !id.trim()) return null;
    const articles = await readSavedArticlesFromCSV();
    const foundArticle = articles.find(article => article.id === id);
    return foundArticle || null;
  } catch (error) {
    console.error(`Error finding saved article by ID "${id}":`, error);
    console.error('Original error object:', error);
    throw new Error(`Could not retrieve saved article with ID ${id}.`);
  }
}

export async function saveAnalyzedArticle(
  dataToSave: Omit<SavedAnalyzedArticle, 'id' | 'savedDate'> & { similarArticles?: Array<{ id: string; confidence?: number; reasoning?: string }> }
): Promise<SaveAnalyzedArticleResult> {
  try {
    let articles = await readSavedArticlesFromCSV();

    // Check if an article with the same link already exists
    if (dataToSave.articleLink && dataToSave.articleLink.trim() !== '') {
        const existingArticleIndex = articles.findIndex(a => a.articleLink === dataToSave.articleLink);
        if (existingArticleIndex !== -1) {
            const existingArticle = articles[existingArticleIndex];
            
            // Update existing article
            const updatedArticle: SavedAnalyzedArticle = {
                ...existingArticle, // Keep original ID, savedDate, and potentially similarArticles
                summary: dataToSave.summary,
                biasScore: dataToSave.biasScore,
                biasExplanation: dataToSave.biasExplanation,
                neutralSummary: dataToSave.neutralSummary || existingArticle.neutralSummary, // Update if new one provided
                sourceName: dataToSave.sourceName || existingArticle.sourceName,
                category: dataToSave.category || existingArticle.category, // Update if new one provided
                originalContent: dataToSave.originalContent || existingArticle.originalContent,
                // Preserve existing similarArticles unless new ones are explicitly provided (e.g., from a re-analysis that re-calculates similarity)
                // The current logic below recalculates similarArticles if it's a "new save" path,
                // but here we are updating an existing article.
                similarArticles: dataToSave.similarArticles && dataToSave.similarArticles.length > 0 
                                  ? dataToSave.similarArticles 
                                  : existingArticle.similarArticles, // Preserve or update
            };
            articles[existingArticleIndex] = updatedArticle;
            await writeSavedArticlesToCSV(articles);
            console.log(`Updated existing analysis for article: ${updatedArticle.articleLink}`);
            return { article: updatedArticle, operation: 'updated_analysis' };
        }
    }

    // If no existing article by link, proceed to save as new
    const newArticleId = randomUUID();
    let similarArticlesFound: Array<{ id: string; confidence?: number; reasoning?: string }> = [];

    // Perform similarity check only if originalContent is substantial
    if (dataToSave.originalContent && dataToSave.originalContent.trim().length > 50) {
      console.log(`Finding similar articles for new article (ID: ${newArticleId}, Title: ${dataToSave.summary.substring(0,30)}...).`);
      // Get recent articles, excluding the one we are about to save (though it's not in the list yet)
      // and ensuring they also have substantial content.
      const recentCandidates = articles
        .sort((a, b) => new Date(b.savedDate).getTime() - new Date(a.savedDate).getTime())
        .filter(a => a.id !== newArticleId && a.originalContent && a.originalContent.trim().length > 50)
        .slice(0, MAX_CANDIDATES_FOR_SIMILARITY_CHECK);

      if (recentCandidates.length > 0) {
        console.log(`Comparing against ${recentCandidates.length} recent candidate articles.`);
        for (const candidate of recentCandidates) {
          try {
            const similarityResult: AssessTextPairSimilarityOutput = await assessTextPairSimilarity({
              textA: dataToSave.originalContent,
              textB: candidate.originalContent!, // Non-null assertion as we filtered
            });
            console.log(`Similarity check with candidate ${candidate.id}: isSimilar=${similarityResult.isSimilar}, confidence=${similarityResult.confidence}, reasoning=${similarityResult.reasoning}`);
            if (similarityResult.isSimilar && (similarityResult.confidence || 0) >= SIMILARITY_CONFIDENCE_THRESHOLD) {
              similarArticlesFound.push({
                id: candidate.id,
                confidence: similarityResult.confidence,
                reasoning: similarityResult.reasoning,
              });
            }
          } catch (aiError) {
            console.warn(`AI similarity check failed between new article and candidate ${candidate.id}:`, aiError);
            // Continue with other candidates
          }
        }
        console.log(`Found ${similarArticlesFound.length} similar articles for ${newArticleId}: ${similarArticlesFound.map(sa => sa.id).join(', ')}`);
      } else {
        console.log('No recent candidate articles found for similarity check.');
      }
    } else {
      console.log('Skipping similarity check for new article due to missing or short original content.');
    }

    const newSavedArticle: SavedAnalyzedArticle = {
      ...dataToSave,
      id: newArticleId,
      savedDate: new Date().toISOString(),
      category: dataToSave.category, // Ensure category is included
      similarArticles: similarArticlesFound, // Store the found similar articles
    };

    const updatedArticles = [...articles, newSavedArticle];
    await writeSavedArticlesToCSV(updatedArticles);
    console.log(`Saved new analysis for article: ${newSavedArticle.articleLink || newSavedArticle.summary.substring(0,30)}`);
    return { article: newSavedArticle, operation: 'saved_new' };
  } catch (error) {
    console.error("Error in saveAnalyzedArticle:", error);
    console.error('Original error object:', error);
    const message = error instanceof Error ? error.message : 'Could not save article analysis.';
    throw new Error(message);
  }
}

export async function deleteSavedArticle(articleId: string): Promise<{ success: boolean }> {
  try {
    let articles = await readSavedArticlesFromCSV();
    const initialCount = articles.length;
    articles = articles.filter(article => article.id !== articleId);

    // Also, remove references to the deleted article from other articles' similarArticles lists
    articles = articles.map(article => {
      if (article.similarArticles && article.similarArticles.some(sa => sa.id === articleId)) {
        return {
          ...article,
          similarArticles: article.similarArticles.filter(sa => sa.id !== articleId),
        };
      }
      return article;
    });

    if (initialCount === articles.length && !articles.some(a => a.id === articleId)) {
      // This condition means the article was not found to begin with,
      // or it was already deleted and references were already cleared.
      console.warn(`Saved article with ID "${articleId}" not found for deletion (or already deleted and references cleared).`);
    }
    await writeSavedArticlesToCSV(articles);
    return { success: true };
  } catch (error) {
    console.error("Error in deleteSavedArticle:", error);
    console.error('Original error object:', error);
    const message = error instanceof Error ? error.message : 'Could not delete article analysis.';
    throw new Error(message);
  }
}


export async function getArticleDetailsForLinking(articleIds: string[]): Promise<Array<{id: string, title: string, sourceName?: string, category?: string, link?: string}>> {
  if (!articleIds || articleIds.length === 0) {
    return [];
  }
  try {
    const allArticles = await readSavedArticlesFromCSV();
    return articleIds
      .map(id => {
        const article = allArticles.find(a => a.id === id);
        if (article) {
          // Return a shorter title for linking display if needed
          return { id: article.id, title: article.summary.substring(0, 70) + "...", sourceName: article.sourceName, category: article.category, link: article.articleLink };
        }
        return null;
      })
      .filter(Boolean) as Array<{id: string, title: string, sourceName?:string, category?: string, link?: string}>;
  } catch (error) {
    console.error('Error fetching article details for linking:', error);
    console.error('Original error object:', error);
    return [];
  }
}

export async function searchSavedArticles(searchTerm: string): Promise<SavedAnalyzedArticle[]> {
  if (!searchTerm || !searchTerm.trim()) {
    return [];
  }
  const lowerSearchTerm = searchTerm.toLowerCase();
  const searchWords = lowerSearchTerm.split(' ').filter(word => word.length > 0);

  // Get synonyms for each search word
  const searchTermsWithSynonyms: string[][] = [];
  for (const word of searchWords) {
    const synonymsOutput: GetSynonymsOutput = await getSynonymsForWord({ word });
    // Include the original word with its synonyms
    searchTermsWithSynonyms.push([word.toLowerCase(), ...synonymsOutput.synonyms.map(s => s.toLowerCase())]);
  }
  
  if (searchTermsWithSynonyms.length === 0) { // Handle case where search term was e.g., only spaces
      return [];
  }

  try {
    const articles = await readSavedArticlesFromCSV();
    return articles.filter(article => {
      const fieldsToSearch = [
        article.summary,
        article.originalContent,
        article.sourceName,
        article.category,
        article.biasExplanation,
        article.neutralSummary,
        ...(article.similarArticles?.map(sa => sa.reasoning) || [])
      ].map(field => field?.toLowerCase() || '');

      // Check if for EACH group of (originalWord + itsSynonyms), AT LEAST ONE matches
      return searchTermsWithSynonyms.every(wordAndSynonymsGroup => 
        wordAndSynonymsGroup.some(termVariant =>
          fieldsToSearch.some(fieldText => fieldText.includes(termVariant))
        )
      );
    });
  } catch (error) {
    console.error("Error searching saved articles with synonyms:", error);
    console.error('Original error object:', error);
    // Fallback to simpler search if synonym logic fails critically, or rethrow
    throw new Error("Failed to search saved articles with synonym expansion."); 
  }
}
