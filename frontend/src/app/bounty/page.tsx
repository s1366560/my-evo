'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { BountyCard, BountyStats } from '@/components/bounty/BountyCard';
import { Button } from '@/components/ui/Button';
import { Plus, RefreshCw, Loader2, Send } from 'lucide-react';
import { useBountyApi, Bounty } from '@/hooks/useBountyApi';

// Match evomap.ai task types
const taskTypes = [
  { id: 'all', label: 'All Types', count: 0 },
  { id: 'bounty_task', label: 'Bounty Task', count: 0 },
  { id: 'external_task', label: 'External Task', count: 0 },
  { id: 'question', label: 'Question', count: 0 },
  { id: 'knowledge', label: 'Knowledge', count: 0 },
];

// Status filters matching evomap.ai
const statusFilters: { id: string; label: string; count?: number }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'matched', label: 'Matched' },
];

const timeFilters = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
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
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedTime, setSelectedTime] = useState('all');
  const [selectedBounty, setSelectedBounty] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);

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

  // Filter bounties with status and time filters
  const filteredBounties = bounties.filter((bounty) => {
    if (selectedType !== 'all' && bounty.taskType !== selectedType) return false;
    if (selectedStatus !== 'all') {
      if (selectedStatus === 'open' && bounty.status !== 'open') return false;
      if (selectedStatus === 'matched' && bounty.status !== 'in_progress') return false;
    }
    if (selectedBounty === 'with_bounty' && bounty.credits === 0) return false;
    if (selectedBounty === 'no_bounty' && bounty.credits > 0) return false;
    
    // Time filter
    if (selectedTime !== 'all') {
      const bountyDate = new Date(bounty.createdAt);
      const now = new Date();
      const diffMs = now.getTime() - bountyDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (selectedTime === 'today' && diffDays > 0) return false;
      if (selectedTime === 'week' && diffDays > 7) return false;
      if (selectedTime === 'month' && diffDays > 30) return false;
    }
    return true;
  });

  // Calculate stats from real data
  const stats = {
    total: totalCount || bounties.length,
    withBounty: bounties.filter((b) => b.credits > 0).length,
    totalReward: bounties.reduce((sum, b) => sum + b.credits, 0),
  };

  // Update task type counts and status counts
  const updatedTaskTypes = taskTypes.map(type => {
    if (type.id === 'all') {
      return { ...type, count: totalCount };
    }
    const count = apiBounties.filter(b => b.taskType === type.id).length;
    return { ...type, count };
  });

  const updatedStatusFilters = statusFilters.map(status => {
    if (status.id === 'all') {
      return { ...status, count: totalCount };
    }
    if (status.id === 'open') {
      return { ...status, count: openCount };
    }
    if (status.id === 'matched') {
      return { ...status, count: matchedCount };
    }
    return status;
  });

  // Update status counts from apiBounties
  useEffect(() => {
    const open = apiBounties.filter(b => b.status?.toLowerCase() === 'open').length;
    const matched = apiBounties.filter(b => b.status?.toLowerCase() === 'in_progress' || b.status?.toLowerCase() === 'matched').length;
    setOpenCount(open);
    setMatchedCount(matched);
  }, [apiBounties]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header - Match evomap.ai "Question Board" */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Question Board</h1>
            <p className="text-gray-400">Browse all questions from users. Questions with bounties offer credits for AI agents that deliver solutions.</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Ask a Question
          </Button>
        </div>

        {/* Stats */}
        <BountyStats {...stats} />

        {/* Filters - Match evomap.ai layout */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4 mb-6">
          <div className="flex flex-wrap gap-6">
            {/* Task Type Pills */}
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
                    {type.count > 0 && <span className="ml-1.5 text-xs opacity-60">({type.count.toLocaleString()})</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Pills - evomap.ai style */}
            <div>
              <span className="text-sm text-gray-400 block mb-2">Status:</span>
              <div className="flex gap-2">
                {updatedStatusFilters.map((status) => (
                  <button
                    key={status.id}
                    onClick={() => setSelectedStatus(status.id)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      selectedStatus === status.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {status.label}
                    {(status.count ?? 0) > 0 && <span className="ml-1.5 text-xs opacity-60">({(status.count ?? 0).toLocaleString()})</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Bounty Filter */}
            <div>
              <span className="text-sm text-gray-400 block mb-2">Bounty:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedBounty('all')}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    selectedBounty === 'all'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedBounty('with_bounty')}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    selectedBounty === 'with_bounty'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  With Bounty
                </button>
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

        {/* Results - evomap.ai style "Showing X / Y" */}
        <div className="mb-4 text-sm text-gray-400">
          Showing {filteredBounties.length.toLocaleString()} / {totalCount.toLocaleString()}
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
