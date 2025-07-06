
'use server';

import type { NewsArticle, RssFeedSource, SystemSettings } from '@/types';
import { getFeeds } from '@/actions/feedActions';
import { getSystemSettings } from '@/actions/settingsActions';
import { deleteFeed } from '@/actions/feedActions';
import Parser from 'rss-parser';
import { stripHtml, extractImageUrlFromFeedItem } from '@/lib/utils';

export async function searchSingleFeed(
  synonymGroups: string[][], // Updated parameter: array of [originalWord, ...synonyms]
  feedSource: RssFeedSource,
  feedIndex: number, 
  totalFeeds: number
): Promise<{ articles: NewsArticle[]; logEntry: string; error?: string }> {
  const articles: NewsArticle[] = [];
  // Updated log entry to reflect the use of expanded terms
  let logEntry = `(${feedIndex}/${totalFeeds}) Processing ${feedSource.name} using expanded search terms...`;
  
  let settings: SystemSettings;
  try {
    settings = await getSystemSettings();
  } catch (e) {
    console.warn("Could not fetch system settings in searchSingleFeed, using defaults.");
    settings = { 
        dataSource: 'live', 
        autoRemoveBadFeeds: false,
        feedValidationTimeoutSeconds: 7,
        maxArticlesPerFeedGlobalSearch: 10 
    };
  }

  const feedFetchTimeoutMs = (settings.feedValidationTimeoutSeconds || 7) * 1000;
  const maxArticlesPerFeed = settings.maxArticlesPerFeedGlobalSearch || 10;

  const parser = new Parser({
    timeout: feedFetchTimeoutMs,
    headers: { 'User-Agent': 'NewsCompassSearch/1.0' },
  });

  let feedErrorOccurred = false;
  let errorMessageForFeed = 'Unknown error';

  try {
    const feed = await parser.parseURL(feedSource.url);
    let foundInThisFeedCount = 0;
    if (feed.items) {
      for (const [index, item] of feed.items.entries()) {
        if (index >= maxArticlesPerFeed) {
            logEntry = `(${feedIndex}/${totalFeeds}) Searched ${feedSource.name} with expanded terms: Reached article limit (${maxArticlesPerFeed}). Found ${foundInThisFeedCount} prior.`;
            break; 
        }
        const title = stripHtml(item.title || '');
        const contentSnippet = stripHtml(item.contentSnippet || item.summary || item.description || '');
        const fullContent = stripHtml(item.content || ''); 
        const searchableText = `${title.toLowerCase()} ${contentSnippet.toLowerCase()} ${fullContent.toLowerCase()}`;

        // New matching logic using synonymGroups
        let matchesAllGroups = true;
        if (synonymGroups.length > 0) { // Ensure there are search term groups
            matchesAllGroups = synonymGroups.every(group =>
                group.some(termVariant => searchableText.includes(termVariant.toLowerCase()))
            );
        } else {
            matchesAllGroups = false; // No search terms, so no match (should not happen if validated upstream)
        }


        if (matchesAllGroups) {
          const summary = contentSnippet.length > 50 ? contentSnippet : fullContent;
          const extractedImg = extractImageUrlFromFeedItem(item, feed.link);
          const articleImageUrl = extractedImg || 'https://placehold.co/600x400.png';
          const articleImageAiHint = extractedImg ? 'news media' : 'news article';

          let articleId = item.guid || item.link;
          if (!articleId) {
            const pseudoHash = `${feedSource.url}-${stripHtml(item.title || 'untitled')}`;
            articleId = `${pseudoHash}-${Date.now()}-${Math.random()}`;
            console.warn(`Generated potentially unstable ID for searched article from ${feedSource.name} (title: ${stripHtml(item.title || 'untitled')}). Feed should provide stable GUIDs or Links.`);
          }

          const article: NewsArticle = {
            id: articleId,
            title: title || 'No title',
            link: item.link || feedSource.url,
            source: feedSource.name,
            sourceUrl: feedSource.url,
            publishedDate: item.isoDate || new Date().toISOString(),
            summary: summary.substring(0, 250) + (summary.length > 250 ? '...' : ''),
            content: fullContent, 
            bias: 'Unknown', 
            biasExplanation: undefined,
            neutralSummary: undefined,
            imageUrl: articleImageUrl,
            imageAiHint: articleImageAiHint,
          };
          articles.push(article);
          foundInThisFeedCount++;
        }
      }
    }
    if (foundInThisFeedCount > 0) {
      logEntry = `(${feedIndex}/${totalFeeds}) Searched ${feedSource.name} with expanded terms: Found ${foundInThisFeedCount} article(s).`;
    } else if (!logEntry.includes('Reached article limit')) { 
      logEntry = `(${feedIndex}/${totalFeeds}) Searched ${feedSource.name} with expanded terms: No matches found.`;
    }
    return { articles, logEntry };
  } catch (error) {
    feedErrorOccurred = true;
    if (error instanceof Error) {
      errorMessageForFeed = error.message;
      if (errorMessageForFeed.toLowerCase().includes('timeout') || errorMessageForFeed.toLowerCase().includes('timed out')) {
        logEntry = `(${feedIndex}/${totalFeeds}) Error searching ${feedSource.name}: Request timed out after ${feedFetchTimeoutMs / 1000}s.`;
      } else if (errorMessageForFeed.toLowerCase().includes('enotfound') || errorMessageForFeed.toLowerCase().includes('econnrefused') || errorMessageForFeed.toLowerCase().includes('404')) {
        logEntry = `(${feedIndex}/${totalFeeds}) Error searching ${feedSource.name}: URL not found or connection refused.`;
      } else {
        const lowerErrorMessage = errorMessageForFeed.toLowerCase();
        if (
          lowerErrorMessage.includes('invalid character') ||
          lowerErrorMessage.includes('unexpected token') ||
          lowerErrorMessage.includes('unexpected end of input') ||
          lowerErrorMessage.includes('non-whitespace before first tag') ||
          lowerErrorMessage.includes('unclosed root tag') ||
          lowerErrorMessage.includes('stray end tag') ||
          lowerErrorMessage.includes('xml')
        ) {
          logEntry = `(${feedIndex}/${totalFeeds}) Error with ${feedSource.name}: Feed content (XML) parsing error - ${errorMessageForFeed.substring(0, 150)}`;
        } else {
          logEntry = `(${feedIndex}/${totalFeeds}) Error searching ${feedSource.name}: ${errorMessageForFeed.substring(0, 150)}`;
        }
      }
    } else {
      errorMessageForFeed = String(error);
      logEntry = `(${feedIndex}/${totalFeeds}) Error searching ${feedSource.name}: ${errorMessageForFeed.substring(0,150)}`;
    }
    console.warn(`Error processing single feed ${feedSource.name} during interactive search:`);
    console.warn('Original error object:', error);

    if (settings.autoRemoveBadFeeds) {
        try {
            console.log(`Auto-remove setting is ON. Attempting to remove problematic feed: ${feedSource.name} (${feedSource.url})`);
            await deleteFeed(feedSource.url);
            logEntry += ` | Feed automatically removed.`;
            console.log(`Successfully auto-removed feed: ${feedSource.name}`);
        } catch (deleteError) {
            console.error(`Failed to auto-remove feed ${feedSource.name}:`, deleteError);
            logEntry += ` | Failed to auto-remove.`;
        }
    }
    return { articles: [], logEntry, error: errorMessageForFeed };
  }
}


