
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, TestTube2, FileText, Activity, Info, RefreshCw, Palette, Save, LinkIcon, Search, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { analyzeArticleContent } from '@/actions/analysisActions';
import { saveAnalyzedArticle, type SaveAnalyzedArticleResult, findSavedAnalysisByLink } from '@/actions/articleActions';
import type { AnalyzedArticleOutput, SavedAnalyzedArticle } from '@/types';
import { AnalyzeArticleContentInputSchema } from '@/types';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AnalyzeArticlePage() {
  const [articleContent, setArticleContent] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [articleLink, setArticleLink] = useState('');
  const [customPromptInstructions, setCustomPromptInstructions] = useState(''); // New state for custom prompt
  const [analysisResult, setAnalysisResult] = useState<AnalyzedArticleOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [isFetchingSaved, setIsFetchingSaved] = useState(false);
  const [initialAnalysisLoadedFromSaved, setInitialAnalysisLoadedFromSaved] = useState(false);

  const handleFetchSavedAnalysis = async () => {
    if (!articleLink || !articleLink.trim()) {
      if (initialAnalysisLoadedFromSaved) {
        setArticleContent('');
        setSourceName('');
        setAnalysisResult(null);
        setInitialAnalysisLoadedFromSaved(false);
        setCustomPromptInstructions(''); // Reset custom prompt too
      }
      return;
    }
    try {
      new URL(articleLink.trim()); 
    } catch (e) {
      toast({ title: "Invalid URL", description: "Please enter a valid article URL.", variant: "destructive" });
      return;
    }

    setIsFetchingSaved(true);
    setError(null);
    try {
      const savedAnalysis: SavedAnalyzedArticle | null = await findSavedAnalysisByLink(articleLink.trim());
      if (savedAnalysis) {
        setArticleContent(savedAnalysis.originalContent || '');
        setSourceName(savedAnalysis.sourceName || '');
        setAnalysisResult({
          summary: savedAnalysis.summary,
          biasScore: savedAnalysis.biasScore,
          biasExplanation: savedAnalysis.biasExplanation,
          neutralSummary: savedAnalysis.neutralSummary,
          sourceName: savedAnalysis.sourceName,
          articleLink: savedAnalysis.articleLink,
          originalContent: savedAnalysis.originalContent,
          category: savedAnalysis.category,
        });
        setInitialAnalysisLoadedFromSaved(true);
        // Do not reset customPromptInstructions here, user might want to re-use them
        toast({
          title: 'Saved Analysis Loaded',
          description: 'Existing analysis for this URL has been loaded.',
        });
      } else {
        setInitialAnalysisLoadedFromSaved(false);
        setAnalysisResult(null);
        toast({
          title: 'No Saved Analysis',
          description: 'No saved analysis found for this URL. You can analyze new content.',
          variant: "default",
        });
      }
    } catch (err) {
      console.error("Failed to fetch saved analysis:", err);
      const errorMessage = err instanceof Error ? err.message : 'Could not fetch saved analysis.';
      setError(errorMessage);
      toast({ title: 'Fetch Failed', description: errorMessage, variant: 'destructive' });
      setInitialAnalysisLoadedFromSaved(false);
      setAnalysisResult(null);
    } finally {
      setIsFetchingSaved(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const validationResult = AnalyzeArticleContentInputSchema.safeParse({
      articleContent,
      sourceName,
      articleLink: articleLink.trim() || undefined,
      originalContentForSave: articleContent,
      generateNeutralPerspective: true,
      customPromptInstructions: customPromptInstructions.trim() || undefined, // Add custom prompt
    });

    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues.map(i => i.message).join('; ');
      setError(errorMessages);
      toast({
        title: 'Validation Error',
        description: errorMessages,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const shouldForceRefresh = initialAnalysisLoadedFromSaved || !!analysisResult;
      
      const result = await analyzeArticleContent({
        ...validationResult.data,
        forceRefresh: shouldForceRefresh,
      });
      
      setAnalysisResult(result);
      setInitialAnalysisLoadedFromSaved(false); 
      toast({
        title: 'Analysis Complete',
        description: 'Article content has been successfully analyzed.',
      });
    } catch (err) {
      console.error("Analysis failed:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      toast({
        title: 'Analysis Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAnalysis = async () => {
    if (!analysisResult) return;
    setIsSaving(true);
    try {
      const dataToSave: Omit<SavedAnalyzedArticle, 'id' | 'savedDate'> = {
        summary: analysisResult.summary,
        biasScore: analysisResult.biasScore,
        biasExplanation: analysisResult.biasExplanation,
        neutralSummary: analysisResult.neutralSummary,
        sourceName: analysisResult.sourceName || sourceName, 
        articleLink: analysisResult.articleLink || (articleLink.trim() || undefined), 
        originalContent: analysisResult.originalContent || articleContent, 
        category: analysisResult.category,
      };
      const saveResult: SaveAnalyzedArticleResult = await saveAnalyzedArticle(dataToSave);

      let toastMessage = '';
      if (saveResult.operation === 'saved_new') {
        toastMessage = `Article "${saveResult.article.summary.substring(0, 50)}..." was analyzed and saved.`;
      } else if (saveResult.operation === 'updated_analysis') {
        toastMessage = `Analysis for "${saveResult.article.summary.substring(0, 50)}..." was updated.`;
      }
      toast({
        title: saveResult.operation === 'saved_new' ? 'Analysis Saved' : 'Analysis Updated',
        description: toastMessage,
      });
      setAnalysisResult({
        summary: saveResult.article.summary,
        biasScore: saveResult.article.biasScore,
        biasExplanation: saveResult.article.biasExplanation,
        neutralSummary: saveResult.article.neutralSummary,
        sourceName: saveResult.article.sourceName,
        articleLink: saveResult.article.articleLink,
        originalContent: saveResult.article.originalContent,
        category: saveResult.article.category,
      });
      setInitialAnalysisLoadedFromSaved(true); 

    } catch (err) {
      console.error("Failed to save analysis:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while saving.';
      toast({
        title: 'Save Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
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

  const mainButtonText = (initialAnalysisLoadedFromSaved || analysisResult) ? "Re-analyze Current Content" : "Analyze Article";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <TestTube2 className="h-9 w-9 text-primary" />
          Analyze Article Content
        </h1>
        <Button variant="outline" asChild>
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin Dashboard
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submit Article for AI Analysis</CardTitle>
          <CardDescription>
            Paste the full text content of a news article below.
            Provide an Article URL to fetch, view, and potentially update a previously saved analysis.
            Optionally add custom instructions to guide the AI analysis.
            The AI will generate a summary, assess political bias, and provide a neutral perspective.
            Analysis results can be saved or updated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="articleLink" className="text-lg font-semibold">Article URL (Optional)</Label>
                <div className="flex items-center gap-2 mt-2">
                    <Input
                    id="articleLink"
                    type="url"
                    value={articleLink}
                    onChange={(e) => setArticleLink(e.target.value)}
                    onBlur={handleFetchSavedAnalysis} 
                    placeholder="e.g., https://example.com/news/article-123"
                    className="text-base"
                    disabled={isLoading || isSaving || isFetchingSaved}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleFetchSavedAnalysis}
                        disabled={isLoading || isSaving || isFetchingSaved || !articleLink.trim()}
                        title="Fetch saved analysis for this URL"
                    >
                        {isFetchingSaved ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter URL to load saved analysis or to associate with new analysis.
                </p>
              </div>
              <div>
                <Label htmlFor="sourceName" className="text-lg font-semibold">Source Name (Optional)</Label>
                <Input
                  id="sourceName"
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder="e.g., News Provider Weekly"
                  className="mt-2 text-base"
                  disabled={isLoading || isSaving || isFetchingSaved}
                />
                <p className="text-sm text-muted-foreground mt-1">Name of the news source or company.</p>
              </div>
            </div>
             <div>
              <Label htmlFor="articleContent" className="text-lg font-semibold">Article Content</Label>
              <Textarea
                id="articleContent"
                value={articleContent}
                onChange={(e) => setArticleContent(e.target.value)}
                placeholder={
                    isFetchingSaved ? "Fetching content..." : 
                    initialAnalysisLoadedFromSaved ? "Content loaded from saved analysis. Edit to re-analyze." : 
                    "Paste the full news article text here..."
                }
                rows={15}
                required
                className="mt-2 text-base"
                disabled={isLoading || isSaving || isFetchingSaved}
              />
              <p className="text-sm text-muted-foreground mt-1">Minimum 50 characters required.</p>
            </div>
            <div>
              <Label htmlFor="customPromptInstructions" className="text-lg font-semibold flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500"/>
                Custom AI Prompt Instructions (Optional)
              </Label>
              <Textarea
                id="customPromptInstructions"
                value={customPromptInstructions}
                onChange={(e) => setCustomPromptInstructions(e.target.value)}
                placeholder="e.g., 'Focus on the economic impact in the summary.' or 'Assess bias specifically regarding international trade policies.'"
                rows={3}
                className="mt-2 text-base"
                disabled={isLoading || isSaving || isFetchingSaved}
              />
              <p className="text-sm text-muted-foreground mt-1">
                These instructions will be appended to the AI's default prompts for summarization, bias assessment, and neutral perspective generation.
              </p>
            </div>
            {error && (
              <Alert variant="destructive">
                <Activity className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full md:w-auto text-lg py-3 px-6" disabled={isLoading || isSaving || isFetchingSaved}>
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <TestTube2 className="mr-2 h-5 w-5" /> {mainButtonText}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {analysisResult && (
        <Card className="mt-8 animate-fadeIn">
          <CardHeader>
            <CardTitle className="text-2xl">AI Analysis Results</CardTitle>
            <div className="text-sm text-muted-foreground space-y-1">
              {analysisResult.sourceName && (
                <p>Source: <strong>{analysisResult.sourceName}</strong></p>
              )}
              {analysisResult.articleLink && (
                <p>Original URL: <a href={analysisResult.articleLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{analysisResult.articleLink}</a></p>
              )}
              {analysisResult.category && (
                <p>Category: <strong>{analysisResult.category}</strong></p>
              )}
              {initialAnalysisLoadedFromSaved && (
                <p className="text-primary font-semibold">Currently displaying a previously saved analysis.</p>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2 flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Concise Summary</h3>
              <p className="text-muted-foreground bg-muted p-4 rounded-md shadow-sm">{analysisResult.summary}</p>
            </div>
            <Separator />
            <div>
              <h3 className="text-xl font-semibold mb-2 flex items-center gap-2"><Palette className="h-5 w-5 text-primary" />Political Bias Assessment</h3>
              <div className={`p-4 rounded-md border-l-4 ${getBiasClasses(analysisResult.biasScore)} shadow-sm`}>
                <p className="text-lg font-medium">
                  Assessed Bias: <span className={`font-bold ${getBiasClasses(analysisResult.biasScore).split(' ')[2]}`}>{analysisResult.biasScore}</span>
                </p>
                <p className="text-sm text-muted-foreground mt-1"><strong>Explanation:</strong> {analysisResult.biasExplanation}</p>
              </div>
            </div>
            {analysisResult.neutralSummary && (
              <>
                <Separator />
                <div>
                  <h3 className="text-xl font-semibold mb-2 flex items-center gap-2"><Info className="h-5 w-5 text-primary" />AI Neutral Perspective</h3>
                  <p className="text-muted-foreground bg-muted p-4 rounded-md shadow-sm">{analysisResult.neutralSummary}</p>
                </div>
              </>
            )}
            {analysisResult.originalContent && (
              <>
                <Separator />
                <div>
                  <h3 className="text-xl font-semibold mb-2 flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Original Content Analyzed</h3>
                  <ScrollArea className="h-40 bg-muted p-4 rounded-md shadow-sm">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysisResult.originalContent}</p>
                  </ScrollArea>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex-col items-start gap-4 sm:flex-row sm:justify-between sm:items-center">
            <Button onClick={handleSaveAnalysis} disabled={isSaving || isLoading || isFetchingSaved} className="w-full sm:w-auto">
              {isSaving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> {initialAnalysisLoadedFromSaved ? 'Update Saved Analysis' : 'Save Analysis'}
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground">
              These results are generated by AI and should be used as a tool for understanding, not as absolute truth.
            </p>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
