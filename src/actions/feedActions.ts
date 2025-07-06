
'use server';

import type { RssFeedSource, SystemSettings } from '@/types';
import fs from 'fs/promises';
import path from 'path';
import { initialRssFeeds } from '@/config/rssFeeds'; // Used for seeding
import { getSystemSettings } from '@/actions/settingsActions'; // Import settings getter

const dataDir = path.join(process.cwd(), 'data');
const feedsFilePath = path.join(dataDir, 'feeds.csv');

// Helper function to ensure the data directory exists
async function ensureDataDirectory(): Promise<void> {
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.error('Error creating data directory for feeds:');
      console.error('Original error:', error);
      throw new Error('Failed to ensure data directory for feeds.');
    }
  }
}

// Helper function to read feeds from CSV
async function readFeedsFromCSV(): Promise<RssFeedSource[]> {
  await ensureDataDirectory();
  try {
    await fs.access(feedsFilePath); // Check if file exists
  } catch (error) {
    // File doesn't exist, so seed it
    console.log('Feeds CSV not found, seeding with initial data...');
    try {
      await writeFeedsToCSV(initialRssFeeds); // This now can throw
      return initialRssFeeds;
    } catch (seedError) {
        console.error('Failed to seed feeds.csv:');
        console.error('Original seed error:', seedError);
        throw new Error('Failed to initialize feed data file.');
    }
  }

  let csvData;
  try {
    csvData = await fs.readFile(feedsFilePath, 'utf-8');
  } catch (readError) {
    console.error('Critical error reading feeds.csv:');
    console.error('Original read error:', readError);
    throw new Error('Failed to read feed data.');
  }
    
  if (!csvData.trim()) { // Handle empty file case after creation
      console.log('Feeds CSV is empty, seeding with initial data...');
      try {
        await writeFeedsToCSV(initialRssFeeds);
        return initialRssFeeds;
      } catch (seedError) {
        console.error('Failed to seed empty feeds.csv:');
        console.error('Original seed error:', seedError);
        throw new Error('Failed to initialize empty feed data file.');
      }
  }
  const lines = csvData.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
  const nameIndex = header.indexOf('name');
  const urlIndex = header.indexOf('url');
  const categoryIndex = header.indexOf('category');

  if (nameIndex === -1 || urlIndex === -1 || categoryIndex === -1) {
      console.error('CSV header is missing required columns (name, url, category). Re-seeding with initial data.');
      try {
        await writeFeedsToCSV(initialRssFeeds); // Overwrite malformed CSV
        return initialRssFeeds;
      } catch (seedError) {
        console.error('Failed to re-seed malformed feeds.csv:');
        console.error('Original seed error:', seedError);
        throw new Error('Failed to repair malformed feed data file.');
      }
  }
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    return {
      name: values[nameIndex] || '',
      url: values[urlIndex] || '',
      category: values[categoryIndex] || '',
    };
  }).filter(feed => feed.name && feed.url && feed.category);
}

// Helper function to write feeds to CSV
async function writeFeedsToCSV(feeds: RssFeedSource[]): Promise<void> {
  await ensureDataDirectory();
  const csvContent = [
    '"Name","URL","Category"',
    ...feeds.map(f => `"${f.name.replace(/"/g, '""')}","${f.url.replace(/"/g, '""')}","${f.category.replace(/"/g, '""')}"`)
  ].join('\n');
  try {
    await fs.writeFile(feedsFilePath, csvContent + '\n', 'utf-8'); // Ensure trailing newline
  } catch (error) {
    console.error('Error writing to feeds.csv:');
    console.error('Original error:', error);
    throw new Error('Failed to save feeds to data file.');
  }
}

// --- Server Actions ---

export async function getFeeds(): Promise<RssFeedSource[]> {
  try {
    return await readFeedsFromCSV();
  } catch (error) {
    console.error("Error in getFeeds:", error);
    console.error('Original error object:', error);
    const message = error instanceof Error ? error.message : 'Could not fetch RSS feeds.';
    throw new Error(message);
  }
}

export async function addFeed(newFeed: RssFeedSource): Promise<RssFeedSource | { error: string; feedExists?: boolean }> {
  let feeds: RssFeedSource[];
  try {
    feeds = await readFeedsFromCSV();
  } catch (readError) {
    console.error("Error reading feeds.csv in addFeed:", readError);
    // Log original error for server diagnostics
    console.error('Original read error object:', readError);
    return { error: 'Failed to read existing feeds. Could not add new feed.' };
  }

  if (feeds.some(feed => feed.url === newFeed.url)) {
    return { error: `Feed with URL "${newFeed.url}" already exists.`, feedExists: true };
  }

  try {
    const updatedFeeds = [...feeds, newFeed];
    await writeFeedsToCSV(updatedFeeds);
    return newFeed; // Success
  } catch (writeError) {
    console.error("Error writing feeds.csv in addFeed:", writeError);
    // Log original error for server diagnostics
    console.error('Original write error object:', writeError);
    return { error: 'Failed to save new feed.' };
  }
}

