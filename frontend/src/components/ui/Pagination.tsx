'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  showFirstLast?: boolean;
  maxVisible?: number;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  showFirstLast = true,
  maxVisible = 7,
  className = '',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate visible page numbers with ellipsis
  const getVisiblePages = () => {
    const pages: (number | 'ellipsis')[] = [];
    const halfVisible = Math.floor(maxVisible / 2);
    
    if (totalPages <= maxVisible) {
      // Show all pages if total is small enough
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage > halfVisible + 2) {
        pages.push('ellipsis');
      }
      
      // Calculate range around current page
      let start = Math.max(2, currentPage - halfVisible);
      let end = Math.min(totalPages - 1, currentPage + halfVisible);
      
      // Adjust if at the edges
      if (currentPage <= halfVisible + 1) {
        end = Math.min(totalPages - 1, maxVisible - 1);
      }
      if (currentPage >= totalPages - halfVisible) {
        start = Math.max(2, totalPages - maxVisible + 2);
      }
      
      // Add pages in range
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }
      
      // Add ellipsis before last page if needed
      if (end < totalPages - 1) {
        pages.push('ellipsis');
      }
      
      // Always show last page
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <nav 
      className={`flex items-center justify-between gap-4 ${className}`}
      role="navigation"
      aria-label="Pagination"
    >
      {/* Items count */}
      <div className="text-sm text-gray-400">
        Showing <span className="font-medium text-white">{startItem}</span>
        {' - '}
        <span className="font-medium text-white">{endItem}</span>
        {' of '}
        <span className="font-medium text-white">{totalItems}</span>
        {' items'}
      </div>

      {/* Page controls */}
      <div className="flex items-center gap-1">
        {/* First page */}
        {showFirstLast && (
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="hidden sm:flex p-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="First page"
            title="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        )}

        {/* Previous page */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1 px-2">
          {visiblePages.map((page, index) =>
            page === 'ellipsis' ? (
              <span 
                key={`ellipsis-${index}`}
                className="px-3 py-2 text-gray-500 select-none"
                aria-hidden="true"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === page
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
                aria-label={`Page ${page}`}
                aria-current={currentPage === page ? 'page' : undefined}
              >
                {page}
              </button>
            )
          )}
        </div>

        {/* Next page */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last page */}
        {showFirstLast && (
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="hidden sm:flex p-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Last page"
            title="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </nav>
  );
}

export default Pagination;
