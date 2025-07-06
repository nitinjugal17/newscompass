
'use server';

import type { DataSourceOption, SystemSettings } from '@/types';
import fs from 'fs/promises';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const settingsFilePath = path.join(dataDir, 'settings.json');

const defaultSettings: SystemSettings = {
  dataSource: 'live',
  autoRemoveBadFeeds: false,
  maxFeedsForGlobalSearch: 20,
  maxArticlesPerFeedGlobalSearch: 10,
  feedValidationTimeoutSeconds: 7,
};

async function ensureDataDirectory(): Promise<void> {
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.error('Error creating data directory for settings:');
      console.error('Original error:', error);
      throw new Error('Failed to ensure data directory for settings.');
    }
  }
}

async function readSettings(): Promise<SystemSettings | null> {
  await ensureDataDirectory();
  try {
    await fs.access(settingsFilePath); // Check if file exists
  } catch (error) {
    // File doesn't exist
    return null;
  }

  let fileContent: string;
  try {
    fileContent = await fs.readFile(settingsFilePath, 'utf-8');
  } catch (readError) {
    console.error('Failed to read settings.json:');
    console.error('Original read error:', readError);
    try {
        await fs.unlink(settingsFilePath);
        console.log('Unreadable settings.json deleted.');
    } catch (deleteError) {
        console.error('Failed to delete unreadable settings.json:');
        console.error('Original delete error:', deleteError);
    }
    return null;
  }

  if (!fileContent.trim()) {
    console.warn('settings.json is empty. Deleting and using default settings.');
    try {
        await fs.unlink(settingsFilePath);
        console.log('Empty settings.json deleted.');
    } catch (deleteError) {
        console.error('Failed to delete empty settings.json:');
        console.error('Original delete error:', deleteError);
    }
    return null;
  }

  try {
    const parsedSettings = JSON.parse(fileContent) as Partial<SystemSettings>; // Partial to handle missing fields

    // Validate the structure of parsedSettings and provide defaults for missing keys
    const validatedSettings: SystemSettings = {
      dataSource: ['mock', 'live', 'api'].includes(parsedSettings.dataSource!) 
                    ? parsedSettings.dataSource!
                    : defaultSettings.dataSource,
      autoRemoveBadFeeds: typeof parsedSettings.autoRemoveBadFeeds === 'boolean' 
                          ? parsedSettings.autoRemoveBadFeeds 
                          : defaultSettings.autoRemoveBadFeeds,
      maxFeedsForGlobalSearch: typeof parsedSettings.maxFeedsForGlobalSearch === 'number' && parsedSettings.maxFeedsForGlobalSearch > 0
                                 ? parsedSettings.maxFeedsForGlobalSearch
                                 : defaultSettings.maxFeedsForGlobalSearch,
      maxArticlesPerFeedGlobalSearch: typeof parsedSettings.maxArticlesPerFeedGlobalSearch === 'number' && parsedSettings.maxArticlesPerFeedGlobalSearch > 0
                                        ? parsedSettings.maxArticlesPerFeedGlobalSearch
                                        : defaultSettings.maxArticlesPerFeedGlobalSearch,
      feedValidationTimeoutSeconds: typeof parsedSettings.feedValidationTimeoutSeconds === 'number' && parsedSettings.feedValidationTimeoutSeconds > 0
                                      ? parsedSettings.feedValidationTimeoutSeconds
                                      : defaultSettings.feedValidationTimeoutSeconds,
    };
    return validatedSettings;

  } catch (parseError) {
    if (parseError instanceof SyntaxError) {
        console.error('Error parsing settings.json (SyntaxError - file is not valid JSON):');
    } else {
        console.error('Error processing settings.json (unknown parsing related error):');
    }
    console.error('Original parse error:', parseError);
    
    try {
      await fs.unlink(settingsFilePath);
      console.log('Corrupted settings.json (due to parsing error) deleted successfully.');
    } catch (deleteError) {
      console.error('Failed to delete corrupted settings.json (parsing error):');
      console.error('Original delete error:', deleteError);
    }
    return null;
  }
}