export async function updateFeed(feedToUpdate: RssFeedSource, originalUrl: string): Promise<RssFeedSource> {
  try {
    let feeds = await readFeedsFromCSV();
    
    if (feedToUpdate.url !== originalUrl && feeds.some(f => f.url === feedToUpdate.url)) {
      throw new Error(`Another feed with the URL "${feedToUpdate.url}" already exists.`);
    }

    feeds = feeds.map(feed => (feed.url === originalUrl ? feedToUpdate : feed));
    await writeFeedsToCSV(feeds);
    return feedToUpdate;
  } catch (error) {
    console.error("Error in updateFeed:", error);
    console.error('Original error object:', error);
    const message = error instanceof Error ? error.message : 'Could not update feed.';
    throw new Error(message);
  }
}

export async function deleteFeed(feedUrlToDelete: string): Promise<{ success: boolean }> {
  try {
    const feeds = await readFeedsFromCSV();
    const updatedFeeds = feeds.filter(feed => feed.url !== feedUrlToDelete);
    if (feeds.length === updatedFeeds.length) {
      console.warn(`Feed with URL "${feedUrlToDelete}" not found for deletion.`); 
    }
    await writeFeedsToCSV(updatedFeeds);
    return { success: true };
  } catch (error) {
    console.error("Error in deleteFeed:", error);
    console.error('Original error object:', error);
    const message = error instanceof Error ? error.message : 'Could not delete feed.';
    throw new Error(message);
  }
}

export async function deleteMultipleFeeds(urlsToDelete: string[]): Promise<{ success: boolean; deletedCount: number; message: string }> {
  try {
    const feeds = await readFeedsFromCSV();
    const updatedFeeds = feeds.filter(feed => !urlsToDelete.includes(feed.url));
    const deletedCount = feeds.length - updatedFeeds.length;
    
    if (deletedCount === 0 && urlsToDelete.length > 0) {
      console.warn(`No feeds found matching the URLs for deletion: ${urlsToDelete.join(', ')}.`);
    }
    
    await writeFeedsToCSV(updatedFeeds);
    
    return { 
      success: true, 
      deletedCount, 
      message: deletedCount > 0 ? `${deletedCount} feed(s) deleted successfully.` : "No matching feeds found for deletion." 
    };
  } catch (error) {
    console.error("Error in deleteMultipleFeeds:", error);
    console.error('Original error object:', error);
    const message = error instanceof Error ? error.message : 'Could not delete selected feeds.';
    throw new Error(message);
  }
}


export async function exportFeeds(format: 'txt' | 'csv'): Promise<string> {
  try {
    const feeds = await readFeedsFromCSV();
    if (feeds.length === 0) {
      return '';
    }

    if (format === 'csv') {
      let content = '"Name","URL","Category"\n';
      content += feeds.map(f => `"${f.name.replace(/"/g, '""')}","${f.url.replace(/"/g, '""')}","${f.category.replace(/"/g, '""')}"`).join('\n');
      return content;
    } else { 
      return feeds.map(f => `${f.name},${f.url},${f.category}`).join('\n');
    }
  } catch (error) {
    console.error("Error in exportFeeds:", error);
    console.error('Original error object:', error);
    const message = error instanceof Error ? error.message : 'Could not export feeds.';
    throw new Error(message);
  }
}

export async function importFeeds(feedsToAdd: RssFeedSource[]): Promise<{ 
  importedCount: number; 
  alreadyExistedCount: number; 
  finalMessage: string;
  logMessages: string[]; 
}> {
  const serverLogMessages: string[] = ["Server-side import process started."];
  let actualImportedCount = 0;
  let alreadyExistedInCsvCount = 0;
  let currentFeedsInCsv: RssFeedSource[];

  try {
    currentFeedsInCsv = await readFeedsFromCSV();
  } catch (readError) {
      const msg = "Server CRITICAL ERROR: Failed to read existing feeds.csv before import.";
      console.error(msg, readError);
      serverLogMessages.push(msg);
      throw new Error('Failed to prepare for import: could not read existing feeds.');
  }
  
  const existingUrlsInCsv = new Set(currentFeedsInCsv.map(f => f.url));
  const feedsToActuallyAddToCsv: RssFeedSource[] = [];

  for (const feed of feedsToAdd) {
    if (!existingUrlsInCsv.has(feed.url)) {
      feedsToActuallyAddToCsv.push(feed);
      existingUrlsInCsv.add(feed.url); 
      serverLogMessages.push(`Server: Marked "${feed.url}" for CSV addition.`);
    } else {
      alreadyExistedInCsvCount++;
      serverLogMessages.push(`Server: Skipped (already in CSV) - "${feed.url}".`);
    }
  }

  if (feedsToActuallyAddToCsv.length > 0) {
    currentFeedsInCsv = [...currentFeedsInCsv, ...feedsToActuallyAddToCsv];
    try {
        await writeFeedsToCSV(currentFeedsInCsv);
        actualImportedCount = feedsToActuallyAddToCsv.length;
        serverLogMessages.push(`Server: Successfully wrote ${actualImportedCount} new feed(s) to CSV.`);
    } catch (writeError) {
        const msg = `Server CRITICAL ERROR: Failed to write ${feedsToActuallyAddToCsv.length} new feed(s) to CSV.`;
        console.error(msg, writeError);
        serverLogMessages.push(msg);
        throw new Error('Failed to complete import: could not save new feeds.');
    }
  } else {
    serverLogMessages.push("Server: No new feeds to write to CSV after checking against existing data.");
  }

  const finalMessage = `Server: Successfully imported ${actualImportedCount} new feed(s) into CSV. ${alreadyExistedInCsvCount} feed(s) from the client-validated batch already existed in the CSV.`;
  serverLogMessages.push(finalMessage);
  console.log(finalMessage); 
  return { 
    importedCount: actualImportedCount, 
    alreadyExistedCount: alreadyExistedInCsvCount, 
    finalMessage, 
    logMessages: serverLogMessages 
  };
}

