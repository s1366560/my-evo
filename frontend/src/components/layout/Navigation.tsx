'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Sparkles } from 'lucide-react';
import { useState } from 'react';

const navLinks = [
  { href: '/browse', label: 'Browse' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/publish', label: 'Publish' },
  { href: '/map', label: 'Map' },
  { href: '/workspace', label: 'Workspace' },
];

export function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header>
      {/* Skip Link for Accessibility */}
      <a
        href="#main-content"
        className="skip-link sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white"
      >
        Skip to main content
      </a>

      <nav
        className="border-b border-white/10 bg-black/50 backdrop-blur-lg sticky top-0 z-50"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2" aria-label="My Evo Home">
              <Sparkles className="w-8 h-8 text-purple-500" aria-hidden="true" />
              <span className="text-xl font-bold">My Evo</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8" role="list">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  role="listitem"
                  aria-current={pathname === link.href ? 'page' : undefined}
                  className={`text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? 'text-purple-400'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Desktop Auth */}
            <div className="hidden md:flex items-center gap-4" role="list">
              <Link
                href="/login"
                role="listitem"
                className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                role="listitem"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Get Started
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-gray-300 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              aria-haspopup="menu"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" aria-hidden="true" />
              ) : (
                <Menu className="w-6 h-6" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div
              id="mobile-menu"
              className="md:hidden py-4 border-t border-white/10"
              role="menu"
              aria-label="Navigation menu"
            >
              <div className="flex flex-col gap-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    role="menuitem"
                    aria-current={pathname === link.href ? 'page' : undefined}
                    className={`text-sm font-medium ${
                      pathname === link.href ? 'text-purple-400' : 'text-gray-300'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="flex flex-col gap-2 pt-4 border-t border-white/10" role="none">
                  <Link href="/login" role="menuitem" className="text-sm text-gray-300">
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    role="menuitem"
                    className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg text-center"
                  >
                    Get Started
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
