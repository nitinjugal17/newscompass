
'use client';

import type { BiasScore } from '@/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Filter, ArrowDownAZ, ArrowUpAZ, CalendarClock, Users, Search, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext'; // Import useLanguage

export type SortOption = 'date-desc' | 'date-asc' | 'source-asc' | 'source-desc';

interface FilterSortControlsProps {
  selectedBias: BiasScore | 'All';
  onBiasChange: (bias: BiasScore | 'All') => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onGlobalSearchSubmit: (term: string) => void;
  isGlobalSearching: boolean;
}

const biasOptions: (BiasScore | 'All')[] = ['All', 'Left', 'Center', 'Right', 'Unknown'];

export function FilterSortControls({
  selectedBias,
  onBiasChange,
  sortOption,
  onSortChange,
  searchTerm,
  onSearchTermChange,
  onGlobalSearchSubmit,
  isGlobalSearching,
}: FilterSortControlsProps) {
  
  const { t } = useLanguage(); // Use the language context

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      onGlobalSearchSubmit(searchTerm.trim());
    }
  };

  return (
    <div className="bg-card p-4 rounded-lg shadow mb-6 sticky top-16 z-30 border border-border space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Filter className="h-5 w-5 text-primary" />
          <Label htmlFor="bias-filter" className="font-semibold text-md">{t('filterByBias')}</Label>
        </div>
        <div className="flex flex-wrap gap-2">
          {biasOptions.map((bias) => (
            <Button
              key={bias}
              variant={selectedBias === bias ? 'default' : 'outline'}
              size="sm"
              onClick={() => onBiasChange(bias)}
              className={`transition-all duration-150 ease-in-out ${selectedBias === bias ? 'ring-2 ring-primary ring-offset-2' : ''}`}
              disabled={isGlobalSearching}
            >
              {bias}
            </Button>
          ))}
        </div>
        
        <Separator orientation="vertical" className="hidden sm:block h-8 mx-2" />
        <Separator orientation="horizontal" className="block sm:hidden my-2" />

        <div className="flex items-center gap-2 flex-shrink-0">
          <CalendarClock className="h-5 w-5 text-primary" />
           <Label htmlFor="sort-select" className="font-semibold text-md">Sort by:</Label>
        </div>
        <Select value={sortOption} onValueChange={(value) => onSortChange(value as SortOption)} disabled={isGlobalSearching}>
          <SelectTrigger id="sort-select" className="w-full sm:w-[200px] bg-background flex-shrink-0">
            <SelectValue placeholder="Select sort option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4"/> Date (Newest First)
              </div>
            </SelectItem>
            <SelectItem value="date-asc">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4"/> Date (Oldest First)
              </div>
            </SelectItem>
            <SelectItem value="source-asc">
               <div className="flex items-center gap-2">
                <ArrowUpAZ className="h-4 w-4"/> Source (A-Z)
              </div>
            </SelectItem>
            <SelectItem value="source-desc">
              <div className="flex items-center gap-2">
                <ArrowDownAZ className="h-4 w-4"/> Source (Z-A)
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Separator />
      <div className="flex items-center gap-3">
        <Search className="h-6 w-6 text-primary" />
        <Label htmlFor="search-input" className="font-semibold text-md sr-only">Search News:</Label>
        <Input
          id="search-input"
          type="search"
          placeholder="Filter loaded articles or search all feeds..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          onKeyPress={handleSearchKeyPress}
          className="flex-grow bg-background text-base"
          disabled={isGlobalSearching}
        />
        <Button 
          onClick={() => searchTerm.trim() && onGlobalSearchSubmit(searchTerm.trim())} 
          disabled={isGlobalSearching || !searchTerm.trim()}
          variant="outline"
        >
          <Globe className="mr-2 h-4 w-4" />
          {isGlobalSearching ? 'Searching All...' : 'Search All Feeds'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Use the input to filter currently loaded articles as you type. Click "Search All Feeds" or press Enter to search across all configured RSS sources.
      </p>
    </div>
  );
}
