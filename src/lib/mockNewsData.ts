
import type { NewsArticle, RssFeedSource, SystemSettings, SavedAnalyzedArticle } from '@/types';
import { getFeeds } from '@/actions/feedActions';
import { getSystemSettings } from '@/actions/settingsActions';
import { saveAnalyzedArticle, findSavedAnalysisByLink } from '@/actions/articleActions'; // saveAnalyzedArticle is used by NewsCard now
// analyzeArticleContent is NOT called directly here anymore for initial load
import Parser from 'rss-parser';
import { stripHtml, extractImageUrlFromFeedItem } from '@/lib/utils';

// Helper function to format date for display
export const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'Date unknown';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (e) {
    return 'Invalid date';
  }
};

// This is your fallback data if live fetching fails
export const mockArticles: NewsArticle[] = [
  {
    id: 'mock-1',
    title: 'Global Summit Addresses Climate Change Concerns (Mock)',
    link: 'https://example.com/article1',
    source: 'World News Org',
    sourceUrl: 'https://example.com/worldnewsorg',
    category: 'World News',
    publishedDate: new Date(2023, 10, 15, 10, 0, 0).toISOString(),
    content: 'Leaders from around the globe gathered today to discuss urgent actions needed to combat climate change. The summit focused on renewable energy, carbon emission reductions, and international cooperation. Several key agreements were reached, though some critics argue the measures do not go far enough. The event underscored the growing global consensus on the need for immediate and substantial efforts to mitigate environmental risks.',
    summary: 'A global summit convened to address climate change, focusing on renewable energy and emission cuts. Key agreements were made, but some critics find them insufficient.',
    neutralSummary: 'The international summit on climate change resulted in commitments towards renewable energy adoption and lower carbon emissions. Discussions highlighted diverse viewpoints on the adequacy of these measures, with some advocating for more aggressive targets and others emphasizing economic feasibility. The agreements represent a step in ongoing global efforts to address environmental challenges.',
    bias: 'Center',
    biasExplanation: 'The article presents the information factually, mentioning both agreements and criticisms without heavily favoring one side. It maintains a balanced tone throughout.',
    imageUrl: 'https://placehold.co/600x400.png',
    imageAiHint: 'global summit environment',
    similarArticles: [],
  },
  {
    id: 'mock-2',
    title: 'Tech Giants Unveil New AI Breakthroughs Amidst Ethical Debates (Mock)',
    link: 'https://example.com/article2',
    source: 'Future Tech Today',
    sourceUrl: 'https://example.com/futuretechtoday',
    category: 'Technology',
    publishedDate: new Date(2023, 10, 14, 14, 30, 0).toISOString(),
    content: 'Tech companies showcased their latest advancements in artificial intelligence this week. Innovations include more powerful language models, AI-driven drug discovery, and autonomous systems. The announcements have sparked excitement about future possibilities and intense debates about ethical implications, privacy concerns, and potential job displacement. Regulatory bodies are urged to keep pace.',
    summary: 'Tech companies revealed new AI innovations, including advanced language models and AI in healthcare, sparking both excitement and significant ethical discussions.',
    neutralSummary: 'Recent announcements from leading technology firms detailed significant progress in AI, such as enhanced language processing and applications in medical research. These developments are seen by some as transformative opportunities for societal benefit. Concurrently, others raise substantial concerns regarding ethical oversight, data privacy, and the potential socio-economic impact, including workforce adjustments. The discourse reflects a spectrum of perspectives on AI\'s trajectory and its governance.',
    bias: 'Center',
    biasExplanation: 'The article covers the advancements and acknowledges both excitement and ethical debates with similar weight, maintaining a balanced perspective.',
    imageUrl: 'https://placehold.co/600x400.png',
    imageAiHint: 'artificial intelligence technology',
    similarArticles: [],
  },
];