async function writeSettings(settings: SystemSettings): Promise<void> {
  await ensureDataDirectory();
  try {
    // Ensure settings object is valid before stringifying
    const validSettings: SystemSettings = {
        dataSource: ['mock', 'live', 'api'].includes(settings.dataSource) ? settings.dataSource : defaultSettings.dataSource,
        autoRemoveBadFeeds: typeof settings.autoRemoveBadFeeds === 'boolean' ? settings.autoRemoveBadFeeds : defaultSettings.autoRemoveBadFeeds,
        maxFeedsForGlobalSearch: typeof settings.maxFeedsForGlobalSearch === 'number' && settings.maxFeedsForGlobalSearch > 0 ? settings.maxFeedsForGlobalSearch : defaultSettings.maxFeedsForGlobalSearch,
        maxArticlesPerFeedGlobalSearch: typeof settings.maxArticlesPerFeedGlobalSearch === 'number' && settings.maxArticlesPerFeedGlobalSearch > 0 ? settings.maxArticlesPerFeedGlobalSearch : defaultSettings.maxArticlesPerFeedGlobalSearch,
        feedValidationTimeoutSeconds: typeof settings.feedValidationTimeoutSeconds === 'number' && settings.feedValidationTimeoutSeconds > 0 ? settings.feedValidationTimeoutSeconds : defaultSettings.feedValidationTimeoutSeconds,
    };
    await fs.writeFile(settingsFilePath, JSON.stringify(validSettings, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing settings.json:');
    console.error('Original error:', error);
    throw new Error('Failed to save settings.');
  }
}

export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    let settings = await readSettings();
    if (!settings) {
      console.log('No valid settings found or settings file was corrupted/empty. Creating default settings.json.');
      settings = { ...defaultSettings };
      await writeSettings(settings);
    }
    return settings;
  } catch (error) {
    console.error("Error in getSystemSettings:", error);
    console.error('Original error object:', error);
    return { ...defaultSettings };
  }
}

export async function setSystemSettings(newSettings: Partial<SystemSettings>): Promise<SystemSettings> {
  // Validate crucial parts, allow others to be potentially undefined to use defaults from readSettings merge
  if (newSettings.dataSource && !['mock', 'live', 'api'].includes(newSettings.dataSource)) {
    throw new Error('Invalid data source option provided in settings.');
  }
  
  try {
    const currentSettings = await getSystemSettings(); // Get current to merge, ensuring all fields are present
    const mergedSettings: SystemSettings = {
        ...currentSettings,
        ...newSettings, // New values overwrite current ones
        // Explicitly ensure types for numeric values or use default if invalid
        maxFeedsForGlobalSearch: (typeof newSettings.maxFeedsForGlobalSearch === 'number' && newSettings.maxFeedsForGlobalSearch > 0) ? newSettings.maxFeedsForGlobalSearch : currentSettings.maxFeedsForGlobalSearch,
        maxArticlesPerFeedGlobalSearch: (typeof newSettings.maxArticlesPerFeedGlobalSearch === 'number' && newSettings.maxArticlesPerFeedGlobalSearch > 0) ? newSettings.maxArticlesPerFeedGlobalSearch : currentSettings.maxArticlesPerFeedGlobalSearch,
        feedValidationTimeoutSeconds: (typeof newSettings.feedValidationTimeoutSeconds === 'number' && newSettings.feedValidationTimeoutSeconds > 0) ? newSettings.feedValidationTimeoutSeconds : currentSettings.feedValidationTimeoutSeconds,
    };

    await writeSettings(mergedSettings);
    console.log(`System settings updated to:`, mergedSettings);
    return mergedSettings;
  } catch (error) {
    console.error("Error in setSystemSettings:", error);
    console.error('Original error object:', error);
    const message = error instanceof Error ? error.message : 'Could not update system settings.';
    throw new Error(message);
  }
}
