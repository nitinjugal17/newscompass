
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BlogCard } from '@/components/BlogCard';
import { getBlogPosts } from '@/actions/blogActions';
import type { BlogPost } from '@/types';
import { NewspaperIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const revalidate = 60; // Revalidate this page every 60 seconds

export default async function BlogListPage() {
  const posts: BlogPost[] = await getBlogPosts();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary flex items-center justify-center gap-3">
            <NewspaperIcon className="h-10 w-10" /> The News Compass Blog
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Insights, analyses, and discussions on the latest news, powered by AI and our editorial team.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-20">
            <NewspaperIcon className="mx-auto h-16 w-16 text-muted-foreground opacity-50" />
            <h2 className="mt-6 text-2xl font-semibold text-muted-foreground">No Blog Posts Yet</h2>
            <p className="mt-2 text-md text-muted-foreground">
              Our blog is new! Check back soon for articles and analyses.
            </p>
            <Button asChild className="mt-8">
              <Link href="/">Return to Homepage</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post, index) => (
              <BlogCard key={post.id} post={post} index={index} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