export async function checkFeedUrl(url: string): Promise<{ isValid: boolean; message: string; status?: number }> {
  if (!url || !url.trim()) {
    return { isValid: false, message: 'URL cannot be empty.' };
  }
  try {
    new URL(url);
  } catch (_) {
    return { isValid: false, message: 'Invalid URL format.' };
  }

  let settings: SystemSettings;
  try {
    settings = await getSystemSettings();
  } catch (e) {
    console.warn("Could not fetch system settings for timeout in checkFeedUrl, using default.");
    console.error('Original error object:', e);
    settings = { dataSource: 'live', feedValidationTimeoutSeconds: 7 }; // Fallback default
  }
  const timeoutMs = (settings.feedValidationTimeoutSeconds || 7) * 1000;


  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs); 

  try {
    const response = await fetch(url, { 
      method: 'HEAD', 
      signal: controller.signal,
      redirect: 'follow' 
    });
    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type');
    const isFeedType = contentType && (contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom'));

    if (response.ok) {
      if (isFeedType) {
        return { isValid: true, message: `Feed URL is valid and content type (${contentType}) suggests it is a feed.`, status: response.status };
      } else if (contentType && contentType.includes('html')) {
        return { isValid: false, message: `URL is reachable (status ${response.status}) but appears to be an HTML page (Content-Type: ${contentType}), not a direct XML/RSS/Atom feed. Import will skip this.`, status: response.status };
      } else {
        return { isValid: false, message: `URL is reachable (status ${response.status}), but content type (${contentType || 'not specified'}) is not recognized as a valid XML/RSS/Atom feed. Import will skip this.`, status: response.status };
      }
    } else { 
      if (response.status === 404) {
        return { isValid: false, message: `URL not found (Error 404). Status: ${response.status}.`, status: response.status };
      }
      return { isValid: false, message: `Feed URL is not reachable. Status: ${response.status}.`, status: response.status };
    }
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Error details during checkFeedUrl for URL:', url);
    console.error('Original error object:', error); 

    let userMessage = 'Unknown error during URL check.';
    if (error instanceof Error) {
        if (error.name === 'AbortError') {
          userMessage = `Request timed out after ${timeoutMs / 1000}s while checking URL.`;
        } else if ((error as any).cause && typeof (error as any).cause === 'object' && (error as any).cause !== null && 'code' in (error as any).cause) {
            const causeCode = (error as any).cause.code;
            if (causeCode === 'ENOTFOUND' || causeCode === 'EAI_AGAIN') {
                 userMessage = 'Host not found (DNS resolution issue). Please check the URL.';
            } else if (causeCode === 'ECONNREFUSED') {
                 userMessage = 'Connection refused by server. Please check the URL and server status.';
            } else {
                 userMessage = `Network error: ${causeCode}. Check URL and network.`;
            }
        } else if (error.message.toLowerCase().includes('enotfound') || error.message.toLowerCase().includes('econnrefused') || error.message.toLowerCase().includes('fetch failed')) {
            if (error.message.toLowerCase().includes('enotfound')) {
                 userMessage = 'Host not found (DNS resolution issue). Please check the URL.';
            } else if (error.message.toLowerCase().includes('econnrefused')) {
                 userMessage = 'Connection refused by server. Please check the URL and server status.';
            } else { 
                userMessage = 'Network error: Could not connect to URL. Check domain name and network connectivity.';
            }
        } else { 
            userMessage = `Error fetching URL: ${error.message}`;
        }
    }
    
    if (error instanceof TypeError && error.message.toLowerCase().includes('fetch failed')) {
        userMessage = 'Network error: Could not resolve host or connect to URL. Check domain name.';
    }
    
    return { isValid: false, message: userMessage };
  }
}
    