async function fetchAndProcessLiveFeeds(settings: SystemSettings): Promise<NewsArticle[]> {
  console.log('Fetching live news articles for homepage (basic info, uses cached analysis if available)...');
  const parser = new Parser({
    timeout: (settings.feedValidationTimeoutSeconds || 7) * 1000,
    headers: { 'User-Agent': 'NewsCompassApp/1.0' }
  });
  const processedArticles: NewsArticle[] = [];
  const processedArticleIds = new Set<string>();

  try {
    const configuredFeeds: RssFeedSource[] = await getFeeds();
    if (!configuredFeeds || configuredFeeds.length === 0) {
      console.log('No RSS feeds configured for live fetching.');
      return [];
    }

    const feedsToProcess = configuredFeeds.slice(0, settings.maxFeedsForGlobalSearch || 3);
    console.log(`Processing up to ${feedsToProcess.length} feeds for homepage. Max articles per feed: ${settings.maxArticlesPerFeedGlobalSearch || 5}. AI analysis occurs on-demand per card.`);

    for (const feedSource of feedsToProcess) {
      let displayMessage = `Fetching from feed: ${feedSource.name} from ${feedSource.url}`;
      try {
        console.log(displayMessage);
        const feed = await parser.parseURL(feedSource.url);
        let articlesProcessedFromThisFeed = 0;

        if (feed.items) {
          for (const item of feed.items) {
            if (articlesProcessedFromThisFeed >= (settings.maxArticlesPerFeedGlobalSearch || 5)) break;

            let articleId = item.guid || item.link;
            if (!articleId) {
              const titlePart = stripHtml(item.title || 'untitled').replace(/\s+/g, '-').toLowerCase();
              const pseudoHash = `${feedSource.url}-${titlePart}`;
              articleId = `${pseudoHash}-${Date.now()}-${Math.random()}`;
              console.warn(`Generated potentially unstable ID for article from ${feedSource.name} (title: ${stripHtml(item.title || 'untitled')}). Feed should provide stable GUIDs or Links.`);
            }
            
            if (processedArticleIds.has(articleId)) {
              console.warn(`Skipping duplicate article ID ${articleId} from ${feedSource.name} during initial feed processing.`);
              continue;
            }

            const articleOriginalLink = item.link || item.guid || '';
            const rawFullContent = item.content || item.contentSnippet || item.summary || item.description || item.title || '';
            const cleanedFullContent = stripHtml(rawFullContent);
            const feedSummary = cleanedFullContent.substring(0, 300) + (cleanedFullContent.length > 300 ? '...' : '');
            const extractedImg = extractImageUrlFromFeedItem(item, feed.link);
            const articleImageAiHint = extractedImg ? 'news media' : 'news article';

            // Initialize NewsArticle with basic feed data
            const newsArticle: NewsArticle = {
              id: articleId,
              title: stripHtml(item.title || 'No title'),
              link: articleOriginalLink,
              source: feedSource.name,
              sourceUrl: feedSource.url,
              category: feedSource.category,
              publishedDate: item.isoDate || new Date().toISOString(),
              content: cleanedFullContent, // Full cleaned content for on-demand analysis
              summary: feedSummary, // Initial summary from feed
              bias: 'Unknown',
              biasExplanation: undefined,
              neutralSummary: undefined,
              imageUrl: extractedImg || 'https://placehold.co/600x400.png',
              imageAiHint: articleImageAiHint,
              similarArticles: [],
            };

            // Check for existing saved analysis to pre-populate with richer data
            if (newsArticle.link) {
              const cachedAnalysis: SavedAnalyzedArticle | null = await findSavedAnalysisByLink(newsArticle.link);
              if (cachedAnalysis) {
                console.log(`Found cached analysis for ${newsArticle.link} from ${newsArticle.source}. Using it.`);
                newsArticle.summary = cachedAnalysis.summary; // Use AI summary if available
                newsArticle.bias = cachedAnalysis.biasScore as NewsArticle['bias'] || 'Unknown';
                newsArticle.biasExplanation = cachedAnalysis.biasExplanation;
                newsArticle.neutralSummary = cachedAnalysis.neutralSummary;
                newsArticle.originalContent = cachedAnalysis.originalContent || newsArticle.content; // Prefer saved original content
                newsArticle.similarArticles = cachedAnalysis.similarArticles || [];
                // Note: newsArticle.content remains the cleanedFullContent from feed if cachedAnalysis.originalContent is null/undefined
              }
            }
            
            if (!processedArticleIds.has(newsArticle.id)) {
                processedArticles.push(newsArticle);
                processedArticleIds.add(newsArticle.id);
                articlesProcessedFromThisFeed++;
            } else {
                console.warn(`Skipping duplicate article ID ${newsArticle.id} (after constructing NewsArticle) from ${feedSource.name}.`);
            }
          }
        }
        console.log(`Successfully fetched ${articlesProcessedFromThisFeed} article(s) from ${feedSource.name}`);
      } catch (feedError) {
         displayMessage = `Failed to fetch or parse feed '${feedSource.name}' (${feedSource.url}).`;
         if (feedError instanceof Error && (feedError.message.includes("Line:") || feedError.message.includes("Non-whitespace before first tag."))) {
             displayMessage += " Reason: XML content may be malformed.";
             console.warn(displayMessage); 
             console.debug('Original feed error details:', feedError.message, feedError.stack);
         } else if (feedError instanceof Error) {
             displayMessage += ` Reason: ${feedError.message}`;
             console.warn(displayMessage); 
             console.debug('Original feed error object:', feedError);
         } else {
             displayMessage += ` Reason: ${String(feedError)}`;
             console.warn(displayMessage);
             console.debug('Original feed error object:', feedError);
         }
      }
    }

    if (processedArticles.length > 0) {
      console.log(`Successfully processed a total of ${processedArticles.length} live articles for homepage display.`);
      processedArticles.sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime());
      return processedArticles;
    } else {
      console.warn('Live feed processing (basic info) yielded no articles. Falling back to mock data for homepage display.');
      return []; 
    }

  } catch (error) {
    console.error('Error in fetchAndProcessLiveFeeds (basic info) overall:');
    console.error('Original error object:', error);
    return []; 
  }
}

export async function getProcessedNewsArticles(): Promise<NewsArticle[]> {
  let settings: SystemSettings = {
      dataSource: 'live',
      autoRemoveBadFeeds: false,
      maxFeedsForGlobalSearch: 20,
      maxArticlesPerFeedGlobalSearch: 10,
      feedValidationTimeoutSeconds: 7,
  };
  try {
    settings = await getSystemSettings();
    console.log(`System settings loaded: Data source is "${settings.dataSource}".`);
  } catch (settingsError) {
    console.warn('Failed to get system settings, using default "live" data source and other defaults.');
    console.debug('Original settings error object:', settingsError);
  }

  const dataSource = settings.dataSource;

  if (dataSource === 'mock') {
    console.log('Using mock data as per system settings.');
    return mockArticles;
  }

  if (dataSource === 'api') {
    console.log('API data source selected. API integration not yet implemented. Falling back to mock data.');
    return mockArticles;
  }

  // For 'live' data source
  try {
    const liveArticles = await fetchAndProcessLiveFeeds(settings);
    if (liveArticles.length > 0) {
      return liveArticles;
    } else {
      console.warn('Live feed processing (basic info) yielded no articles. Falling back to mock data for homepage display.');
      return mockArticles;
    }
  } catch (liveFetchError) {
     console.error('Critical error during live feed processing (basic info), falling back to mock data for homepage display.');
     console.error('Original live fetch error object:', liveFetchError);
    return mockArticles;
  }
}
