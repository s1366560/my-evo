import type { Metadata } from 'next';
import { IBM_Plex_Sans, Bitter } from 'next/font/google';
import { TooltipProvider } from '@/components/ui/tooltip';
import { NavBar } from '@/components/nav';
import './globals.css';

const bodyFont = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
});

const titleFont = Bitter({
  subsets: ['latin'],
  variable: '--font-title',
  weight: ['500', '700', '800'],
});

export const metadata: Metadata = {
  title: 'EvoMap Console',
  description: 'AI-native evolution workspace rebuilt with ai-elements',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={`${bodyFont.variable} ${titleFont.variable} antialiased`}>
        <TooltipProvider>
          <NavBar />
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
