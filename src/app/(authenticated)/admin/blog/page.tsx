
'use client';

import type { BlogPost, User } from '@/types';
import { UserRole } from '@/types';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NewspaperIcon, Trash2, ArrowLeft, RefreshCw, AlertTriangle, Eye } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { getBlogPosts, deleteBlogPost } from '@/actions/blogActions';
import { formatDate } from '@/lib/mockNewsData';
import { mockUsers } from '@/lib/mockAuthData'; // For mocking current user
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
import { ScrollArea } from '@/components/ui/scroll-area';

// --- Mock Current User for Page Access Control ---
const MOCK_CURRENT_USER_FOR_PAGE_ACCESS: User | undefined = mockUsers.find(u => u.role === UserRole.SUPER_ADMIN) || mockUsers.find(u => u.role === UserRole.ADMIN);
const currentUserRole = MOCK_CURRENT_USER_FOR_PAGE_ACCESS ? MOCK_CURRENT_USER_FOR_PAGE_ACCESS.role : UserRole.USER;
// --- End Mock Current User ---

export default function ManageBlogPostsPage() {
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // Stores ID of blog post being deleted

  const { toast } = useToast();

  const fetchBlogPosts = useCallback(async () => {
    if (currentUserRole !== UserRole.ADMIN && currentUserRole !== UserRole.SUPER_ADMIN) {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    try {
      const fetchedPosts = await getBlogPosts();
      setBlogPosts(fetchedPosts);
    } catch (error) {
      console.error("Failed to fetch blog posts:", error);
      toast({
        title: 'Error Fetching Blog Posts',
        description: error instanceof Error ? error.message : 'Could not load blog posts.',
        variant: 'destructive',
      });
      setBlogPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast, currentUserRole]);

  useEffect(() => {
    fetchBlogPosts();
  }, [fetchBlogPosts]);

  const handleDeleteBlogPost = async (postId: string, postTitle: string) => {
    setIsDeleting(postId);
    try {
      await deleteBlogPost(postId);
      toast({
        title: 'Blog Post Deleted',
        description: `Blog post "${postTitle}" has been removed. The original saved analysis is unaffected.`,
      });
      await fetchBlogPosts(); // Refresh the list
    } catch (error) {
      console.error("Failed to delete blog post:", error);
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Could not remove the blog post.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(null);
    }
  };

  if (currentUserRole !== UserRole.ADMIN && currentUserRole !== UserRole.SUPER_ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 text-destructive">
              <AlertTriangle className="h-8 w-8" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg text-muted-foreground">
              You do not have permission to manage blog posts.
            </p>
            <Button variant="outline" asChild className="mt-6">
              <Link href="/admin">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Admin Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <NewspaperIcon className="h-9 w-9 text-primary" />
          Manage Blog Posts
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchBlogPosts} disabled={isLoading || !!isDeleting} title="Refresh List">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin Dashboard
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Published Blog Posts</CardTitle>
          <CardDescription>
            View and manage existing blog posts. New posts are created by promoting saved analyses.
            Deleting a blog post here will "un-promote" it, meaning it's removed from the blog, but the original saved news analysis remains.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-muted-foreground text-center py-4">Loading blog posts...</p>}
          {!isLoading && blogPosts.length === 0 && (
            <div className="text-center py-10">
              <NewspaperIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-lg font-medium">No Blog Posts Yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Promote a saved article analysis to create a blog post.
              </p>
              <Button asChild className="mt-4">
                <Link href="/admin/articles">Go to Saved Analyses</Link>
              </Button>
            </div>
          )}
          {!isLoading && blogPosts.length > 0 && (
            <ScrollArea className="h-[60vh] w-full overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Created Date</TableHead>
                    <TableHead>Summary (Excerpt)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blogPosts.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell className="font-medium max-w-xs truncate" title={post.title}>{post.title}</TableCell>
                      <TableCell>{post.authorName}</TableCell>
                      <TableCell>{formatDate(post.createdAt)}</TableCell>
                      <TableCell className="max-w-sm truncate" title={post.summary}>
                        {post.summary.substring(0, 100)}{post.summary.length > 100 ? '...' : ''}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" asChild title="View Blog Post">
                            <Link href={`/blog/${post.slug}`} target="_blank">
                                <Eye className="h-4 w-4 text-blue-500" />
                            </Link>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Delete Blog Post" disabled={isLoading || !!isDeleting} title="Delete Blog Post (Un-promote)">
                              {isDeleting === post.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive"/>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the blog post: "{post.title}".
                                The original saved news analysis will not be affected and can be promoted again.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={isDeleting === post.id}>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteBlogPost(post.id, post.title)}
                                className="bg-destructive hover:bg-destructive/90"
                                disabled={isDeleting === post.id}
                              >
                                {isDeleting === post.id ? 'Deleting...' : 'Yes, delete'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
