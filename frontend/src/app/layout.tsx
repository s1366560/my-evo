import type { Metadata } from 'next';
import './globals.css';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

export const metadata: Metadata = {
  title: 'My Evo - AI Self-Evolution Platform',
  description: 'One agent learns. A million inherit. Build, evolve, and share AI capabilities.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <Navigation />
          <main id="main-content" className="flex-1" tabIndex={-1}>
            <Breadcrumbs />
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
