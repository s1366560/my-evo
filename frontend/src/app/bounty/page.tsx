'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { BountyCard, BountyStats } from '@/components/bounty/BountyCard';
import { Button } from '@/components/ui/Button';
import { Plus, RefreshCw, Loader2 } from 'lucide-react';
import { useBountyApi, Bounty } from '@/hooks/useBountyApi';

const taskTypes = [
  { id: 'all', label: 'All Types', count: 0 },
  { id: 'bounty_task', label: 'Bounty Task', count: 0 },
  { id: 'external_task', label: 'External Task', count: 0 },
  { id: 'ai-integration', label: 'AI Integration', count: 0 },
];

const timeFilters = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
];

const bountyFilters = [
  { id: 'all', label: 'All' },
  { id: 'with_bounty', label: 'With Bounty' },
  { id: 'no_bounty', label: 'No Bounty' },
];

// Transform API bounty to UI format
function transformBounty(bounty: Bounty) {
  return {
    id: bounty.bountyId,
    title: bounty.title,
    description: bounty.description || bounty.requirements || '',
    tags: [],
    author: bounty.user?.username || 'unknown',
    createdAt: bounty.createdAt,
    credits: bounty.reward,
    status: bounty.status?.toLowerCase() as 'open' | 'in_progress' | 'closed',
    taskType: bounty.taskType || 'bounty_task',
    difficulty: bounty.difficulty || 'intermediate',
  };
}

export default function BountyPage() {
  const { listBounties, loading, error } = useBountyApi();
  const [bounties, setBounties] = useState<ReturnType<typeof transformBounty>[]>([]);
  const [apiBounties, setApiBounties] = useState<Bounty[]>([]);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedTime, setSelectedTime] = useState('all');
  const [selectedBounty, setSelectedBounty] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Load bounties from API
  const loadBounties = useCallback(async () => {
    try {
      const response = await listBounties({
        status: selectedType !== 'all' ? selectedType.toUpperCase() : undefined,
        limit: 50,
      });
      setApiBounties(response.bounties || []);
      setTotalCount(response.total || 0);
    } catch (err) {
      console.error('Failed to load bounties:', err);
    }
  }, [listBounties, selectedType]);

  useEffect(() => {
    loadBounties();
  }, [loadBounties]);

  // Update UI bounties when API bounties change
  useEffect(() => {
    setBounties(apiBounties.map(transformBounty));
  }, [apiBounties]);

  // Filter bounties
  const filteredBounties = bounties.filter((bounty) => {
    if (selectedType !== 'all' && bounty.taskType !== selectedType) return false;
    if (selectedBounty === 'with_bounty' && bounty.credits === 0) return false;
    if (selectedBounty === 'no_bounty' && bounty.credits > 0) return false;
    return true;
  });

  // Calculate stats from real data
  const stats = {
    total: totalCount || bounties.length,
    withBounty: bounties.filter((b) => b.credits > 0).length,
    totalReward: bounties.reduce((sum, b) => sum + b.credits, 0),
  };

  // Update task type counts
  const updatedTaskTypes = taskTypes.map(type => {
    if (type.id === 'all') {
      return { ...type, count: totalCount };
    }
    const count = apiBounties.filter(b => b.taskType === type.id).length;
    return { ...type, count };
  });

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Question Board</h1>
            <p className="text-gray-400">Find tasks and earn rewards by solving problems</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Post Bounty
          </Button>
        </div>

        {/* Stats */}
        <BountyStats {...stats} />

        {/* Filters */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4 mb-6">
          <div className="flex flex-wrap gap-6">
            {/* Task Type */}
            <div>
              <span className="text-sm text-gray-400 block mb-2">Type:</span>
              <div className="flex flex-wrap gap-2">
                {updatedTaskTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      selectedType === type.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {type.label}
                    {type.count > 0 && <span className="ml-1.5 text-xs opacity-60">({type.count})</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Bounty Filter */}
            <div>
              <span className="text-sm text-gray-400 block mb-2">Bounty:</span>
              <div className="flex gap-2">
                {bountyFilters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setSelectedBounty(filter.id)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      selectedBounty === filter.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Filter */}
            <div>
              <span className="text-sm text-gray-400 block mb-2">Time:</span>
              <div className="flex gap-2">
                {timeFilters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setSelectedTime(filter.id)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      selectedTime === filter.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Refresh Button */}
            <div className="ml-auto flex items-end">
              <Button variant="outline" onClick={loadBounties} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mb-4 text-sm text-gray-400">
          Showing {filteredBounties.length} bounties
          {error && <span className="text-red-400 ml-2">({error})</span>}
        </div>

        {/* Bounty List */}
        {loading && bounties.length === 0 ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-purple-500 mb-4" />
            <p className="text-gray-400">Loading bounties...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBounties.map((bounty) => (
              <BountyCard
                key={bounty.id}
                id={bounty.id}
                title={bounty.title}
                description={bounty.description}
                tags={bounty.tags}
                author={bounty.author}
                createdAt={bounty.createdAt}
                credits={bounty.credits}
                status={bounty.status}
                taskType={bounty.taskType}
                difficulty={bounty.difficulty as 'beginner' | 'intermediate' | 'advanced'}
                onClaim={() => console.log('Claim bounty:', bounty.id)}
                onView={() => console.log('View bounty:', bounty.id)}
              />
            ))}
          </div>
        )}

        {filteredBounties.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-400">No bounties found matching your criteria.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSelectedType('all');
                setSelectedBounty('all');
                setSelectedTime('all');
              }}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
