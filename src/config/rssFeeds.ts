
import type { RssFeedSource } from '@/types';

export const initialRssFeeds: RssFeedSource[] = [
  {
    name: "Associated Press",
    url: "https://feeds.apnews.com/APTopNews.xml", // Verified XML feed
    category: "World News"
  },
  {
    name: "Reuters - World News",
    url: "https://feeds.reuters.com/reuters/worldNews", // Updated to HTTPS
    category: "World News"
  },
  {
    name: "BBC News - World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml", // Updated to HTTPS
    category: "World News"
  },
  {
    name: "NPR News",
    url: "https://feeds.npr.org/1001/rss.xml",
    category: "US News"
  },
  {
    name: "The Guardian - World News",
    url: "https://www.theguardian.com/world/rss",
    category: "World News"
  }
];
