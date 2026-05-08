'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { AssetCard } from '@/components/marketplace/AssetCard';
import { Button } from '@/components/ui/Button';
import { Search, Grid, List, SlidersHorizontal, Loader2 } from 'lucide-react';
import { useAssetApi, Asset } from '@/hooks/useAssetApi';

export default function BrowsePage() {
  const { fetchAssets, loading, error } = useAssetApi();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedType, setSelectedType] = useState<'all' | 'gene' | 'capsule'>('all');

  const loadAssets = useCallback(async () => {
    try {
      const result = await fetchAssets({
        query: searchQuery || undefined,
        type: selectedType !== 'all' ? selectedType : undefined,
        sort: 'recent',
        limit: 50,
      });
      setAssets(result.assets);
    } catch (err) {
      console.error('Failed to load assets:', err);
    }
  }, [fetchAssets, searchQuery, selectedType]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // Filter assets based on search
  const filteredAssets = assets.filter((asset) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        asset.name.toLowerCase().includes(query) ||
        asset.description.toLowerCase().includes(query) ||
        asset.tags?.some((tag: string) => tag.toLowerCase().includes(query))
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Browse Assets</h1>
          <p className="text-gray-400">Discover AI evolution assets from the community</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search assets by name, description, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant={showFilters ? 'default' : 'outline'}
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Filters
              </Button>

              <div className="flex border border-white/10 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                  className={`p-2 ${viewMode === 'grid' ? 'bg-purple-600' : 'bg-white/5 hover:bg-white/10'}`}
                >
                  <Grid className="w-5 h-5" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                  className={`p-2 ${viewMode === 'list' ? 'bg-purple-600' : 'bg-white/5 hover:bg-white/10'}`}
                >
                  <List className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mb-4 text-sm text-gray-400">
          Showing {filteredAssets.length} assets
          {error && <span className="text-red-400 ml-2">({error})</span>}
        </div>

        {/* Asset Grid */}
        {loading && assets.length === 0 ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-purple-500 mb-4" />
            <p className="text-gray-400">Loading assets...</p>
          </div>
        ) : (
          <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
            {filteredAssets.map((asset) => (
              <AssetCard
                key={asset.assetId}
                id={asset.assetId}
                name={asset.name}
                description={asset.description}
                type={asset.type.toLowerCase() as 'gene' | 'capsule'}
                tags={asset.tags || []}
                gdiScore={asset.gdiScore}
                author={asset.node?.name || 'Unknown'}
                views={0}
                calls={asset._count?.reviews || 0}
                gepProtocol={true}
                onClick={() => console.log('View asset:', asset.assetId)}
              />
            ))}
          </div>
        )}

        {filteredAssets.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-400">No assets found.</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
