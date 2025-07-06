
'use client';

import type { SavedAnalyzedArticle, User } from '@/types';
import { UserRole } from '@/types';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { FileText, Trash2, ArrowLeft, RefreshCw, AlertTriangle, Eye, SendToBack, LinkIcon, TestTubeDiagonal, FilterIcon, MessageCircleQuestion, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { getSavedArticles, deleteSavedArticle, getArticleDetailsForLinking, saveAnalyzedArticle, type SaveAnalyzedArticleResult } from '@/actions/articleActions';
import { analyzeArticleContent, type AnalyzedArticleOutput } from '@/actions/analysisActions';
import { createBlogPostFromArticle } from '@/actions/blogActions';
import { formatDate } from '@/lib/mockNewsData';
import { mockUsers } from '@/lib/mockAuthData';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


// --- Mock Current User for Page Access Control ---
const MOCK_CURRENT_USER_FOR_PAGE_ACCESS: User | undefined = mockUsers.find(u => u.role === UserRole.SUPER_ADMIN) || mockUsers.find(u => u.role === UserRole.ADMIN);
const currentUserRole = MOCK_CURRENT_USER_FOR_PAGE_ACCESS ? MOCK_CURRENT_USER_FOR_PAGE_ACCESS.role : UserRole.USER;
const currentUserId = MOCK_CURRENT_USER_FOR_PAGE_ACCESS ? MOCK_CURRENT_USER_FOR_PAGE_ACCESS.id : 'unknown-user';
// --- End Mock Current User ---

type SimilarArticleDetail = {
  id: string;
  title: string;
  sourceName?: string;
  category?: string;
  link?: string;
  // We'll fetch confidence and reasoning from the selectedArticleForView.similarArticles directly
};

export default function ManageSavedAnalysisPage() {
  const [allSavedArticles, setAllSavedArticles] = useState<SavedAnalyzedArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isPromoting, setIsPromoting] = useState<string | null>(null);
  const [selectedArticleForView, setSelectedArticleForView] = useState<SavedAnalyzedArticle | null>(null);
  const [similarArticlesDetailsForDialog, setSimilarArticlesDetailsForDialog] = useState<SimilarArticleDetail[]>([]);
  const [isLoadingSimilarForDialog, setIsLoadingSimilarForDialog] = useState(false);
  const [isReAnalyzing, setIsReAnalyzing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const { toast } = useToast();

  const fetchArticles = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedArticles = await getSavedArticles();
      setAllSavedArticles(fetchedArticles);
    } catch (error) {
      console.error("Failed to fetch saved analysis:", error);
      toast({
        title: 'Error Fetching Saved Analysis',
        description: error instanceof Error ? error.message : 'Could not load saved analysis.',
        variant: 'destructive',
      });
      setAllSavedArticles([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  useEffect(() => {
    if (selectedArticleForView?.similarArticles && selectedArticleForView.similarArticles.length > 0) {
      const fetchSimilarDetails = async () => {
        setIsLoadingSimilarForDialog(true);
        try {
          const idsToFetch = selectedArticleForView.similarArticles!.map(sa => sa.id);
          const details = await getArticleDetailsForLinking(idsToFetch);
          setSimilarArticlesDetailsForDialog(details);
        } catch (error) {
          console.error("Failed to fetch similar article details for dialog:", error);
          setSimilarArticlesDetailsForDialog([]);
        } finally {
          setIsLoadingSimilarForDialog(false);
        }
      };
      fetchSimilarDetails();
    } else {
      setSimilarArticlesDetailsForDialog([]);
    }
  }, [selectedArticleForView]);

  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    allSavedArticles.forEach(article => {
      if (article.category && article.category.trim() !== '') {
        categories.add(article.category.trim());
      }
    });
    return ['All', ...Array.from(categories).sort()];
  }, [allSavedArticles]);

  const filteredArticles = useMemo(() => {
    if (selectedCategory === 'All') {
      return allSavedArticles;
    }
    return allSavedArticles.filter(article => article.category === selectedCategory);
  }, [allSavedArticles, selectedCategory]);


  const handleDeleteArticle = async (articleId: string) => {
    setIsDeleting(articleId);
    try {
      await deleteSavedArticle(articleId);
      toast({
        title: 'Analysis Deleted',
        description: `The saved analysis has been removed.`,
      });
      await fetchArticles(); // Refresh the list
      if (selectedArticleForView?.id === articleId) {
        setSelectedArticleForView(null); // Close dialog if deleted article was being viewed
      }
    } catch (error) {
      console.error("Failed to delete article:", error);
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Could not remove the saved analysis.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handlePromoteToBlog = async (articleId: string) => {
    if (currentUserRole !== UserRole.ADMIN && currentUserRole !== UserRole.SUPER_ADMIN) {
      toast({ title: "Permission Denied", description: "You don't have permission to promote articles to blog.", variant: "destructive"});
      return;
    }
    setIsPromoting(articleId);
    try {
      const result = await createBlogPostFromArticle(articleId, currentUserId);
      if ('error' in result) {
        toast({
          title: 'Promotion Failed',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Article Promoted to Blog',
          description: `"${result.title}" is now a blog post.`,
        });
      }
    } catch (error) {
      console.error("Failed to promote article to blog:", error);
      toast({
        title: 'Promotion Failed',
        description: error instanceof Error ? error.message : 'Could not promote article to blog.',
        variant: 'destructive',
      });
    } finally {
      setIsPromoting(null);
    }
  };

  const handleReanalyzeAndUpdate = async () => {
    if (!selectedArticleForView || !selectedArticleForView.originalContent) {
      toast({ title: 'Cannot Re-analyze', description: 'Original content is missing for this article.', variant: 'destructive' });
      return;
    }
    setIsReAnalyzing(true);
    try {
      const analysisInput = {
        articleContent: selectedArticleForView.originalContent,
        articleLink: selectedArticleForView.articleLink,
        sourceName: selectedArticleForView.sourceName,
        category: selectedArticleForView.category,
        originalContentForSave: selectedArticleForView.originalContent,
        generateNeutralPerspective: true,
        forceRefresh: true,
      };
      const freshAnalysis: AnalyzedArticleOutput = await analyzeArticleContent(analysisInput);

      // Ensure to pass the existing similarArticles to saveAnalyzedArticle if you want to preserve them during re-analysis.
      // The current saveAnalyzedArticle will re-calculate similarity if it's a "new" save, or update existing fields.
      // If re-analysis should NOT re-trigger similarity checks, saveAnalyzedArticle might need another flag or different input structure.
      // For now, it will re-evaluate similarity if it treats this as a "new" save based on link/content.
      // OR, we preserve the existing similarArticles from selectedArticleForView when updating.

      const dataToSave: Omit<SavedAnalyzedArticle, 'id' | 'savedDate'> = {
        summary: freshAnalysis.summary,
        biasScore: freshAnalysis.biasScore,
        biasExplanation: freshAnalysis.biasExplanation,
        neutralSummary: freshAnalysis.neutralSummary,
        sourceName: freshAnalysis.sourceName,
        category: freshAnalysis.category,
        articleLink: freshAnalysis.articleLink,
        originalContent: freshAnalysis.originalContent,
        similarArticles: selectedArticleForView.similarArticles || [], // Preserve existing similar articles data
      };

      const saveResult: SaveAnalyzedArticleResult = await saveAnalyzedArticle(dataToSave);

      setSelectedArticleForView(saveResult.article); // Update the dialog with the latest data
      await fetchArticles(); // Refresh the main list

      toast({
        title: 'Re-analysis Complete',
        description: `Article "${saveResult.article.summary.substring(0, 30)}..." has been re-analyzed and updated.`,
      });

    } catch (error) {
      console.error("Failed to re-analyze and update article:", error);
      toast({
        title: 'Re-analysis Failed',
        description: error instanceof Error ? error.message : 'Could not re-analyze and update the article.',
        variant: 'destructive',
      });
    } finally {
      setIsReAnalyzing(false);
    }
  };


  const biasColorMapping: Record<string, string> = {
    Left: 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400',
    Center: 'border-primary bg-primary/10 text-primary',
    Right: 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    Unknown: 'border-muted bg-muted/10 text-muted-foreground',
  };

  const getBiasClasses = (biasScore: string | undefined) => {
    return biasColorMapping[biasScore || 'Unknown'] || biasColorMapping['Unknown'];
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <FileText className="h-9 w-9 text-primary" />
          Manage Saved Analysis
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchArticles} disabled={isLoading || !!isDeleting || !!isPromoting || isReAnalyzing} title="Refresh List">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historical Analysis Results</CardTitle>
          <CardDescription>
            Browse saved AI analysis. Results are displayed horizontally. Admins can promote an analysis to blog post or re-analyze an article.
            Filter by category to narrow down results. Displaying {filteredArticles.length} of {allSavedArticles.length} saved analysis results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 space-y-2">
            <Label className="font-semibold flex items-center gap-2">
              <FilterIcon className="h-5 w-5 text-primary" />
              Filter by Category:
            </Label>
            <div className="flex flex-wrap gap-2">
              {uniqueCategories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className={`transition-all duration-150 ease-in-out ${selectedCategory === category ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  disabled={isLoading || isReAnalyzing}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
          <Separator className="mb-6"/>
          {isLoading && <p className="text-muted-foreground text-center py-4">Loading saved analysis...</p>}
          {!isLoading && filteredArticles.length === 0 && (
            <div className="text-center py-10">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-lg font-medium">No Saved Analysis Found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedCategory === 'All'
                  ? "You haven't saved any article analysis yet."
                  : `No saved analysis found for the category "${selectedCategory}".`}
              </p>
              <Button asChild className="mt-4">
                <Link href="/admin/analyze">Analyze an Article</Link>
              </Button>
            </div>
          )}
          {!isLoading && filteredArticles.length > 0 && (
            <ScrollArea className="w-full whitespace-nowrap rounded-md border">
              <div className="flex w-max space-x-4 p-4">
                {filteredArticles.map((article) => (
                  <Card key={article.id} className="min-w-[320px] max-w-[380px] shrink-0 flex flex-col justify-between">
                    <CardHeader className="pb-3">
                      <CardTitle className="truncate text-lg" title={article.sourceName || 'N/A'}>
                        {article.sourceName || 'N/A'}
                      </CardTitle>
                      <CardDescription>{formatDate(article.savedDate)}</CardDescription>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge variant="outline" className={`w-fit ${getBiasClasses(article.biasScore)}`}>
                          Bias: {article.biasScore || 'Unknown'}
                        </Badge>
                        {article.category && (
                          <Badge variant="secondary" className="w-fit">
                            {article.category}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 flex-grow pb-4">
                      <p className="text-sm font-semibold">Summary:</p>
                      <div className="text-xs text-muted-foreground line-clamp-4 whitespace-normal" title={article.summary}>
                        {article.summary}
                      </div>
                      {article.similarArticles && article.similarArticles.length > 0 && (
                        <div className="text-xs text-muted-foreground pt-1">
                           <Badge variant="outline" className="px-1.5 py-0.5 text-xs flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" /> {article.similarArticles.length} similar
                           </Badge>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 pt-3 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedArticleForView(article)}
                        aria-label="View Details"
                        className="w-full sm:w-auto justify-start sm:justify-center"
                        disabled={!!isDeleting || !!isPromoting || isReAnalyzing}
                      >
                        <Eye className="mr-2 h-4 w-4 text-blue-500" /> View
                      </Button>
                      {(currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.SUPER_ADMIN) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePromoteToBlog(article.id)}
                          aria-label="Promote to Blog Post"
                          disabled={isLoading || !!isDeleting || isPromoting === article.id || isReAnalyzing}
                          title="Promote to Blog Post"
                          className="w-full sm:w-auto justify-start sm:justify-center"
                        >
                          {isPromoting === article.id ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <SendToBack className="mr-2 h-4 w-4 text-green-600" />}
                          Promote
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Delete Saved Analysis"
                            className="w-full sm:w-auto justify-start sm:justify-center text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={isLoading || !!isDeleting || !!isPromoting || isReAnalyzing}
                          >
                            {isDeleting === article.id ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive"/>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the saved analysis for
                              "{article.sourceName || `Analysis from ${formatDate(article.savedDate)}`}".
                              This will also remove references to this article from other articles' "similar articles" lists.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting === article.id}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteArticle(article.id)}
                              className="bg-destructive hover:bg-destructive/90"
                              disabled={isDeleting === article.id}
                            >
                              {isDeleting === article.id ? 'Deleting...' : 'Yes, delete'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardFooter>
                  </Card>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {selectedArticleForView && (
        <AlertDialog open={!!selectedArticleForView} onOpenChange={() => setSelectedArticleForView(null)}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Analysis Details: {selectedArticleForView.sourceName || `Analysis from ${formatDate(selectedArticleForView.savedDate)}`}</AlertDialogTitle>
              <AlertDialogDescription>
                Saved on: {formatDate(selectedArticleForView.savedDate)}
                {selectedArticleForView.category && (<><br />Category: <strong>{selectedArticleForView.category}</strong></>)}
                 {selectedArticleForView.articleLink && (
                    <>
                    <br /> Original URL: <a href={selectedArticleForView.articleLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{selectedArticleForView.articleLink}</a>
                    </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4 py-4 text-sm">
                <div>
                  <h4 className="font-semibold">Summary:</h4>
                  <p className="text-muted-foreground">{selectedArticleForView.summary}</p>
                </div>
                 <Separator />
                 <div className="mt-2">
                  <h4 className="font-semibold">Bias Assessment:</h4>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className={`mr-2 ${getBiasClasses(selectedArticleForView.biasScore)}`}>{selectedArticleForView.biasScore}</Badge>
                    <p className="text-muted-foreground flex-1">{selectedArticleForView.biasExplanation}</p>
                  </div>
                </div>
                {selectedArticleForView.neutralSummary && (
                  <>
                    <Separator />
                    <div className="mt-2">
                        <h4 className="font-semibold flex items-center gap-1"><Sparkles className="h-4 w-4 text-primary"/>AI Neutral Perspective:</h4>
                        <p className="text-muted-foreground">{selectedArticleForView.neutralSummary}</p>
                    </div>
                  </>
                )}
                {selectedArticleForView.originalContent && (
                   <>
                    <Separator />
                    <div className="mt-2">
                        <h4 className="font-semibold">Original Content Analyzed:</h4>
                        <ScrollArea className="h-32 bg-muted p-2 rounded-sm">
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap ">{selectedArticleForView.originalContent}</p>
                        </ScrollArea>
                    </div>
                  </>
                )}
                {selectedArticleForView.similarArticles && selectedArticleForView.similarArticles.length > 0 && (
                  <>
                    <Separator />
                    <div className="mt-2">
                      <h4 className="font-semibold flex items-center gap-1"><LinkIcon className="h-4 w-4 text-primary"/>AI-Identified Similar Articles ({selectedArticleForView.similarArticles.length}):</h4>
                      {isLoadingSimilarForDialog ? (
                        <p className="text-muted-foreground">Loading similar article details...</p>
                      ) : similarArticlesDetailsForDialog.length > 0 || selectedArticleForView.similarArticles.length > 0 ? (
                        <ul className="space-y-3 mt-2">
                          {selectedArticleForView.similarArticles.map(simArtRef => {
                            const details = similarArticlesDetailsForDialog.find(d => d.id === simArtRef.id);
                            return (
                              <li key={simArtRef.id} className="text-xs border-l-2 pl-3 py-1 border-muted-foreground/30">
                                <div className="font-medium">
                                  {details?.link ? (
                                    <a href={details.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                      {details.title || `Article ID: ${simArtRef.id}`}
                                    </a>
                                  ) : (
                                    details?.title || `Article ID: ${simArtRef.id}`
                                  )}
                                  {details?.sourceName && <span className="text-muted-foreground text-xs"> ({details.sourceName})</span>}
                                </div>
                                {simArtRef.reasoning && (
                                   <TooltipProvider>
                                    <Tooltip delayDuration={100}>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1 text-muted-foreground mt-0.5 cursor-help">
                                          <MessageCircleQuestion className="h-3.5 w-3.5"/>
                                          <span>AI Reason (Similarity: {simArtRef.confidence?.toFixed(2) || 'N/A'})</span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs text-xs" side="bottom" align="start">
                                        <p>{simArtRef.reasoning}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                 {!simArtRef.reasoning && simArtRef.confidence !== undefined && (
                                  <p className="text-muted-foreground text-xs mt-0.5">Similarity Confidence: {simArtRef.confidence.toFixed(2)}</p>
                                 )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground mt-1">Details for similar articles could not be loaded or none found.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
            <AlertDialogFooter className="flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-4">
               <Button
                  variant="outline"
                  onClick={handleReanalyzeAndUpdate}
                  disabled={isReAnalyzing || !selectedArticleForView.originalContent}
                  className="w-full sm:w-auto"
                >
                  {isReAnalyzing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <TestTubeDiagonal className="mr-2 h-4 w-4" />}
                  {isReAnalyzing ? 'Analyzing...' : 'Re-analyze & Update'}
                </Button>
              <AlertDialogCancel onClick={() => setSelectedArticleForView(null)} className="w-full sm:w-auto mt-0">Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

