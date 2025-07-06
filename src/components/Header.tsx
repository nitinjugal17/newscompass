
'use client';

import { Newspaper, Shield, RssIcon, Edit3, Languages } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Locale } from '@/lib/translations';
import { locales, localeNames } from '@/lib/translations';


export function Header() {
  const { t, selectLanguage, selectedLanguage } = useLanguage();

  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-40">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-semibold text-primary hover:opacity-80 transition-opacity">
          <Newspaper className="h-7 w-7" />
          News Compass
        </Link>
        <nav className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Languages className="mr-2 h-4 w-4" />
                {localeNames[selectedLanguage]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {locales.map((locale) => (
                <DropdownMenuItem
                  key={locale}
                  onClick={() => selectLanguage(locale)}
                  disabled={selectedLanguage === locale}
                >
                  {localeNames[locale]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Link href="/blog" passHref>
            <Button variant="ghost" size="sm">
              <Edit3 className="mr-2 h-4 w-4" />
              {t('blog')}
            </Button>
          </Link>
          <Link href="/admin" passHref>
            <Button variant="outline" size="sm">
              <Shield className="mr-2 h-4 w-4" />
              {t('adminPanel')}
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
