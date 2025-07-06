
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getBlogPostBySlug } from '@/actions/blogActions';
import { getSavedArticleById, getArticleDetailsForLinking } from '@/actions/articleActions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, UserCircle, ArrowLeft, MessageSquare, LinkIcon, MessageCircleQuestion, Sparkles } from 'lucide-react'; // Added LinkIcon, Sparkles
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatDate } from '@/lib/mockNewsData';
import { notFound } from 'next/navigation';
import { BlogTranslationNotice } from '@/components/BlogTranslationNotice';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { SavedAnalyzedArticle } from '@/types'; // Import SavedAnalyzedArticle

export const revalidate = 60; // Revalidate this page every 60 seconds

interface BlogPostPageProps {
  params: {
    slug: string;
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const blogPost = await getBlogPostBySlug(params.slug);

  if (!blogPost) {
    notFound();
  }

  const savedArticle: SavedAnalyzedArticle | null = await getSavedArticleById(blogPost.newsArticleId);

  let similarArticleLinks: Array<{
    id: string;
    title: string;
    sourceName?: string;
    link?: string;
    confidence?: number;
    reasoning?: string;
  }> = [];

  if (savedArticle && savedArticle.similarArticles && savedArticle.similarArticles.length > 0) {
    const idsToFetch = savedArticle.similarArticles.map(sa => sa.id);
    const details = await getArticleDetailsForLinking(idsToFetch);
    // Merge details with confidence and reasoning
    similarArticleLinks = savedArticle.similarArticles.map(sa => {
      const detail = details.find(d => d.id === sa.id);
      return {
        ...detail, // id, title, sourceName, link from getArticleDetailsForLinking
        id: sa.id, // Ensure ID from sa is prioritized if detail is not found
        title: detail?.title || `Article ID: ${sa.id}`, // Fallback title
        confidence: sa.confidence,
        reasoning: sa.reasoning,
      };
    });
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <article className="max-w-3xl mx-auto">
          <Button variant="outline" asChild className="mb-8">
            <Link href="/blog">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Blog
            </Link>
          </Button>

          <BlogTranslationNotice />

          <Card className="shadow-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-3xl lg:text-4xl font-bold leading-tight text-primary">
                {blogPost.title}
              </CardTitle>
              <div className="mt-3 text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex items-center gap-1.5">
                  <UserCircle className="h-4 w-4" />
                  By {blogPost.authorName}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  Published on {formatDate(blogPost.createdAt)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {savedArticle?.imageUrl && !savedArticle.imageUrl.startsWith('https://placehold.co') && (
                <div className="relative w-full h-64 md:h-96 mb-6 rounded-lg overflow-hidden shadow-md bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={savedArticle.imageUrl}
                    alt={blogPost.title}
                    className="w-full h-full object-cover"
                    data-ai-hint={savedArticle.imageAiHint || "blog post image"}
                  />
                </div>
              )}
              {blogPost.summary && (
                <p className="text-lg italic text-muted-foreground mb-6 border-l-4 border-primary pl-4 py-2 bg-primary/5 rounded-r-md">
                  {blogPost.summary}
                </p>
              )}
              {savedArticle?.originalContent ? (
                <div
                  className="prose prose-lg dark:prose-invert max-w-none text-foreground/90"
                  dangerouslySetInnerHTML={{ __html: savedArticle.originalContent.replace(/\n/g, '<br />') }}
                />
              ) : (
                <p className="text-muted-foreground">Content not available.</p>
              )}

              {savedArticle?.articleLink && (
                <div className="mt-8 text-sm">
                  <p className="text-muted-foreground">
                    This blog post is based on analysis of an article originally found at:
                    <a href={savedArticle.articleLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                       {savedArticle.articleLink.length > 50 ? savedArticle.articleLink.substring(0,50) + "..." : savedArticle.articleLink }
                    </a>
                  </p>
                </div>
              )}

             {similarArticleLinks.length > 0 && (
                <div className="mt-10 pt-6 border-t">
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <LinkIcon className="h-5 w-5 text-primary" />
                    Related Coverage & Perspectives
                  </h3>
                  <ul className="space-y-4">
                    {similarArticleLinks.map(simArt => (
                      <li key={simArt.id} className="text-sm border-l-2 pl-3 py-1 border-muted-foreground/30">
                        <div className="font-medium">
                          {simArt.link ? (
                            <a href={simArt.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              {simArt.title}
                            </a>
                          ) : (
                            simArt.title
                          )}
                          {simArt.sourceName && <span className="text-muted-foreground text-xs"> ({simArt.sourceName})</span>}
                        </div>
                        {simArt.reasoning && (
                          <TooltipProvider>
                            <Tooltip delayDuration={100}>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 text-muted-foreground mt-0.5 cursor-help text-xs">
                                  <MessageCircleQuestion className="h-3.5 w-3.5"/>
                                  <span>AI Reason (Similarity: {simArt.confidence?.toFixed(2) || 'N/A'})</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs" side="bottom" align="start">
                                <p>{simArt.reasoning}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {!simArt.reasoning && simArt.confidence !== undefined && (
                          <p className="text-muted-foreground text-xs mt-0.5">Similarity Confidence: {simArt.confidence.toFixed(2)}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator className="my-12" />
          <div id="comments" className="mt-8">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" /> Reader Comments
            </h2>
            <div className="bg-muted/50 p-6 rounded-lg text-center">
              <p className="text-muted-foreground">Comments are coming soon!</p>
              <p className="text-sm text-muted-foreground mt-1">Share your thoughts on this post in the near future.</p>
            </div>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
