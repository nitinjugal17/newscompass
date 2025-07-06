
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ArrowLeft, Settings, Save, RefreshCw, Server, FileJson, Cpu, Search, Timer, ListChecks, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { getSystemSettings, setSystemSettings } from '@/actions/settingsActions';
import type { DataSourceOption, SystemSettings, User } from '@/types';
import { UserRole } from '@/types';
import { mockUsers } from '@/lib/mockAuthData'; // For mocking current user
import { Separator } from '@/components/ui/separator';

// --- Mock Current User for Page Access Control ---
// In a real app, this would come from your authentication system.
// To test different roles, change this user:
// const MOCK_CURRENT_USER_FOR_SETTINGS_ACCESS: User | undefined = mockUsers.find(u => u.role === UserRole.ADMIN);
const MOCK_CURRENT_USER_FOR_SETTINGS_ACCESS: User | undefined = mockUsers.find(u => u.role === UserRole.SUPER_ADMIN);
// const MOCK_CURRENT_USER_FOR_SETTINGS_ACCESS: User | undefined = mockUsers.find(u => u.role === UserRole.USER);

const currentUserRoleForSettings = MOCK_CURRENT_USER_FOR_SETTINGS_ACCESS ? MOCK_CURRENT_USER_FOR_SETTINGS_ACCESS.role : UserRole.USER;
// --- End Mock Current User ---


