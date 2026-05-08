'use client';

import { useState, useEffect } from 'react';
import { Pagination } from '@/components/ui/Pagination';
import { AssetPreviewModal } from '@/components/marketplace/AssetPreviewModal';

interface Asset {
  id: string;
  assetId: string;
  type: 'GENE' | 'CAPSULE';
  name: string;
  description?: string;
  tags: string[];
  gdiScore?: number;
  model?: string;
  nodeId: string;
  creatorName?: string;
  createdAt: string;
  status: string;
}

interface MarketplaceStats {
  totalAssets: number;
  totalGenes: number;
  totalCapsules: number;
  totalNodes: number;
  totalBounties: number;
  activeBounties: number;
}

const ITEMS_PER_PAGE = 20;

export default function MarketplacePage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'GENE' | 'CAPSULE'>('ALL');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'gdi'>('recent');
  const [currentPage, setCurrentPage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  useEffect(() => {
    fetchMarketplaceData();
    const interval = setInterval(() => fetchMarketplaceData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterAndSortAssets();
    setCurrentPage(1);
  }, [assets, searchQuery, typeFilter, sortBy]);

  const fetchMarketplaceData = async (silent = false) => {
    if (!silent) setLoading(true);
    setIsRefreshing(silent);
    setError(null);
    try {
      const statsRes = await fetch('/api/frontend/marketplace/stats');
      if (statsRes.ok) setStats(await statsRes.json());
      const assetsRes = await fetch('/api/frontend/assets');
      if (assetsRes.ok) {
        const data = await assetsRes.json();
        setAssets(Array.isArray(data) ? data : (data.assets || []));
        setLastUpdated(new Date());
      } else { setAssets(generateMockAssets()); setLastUpdated(new Date()); }
    } catch (err) { console.error('Failed to fetch marketplace data:', err); setAssets(generateMockAssets()); setLastUpdated(new Date()); }
    finally { setLoading(false); setIsRefreshing(false); }
  };

  const filterAndSortAssets = () => {
    let result = [...assets];
    if (typeFilter !== 'ALL') result = result.filter(a => a.type === typeFilter);
    if (searchQuery) { const q = searchQuery.toLowerCase(); result = result.filter(a => a.name.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q) || a.tags.some(t => t.toLowerCase().includes(q))); }
    if (sortBy === 'popular' || sortBy === 'gdi') result.sort((a, b) => (b.gdiScore || 0) - (a.gdiScore || 0));
    else result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setFilteredAssets(result);
  };

  const totalPages = Math.ceil(filteredAssets.length / ITEMS_PER_PAGE);
  const paginatedAssets = filteredAssets.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const handlePageChange = (page: number) => { if (page >= 1 && page <= totalPages) { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }};
  const getTypeColor = (type: string) => type === 'GENE' ? 'bg-emerald-500' : 'bg-violet-500';
  const getGdiColor = (score?: number) => { if (!score) return 'text-gray-400'; if (score >= 0.8) return 'text-emerald-400'; if (score >= 0.6) return 'text-blue-400'; if (score >= 0.4) return 'text-yellow-400'; return 'text-orange-400'; };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Marketplace</h1>
              <p className="text-gray-400">Discover Genes and Capsules from the AI evolution ecosystem</p>
            </div>
            {lastUpdated && (
              <div className="text-right">
                <span className="text-xs text-gray-500">Last updated</span>
                <p className="text-sm text-gray-400">{lastUpdated.toLocaleTimeString()}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {stats && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800"><div className="text-2xl font-bold text-white">{stats.totalAssets.toLocaleString()}</div><div className="text-sm text-gray-400">Total Assets</div></div>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800"><div className="text-2xl font-bold text-emerald-400">{stats.totalGenes.toLocaleString()}</div><div className="text-sm text-gray-400">Genes</div></div>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800"><div className="text-2xl font-bold text-violet-400">{stats.totalCapsules.toLocaleString()}</div><div className="text-sm text-gray-400">Capsules</div></div>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800"><div className="text-2xl font-bold text-blue-400">{stats.totalNodes.toLocaleString()}</div><div className="text-sm text-gray-400">Active Nodes</div></div>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800"><div className="text-2xl font-bold text-amber-400">{stats.totalBounties.toLocaleString()}</div><div className="text-sm text-gray-400">Bounties</div></div>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800"><div className="text-2xl font-bold text-cyan-400">{stats.activeBounties.toLocaleString()}</div><div className="text-sm text-gray-400">Active Tasks</div></div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setTypeFilter("ALL")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${typeFilter === "ALL" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>All</button>
            <button onClick={() => setTypeFilter("GENE")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${typeFilter === "GENE" ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>Genes</button>
            <button onClick={() => setTypeFilter("CAPSULE")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${typeFilter === "CAPSULE" ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>Capsules</button>
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={() => fetchMarketplaceData()} disabled={isRefreshing} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all disabled:opacity-50" title="Refresh">
              <svg className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} aria-label="Sort assets" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="recent">Most Recent</option><option value="popular">Most Popular</option><option value="gdi">Highest GDI</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <input type="text" placeholder="Search assets..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 p-5 animate-pulse"><div className="h-6 bg-gray-800 rounded w-1/4 mb-4"></div><div className="h-8 bg-gray-800 rounded w-3/4 mb-3"></div><div className="h-12 bg-gray-800 rounded w-full mb-3"></div><div className="flex gap-2"><div className="h-5 bg-gray-800 rounded w-16"></div><div className="h-5 bg-gray-800 rounded w-16"></div></div></div>)}
          </div>
        ) : error ? (
          <div className="text-center py-20"><div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 inline-block"><p className="text-red-400 mb-4">{error}</p><button onClick={() => fetchMarketplaceData()} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm">Try Again</button></div></div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center py-20 text-gray-500">{searchQuery ? "No assets match your search." : "No assets available yet."}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedAssets.map(asset => (
                <div key={asset.id || asset.assetId} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/5 hover:-translate-y-0.5">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(asset.type)} text-white`}>{asset.type}</span>
                      {asset.gdiScore && <div className={`font-medium ${getGdiColor(asset.gdiScore)}`}>GDI {asset.gdiScore.toFixed(2)}</div>}
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-white hover:text-purple-400 transition-colors">{asset.name}</h3>
                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">{asset.description || "No description provided."}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {asset.tags?.slice(0, 3).map((tag, idx) => <span key={idx} className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400">{tag}</span>)}
                      {asset.tags?.length > 3 && <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-500">+{asset.tags.length - 3}</span>}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{new Date(asset.createdAt).toLocaleDateString()}</span>
                      {asset.model && <span className="text-gray-500 text-xs">{asset.model}</span>}
                    </div>
                  </div>
                  <div className="px-5 py-3 bg-gray-800/50 border-t border-gray-800 flex justify-between">
                    <button onClick={() => setSelectedAsset(asset)} className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">View Details</button>
                    <button className="text-gray-400 hover:text-gray-300 text-sm font-medium transition-colors">Add to Collection</button>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredAssets.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </div>

      {selectedAsset && (
        <AssetPreviewModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
    </div>
  );
}

function generateMockAssets(): any[] {
  return [
    { id: "1", assetId: "gene_001", type: "GENE", name: "Creative Writing Gene", description: "A gene optimized for creative writing and storytelling tasks.", tags: ["writing", "creative", "nlp"], gdiScore: 0.85, model: "gpt-4", nodeId: "node_001", createdAt: new Date().toISOString(), status: "PUBLISHED" },
    { id: "2", assetId: "capsule_001", type: "CAPSULE", name: "Code Review Assistant", description: "A capsule that provides detailed code review and optimization suggestions.", tags: ["code", "review", "development"], gdiScore: 0.92, model: "claude-3", nodeId: "node_002", createdAt: new Date(Date.now() - 86400000).toISOString(), status: "PUBLISHED" },
    { id: "3", assetId: "gene_002", type: "GENE", name: "Data Analysis Gene", description: "Specialized gene for data analysis and statistical computations.", tags: ["data", "analysis", "statistics"], gdiScore: 0.78, model: "gpt-4", nodeId: "node_003", createdAt: new Date(Date.now() - 172800000).toISOString(), status: "PUBLISHED" },
    { id: "4", assetId: "capsule_002", type: "CAPSULE", name: "Research Assistant", description: "Capsule designed for academic research assistance and paper summarization.", tags: ["research", "academic", "papers"], gdiScore: 0.88, model: "gpt-4", nodeId: "node_001", createdAt: new Date(Date.now() - 259200000).toISOString(), status: "PUBLISHED" },
  ];
}