export async function searchArticlesInAllFeeds(
  searchTerm: string // This can remain for the batch search, or be adapted similarly if preferred
): Promise<{ articles: NewsArticle[]; searchLog: string[] }> {
  const articles: NewsArticle[] = [];
  const searchLog: string[] = [];
  const lowerSearchTerm = searchTerm.toLowerCase(); // Keep for direct matching if not using synonym groups here
  let configuredFeeds: RssFeedSource[] = [];

  if (!searchTerm.trim()) {
    searchLog.push('Search term is empty. Please provide a term to search.');
    return { articles, searchLog };
  }
  
  let settings: SystemSettings;
  try {
    settings = await getSystemSettings();
  } catch (settingsError) {
      searchLog.push("Warning: Could not fetch system settings. Using default limits.");
      console.warn("Could not fetch system settings in searchArticlesInAllFeeds:", settingsError);
      settings = { 
        dataSource: 'live', 
        autoRemoveBadFeeds: false,
        maxFeedsForGlobalSearch: 20,
        maxArticlesPerFeedGlobalSearch: 10,
        feedValidationTimeoutSeconds: 7
      };
  }

  const maxFeedsToSearch = settings.maxFeedsForGlobalSearch || 20;
  const maxArticlesPerFeed = settings.maxArticlesPerFeedGlobalSearch || 10;
  const feedFetchTimeoutMs = (settings.feedValidationTimeoutSeconds || 7) * 1000;
  const autoRemoveEnabled = settings.autoRemoveBadFeeds || false;

  searchLog.push(`Starting global search for term: "${searchTerm}"`);
  searchLog.push(`Note: Each feed has a ${feedFetchTimeoutMs / 1000}-second timeout.`);
  if (autoRemoveEnabled) {
      searchLog.push("Auto-removal of problematic feeds is ENABLED.");
  }

  // For this batch search, if we want synonym support, we'd fetch them here once.
  // For simplicity and consistency with the interactive search update,
  // this batch search will still use direct term matching.
  // To add synonyms here:
  // 1. Fetch synonymGroups similar to NewsFeedClientWrapper.
  // 2. Update the matching logic below.

  try {
    configuredFeeds = await getFeeds();
    if (!configuredFeeds || configuredFeeds.length === 0) {
      searchLog.push('No RSS feeds configured to search.');
      return { articles, searchLog };
    }

    const feedsToSearch = configuredFeeds.slice(0, maxFeedsToSearch);
    if (configuredFeeds.length > maxFeedsToSearch) {
      searchLog.push(`Limiting search to the first ${maxFeedsToSearch} of ${configuredFeeds.length} configured feeds (admin setting).`);
    }
    
    const parser = new Parser({
      timeout: feedFetchTimeoutMs, 
      headers: { 'User-Agent': 'NewsCompassSearch/1.0' }
    });

    for (const feedSource of feedsToSearch) {
      searchLog.push(`Fetching and searching in: ${feedSource.name} (${feedSource.url})`);
      let feedErrorForAutoRemove: Error | null = null;
      try {
        const feed = await parser.parseURL(feedSource.url);
        let foundInFeedCount = 0;
        if (feed.items) {
          for (const [index, item] of feed.items.entries()) {
            if (index >= maxArticlesPerFeed) {
                searchLog.push(`  Reached max article check limit (${maxArticlesPerFeed}) for ${feedSource.name} (admin setting).`);
                break;
            }

            const title = stripHtml(item.title || '');
            const contentSnippet = stripHtml(item.contentSnippet || item.summary || item.description || '');
            const fullContent = stripHtml(item.content || ''); 

            const searchableText = `${title.toLowerCase()} ${contentSnippet.toLowerCase()} ${fullContent.toLowerCase()}`;

            // Original matching logic for batch search:
            if (searchableText.includes(lowerSearchTerm)) {
              const summary = contentSnippet.length > 50 ? contentSnippet : fullContent;
              const extractedImg = extractImageUrlFromFeedItem(item, feed.link);
              const articleImageUrl = extractedImg || 'https://placehold.co/600x400.png';
              const articleImageAiHint = extractedImg ? 'news media' : 'news article';

              let articleId = item.guid || item.link;
              if (!articleId) {
                const pseudoHash = `${feedSource.url}-${stripHtml(item.title || 'untitled')}`;
                articleId = `${pseudoHash}-${Date.now()}-${Math.random()}`;
                console.warn(`Generated potentially unstable ID for searched article (batch) from ${feedSource.name} (title: ${stripHtml(item.title || 'untitled')}). Feed should provide stable GUIDs or Links.`);
              }

              const articleEntry: NewsArticle = {
                id: articleId,
                title: title || 'No title',
                link: item.link || feedSource.url,
                source: feedSource.name,
                sourceUrl: feedSource.url,
                publishedDate: item.isoDate || new Date().toISOString(),
                summary: summary.substring(0, 250) + (summary.length > 250 ? '...' : ''),
                content: fullContent, 
                bias: 'Unknown', 
                biasExplanation: undefined,
                neutralSummary: undefined,
                imageUrl: articleImageUrl,
                imageAiHint: articleImageAiHint,
              };
              articles.push(articleEntry);
              foundInFeedCount++;
              if (title) {
                searchLog.push(`  -> Found match in "${title.substring(0,50)}..."`);
              } else {
                searchLog.push(`  -> Found match in an untitled article.`);
              }
            }
          }
        }
        if (foundInFeedCount === 0 && !(feed.items && feed.items.length >= maxArticlesPerFeed)) {
          searchLog.push(`  No matches found in ${feedSource.name}.`);
        } else if (foundInFeedCount > 0) {
          searchLog.push(`  Found ${foundInFeedCount} match(es) in ${feedSource.name}.`);
        }
      } catch (error) {
        feedErrorForAutoRemove = error instanceof Error ? error : new Error(String(error));
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          errorMessage = error.message;
          if (errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('timed out')) {
            searchLog.push(`  Error processing feed ${feedSource.name}: Request timed out after ${feedFetchTimeoutMs / 1000} seconds.`);
          } else if (errorMessage.toLowerCase().includes('enotfound') || errorMessage.toLowerCase().includes('econnrefused') || errorMessage.toLowerCase().includes('404')) {
            searchLog.push(`  Error processing feed ${feedSource.name}: URL not found or connection refused.`);
          } else {
            searchLog.push(`  Error processing feed ${feedSource.name}: ${errorMessage}`);
          }
        } else {
           searchLog.push(`  Error processing feed ${feedSource.name}: ${String(error)}`);
        }
        console.warn(`Error processing feed ${feedSource.name} during batch search:`);
        console.warn('Original error object:', error);

        if (autoRemoveEnabled && feedErrorForAutoRemove) {
            try {
                searchLog.push(`  Attempting to auto-remove problematic feed: ${feedSource.name}`);
                await deleteFeed(feedSource.url);
                searchLog.push(`  Feed '${feedSource.name}' automatically removed due to error: ${feedErrorForAutoRemove.message.substring(0,100)}`);
                console.log(`Auto-removed feed (batch search): ${feedSource.name}`);
            } catch (deleteErrorInstance) {
                const delErrorMsg = deleteErrorInstance instanceof Error ? deleteErrorInstance.message : String(deleteErrorInstance);
                searchLog.push(`  Failed to auto-remove feed '${feedSource.name}': ${delErrorMsg.substring(0,100)}`);
                console.error(`Failed to auto-remove feed ${feedSource.name} (batch search):`, deleteErrorInstance);
            }
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    searchLog.push(`An unexpected error occurred during the search setup: ${errorMessage}`);
    console.error('Unexpected error in searchArticlesInAllFeeds:');
    console.error('Original error object:', error);
  }
 
  const initialLogMessagesCount = 2 + (autoRemoveEnabled ? 1 : 0) + (configuredFeeds.length > maxFeedsToSearch && configuredFeeds.length > 0 ? 1 : 0);

  if (articles.length === 0 && searchLog.length <= initialLogMessagesCount && searchTerm.trim() ) { 
      searchLog.push('No articles found matching your search term across all processed feeds.');
  } else if (articles.length > 0) {
      searchLog.push(`Search complete. Found ${articles.length} total matching articles.`);
  } else if (searchLog.length > initialLogMessagesCount && searchTerm.trim()) { 
      searchLog.push('Search complete. No matching articles found in processed feeds.');
  }
  
  articles.sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime());

  return { articles, searchLog };
}

