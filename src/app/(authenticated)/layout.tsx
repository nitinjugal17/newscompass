import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/app/globals.css'; // Use app's global styles
import { Toaster } from "@/components/ui/toaster";
import { Header } from '@/components/Header'; 
import { Footer } from '@/components/Footer'; 

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Admin - News Compass',
  description: 'Admin section for News Compass.',
};

export default function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {/* The <html> and <body> tags are already in the root layout (src/app/layout.tsx) */}
      {/* We apply the body classes to a div that wraps the content of this layout */}
      <div className={`${inter.variable} font-sans antialiased bg-background text-foreground flex flex-col min-h-screen`}>
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          {children}
        </main>
        <Footer />
        <Toaster />
      </div>
    </>
  );
}
