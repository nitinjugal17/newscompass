
'use client';

import type { NewsArticle, BiasScore, RssFeedSource, SystemSettings, SavedAnalyzedArticle } from '@/types';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { NewsCard } from './NewsCard';
import { FilterSortControls, type SortOption } from './FilterSortControls';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronDown, SearchX, ListChecks, RefreshCw, AlertTriangle, Globe, Loader2 } from 'lucide-react';
import { searchSingleFeed } from '@/actions/searchActions';
import { searchSavedArticles } from '@/actions/articleActions';
import { getFeeds } from '@/actions/feedActions';
import { getSystemSettings } from '@/actions/settingsActions';
import { getSynonymsForWord, type GetSynonymsOutput } from '@/ai/flows/get-synonyms-flow'; // Import synonym flow
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';

interface NewsFeedClientWrapperProps {
  initialArticles: NewsArticle[];
}

const INITIAL_ARTICLES_TO_SHOW = 9;
const ARTICLES_TO_LOAD_MORE = 6;

export function NewsFeedClientWrapper({ initialArticles }: NewsFeedClientWrapperProps) {
  const [articles, setArticles] = useState<NewsArticle[]>(initialArticles);
  const [selectedBias, setSelectedBias] = useState<BiasScore | 'All'>('All');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [displayedCount, setDisplayedCount] = useState(INITIAL_ARTICLES_TO_SHOW);

  const [isInteractiveGlobalSearching, setIsInteractiveGlobalSearching] = useState(false);
  const [interactiveGlobalSearchResults, setInteractiveGlobalSearchResults] = useState<NewsArticle[]>([]);
  const [interactiveGlobalSearchLog, setInteractiveGlobalSearchLog] = useState<string[]>([]);
  const [currentSearchFeedName, setCurrentSearchFeedName] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    const timer = setTimeout(() => {
      setArticles(initialArticles);
      setIsLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [initialArticles]);

  useEffect(() => {
    setDisplayedCount(INITIAL_ARTICLES_TO_SHOW);
  }, [selectedBias, sortOption, searchTerm, interactiveGlobalSearchResults]);


  const mapSavedToNewsArticle = (saved: SavedAnalyzedArticle): NewsArticle => {
    return {
      id: saved.id,
      title: saved.summary, 
      link: saved.articleLink || '',
      source: saved.sourceName || 'Saved Analysis',
      sourceUrl: saved.articleLink,
      publishedDate: saved.savedDate, 
      content: saved.originalContent,
      summary: saved.summary,
      bias: saved.biasScore as BiasScore,
      biasExplanation: saved.biasExplanation,
      neutralSummary: saved.neutralSummary,
      imageUrl: `https://placehold.co/600x400.png?text=Saved+Analysis`, 
      imageAiHint: 'saved analysis document',
      similarArticles: saved.similarArticles,
      category: saved.category,
    };
  };

  const filteredAndSortedArticles = useMemo(() => {
    let processedArticles = [...articles];

    if (searchTerm.trim() !== '' && !isInteractiveGlobalSearching && interactiveGlobalSearchResults.length === 0) { 
      const searchWords = searchTerm.toLowerCase().split(' ').filter(word => word.length > 0);
      if (searchWords.length > 0) {
        processedArticles = processedArticles.filter(article => {
          const searchableText = `${article.title.toLowerCase()} ${article.summary ? article.summary.toLowerCase() : ''} ${article.source.toLowerCase()}`;
          return searchWords.every(word => searchableText.includes(word));
        });
      }
    }

    if (selectedBias !== 'All') {
      processedArticles = processedArticles.filter(
        (article) => (article.bias || 'Unknown') === selectedBias
      );
    }

    switch (sortOption) {
      case 'date-asc':
        processedArticles.sort((a, b) => new Date(a.publishedDate).getTime() - new Date(b.publishedDate).getTime());
        break;
      case 'date-desc':
        processedArticles.sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime());
        break;
      case 'source-asc':
        processedArticles.sort((a, b) => a.source.localeCompare(b.source));
        break;
      case 'source-desc':
        processedArticles.sort((a, b) => b.source.localeCompare(a.source));
        break;
      default:
        break;
    }
    return processedArticles;
  }, [articles, selectedBias, sortOption, searchTerm, isInteractiveGlobalSearching, interactiveGlobalSearchResults]);

  const articlesToDisplay = useMemo(() => {
    const sourceList = interactiveGlobalSearchResults.length > 0 ? interactiveGlobalSearchResults : filteredAndSortedArticles;
    return sourceList.slice(0, displayedCount);
  }, [interactiveGlobalSearchResults, filteredAndSortedArticles, displayedCount]);

  const handleLoadMore = () => {
    setDisplayedCount(prevCount => prevCount + ARTICLES_TO_LOAD_MORE);
  };
  
  const handleInteractiveGlobalSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
        toast({ title: "Search Term Required", description: "Please enter a term to search.", variant: "default" });
        return;
    }
    setIsInteractiveGlobalSearching(true);
    setInteractiveGlobalSearchResults([]); 
    let accumulatedResults: NewsArticle[] = [];
    const processedIds = new Set<string>();

    setInteractiveGlobalSearchLog([`Global Search for "${term}":`]);
    setCurrentSearchFeedName(null);
    setDisplayedCount(INITIAL_ARTICLES_TO_SHOW);

    let settings: SystemSettings;
    try {
      settings = await getSystemSettings();
    } catch (e) {
      console.warn("Could not fetch system settings for global search, using defaults.");
      settings = { dataSource: 'live', maxFeedsForGlobalSearch: 20, feedValidationTimeoutSeconds: 7, autoRemoveBadFeeds: false, maxArticlesPerFeedGlobalSearch: 10 };
    }
    
    const maxFeedsToProcess = settings.maxFeedsForGlobalSearch || 20;
    const feedFetchTimeoutS = settings.feedValidationTimeoutSeconds || 7;

    setInteractiveGlobalSearchLog(prev => [...prev, `Timeout per live feed: ${feedFetchTimeoutS}s. Max live feeds to search: ${maxFeedsToProcess}.`]);

    // Phase 1a: Fetch synonyms for the search term (for live feed search)
    const searchWords = term.toLowerCase().split(' ').filter(word => word.length > 0);
    const synonymGroupsForSearch: string[][] = [];

    if (searchWords.length > 0) {
      setInteractiveGlobalSearchLog(prev => [...prev, `Phase 1a: Fetching synonyms for search term "${term}"...`]);
      for (const word of searchWords) {
        try {
          const synonymsOutput: GetSynonymsOutput = await getSynonymsForWord({ word });
          // Ensure original word is always first in its group and all are lowercase
          const group = [word.toLowerCase(), ...synonymsOutput.synonyms.map(s => s.toLowerCase())];
          synonymGroupsForSearch.push(Array.from(new Set(group))); // Ensure unique terms within group
        } catch (synError) {
          console.warn(`Failed to get synonyms for "${word}":`, synError);
          synonymGroupsForSearch.push([word.toLowerCase()]); // Use the word itself if synonym fetch fails
        }
      }
      setInteractiveGlobalSearchLog(prev => [...prev, `Synonym fetching complete for live search. Proceeding.`]);
    } else {
      setIsInteractiveGlobalSearching(false);
      setCurrentSearchFeedName(null);
      toast({ title: "Search Term Invalid", description: "Please enter a valid search term.", variant: "default" });
      return;
    }


    setInteractiveGlobalSearchLog(prev => [...prev, "Phase 1b: Searching previously saved articles..."]);
    try {
        // Saved articles search already uses synonyms internally via its server action
        const savedResults: SavedAnalyzedArticle[] = await searchSavedArticles(term);
        if (savedResults.length > 0) {
            const mappedSavedArticles = savedResults.map(mapSavedToNewsArticle);
            let uniqueSavedAdded = 0;
            mappedSavedArticles.forEach(sa => {
                if(!processedIds.has(sa.id)) {
                    accumulatedResults.push(sa);
                    processedIds.add(sa.id);
                    uniqueSavedAdded++;
                }
            });
            setInteractiveGlobalSearchResults([...accumulatedResults].sort((a,b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime()));
            setInteractiveGlobalSearchLog(prev => [...prev, `Found ${uniqueSavedAdded} unique matching article(s) in saved analyses.`]);
        } else {
            setInteractiveGlobalSearchLog(prev => [...prev, "No matching articles found in saved analyses."]);
        }
    } catch (error) {
        console.error("Error searching saved articles:", error);
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        setInteractiveGlobalSearchLog(prev => [...prev, `Error searching saved articles: ${errorMsg}`]);
        toast({ title: "Saved Search Failed", description: errorMsg, variant: "destructive" });
    }

    setInteractiveGlobalSearchLog(prev => [...prev, "Phase 2: Proceeding to search live RSS feeds..."]);
    try {
      const configuredFeeds = await getFeeds();
      if (!configuredFeeds || configuredFeeds.length === 0) {
        setInteractiveGlobalSearchLog(prev => [...prev, "No live RSS feeds configured to search."]);
      } else {
        const feedsToSearch = configuredFeeds.slice(0, maxFeedsToProcess);
        if (configuredFeeds.length > maxFeedsToProcess) {
            setInteractiveGlobalSearchLog(prev => [...prev, `Limiting live feed search to first ${maxFeedsToProcess} of ${configuredFeeds.length} feeds (admin setting).`]);
        } else {
            setInteractiveGlobalSearchLog(prev => [...prev, `Found ${feedsToSearch.length} live feeds to search.`]);
        }

        let totalLiveArticlesAdded = 0;
        for (let i = 0; i < feedsToSearch.length; i++) {
          const feedSource = feedsToSearch[i];
          setCurrentSearchFeedName(feedSource.name);
          setInteractiveGlobalSearchLog(prev => [...prev, `(${i+1}/${feedsToSearch.length}) Searching live feed: ${feedSource.name}...`]);
          
          try {
              // Pass synonymGroupsForSearch to searchSingleFeed
              const result = await searchSingleFeed(synonymGroupsForSearch, feedSource, i + 1, feedsToSearch.length);
              setInteractiveGlobalSearchLog(prev => [...prev, result.logEntry]); 
              if (result.articles.length > 0) {
                  const uniqueNewArticles = result.articles.filter(newArticle => !processedIds.has(newArticle.id));
                  if (uniqueNewArticles.length > 0) {
                      uniqueNewArticles.forEach(una => {
                        accumulatedResults.push(una);
                        processedIds.add(una.id);
                      });
                      totalLiveArticlesAdded += uniqueNewArticles.length;
                      setInteractiveGlobalSearchResults([...accumulatedResults].sort((a,b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime()));
                  }
              }
              if (result.error) {
                  console.warn(`Error logged for ${feedSource.name} (live search): ${result.error}`);
              }
          } catch (singleFeedError) {
              const errorMsg = singleFeedError instanceof Error ? singleFeedError.message : "Unknown error";
              setInteractiveGlobalSearchLog(prev => [...prev, `(${i+1}/${feedsToSearch.length}) Client-side critical error searching ${feedSource.name} (live): ${errorMsg}`]);
              console.error(`Client-side critical error searching ${feedSource.name} (live):`, singleFeedError);
          }
        }
        if (totalLiveArticlesAdded > 0) {
          setInteractiveGlobalSearchLog(prev => [...prev, `Added ${totalLiveArticlesAdded} unique article(s) from live feeds.`]);
        } else {
          setInteractiveGlobalSearchLog(prev => [...prev, `No additional unique articles found in live feeds.`]);
        }
      }
    } catch (error) {
      console.error("Global live feed search setup failed:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during live feed search setup.";
      setInteractiveGlobalSearchLog(prev => [...prev, `Client Error during live feed search setup: ${errorMessage}`]);
      toast({ title: "Live Feed Search Failed", description: errorMessage, variant: "destructive" });
    } finally {
      if (accumulatedResults.length === 0) {
        setInteractiveGlobalSearchLog(prev => [...prev, "Global search complete: No articles found overall."]);
        toast({ title: "Global Search Complete", description: "No articles found matching your term.", variant: "default" });
      } else {
        setInteractiveGlobalSearchLog(prev => [...prev, `Global search complete: Found ${accumulatedResults.length} unique article(s) in total.`]);
        toast({ title: "Global Search Complete", description: `Found ${accumulatedResults.length} unique articles.`, variant: "default" });
      }
      setIsInteractiveGlobalSearching(false);
      setCurrentSearchFeedName(null);
    }
  }, [toast]); // Added toast to dependencies

  const clearGlobalSearch = () => {
    setInteractiveGlobalSearchResults([]);
    setInteractiveGlobalSearchLog([]);
    setDisplayedCount(INITIAL_ARTICLES_TO_SHOW);
  };
  
  const getLogItemClass = (logMessage: string): string => {
    const lowerLog = logMessage.toLowerCase();
    if (lowerLog.includes("error") || lowerLog.includes("fail") || lowerLog.includes("critical")) {
      return "text-destructive";
    }
    if (lowerLog.includes("no matches found") || lowerLog.includes("no additional unique articles")) {
      return "text-amber-600 dark:text-amber-400";
    }
    if (lowerLog.includes("found") && (lowerLog.includes("article(s)") || lowerLog.includes("match(es)"))) {
      return "text-green-600 dark:text-green-400";
    }
    if (lowerLog.startsWith("global search for") || lowerLog.includes("searching") || lowerLog.startsWith("phase") || lowerLog.includes("global search complete") || lowerLog.includes("timeout per live feed") || lowerLog.includes("limiting live feed search") || lowerLog.includes("synonym fetching complete")) {
      return "text-primary font-medium";
    }
    return "text-muted-foreground";
  };


  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <FilterSortControls
            selectedBias={selectedBias}
            onBiasChange={setSelectedBias}
            sortOption={sortOption}
            onSortChange={setSortOption}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            onGlobalSearchSubmit={handleInteractiveGlobalSearch}
            isGlobalSearching={isInteractiveGlobalSearching}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(INITIAL_ARTICLES_TO_SHOW)].map((_, i) => (
            <div key={i} className="bg-card p-4 rounded-lg shadow">
              <Skeleton className="h-48 w-full mb-4" />
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const currentArticleListSource = interactiveGlobalSearchResults.length > 0 ? interactiveGlobalSearchResults : filteredAndSortedArticles;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8 text-primary">{t('latestNewsFeed')}</h1>
      
      <FilterSortControls
        selectedBias={selectedBias}
        onBiasChange={setSelectedBias}
        sortOption={sortOption}
        onSortChange={setSortOption}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onGlobalSearchSubmit={handleInteractiveGlobalSearch} 
        isGlobalSearching={isInteractiveGlobalSearching}
      />

      {isInteractiveGlobalSearching && (
        <Card className="my-6 shadow-lg border-primary/50">
            <CardHeader>
                 <CardTitle className="text-xl flex items-center gap-2">
                    <Loader2 className="h-6 w-6 text-primary animate-spin"/>
                    Performing Global Search for "{searchTerm}"
                </CardTitle>
                {currentSearchFeedName && <CardDescription>Currently processing live feed: {currentSearchFeedName}...</CardDescription>}
            </CardHeader>
            <CardContent>
                 <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary"/>Search Log:</h3>
                <ScrollArea className="h-48 border rounded-md p-3 bg-muted/30 text-xs">
                    <ul className="space-y-1">
                    {interactiveGlobalSearchLog.map((log, index) => (
                        <li key={index} className={getLogItemClass(log)}>{log}</li>
                    ))}
                    </ul>
                </ScrollArea>
                {interactiveGlobalSearchResults.length > 0 && (
                    <div className="mt-4">
                        <h3 className="text-md font-semibold mb-2">Found Articles ({interactiveGlobalSearchResults.length}):</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {interactiveGlobalSearchResults.slice(0, displayedCount).map((article, index) => ( 
                                <NewsCard key={article.id} article={article} index={index} />
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
      )}

      {!isInteractiveGlobalSearching && interactiveGlobalSearchResults.length > 0 && (
        <Card className="my-6 shadow-lg border-primary">
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                        <CardTitle className="text-2xl flex items-center gap-2">
                            <Globe className="h-6 w-6 text-primary"/>
                            Global Search Results for "{searchTerm}"
                        </CardTitle>
                        <CardDescription>
                            Displaying {articlesToDisplay.length} of {interactiveGlobalSearchResults.length} unique article(s) found from saved analyses and live feeds.
                        </CardDescription>
                    </div>
                    <Button onClick={clearGlobalSearch} variant="outline" size="sm">
                        <SearchX className="mr-2 h-4 w-4" /> Clear Search Results
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {interactiveGlobalSearchLog.length > 0 && ( 
                    <div className="mb-6">
                        <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary"/>Search Log:</h3>
                        <ScrollArea className="h-32 border rounded-md p-3 bg-muted/50 text-xs">
                            <ul className="space-y-1">
                            {interactiveGlobalSearchLog.map((log, index) => (
                                <li key={index} className={getLogItemClass(log)}>{log}</li>
                            ))}
                            </ul>
                        </ScrollArea>
                    </div>
                )}
                {articlesToDisplay.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {articlesToDisplay.map((article, index) => (
                        <NewsCard key={article.id} article={article} index={index} />
                    ))}
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
                        <p className="mt-4 text-xl text-muted-foreground">
                            No articles found matching "{searchTerm}" in the global search.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
      )}
      
      {!isInteractiveGlobalSearching && interactiveGlobalSearchResults.length === 0 && ( 
         articlesToDisplay.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articlesToDisplay.map((article, index) => (
                <NewsCard key={article.id} article={article} index={index} />
            ))}
            </div>
        ) : (
            <div className="text-center py-12">
            <SearchX className="mx-auto h-16 w-16 text-muted-foreground opacity-50" />
            <p className="mt-4 text-xl text-muted-foreground">
                {searchTerm.trim() !== '' && filteredAndSortedArticles.length === 0 ? 'No loaded articles found matching your filter/search criteria.' :
                 filteredAndSortedArticles.length === 0 && articles.length > 0 ? 'No articles found matching your filter criteria.' :
                 articles.length === 0 ? 'No articles available to display. Check admin panel for feed configuration or try a global search.' : 
                 'No articles to display.'
                }
            </p>
            </div>
        )
      )}

      {currentArticleListSource.length > displayedCount && (
        <div className="mt-8 text-center">
          <Button 
            onClick={handleLoadMore} 
            size="lg" 
            variant="outline"
            disabled={isInteractiveGlobalSearching}
          >
            <ChevronDown className="mr-2 h-5 w-5" />
            {isInteractiveGlobalSearching ? 'Load More (available after search)' : 'Load More News'}
          </Button>
        </div>
      )}
    </div>
  );
}
