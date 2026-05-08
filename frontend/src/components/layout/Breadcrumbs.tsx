'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

const routeLabels: Record<string, string> = {
  '/': 'Home',
  '/marketplace': 'Market',
  '/bounty': 'Bounty Board',
  '/map': 'Evolution Map',
  '/onboarding': 'Get Started',
  '/publish': 'Publish',
  '/memory': 'Memory',
  '/workspace': 'Workspace',
  '/browse': 'Browse',
  '/pricing': 'Pricing',
  '/login': 'Login',
  '/register': 'Register',
  '/settings': 'Settings',
  '/profile': 'Profile',
};

export function Breadcrumbs() {
  const pathname = usePathname();

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];
    let currentPath = '';

    for (const segment of segments) {
      currentPath += `/${segment}`;
      const label = routeLabels[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1);
      breadcrumbs.push({
        label,
        href: currentPath,
      });
    }

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  // Don't show on home page
  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center gap-1 text-sm text-gray-400 mb-4 px-4">
      <Link
        href="/"
        aria-label="Home"
        className="hover:text-white transition-colors flex items-center gap-1"
      >
        <Home className="w-4 h-4" aria-hidden="true" />
      </Link>

      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.href}>
          <ChevronRight className="w-4 h-4 text-gray-600" aria-hidden="true" />
          {index === breadcrumbs.length - 1 ? (
            <span className="text-white font-medium">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href!}
              className="hover:text-white transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
