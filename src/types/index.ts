
import { z } from 'zod';

export type BiasScore = 'Left' | 'Center' | 'Right' | 'Unknown';

export interface NewsArticle {
  id: string;
  title: string;
  link: string;
  source: string;
  sourceUrl?: string;
  publishedDate: string; // ISO Date string
  content?: string; // Full original article content (can be large)
  summary?: string; // AI-generated summary or feed snippet
  neutralSummary?: string; // AI-generated neutral summary
  bias?: BiasScore;
  biasExplanation?: string;
  imageUrl?: string;
  imageAiHint?: string; // Hint for AI image generation if needed
  similarArticles?: Array<{ id: string; confidence?: number; reasoning?: string }>; // Enhanced similar articles
  category?: string; // Category of the article, often from the feed source
}

export interface RssFeedSource {
  name: string;
  url: string;
  category: string;
}

export enum UserRole {
  USER = 'User',
  ADMIN = 'Admin',
  SUPER_ADMIN = 'SuperAdmin',
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Hashed password
  role: UserRole;
  avatarUrl?: string;
  avatarAiHint?: string;
}

// Schema for validating article content input for analysis
export const AnalyzeArticleContentInputSchema = z.object({
  articleContent: z.string().min(50, { message: "Article content must be at least 50 characters." }),
  sourceName: z.string().optional(),
  category: z.string().optional(), // Category of the article
  generateNeutralPerspective: z.boolean().optional().default(true),
  articleLink: z.string().url({ message: "Invalid URL format for article link." }).optional(),
  originalContentForSave: z.string().optional(),
  forceRefresh: z.boolean().optional().default(false),
  customPromptInstructions: z.string().optional(), // New field for custom instructions
});
export type AnalyzeArticleContentInput = z.infer<typeof AnalyzeArticleContentInputSchema>;

// Output of the analysis action
export interface AnalyzedArticleOutput {
  summary: string;
  biasScore: 'Left' | 'Center' | 'Right' | string;
  biasExplanation: string;
  neutralSummary?: string;
  sourceName?: string;
  articleLink?: string;
  originalContent?: string;
  category?: string; // Category of the article
}

// Represents an analyzed article result saved by the admin
export interface SavedAnalyzedArticle {
  id: string; // UUID
  savedDate: string; // ISO Date string
  sourceName?: string;
  articleLink?: string; // URL of the original article
  category?: string; // Category of the article
  summary: string; // AI summary
  biasScore: 'Left' | 'Center' | 'Right' | string;
  biasExplanation: string;
  neutralSummary?: string;
  originalContent?: string; // Full original content
  similarArticles?: Array<{
    id: string;
    confidence?: number;
    reasoning?: string;
  }>;
}


export type DataSourceOption = 'mock' | 'live' | 'api';

export interface SystemSettings {
  dataSource: DataSourceOption;
  autoRemoveBadFeeds?: boolean;
  maxFeedsForGlobalSearch?: number;
  maxArticlesPerFeedGlobalSearch?: number;
  feedValidationTimeoutSeconds?: number;
}

export interface BlogPost {
  id: string; // UUID for the blog post
  newsArticleId: string; // ID of the SavedAnalyzedArticle it's based on
  title: string; // Can be edited from original news title
  slug: string; // URL-friendly slug, generated from title
  authorId: string; // ID of the admin/superadmin who created it
  authorName: string; // Name of the admin/superadmin
  createdAt: string; // ISO Date string of blog post creation
  summary: string; // Excerpt for listing, from SavedAnalyzedArticle.summary or edited
  // Full content is fetched from the linked SavedAnalyzedArticle on the detail page
}

export interface BlogComment {
  id: string; // UUID for the comment
  blogPostId: string; // ID of the BlogPost it belongs to
  userId: string; // ID of the user who commented (can be name for guest comments)
  userName: string; // Name of the commenter
  commentText: string;
  createdAt: string; // ISO Date string of comment creation
  // Optional: parentCommentId for threaded comments
}

export type SaveAnalyzedArticleResult = {
  article: SavedAnalyzedArticle;
  operation: 'saved_new' | 'updated_analysis';
};
