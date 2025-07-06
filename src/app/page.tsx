import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { NewsFeedClientWrapper } from '@/components/NewsFeedClientWrapper';
import { getProcessedNewsArticles } from '@/lib/mockNewsData';
import type { NewsArticle } from '@/types';
import { Toaster } from "@/components/ui/toaster"

export default async function HomePage() {
  // In a real application, fetching and AI processing would happen here or be managed by a backend.
  // For this example, getProcessedNewsArticles simulates this and returns pre-processed mock data.
  const articles: NewsArticle[] = await getProcessedNewsArticles();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow">
        <NewsFeedClientWrapper initialArticles={articles} />
      </main>
      <Footer />
      <Toaster />
    </div>
  );
}
