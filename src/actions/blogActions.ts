
'use server';

import type { BlogPost, SavedAnalyzedArticle, User } from '@/types';
import { getSavedArticleById } from '@/actions/articleActions';
import { getMockUserById } from '@/lib/mockAuthData'; // To get author name
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { generateBlogSummary, type BlogSummaryInput, type BlogSummaryOutput } from '@/ai/flows/generate-blog-summary';

const dataDir = path.join(process.cwd(), 'data');
const blogPostsFilePath = path.join(dataDir, 'blogPosts.csv');
const blogCommentsFilePath = path.join(dataDir, 'blogComments.csv'); // For future use

const BLOG_POST_CSV_HEADER = '"id","newsArticleId","title","slug","authorId","authorName","createdAt","summary"\n';
const EXPECTED_BLOG_POST_HEADERS = ['id', 'newsarticleid', 'title', 'slug', 'authorid', 'authorname', 'createdat', 'summary'];

const BLOG_COMMENT_CSV_HEADER = '"id","blogPostId","userId","userName","commentText","createdAt"\n';

async function ensureDataDirectory(): Promise<void> {
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.error('Error creating data directory for blog:', error);
      console.error('Original error:', error);
      throw new Error('Failed to ensure data directory for blog.');
    }
  }
}

function escapeCsvField(field: string | undefined | null): string {
  if (field === undefined || field === null) return '""';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

// --- Blog Post CSV Helpers ---
async function readBlogPostsFromCSV(): Promise<BlogPost[]> {
  await ensureDataDirectory();
  try {
    await fs.access(blogPostsFilePath);
  } catch (error) {
    await fs.writeFile(blogPostsFilePath, BLOG_POST_CSV_HEADER, 'utf-8');
    return [];
  }

  const csvData = await fs.readFile(blogPostsFilePath, 'utf-8');
  if (!csvData.trim() || csvData.trim() === BLOG_POST_CSV_HEADER.trim()) {
    return [];
  }

  const lines = csvData.split('\n').filter(line => line.trim() !== '');
  if (lines.length <= 1) return []; // Only header or empty

  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
  const missingHeaders = EXPECTED_BLOG_POST_HEADERS.filter(eh => !header.includes(eh));
  if (missingHeaders.length > 0 || header.length !== EXPECTED_BLOG_POST_HEADERS.length) {
    console.warn(`Blog posts CSV header is malformed. Re-initializing. Expected: ${EXPECTED_BLOG_POST_HEADERS.join(',')}, Found: ${header.join(',')}`);
    await fs.writeFile(blogPostsFilePath, BLOG_POST_CSV_HEADER, 'utf-8');
    return [];
  }

  return lines.slice(1).map(line => {
    const values: string[] = [];
    let inQuotes = false;
    let currentValue = '';
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && i + 1 < line.length && line[i+1] === '"') {
                currentValue += '"'; i++;
            } else { inQuotes = !inQuotes; }
        } else if (char === ',' && !inQuotes) {
            values.push(currentValue); currentValue = '';
        } else { currentValue += char; }
    }
    values.push(currentValue);

    const post: Partial<BlogPost> = {};
    header.forEach((colName, index) => {
      const val = values[index] !== undefined ? values[index] : '';
      const unescapedVal = val.startsWith('"') && val.endsWith('"') ? val.slice(1, -1).replace(/""/g, '"') : val;
      switch (colName) {
        case 'id': post.id = unescapedVal; break;
        case 'newsarticleid': post.newsArticleId = unescapedVal; break;
        case 'title': post.title = unescapedVal; break;
        case 'slug': post.slug = unescapedVal; break;
        case 'authorid': post.authorId = unescapedVal; break;
        case 'authorname': post.authorName = unescapedVal; break;
        case 'createdat': post.createdAt = unescapedVal; break;
        case 'summary': post.summary = unescapedVal; break;
      }
    });
    return post as BlogPost;
  }).filter(post => post.id && post.title && post.slug);
}

async function writeBlogPostsToCSV(posts: BlogPost[]): Promise<void> {
  await ensureDataDirectory();
  const csvContent = [
    BLOG_POST_CSV_HEADER.trim(),
    ...posts.map(p =>
      [
        escapeCsvField(p.id),
        escapeCsvField(p.newsArticleId),
        escapeCsvField(p.title),
        escapeCsvField(p.slug),
        escapeCsvField(p.authorId),
        escapeCsvField(p.authorName),
        escapeCsvField(p.createdAt),
        escapeCsvField(p.summary),
      ].join(',')
    )
  ].join('\n');
  await fs.writeFile(blogPostsFilePath, csvContent + '\n', 'utf-8');
}

// Function to generate a URL-friendly slug
function generateSlug(title: string | undefined | null): string {
  let baseForSlug = title || ''; // Ensure baseForSlug is a string

  let slug = baseForSlug
    .toString() // Ensure it's a string if title was somehow not
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word characters except spaces and hyphens
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  if (!slug) { // If after all replacements, the slug is empty (e.g., title was only symbols)
    slug = `post-${Date.now()}`; // Generate a timestamp-based slug
  }
  return slug;
}


