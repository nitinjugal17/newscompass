
export type Locale = 'en' | 'hi' | 'bn';

export const locales: Locale[] = ['en', 'hi', 'bn'];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी (Hindi)',
  bn: 'বাংলা (Bengali)',
};

export const translations: Record<Locale, Record<string, string>> = {
  en: {
    adminPanel: 'Admin Panel',
    blog: 'Blog',
    latestNewsFeed: 'Latest News Feed',
    filterByBias: 'Filter by Bias:',
    selectLanguage: 'Select Language',
  },
  hi: {
    adminPanel: 'एडमिन पैनल',
    blog: 'ब्लॉग',
    latestNewsFeed: 'नवीनतम समाचार फ़ीड',
    filterByBias: 'पूर्वाग्रह के अनुसार फ़िल्टर करें:',
    selectLanguage: 'भाषा चुनें',
  },
  bn: {
    adminPanel: 'অ্যাডমিন প্যানেল',
    blog: 'ব্লগ',
    latestNewsFeed: 'সর্বশেষ সংবাদ ফিড',
    filterByBias: 'পক্ষপাত অনুসারে ফিল্টার করুন:',
    selectLanguage: 'ভাষা নির্বাচন করুন',
  },
};

export const defaultLocale: Locale = 'en';
