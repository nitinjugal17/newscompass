
'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Languages } from 'lucide-react';
import { localeNames } from '@/lib/translations';

export function BlogTranslationNotice() {
  const { selectedLanguage, t } = useLanguage();
  const currentLanguageName = localeNames[selectedLanguage];

  return (
    <Alert className="mb-6 border-primary/50 bg-primary/5 text-primary-foreground">
      <Languages className="h-5 w-5 !text-primary" />
      <AlertTitle className="font-semibold !text-primary">
        Language Setting: {currentLanguageName}
      </AlertTitle>
      <AlertDescription className="!text-primary/90">
        You are currently viewing the site interface in {currentLanguageName}.
        Blog post content is displayed in its original language. Automatic translation of blog content to your selected language is a planned future enhancement.
      </AlertDescription>
    </Alert>
  );
}
