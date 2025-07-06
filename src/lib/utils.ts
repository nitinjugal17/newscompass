
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type Parser from 'rss-parser';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper function to strip HTML tags and decode common HTML entities
export function stripHtml(html: string | undefined | null): string {
  if (!html) return '';
  
  // First, remove HTML tags
  let text = html.replace(/<[^>]*>/gm, '');

  // Then, decode common HTML entities
  // This list can be expanded as needed
  const commonEntities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&lsquo;': '‘',
    '&rsquo;': '’',
    '&ldquo;': '“',
    '&rdquo;': '”',
    '&ndash;': '–',
    '&mdash;': '—',
    '&nbsp;': ' ',
    // Add more entities if you frequently encounter others
  };

  for (const entity in commonEntities) {
    text = text.replace(new RegExp(entity, 'g'), commonEntities[entity]);
  }
  
  return text;
}

// Helper function to extract a suitable image URL from an RSS feed item
export function extractImageUrlFromFeedItem(item: Parser.Item, feedLink?: string): string | undefined {
  let imageUrl: string | undefined = undefined;

  // 1. Check <enclosure type="image/..." url="..." />
  if (item.enclosures && item.enclosures.length > 0) {
    for (const enclosure of item.enclosures) {
      if (enclosure.url && enclosure.type && enclosure.type.startsWith('image/')) {
        try {
            new URL(enclosure.url); // Validate if it's a proper URL
            imageUrl = enclosure.url;
            break;
        } catch (e) { /* not a valid URL */ }
      }
    }
  }

  // 2. Check <media:content> or <media:thumbnail> (often parsed into item.image by rss-parser)
  // Also check item.image if it's directly a string (less common but possible)
  if (!imageUrl && item.image && typeof item.image === 'object' && item.image.url) {
     try {
        new URL(item.image.url);
        imageUrl = item.image.url;
    } catch (e) { /* not a valid URL */ }
  } else if (!imageUrl && typeof item.image === 'string') {
    try {
        new URL(item.image);
        imageUrl = item.image;
    } catch (e) { /* not a valid URL */ }
  }

  // 3. Check iTunes image (for feeds that might use this, like some news podcasts)
  if (!imageUrl && item.itunes && item.itunes.image) {
     try {
        new URL(item.itunes.image);
        imageUrl = item.itunes.image;
    } catch (e) { /* not a valid URL */ }
  }

  // 4. Attempt to extract from HTML content (item.content or item.contentSnippet)
  // This is a fallback and can be less reliable.
  const contentToSearch = item.content || item.contentSnippet || '';
  if (!imageUrl && contentToSearch) {
    const imgMatch = contentToSearch.match(/<img[^>]+src\s*=\s*['"]([^'"]+)['"]/i);
    if (imgMatch && imgMatch[1]) {
      let potentialUrl = imgMatch[1].trim();
      if (potentialUrl) {
        try {
          // Resolve relative URLs. Use article link as base, then feed link.
          const baseLink = item.link || feedLink;
          const resolvedUrl = new URL(potentialUrl, baseLink);

          // Basic check for common image extensions to avoid linking to non-image src attributes
          if (/\.(jpeg|jpg|gif|png|webp)(\?|$)/i.test(resolvedUrl.pathname)) {
            imageUrl = resolvedUrl.href;
          }
        } catch (e) {
          // console.warn(`Could not parse potential image URL from content: ${potentialUrl}`, e);
        }
      }
    }
  }
  return imageUrl;
}
