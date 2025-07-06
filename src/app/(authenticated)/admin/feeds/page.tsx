
'use client';

import type { RssFeedSource } from '@/types';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Rss, Trash2, ArrowLeft, Edit2, XCircle, Download, Upload, Filter, Building, RefreshCw, Link2, CheckCircle2, FileText, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Separator } from '@/components/ui/separator';
import { getFeeds, addFeed, updateFeed, deleteFeed, importFeeds as importFeedsAction, exportFeeds as exportFeedsAction, checkFeedUrl, deleteMultipleFeeds as deleteMultipleFeedsAction } from '@/actions/feedActions';

export default function ManageFeedsPage() {
  const [feeds, setFeeds] = useState<RssFeedSource[]>([]);
  const [newFeedName, setNewFeedName] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedCategory, setNewFeedCategory] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [currentImportProgress, setCurrentImportProgress] = useState<string>('');

  const [isEditing, setIsEditing] = useState(false);
  const [editingFeedOriginalUrl, setEditingFeedOriginalUrl] = useState<string | null>(null);

  const [urlCheckStatus, setUrlCheckStatus] = useState<{
    checking: boolean;
    message: string | null;
    isValid: boolean | null;
  }>({ checking: false, message: null, isValid: null });
  
  const [importLogMessages, setImportLogMessages] = useState<string[]>([]);
  const [showImportLogDialog, setShowImportLogDialog] = useState(false);

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedNewsCompany, setSelectedNewsCompany] = useState<string>('All');
  const [selectedFeedUrlsToDelete, setSelectedFeedUrlsToDelete] = useState<Set<string>>(new Set());
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);


  const fetchFeeds = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedFeeds = await getFeeds();
      setFeeds(fetchedFeeds);
    } catch (error) {
      console.error("Failed to fetch feeds:", error);
      toast({
        title: 'Error Fetching Feeds',
        description: error instanceof Error ? error.message : 'Could not load feeds from the server.',
        variant: 'destructive',
      });
      setFeeds([]); 
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);

  const uniqueCategories = useMemo(() => {
    const allCategories = feeds.map(feed => feed.category.trim()).filter(Boolean);
    return ['All', ...new Set(allCategories)].sort((a, b) => {
      if (a === 'All') return -1;
      if (b === 'All') return 1;
      return a.localeCompare(b);
    });
  }, [feeds]);

  const uniqueNewsCompanies = useMemo(() => {
    const allCompanies = feeds.map(feed => feed.name.trim()).filter(Boolean);
    return ['All', ...new Set(allCompanies)].sort((a, b) => {
      if (a === 'All') return -1;
      if (b === 'All') return 1;
      return a.localeCompare(b);
    });
  }, [feeds]);

  const filteredFeeds = useMemo(() => {
    let tempFeeds = feeds;
    if (selectedCategory !== 'All') {
      tempFeeds = tempFeeds.filter(feed => feed.category === selectedCategory);
    }
    if (selectedNewsCompany !== 'All') {
      tempFeeds = tempFeeds.filter(feed => feed.name === selectedNewsCompany);
    }
    return tempFeeds;
  }, [feeds, selectedCategory, selectedNewsCompany]);

  const resetForm = () => {
    setNewFeedName('');
    setNewFeedUrl('');
    setNewFeedCategory('');
    setIsEditing(false);
    setEditingFeedOriginalUrl(null);
    setUrlCheckStatus({ checking: false, message: null, isValid: null }); 
  };

  const handleUrlCheck = useCallback(async (urlToCheck?: string) => {
    const effectiveUrl = (urlToCheck || newFeedUrl).trim();
  
    if (!effectiveUrl) {
      setUrlCheckStatus({ checking: false, message: 'Please enter a URL to check.', isValid: false });
      return;
    }
    setUrlCheckStatus({ checking: true, message: 'Checking URL...', isValid: null });
    try {
      const result = await checkFeedUrl(effectiveUrl); 
      setUrlCheckStatus({ checking: false, message: result.message, isValid: result.isValid });
    } catch (error) {
      let errorMessage = 'Client error: Failed to initiate URL check.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      setUrlCheckStatus({ checking: false, message: errorMessage, isValid: false });
      console.error("URL check initiation failed:", error);
      console.error('Original error object:', error);
    }
  }, [newFeedUrl]);

  const handleEditFeed = useCallback(async (feedToEdit: RssFeedSource) => {
    setIsEditing(true);
    setEditingFeedOriginalUrl(feedToEdit.url);
    setNewFeedName(feedToEdit.name);
    setNewFeedUrl(feedToEdit.url);
    setNewFeedCategory(feedToEdit.category);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  
    if (feedToEdit.url && feedToEdit.url.trim()) {
      setCurrentImportProgress(`Checking URL for editing: ${feedToEdit.url}...`);
      await handleUrlCheck(feedToEdit.url.trim()); 
      setCurrentImportProgress('');
    } else {
      setUrlCheckStatus({checking: false, message: "This feed has no URL to check.", isValid: false});
    }
  }, [handleUrlCheck]);


  const handleSubmitFeed = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newFeedName.trim() || !newFeedUrl.trim() || !newFeedCategory.trim()) {
      toast({
        title: 'Error',
        description: 'All fields are required.',
        variant: 'destructive',
      });
      return;
    }
    try {
      new URL(newFeedUrl.trim()); 
    } catch (_) {
      toast({
        title: 'Error',
        description: 'Please enter a valid URL for the feed.',
        variant: 'destructive',
        });
      return;
    }

    const submittedFeed: RssFeedSource = {
      name: newFeedName.trim(),
      url: newFeedUrl.trim(),
      category: newFeedCategory.trim(),
    };

    setIsSubmitting(true);
    let success = false;
    try {
      if (isEditing && editingFeedOriginalUrl) {
        await updateFeed(submittedFeed, editingFeedOriginalUrl); // Assumes updateFeed throws on actual error
        toast({
          title: 'Success',
          description: `Feed "${submittedFeed.name}" updated successfully.`,
        });
        success = true;
      } else {
        // Adding new feed
        const result = await addFeed(submittedFeed);
        if ('error' in result) { // Check if the result is an error object
          toast({
            title: result.feedExists ? 'Duplicate Feed' : 'Add Feed Failed',
            description: result.error,
            variant: 'destructive',
          });
          // success remains false
        } else {
          // Success
          toast({
            title: 'Success',
            description: `Feed "${result.name}" added successfully.`,
          });
          success = true;
        }
      }

      if (success) {
        resetForm();
        await fetchFeeds();
      }
    } catch (error) { // This catch block is now primarily for errors from updateFeed
      console.error("Failed to submit feed (likely update operation):", error);
      toast({
        title: 'Operation Failed',
        description: error instanceof Error ? error.message : 'Could not save the feed.',
        variant: 'destructive',
      });
      // success remains false
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSingleFeed = async (feedUrlToDelete: string, feedName: string) => {
     setIsSubmitting(true);
    try {
      await deleteFeed(feedUrlToDelete);
      if (isEditing && editingFeedOriginalUrl === feedUrlToDelete) {
        resetForm();
      }
      toast({
        title: 'Feed Removed',
        description: `Feed "${feedName}" has been removed.`,
      });
      await fetchFeeds(); 
      setSelectedFeedUrlsToDelete(prev => {
        const newSet = new Set(prev);
        newSet.delete(feedUrlToDelete);
        return newSet;
      });
    } catch (error) {
      console.error("Failed to delete feed:", error);
      console.error('Original error object:', error);
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Could not remove the feed.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMultipleFeeds = async () => {
    if (selectedFeedUrlsToDelete.size === 0) {
        toast({ title: "No Feeds Selected", description: "Please select feeds to delete.", variant: "default"});
        return;
    }
    setIsDeletingMultiple(true);
    try {
        const result = await deleteMultipleFeedsAction(Array.from(selectedFeedUrlsToDelete));
        if (result.success) {
            toast({
                title: "Feeds Deleted",
                description: `${result.deletedCount} feed(s) have been removed successfully.`,
            });
            if (isEditing && selectedFeedUrlsToDelete.has(editingFeedOriginalUrl || '')) {
                resetForm();
            }
        } else {
            throw new Error(result.message || "Failed to delete selected feeds.");
        }
        setSelectedFeedUrlsToDelete(new Set());
        await fetchFeeds();
    } catch (error) {
        console.error("Failed to delete multiple feeds:", error);
        console.error('Original error object:', error);
        toast({
            title: "Delete Failed",
            description: error instanceof Error ? error.message : "Could not remove selected feeds.",
            variant: "destructive",
        });
    } finally {
        setIsDeletingMultiple(false);
    }
  };

  const handleSelectFeed = (feedUrl: string, isSelected: boolean) => {
    setSelectedFeedUrlsToDelete(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(feedUrl);
      } else {
        newSet.delete(feedUrl);
      }
      return newSet;
    });
  };

  const handleSelectAllFeeds = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedFeedUrlsToDelete(new Set(filteredFeeds.map(feed => feed.url)));
    } else {
      setSelectedFeedUrlsToDelete(new Set());
    }
  };

  const isAllFilteredFeedsSelected = useMemo(() => {
    if (filteredFeeds.length === 0) return false;
    return filteredFeeds.every(feed => selectedFeedUrlsToDelete.has(feed.url));
  }, [filteredFeeds, selectedFeedUrlsToDelete]);


  const createBlobAndDownload = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleExportFeeds = async (format: 'txt' | 'csv') => {
    setIsLoading(true); 
    try {
      const fileContent = await exportFeedsAction(format);
      if (!fileContent) {
        toast({ title: 'No Feeds', description: 'There are no feeds to export.', variant: 'default' });
        setIsLoading(false);
        return;
      }
      createBlobAndDownload(fileContent, `feeds.${format}`, format === 'csv' ? 'text/csv;charset=utf-8;' : 'text/plain;charset=utf-8;');
      toast({ title: 'Export Successful', description: `Feeds exported as ${format.toUpperCase()}.` });
    } catch (error) {
      console.error("Export failed:", error);
      console.error('Original error object:', error);
      toast({ title: 'Export Failed', description: (error instanceof Error ? error.message : 'Could not export feeds.'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

 const handleImportFeeds = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingImport(true);
    setCurrentImportProgress("Initializing import...");
    const clientLogs: string[] = ["Client: Initializing import..."];
    console.info("Client Import: Initializing...");

    const processFilePromise = new Promise<void>(async (resolve) => {
      setCurrentImportProgress("Reading file...");
      clientLogs.push("Client: Reading file...");
      console.info("Client Import: Reading file...");

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          if (!content) {
            const emptyFileMsg = "Client Error: File is empty or unreadable.";
            setCurrentImportProgress(emptyFileMsg);
            clientLogs.push(emptyFileMsg);
            console.error(emptyFileMsg);
            resolve(); return;
          }

          const fileType = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'txt';
          const fileTypeMsg = `Client: Processing ${fileType.toUpperCase()} file: ${file.name}`;
          setCurrentImportProgress(fileTypeMsg);
          clientLogs.push(fileTypeMsg);
          console.info(fileTypeMsg);

          const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
          let dataLines = lines;

          if (fileType === 'csv' && lines.length > 0 && lines[0].toLowerCase().includes('name') && lines[0].toLowerCase().includes('url') && lines[0].toLowerCase().includes('category')) {
            dataLines = lines.slice(1);
            const headerMsg = "Client: CSV header detected and skipped.";
            setCurrentImportProgress(headerMsg);
            clientLogs.push(headerMsg);
            console.info(headerMsg);
          }

          if (dataLines.length === 0) {
            const noDataMsg = "Client: No data lines found in the file.";
            setCurrentImportProgress(noDataMsg);
            clientLogs.push(noDataMsg);
            console.warn(noDataMsg);
            resolve(); return;
          }

          const feedsOnPageUrls = new Set(feeds.map(f => f.url));
          const validatedAndNewFeeds: RssFeedSource[] = [];
          let clientSkippedCount = 0;

          for (const [index, line] of dataLines.entries()) {
            const progressMsg = `Client: Processing line ${index + 1} of ${dataLines.length}: "${line.substring(0, 50)}..."`;
            setCurrentImportProgress(progressMsg); 
            clientLogs.push(progressMsg);
            console.info(progressMsg);

            const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
            if (parts.length === 3) {
              const [name, url, category] = parts;
              if (name && url && category) {
                if (feedsOnPageUrls.has(url) || validatedAndNewFeeds.some(f => f.url === url)) {
                  const logMsg = `Client SKIPPED (duplicate on page or in file): ${url}`;
                  clientLogs.push(logMsg);
                  console.warn(logMsg);
                  clientSkippedCount++;
                  continue;
                }

                const validatingMsg = `Client: Validating URL (${index + 1}/${dataLines.length}): ${url}`;
                setCurrentImportProgress(validatingMsg);
                clientLogs.push(validatingMsg);
                console.info(validatingMsg);
                try {
                  const validationResult = await checkFeedUrl(url);
                  if (validationResult.isValid) {
                    const passMsg = `PASS: ${url} - ${validationResult.message}`;
                    clientLogs.push(passMsg);
                    console.info(passMsg);
                    validatedAndNewFeeds.push({ name, url, category });
                  } else {
                    const failMsg = `FAIL (Validation): ${url} - ${validationResult.message}`;
                    clientLogs.push(failMsg);
                    console.warn(failMsg); 
                    clientSkippedCount++;
                  }
                } catch (valError) {
                  const errorMsgText = valError instanceof Error ? valError.message : "Unknown validation error";
                  const failMsg = `FAIL (Error during validation): ${url} - ${errorMsgText}`;
                  clientLogs.push(failMsg);
                  console.error(failMsg, valError);
                  clientSkippedCount++;
                }
              } else {
                const logMsg = `Client SKIPPED (missing fields): Line "${line}"`;
                clientLogs.push(logMsg);
                console.warn(logMsg);
                clientSkippedCount++;
              }
            } else {
              const logMsg = `Client SKIPPED (incorrect format): Line "${line}"`;
              clientLogs.push(logMsg);
              console.warn(logMsg);
              clientSkippedCount++;
            }
          }

          if (validatedAndNewFeeds.length > 0) {
            const sendingMsg = `Client: Sending ${validatedAndNewFeeds.length} validated new feed(s) to server...`;
            setCurrentImportProgress(sendingMsg);
            clientLogs.push(sendingMsg);
            console.info(sendingMsg);
            try {
              const serverResult = await importFeedsAction(validatedAndNewFeeds);
              const serverResponseMsg = `Server Response: ${serverResult.finalMessage}`;
              setCurrentImportProgress(serverResponseMsg);
              clientLogs.push(serverResponseMsg);
              console.info(serverResponseMsg);
              toast({
                title: 'Import Processed by Server',
                description: serverResult.finalMessage,
              });
            } catch (serverError) {
              const errorMsg = serverError instanceof Error ? serverError.message : "Unknown server error during import.";
              const serverErrorMsg = `Server Error during final import: ${errorMsg}`;
              setCurrentImportProgress(serverErrorMsg);
              clientLogs.push(serverErrorMsg);
              console.error(serverErrorMsg, serverError);
              toast({
                title: 'Server Import Failed',
                description: errorMsg,
                variant: 'destructive',
              });
            }
          } else {
            const noNewFeedsMsg = "Client: No new feeds passed client-side validation to send to server.";
            setCurrentImportProgress(noNewFeedsMsg);
            clientLogs.push(noNewFeedsMsg);
            console.info(noNewFeedsMsg);
            toast({
              title: "Import Complete",
              description: `No new valid feeds were imported. Client-side processing skipped ${clientSkippedCount} feed(s).`,
              variant: "default"
            });
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown error during file processing.";
          const criticalErrorMsg = `CRITICAL CLIENT ERROR: ${errorMsg}`;
          setCurrentImportProgress(criticalErrorMsg);
          clientLogs.push(criticalErrorMsg);
          console.error(criticalErrorMsg, error);
          toast({title: "Import Error", description: errorMsg, variant: "destructive"});
        } finally {
          resolve();
        }
      };
      reader.onerror = () => {
        const readErrorMsg = "Client Error: Failed to read the import file.";
        setCurrentImportProgress(readErrorMsg);
        clientLogs.push(readErrorMsg);
        console.error(readErrorMsg);
        resolve(); 
      };
      reader.readAsText(file);
    });

    await processFilePromise;

    setImportLogMessages(clientLogs);
    setShowImportLogDialog(true);
    await fetchFeeds();
    setIsProcessingImport(false);
    setCurrentImportProgress('Import process finished. View log for details.');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const getNoFeedsMessage = () => {
    if (isLoading) return 'Loading feeds...';
    if (feeds.length === 0) return 'No RSS feeds configured yet. Add one using the form above or import a list.';

    let message = 'No RSS feeds found for ';
    const filters: string[] = [];
    if (selectedCategory !== 'All') {
      filters.push(`category "${selectedCategory}"`);
    }
    if (selectedNewsCompany !== 'All') {
      filters.push(`news company "${selectedNewsCompany}"`);
    }
    return message + filters.join(' and ') + '.';
  };

  const getLogItemClass = (logMessage: string): string => {
    const lowerLog = logMessage.toLowerCase();
    if (lowerLog.startsWith("fail (validation):") || lowerLog.startsWith("fail (error during validation):") || lowerLog.startsWith("client error:") || lowerLog.includes("critical client error") || lowerLog.startsWith("server error:")) {
      return "text-destructive";
    }
    if (lowerLog.startsWith("client skipped")) {
      return "text-amber-600 dark:text-amber-500";
    }
    if (lowerLog.startsWith("pass:")) {
      return "text-green-600 dark:text-green-400";
    }
    return "text-muted-foreground";
  };


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Rss className="h-9 w-9 text-primary" />
          Manage RSS Feeds
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchFeeds} disabled={isLoading || isSubmitting || isProcessingImport || isDeletingMultiple} title="Refresh Feeds List">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isEditing ? <Edit2 className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
            {isEditing ? 'Edit RSS Feed' : 'Add New RSS Feed'}
          </CardTitle>
          <CardDescription>
            {isEditing ? 'Modify the details for this RSS feed source. The URL status will be checked automatically when editing.' : 'Enter the details for the new RSS feed source.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitFeed} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="feedName">Feed Name (News Company)</Label>
                <Input
                  id="feedName"
                  type="text"
                  value={newFeedName}
                  onChange={(e) => setNewFeedName(e.target.value)}
                  placeholder="e.g., TechCrunch News"
                  required
                  disabled={isSubmitting || isProcessingImport || isDeletingMultiple}
                />
              </div>
              <div>
                <Label htmlFor="feedUrl">Feed URL</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="feedUrl"
                    type="url"
                    value={newFeedUrl}
                    onChange={(e) => {
                      setNewFeedUrl(e.target.value);
                      if (!isEditing || (isEditing && e.target.value !== editingFeedOriginalUrl)) {
                         setUrlCheckStatus({ checking: false, message: null, isValid: null });
                      }
                    }}
                    placeholder="e.g., https://techcrunch.com/feed/"
                    required
                    aria-describedby="feedUrlHelp urlCheckFeedback"
                    disabled={isSubmitting || isProcessingImport || isDeletingMultiple}
                    className="flex-grow"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    onClick={() => handleUrlCheck()} 
                    disabled={urlCheckStatus.checking || !newFeedUrl.trim() || isSubmitting || isProcessingImport || isDeletingMultiple}
                    title="Check URL Validity"
                    className="shrink-0"
                  >
                    {urlCheckStatus.checking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    <span className="sr-only">Check URL</span>
                  </Button>
                </div>
                <p id="feedUrlHelp" className="text-xs text-muted-foreground mt-1">
                  Enter the full URL of the RSS, Atom, XML, or CMS feed. E.g., ends with .xml, .rss, /feed, or .cms.
                </p>
                {urlCheckStatus.message && (
                  <p id="urlCheckFeedback" className={`text-xs mt-1 flex items-center gap-1 ${urlCheckStatus.isValid === null ? 'text-muted-foreground' : urlCheckStatus.isValid ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                    {urlCheckStatus.isValid === true && <CheckCircle2 className="h-4 w-4" />}
                    {urlCheckStatus.isValid === false && <XCircle className="h-4 w-4" />}
                    {urlCheckStatus.checking && <RefreshCw className="h-4 w-4 animate-spin mr-1" />}
                    {urlCheckStatus.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="feedCategory">Category</Label>
                <Input
                  id="feedCategory"
                  type="text"
                  value={newFeedCategory}
                  onChange={(e) => setNewFeedCategory(e.target.value)}
                  placeholder="e.g., Technology"
                  required
                  disabled={isSubmitting || isProcessingImport || isDeletingMultiple}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoading || urlCheckStatus.checking || isProcessingImport || isDeletingMultiple}>
                {isSubmitting ? (isEditing ? 'Updating...' : 'Adding...') : (isEditing ? <><Edit2 className="mr-2 h-4 w-4" /> Update Feed</> : <><PlusCircle className="mr-2 h-4 w-4" /> Add Feed</>)}
              </Button>
              {isEditing && (
                <Button type="button" variant="outline" onClick={resetForm} className="w-full md:w-auto" disabled={isSubmitting || isProcessingImport || isDeletingMultiple}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Edit
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <CardTitle>Current RSS Feeds</CardTitle>
            <CardDescription>
              List of configured RSS feed sources. ({filteredFeeds.length} of {feeds.length} feeds shown)
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
             {selectedFeedUrlsToDelete.size > 0 && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isDeletingMultiple || isSubmitting || isLoading || isProcessingImport}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Selected ({selectedFeedUrlsToDelete.size})
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive"/>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete {selectedFeedUrlsToDelete.size} selected feed(s). This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeletingMultiple}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteMultipleFeeds}
                                className="bg-destructive hover:bg-destructive/90"
                                disabled={isDeletingMultiple}
                            >
                                {isDeletingMultiple ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : "Yes, delete selected"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".txt,.csv"
              onChange={handleImportFeeds}
              disabled={isProcessingImport || isSubmitting || isDeletingMultiple}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isProcessingImport || isLoading || isSubmitting || isDeletingMultiple}>
              {isProcessingImport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {isProcessingImport ? 'Importing...' : 'Import Feeds'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isLoading || feeds.length === 0 || isSubmitting || isProcessingImport || isDeletingMultiple}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Feeds
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportFeeds('txt')} disabled={isLoading || feeds.length === 0}>
                  Export as TXT
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportFeeds('csv')} disabled={isLoading || feeds.length === 0}>
                  Export as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {isProcessingImport && (
            <div className="mb-4 p-4 border rounded-lg shadow-sm bg-muted">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Loader2 className="h-6 w-6 text-primary animate-spin" /> 
                <p className="text-primary font-semibold text-lg">Importing Feeds...</p>
              </div>
              {currentImportProgress && 
                <p className="mt-2 text-muted-foreground text-center font-mono text-sm bg-background p-3 rounded-md shadow-inner">
                  {currentImportProgress}
                </p>
              }
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-primary" />
                  <Label className="font-semibold">Filter by Category:</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {uniqueCategories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    className={`transition-all duration-150 ease-in-out ${selectedCategory === category ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                    disabled={isLoading || isSubmitting || isProcessingImport || isDeletingMultiple}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-primary" />
                  <Label className="font-semibold">Filter by News Company (Feed Name):</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {uniqueNewsCompanies.map((companyName) => (
                  <Button
                    key={companyName}
                    variant={selectedNewsCompany === companyName ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedNewsCompany(companyName)}
                    className={`transition-all duration-150 ease-in-out ${selectedNewsCompany === companyName ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                    disabled={isLoading || isSubmitting || isProcessingImport || isDeletingMultiple}
                  >
                    {companyName}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          
          <Separator className="my-6" />

          {isLoading && !isProcessingImport && <p className="text-muted-foreground text-center py-4">Loading feeds...</p>}
          {!isLoading && !isProcessingImport && filteredFeeds.length > 0 && (
            <ScrollArea className="h-[60vh] w-full overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                       <Checkbox
                        checked={isAllFilteredFeedsSelected}
                        onCheckedChange={(checked) => handleSelectAllFeeds(Boolean(checked))}
                        aria-label="Select all visible feeds"
                        disabled={isLoading || isSubmitting || isProcessingImport || isDeletingMultiple || filteredFeeds.length === 0}
                      />
                    </TableHead>
                    <TableHead>Name (News Company)</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFeeds.map((feed) => (
                    <TableRow 
                        key={feed.url}
                        data-state={selectedFeedUrlsToDelete.has(feed.url) ? "selected" : ""}
                    >
                      <TableCell>
                        <Checkbox
                            checked={selectedFeedUrlsToDelete.has(feed.url)}
                            onCheckedChange={(checked) => handleSelectFeed(feed.url, Boolean(checked))}
                            aria-label={`Select feed ${feed.name}`}
                            disabled={isLoading || isSubmitting || isProcessingImport || isDeletingMultiple}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{feed.name}</TableCell>
                      <TableCell>
                        <a 
                          href={feed.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-primary hover:underline truncate block max-w-xs"
                          title={feed.url}
                        >
                          {feed.url}
                        </a>
                      </TableCell>
                      <TableCell>{feed.category}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditFeed(feed)} aria-label={`Edit feed ${feed.name}`} disabled={isSubmitting || urlCheckStatus.checking || isProcessingImport || isDeletingMultiple}>
                          <Edit2 className="h-4 w-4 text-primary" />
                        </Button>
                        
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label={`Delete feed ${feed.name}`} disabled={isSubmitting || urlCheckStatus.checking || isProcessingImport || isDeletingMultiple}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive"/>Confirm Deletion</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to delete the feed: "{feed.name}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => handleDeleteSingleFeed(feed.url, feed.name)}
                                        className="bg-destructive hover:bg-destructive/90"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : "Yes, delete"}
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
          {!isLoading && !isProcessingImport && filteredFeeds.length === 0 && (
            <p className="text-muted-foreground text-center py-4">
                {getNoFeedsMessage()}
            </p>
          )}
        </CardContent>
        <CardFooter>
            <p className="text-sm text-muted-foreground">
                RSS feed data is managed via Server Actions and stored in a CSV file on the server.
                For production, consider using a database or an external API for robust data persistence.
            </p>
        </CardFooter>
      </Card>

      {showImportLogDialog && (
        <AlertDialog open={showImportLogDialog} onOpenChange={setShowImportLogDialog}>
          <AlertDialogContent className="max-w-xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                RSS Feed Import Log
              </AlertDialogTitle>
              <AlertDialogDescription>
                Detailed results of the feed import process.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ScrollArea className="h-[40vh] border rounded-md p-3 text-sm">
              {importLogMessages.length > 0 ? (
                <ul className="space-y-1">
                  {importLogMessages.map((log, index) => (
                    <li key={index} className={`whitespace-pre-wrap ${getLogItemClass(log)}`}>
                      {log}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No specific log messages for this import.</p>
              )}
            </ScrollArea>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowImportLogDialog(false)}>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

    </div>
  );
}