export default function SystemSettingsPage() {
  const [currentSettings, setCurrentSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const [selectedDataSource, setSelectedDataSource] = useState<DataSourceOption>('live');
  const [autoRemoveFeeds, setAutoRemoveFeeds] = useState(false);
  const [maxFeedsSearch, setMaxFeedsSearch] = useState<number>(20);
  const [maxArticlesPerFeed, setMaxArticlesPerFeed] = useState<number>(10);
  const [validationTimeout, setValidationTimeout] = useState<number>(7);


  useEffect(() => {
    async function fetchSettings() {
      setIsLoading(true);
      try {
        const settings = await getSystemSettings();
        setCurrentSettings(settings);
        setSelectedDataSource(settings.dataSource);
        setAutoRemoveFeeds(settings.autoRemoveBadFeeds || false);
        setMaxFeedsSearch(settings.maxFeedsForGlobalSearch || 20);
        setMaxArticlesPerFeed(settings.maxArticlesPerFeedGlobalSearch || 10);
        setValidationTimeout(settings.feedValidationTimeoutSeconds || 7);
      } catch (error) {
        console.error("Failed to fetch system settings:", error);
        toast({
          title: 'Error Fetching Settings',
          description: error instanceof Error ? error.message : 'Could not load system settings.',
          variant: 'destructive',
        });
        // Fallback to defaults on error
        setCurrentSettings({ 
            dataSource: 'live', 
            autoRemoveBadFeeds: false,
            maxFeedsForGlobalSearch: 20,
            maxArticlesPerFeedGlobalSearch: 10,
            feedValidationTimeoutSeconds: 7,
        });
        setSelectedDataSource('live');
        setAutoRemoveFeeds(false);
        setMaxFeedsSearch(20);
        setMaxArticlesPerFeed(10);
        setValidationTimeout(7);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, [toast]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const newSettings: Partial<SystemSettings> = { // Use Partial as some settings might not be submitted if user is not SuperAdmin
        dataSource: selectedDataSource,
      };

      if (currentUserRoleForSettings === UserRole.SUPER_ADMIN) {
        newSettings.autoRemoveBadFeeds = autoRemoveFeeds;
        newSettings.maxFeedsForGlobalSearch = Number(maxFeedsSearch) || 20;
        newSettings.maxArticlesPerFeedGlobalSearch = Number(maxArticlesPerFeed) || 10;
        newSettings.feedValidationTimeoutSeconds = Number(validationTimeout) || 7;
      }

      const savedSettings = await setSystemSettings(newSettings);
      // Update local state with potentially coerced values from server
      setCurrentSettings(savedSettings); 
      setSelectedDataSource(savedSettings.dataSource);
      setAutoRemoveFeeds(savedSettings.autoRemoveBadFeeds || false);
      setMaxFeedsSearch(savedSettings.maxFeedsForGlobalSearch || 20);
      setMaxArticlesPerFeed(savedSettings.maxArticlesPerFeedGlobalSearch || 10);
      setValidationTimeout(savedSettings.feedValidationTimeoutSeconds || 7);
      toast({
        title: 'Settings Saved',
        description: 'System settings have been updated successfully.',
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Could not save settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Settings className="h-9 w-9 text-primary" />
          System Settings
        </h1>
        <Button variant="outline" asChild>
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin Dashboard
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configure Application Behavior</CardTitle>
          <CardDescription>
            Manage data sources, feed processing, search limits, and other system-wide configurations.
            Some settings may be restricted based on your user role (Current Role: {currentUserRoleForSettings}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4 p-6 border rounded-lg shadow-sm bg-card">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Data Source Configuration
            </h3>
            <p className="text-sm text-muted-foreground">
              Choose the primary source for news articles displayed on the homepage. (Accessible by Admins & Super Admins)
            </p>
            <RadioGroup
              value={selectedDataSource}
              onValueChange={(value) => setSelectedDataSource(value as DataSourceOption)}
              className="space-y-2"
              disabled={isSaving}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="live" id="ds-live" />
                <Label htmlFor="ds-live" className="font-normal text-base">
                  Live RSS Feeds (Default) - Fetches and processes news from configured RSS URLs.
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mock" id="ds-mock" />
                <Label htmlFor="ds-mock" className="font-normal text-base">
                  Mock Data - Uses pre-defined sample articles for demonstration or testing.
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="api" id="ds-api" disabled />
                <Label htmlFor="ds-api" className="font-normal text-base text-muted-foreground">
                  External News API (Placeholder) - Integration not yet implemented.
                </Label>
              </div>
            </RadioGroup>
          </div>

          {currentUserRoleForSettings === UserRole.SUPER_ADMIN ? (
            <>
              <Separator />
              <div className="space-y-4 p-6 border rounded-lg shadow-sm bg-card">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-primary" />
                  Feed Management Settings (Super Admin)
                </h3>
                <div className="flex items-center justify-between space-x-2 py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-remove-feeds" className="text-base font-medium">
                      Automatically remove problematic feeds
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      If enabled, feeds that consistently fail (e.g., network errors, parsing issues) during a global search will be automatically removed from the list.
                    </p>
                  </div>
                  <Switch
                    id="auto-remove-feeds"
                    checked={autoRemoveFeeds}
                    onCheckedChange={setAutoRemoveFeeds}
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2 py-2">
                    <Label htmlFor="validation-timeout" className="text-base font-medium flex items-center gap-1">
                       <Timer className="h-4 w-4"/> Feed Validation Timeout (seconds)
                    </Label>
                     <p className="text-sm text-muted-foreground">
                      Time to wait for a feed URL to respond during validation (e.g., in 'Manage Feeds' or during import). Min: 1, Default: 7.
                    </p>
                    <Input
                        id="validation-timeout"
                        type="number"
                        value={validationTimeout}
                        onChange={(e) => setValidationTimeout(Math.max(1, parseInt(e.target.value, 10) || 7))}
                        min="1"
                        className="w-full md:w-48"
                        disabled={isSaving}
                    />
                </div>
              </div>
              
              <Separator />

              <div className="space-y-4 p-6 border rounded-lg shadow-sm bg-card">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  Global Search Settings (Super Admin)
                </h3>
                <div className="space-y-2 py-2">
                    <Label htmlFor="max-feeds-search" className="text-base font-medium flex items-center gap-1">
                        <ListChecks className="h-4 w-4"/> Max Feeds for Global Search
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Maximum number of configured RSS feeds to query during a single global search operation. Min: 1, Default: 20.
                    </p>
                    <Input
                        id="max-feeds-search"
                        type="number"
                        value={maxFeedsSearch}
                        onChange={(e) => setMaxFeedsSearch(Math.max(1, parseInt(e.target.value, 10) || 20))}
                        min="1"
                        className="w-full md:w-48"
                        disabled={isSaving}
                    />
                </div>
                <div className="space-y-2 py-2">
                    <Label htmlFor="max-articles-per-feed" className="text-base font-medium flex items-center gap-1">
                        <ListChecks className="h-4 w-4"/> Max Articles per Feed (Global Search)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Maximum number of articles to check within each feed during a global search. Min: 1, Default: 10.
                    </p>
                    <Input
                        id="max-articles-per-feed"
                        type="number"
                        value={maxArticlesPerFeed}
                        onChange={(e) => setMaxArticlesPerFeed(Math.max(1, parseInt(e.target.value, 10) || 10))}
                        min="1"
                        className="w-full md:w-48"
                        disabled={isSaving}
                    />
                </div>
              </div>
            </>
          ) : (
            <Card className="border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <AlertTriangle className="h-5 w-5" />
                        Limited Access
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm">
                        Advanced feed management and global search performance settings are only available to Super Admins.
                        You can currently manage the Data Source Configuration above.
                    </p>
                </CardContent>
            </Card>
          )}

        </CardContent>
        <CardFooter className="border-t pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-center w-full gap-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <FileJson className="h-4 w-4"/> Settings are stored in <code>data/settings.json</code> on the server.
            </p>
            <Button onClick={handleSaveSettings} disabled={isSaving || isLoading} className="w-full sm:w-auto">
              {isSaving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Saving Settings...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Save Settings
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
