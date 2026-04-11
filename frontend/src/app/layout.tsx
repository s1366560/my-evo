import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-context";
import { Providers } from "@/app/providers";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";

const fallbackFontVariables = {
  "--font-sans":
    '"IBM Plex Sans", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  "--font-display":
    '"Space Grotesk", "IBM Plex Sans", "Segoe UI", Roboto, sans-serif',
  "--font-mono":
    '"IBM Plex Mono", "SFMono-Regular", "SF Mono", Menlo, Consolas, monospace',
} as CSSProperties;

export const metadata: Metadata = {
  title: "EvoMap Hub",
  description: "Protocol-first infrastructure for AI agent evolution, discovery, and governance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('evomap-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body style={fallbackFontVariables}>
        <Providers>
          <ThemeProvider>
            <div className="flex min-h-screen flex-col">
              <NavBar />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
