
'use client';

import type { NewsArticle, BiasScore, User, AnalyzedArticleOutput, SaveAnalyzedArticleResult } from '@/types';
import { UserRole } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ExternalLink, Info, CalendarDays, BookOpenText, Save, RefreshCw, TestTubeDiagonal, LinkIcon } from 'lucide-react';
import Image from 'next/image';
import { formatDate } from '@/lib/mockNewsData';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { analyzeArticleContent } from '@/actions/analysisActions';
import { saveAnalyzedArticle } from '@/actions/articleActions';
import { mockUsers } from '@/lib/mockAuthData';

const MOCK_CURRENT_USER_FOR_CARD_ACTION: User | undefined = mockUsers.find(u => u.role === UserRole.ADMIN);
const currentUserCardActionRole = MOCK_CURRENT_USER_FOR_CARD_ACTION?.role;

interface NewsCardProps {
  article: NewsArticle;
  index: number;
}

const biasColorMapping: Record<BiasScore | string, string> = {
  Left: 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  Center: 'border-primary bg-primary/10 text-primary',
  Right: 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Unknown: 'border-muted bg-muted/10 text-muted-foreground',
};

const biasTextColorMapping: Record<BiasScore | string, string> = {
  Left: 'text-rose-600 dark:text-rose-400',
  Center: 'text-primary',
  Right: 'text-amber-600 dark:text-amber-400',
  Unknown: 'text-muted-foreground',
};

