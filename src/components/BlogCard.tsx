
'use client';

import type { BlogPost } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, UserCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/mockNewsData';

interface BlogCardProps {
  post: BlogPost;
  index?: number; // Optional index for animation delay
}

export function BlogCard({ post, index = 0 }: BlogCardProps) {
  return (
    <Card className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 animate-fadeIn" style={{ animationDelay: `${index * 100}ms` }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl lg:text-2xl leading-tight">
          <Link href={`/blog/${post.slug}`} className="hover:text-primary transition-colors">
            {post.title}
          </Link>
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
          <span className="flex items-center gap-1">
            <UserCircle className="h-3.5 w-3.5" />
            {post.authorName}
          </span>
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(post.createdAt)}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <p className="text-sm text-foreground/80 mb-3 line-clamp-3">
          {post.summary}
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" asChild className="w-full hover:bg-accent hover:text-accent-foreground">
          <Link href={`/blog/${post.slug}`}>
            Read More
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