// --- Blog Comments CSV Helpers (Placeholder for now) ---
async function ensureBlogCommentsFile(): Promise<void> {
  await ensureDataDirectory();
  try {
    await fs.access(blogCommentsFilePath);
  } catch (error) {
    await fs.writeFile(blogCommentsFilePath, BLOG_COMMENT_CSV_HEADER, 'utf-8');
  }
}
// Initialize comments file on module load
ensureBlogCommentsFile();


// --- Server Actions ---

export async function createBlogPostFromArticle(
  newsArticleId: string,
  authorId: string
): Promise<BlogPost | { error: string }> {
  try {
    const savedArticle = await getSavedArticleById(newsArticleId);
    if (!savedArticle) {
      return { error: 'Associated news article not found.' };
    }

    // The title for slug generation comes from savedArticle.summary
    // The actual blog post title will also be savedArticle.summary
    const blogPostTitle = savedArticle.summary; 

    const author: User | undefined = getMockUserById(authorId);
    const authorName = author ? author.name : 'News Compass Admin';

    const slug = generateSlug(blogPostTitle); // Use blogPostTitle for slug
    const blogPosts = await readBlogPostsFromCSV();

    if (blogPosts.some(post => post.slug === slug || post.newsArticleId === newsArticleId)) {
      return { error: 'A blog post with this title (slug) or from this news article already exists.' };
    }

    let blogSummaryToUse = blogPostTitle; // Fallback to original news summary (which is blogPostTitle)
    if (savedArticle.originalContent && savedArticle.originalContent.trim() !== '') {
      try {
        console.log(`Generating blog-specific summary for article: "${blogPostTitle}"`);
        const blogSummaryResult = await generateBlogSummary({
          articleContent: savedArticle.originalContent,
          articleTitle: blogPostTitle, // Pass the title to the AI flow
        } as BlogSummaryInput);
        blogSummaryToUse = (blogSummaryResult as BlogSummaryOutput).blogSummary;
        console.log(`Successfully generated blog summary: "${blogSummaryToUse.substring(0, 50)}..."`);
      } catch (aiError) {
        console.warn(`Failed to generate specific blog summary for article "${blogPostTitle}", falling back to news summary. Error:`, aiError);
        // blogSummaryToUse remains blogPostTitle from fallback initialization
      }
    } else {
      console.warn(`Original content not available for article "${blogPostTitle}", using existing news summary for blog post.`);
    }


    const newBlogPost: BlogPost = {
      id: randomUUID(),
      newsArticleId: savedArticle.id,
      title: blogPostTitle, // Use the potentially empty or original summary as title
      slug,
      authorId,
      authorName,
      createdAt: new Date().toISOString(),
      summary: blogSummaryToUse, // This is the AI-generated blog summary or the fallback
    };

    const updatedBlogPosts = [...blogPosts, newBlogPost];
    await writeBlogPostsToCSV(updatedBlogPosts);
    return newBlogPost;
  } catch (error) {
    console.error('Error creating blog post:', error);
    console.error('Original error object:', error);
    const message = error instanceof Error ? error.message : 'Could not create blog post.';
    return { error: message };
  }
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  try {
    const posts = await readBlogPostsFromCSV();
    return posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Error in getBlogPosts:", error);
    console.error('Original error object:', error);
    throw new Error(error instanceof Error ? error.message : 'Could not fetch blog posts.');
  }
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    if (!slug) return null;
    const posts = await readBlogPostsFromCSV();
    return posts.find(post => post.slug === slug) || null;
  } catch (error) {
    console.error(`Error finding blog post by slug "${slug}":`, error);
    console.error('Original error object:', error);
    throw new Error(error instanceof Error ? error.message : `Could not retrieve blog post with slug ${slug}.`);
  }
}

export async function deleteBlogPost(blogPostId: string): Promise<{ success: boolean }> {
  try {
    const blogPosts = await readBlogPostsFromCSV();
    const updatedBlogPosts = blogPosts.filter(post => post.id !== blogPostId);
    if (blogPosts.length === updatedBlogPosts.length) {
      console.warn(`Blog post with ID "${blogPostId}" not found for deletion.`);
    }
    await writeBlogPostsToCSV(updatedBlogPosts);
    return { success: true };
  } catch (error) {
    console.error("Error in deleteBlogPost:", error);
    console.error('Original error object:', error);
    throw new Error(error instanceof Error ? error.message : 'Could not delete blog post.');
  }
}

// Placeholder for future comment actions
// export async function getCommentsForPost(blogPostId: string): Promise<BlogComment[]>
// export async function addCommentToPost(commentData: Omit<BlogComment, 'id' | 'createdAt'>): Promise<BlogComment>

