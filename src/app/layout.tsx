
import type {Metadata} from 'next';
import { Inter } from 'next/font/google'; // Using Inter as a clean sans-serif font
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Ensure Toaster is imported
import { LanguageProvider } from '@/contexts/LanguageContext'; // Import LanguageProvider

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans', // Using a common variable name for sans-serif
});

export const metadata: Metadata = {
  title: 'News Compass',
  description: 'Understand news with AI-powered insights and bias assessment.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        <LanguageProvider> {/* Wrap application with LanguageProvider */}
          {children}
          <Toaster />
        </LanguageProvider>
      </body>
    </html>
  );
}