export function NewsCard({ article, index }: NewsCardProps) {
  const [localAnalysisResult, setLocalAnalysisResult] = useState<AnalyzedArticleOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSavingForBlog, setIsSavingForBlog] = useState(false);
  const { toast } = useToast();

  // When article prop changes (e.g., due to parent re-fetch/filter), reset local analysis
  useEffect(() => {
    setLocalAnalysisResult(null);
    setIsAnalyzing(false);
    setIsSavingForBlog(false); 
  }, [article.id, article.link]); // Use article.id or article.link as dependency


  const displayData = localAnalysisResult || article;
  const currentBias = displayData?.bias || 'Unknown';
  const biasClasses = biasColorMapping[currentBias] || biasColorMapping['Unknown'];
  const biasTextClass = biasTextColorMapping[currentBias] || biasTextColorMapping['Unknown'];
  const isPlaceholderImage = displayData.imageUrl?.startsWith('https://placehold.co');


  const handleQuickSaveForBlog = async () => {
    if (!article.content || !article.link) {
      toast({
        title: 'Content or Link Missing',
        description: 'Cannot save article for blog as full content or a unique link is not available.',
        variant: 'destructive',
      });
      return;
    }
    setIsSavingForBlog(true);
    try {
      // Ensure neutral perspective is generated for a full analysis save
      const analysisResultToSave: Omit<SavedAnalyzedArticle, 'id' | 'savedDate'> = {
        articleContent: article.content,
        sourceName: article.source,
        articleLink: article.link,
        originalContent: article.content,
        category: article.category,
        summary: localAnalysisResult?.summary || article.summary || 'Summary not available',
        biasScore: localAnalysisResult?.biasScore || article.bias || 'Unknown',
        biasExplanation: localAnalysisResult?.biasExplanation || article.biasExplanation || 'No explanation',
        neutralSummary: localAnalysisResult?.neutralSummary, // Will be generated if requested & not present
        // similarArticles should be handled by saveAnalyzedArticle if it's a new save
      };

      const saveResult: SaveAnalyzedArticleResult = await saveAnalyzedArticle(analysisResultToSave);
      
      let toastMessage = '';
      if (saveResult.operation === 'saved_new') {
        toastMessage = `Article "${saveResult.article.summary.substring(0,50)}..." was analyzed and saved. Promote it from 'Manage Saved Analysis'.`;
      } else if (saveResult.operation === 'updated_analysis' ) { 
         toastMessage = `Analysis for "${saveResult.article.summary.substring(0,50)}..." was updated. Find it in 'Manage Saved Analysis'.`;
      }
      toast({
        title: saveResult.operation === 'saved_new' ? 'Article Saved' : 'Article Updated',
        description: toastMessage,
        duration: 7000,
      });

    } catch (error) {
      console.error('Failed to quick save article for blog:', error);
      toast({
        title: 'Error Saving Article',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingForBlog(false);
    }
  };

  const handleAnalyzeArticle = async () => {
    if (!article.content || article.content.length < MIN_CONTENT_LENGTH_FOR_ANALYSIS) {
      toast({ title: 'Insufficient Content', description: `Article content is missing or too short (min ${MIN_CONTENT_LENGTH_FOR_ANALYSIS} chars) to analyze.`, variant: 'destructive' });
      return;
    }
    setIsAnalyzing(true);
    try {
      const analysisResult = await analyzeArticleContent({
        articleContent: article.content,
        sourceName: article.source,
        articleLink: article.link,
        originalContentForSave: article.content,
        category: article.category,
        generateNeutralPerspective: true, 
        forceRefresh: true, // Force a fresh AI analysis, bypassing server cache
      });
      setLocalAnalysisResult(analysisResult);
      
      // Prepare data for saving, ensuring all fields for SavedAnalyzedArticle are present
      const analysisToSave: Omit<SavedAnalyzedArticle, 'id' | 'savedDate'> = {
        summary: analysisResult.summary,
        biasScore: analysisResult.biasScore,
        biasExplanation: analysisResult.biasExplanation,
        neutralSummary: analysisResult.neutralSummary,
        sourceName: analysisResult.sourceName,
        articleLink: analysisResult.articleLink,
        originalContent: analysisResult.originalContent,
        category: analysisResult.category,
        // similarArticles will be calculated/updated by saveAnalyzedArticle
      };
      await saveAnalyzedArticle(analysisToSave); 

      toast({ title: 'Analysis Updated', description: 'Article analysis has been refreshed and updated.' });
    } catch (error) {
      console.error('On-demand analysis failed:', error);
      toast({ title: 'Analysis Failed', description: error instanceof Error ? error.message : 'Could not analyze article.', variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const MIN_CONTENT_LENGTH_FOR_ANALYSIS = 50;

  return (
    <Card className={`overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 animate-fadeIn border-l-4 ${biasClasses}`} style={{ animationDelay: `${index * 100}ms` }}>
      <CardHeader className="pb-3">
        {displayData.imageUrl && (
          <div className="relative w-full h-48 mb-4 rounded-md overflow-hidden bg-muted">
            {isPlaceholderImage ? (
              <Image
                src={displayData.imageUrl}
                alt={displayData.title}
                fill
                style={{ objectFit: 'cover' }}
                data-ai-hint={displayData.imageAiHint || 'news article'}
                priority={index < 3}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayData.imageUrl}
                alt={displayData.title}
                className="w-full h-full object-cover"
                loading="lazy"
                data-ai-hint={displayData.imageAiHint || 'news media'}
              />
            )}
          </div>
        )}
        <CardTitle className="text-lg leading-tight">
          <a href={displayData.link} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
            {displayData.title}
          </a>
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground flex items-center gap-4 pt-1">
          <span className="flex items-center gap-1">
            <BookOpenText className="h-3.5 w-3.5" />
            {displayData.source}
          </span>
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(displayData.publishedDate)}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <p className="text-sm text-foreground/80 mb-3">{displayData.summary}</p>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-y-1">
          <Badge variant="outline" className={`font-semibold ${biasClasses} ${biasTextClass}`}>
            Bias: {currentBias}
          </Badge>
          {/* Use displayData.similarArticles which reflects localAnalysisResult if available, or article prop */}
          {displayData.similarArticles && (
            <Badge variant="outline" className="flex items-center gap-1 text-xs px-1.5 py-0.5 border-primary/70 text-primary">
              <LinkIcon className="h-3 w-3" />
              {displayData.similarArticles.length} similar report{displayData.similarArticles.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {displayData.biasExplanation && (
          <Accordion type="single" collapsible className="w-full mt-1 border-t border-border/30">
            <AccordionItem value="bias-explanation" className="border-b-0">
              <AccordionTrigger className="text-xs hover:no-underline py-2 text-muted-foreground hover:text-primary">
                <Info className="h-3.5 w-3.5 mr-2 shrink-0" />
                AI Bias Rationale
              </AccordionTrigger>
              <AccordionContent className="text-xs text-foreground/70 pt-0 pb-1">
                {displayData.biasExplanation}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {displayData.neutralSummary && (
          <Accordion type="single" collapsible className="w-full mt-2 border-t border-border/30">
            <AccordionItem value="neutral-summary" className="border-b-0">
              <AccordionTrigger className="text-sm hover:no-underline py-2 text-accent-foreground hover:text-primary">
                <Info className="h-4 w-4 mr-2 shrink-0" />
                View AI Neutral Perspective
              </AccordionTrigger>
              <AccordionContent className="text-sm text-foreground/70 pt-1 pb-2">
                <p className="font-medium text-xs text-muted-foreground mb-1">AI Generated Neutral Summary:</p>
                {displayData.neutralSummary}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row items-stretch gap-2">
        <Button variant="outline" size="sm" asChild className="w-full hover:bg-accent hover:text-accent-foreground">
          <a href={displayData.link} target="_blank" rel="noopener noreferrer">
            Read Full Article
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
        {article.content && article.content.length >= MIN_CONTENT_LENGTH_FOR_ANALYSIS && (
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={handleAnalyzeArticle}
            disabled={isAnalyzing || isSavingForBlog}
            title={localAnalysisResult ? "Get fresh AI analysis for this article" : "Analyze this article with AI"}
          >
            {isAnalyzing ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <TestTubeDiagonal className="mr-2 h-4 w-4" />
            )}
            {isAnalyzing ? 'Analyzing...' : (localAnalysisResult ? 'Re-analyze' : 'Analyze Article')}
          </Button>
        )}
        {(currentUserCardActionRole === UserRole.ADMIN || currentUserCardActionRole === UserRole.SUPER_ADMIN) && article.content && article.link && (
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={handleQuickSaveForBlog}
            disabled={isSavingForBlog || isAnalyzing} 
            title="Analyze and save this article for potential blog promotion"
          >
            {isSavingForBlog ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSavingForBlog ? 'Saving...' : 'Quick Save for Blog'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
