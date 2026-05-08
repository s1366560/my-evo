'use client';

import React, { useState, useEffect } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { useMemoryApi, MemoryEntry } from '@/hooks/useMemoryApi';
import { 
  Brain, 
  Search, 
  Plus, 
  Trash2, 
  Clock, 
  Tag, 
  Sparkles,
  Activity,
  Database,
  X,
  RefreshCw
} from 'lucide-react';

const eventTypeColors: Record<string, string> = {
  'evolution': 'bg-purple-500/20 text-purple-400',
  'discovery': 'bg-cyan-500/20 text-cyan-400',
  'learning': 'bg-green-500/20 text-green-400',
  'task': 'bg-amber-500/20 text-amber-400',
  'error': 'bg-red-500/20 text-red-400',
  'default': 'bg-gray-500/20 text-gray-400',
};

export default function MemoryPage() {
  const { loading, error, recordMemory, recallMemory, getMemories, deleteMemory } = useMemoryApi();
  
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemoryEntry[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [newMemory, setNewMemory] = useState({ content: '', eventType: 'learning', tags: '' });
  const [recordLoading, setRecordLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    try {
      const data = await getMemories(50, 0);
      setMemories(data);
    } catch (err) {
      console.error('Failed to load memories:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    
    setIsSearching(true);
    try {
      const results = await recallMemory(searchQuery, 20);
      setSearchResults(results as MemoryEntry[]);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRecordMemory = async () => {
    if (!newMemory.content.trim()) return;
    
    setRecordLoading(true);
    try {
      const tags = newMemory.tags.split(',').map(t => t.trim()).filter(Boolean);
      await recordMemory(newMemory.content, newMemory.eventType, tags);
      setNewMemory({ content: '', eventType: 'learning', tags: '' });
      setShowRecordModal(false);
      await loadMemories();
    } catch (err) {
      console.error('Failed to record memory:', err);
    } finally {
      setRecordLoading(false);
    }
  };

  const handleDeleteMemory = async (id: number) => {
    if (!confirm('Are you sure you want to delete this memory?')) return;
    
    try {
      await deleteMemory(id);
      await loadMemories();
    } catch (err) {
      console.error('Failed to delete memory:', err);
    }
  };

  const displayedMemories = searchResults !== null ? searchResults : memories;
  
  const filteredMemories = filter === 'all' 
    ? displayedMemories 
    : displayedMemories.filter(m => m.eventType === filter);

  const getEventTypeColor = (eventType: string) => {
    return eventTypeColors[eventType] || eventTypeColors.default;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <Brain className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Evolution Memory</h1>
              <p className="text-gray-400">Track your agent's learning and discoveries</p>
            </div>
          </div>
          <Button onClick={() => setShowRecordModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Record Memory
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Database className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{memories.length}</p>
                  <p className="text-sm text-gray-400">Total Memories</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/20 rounded-lg">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{memories.filter(m => m.eventType === 'discovery').length}</p>
                  <p className="text-sm text-gray-400">Discoveries</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Activity className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{memories.filter(m => m.eventType === 'learning').length}</p>
                  <p className="text-sm text-gray-400">Learnings</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{memories.length > 0 ? formatDate(memories[0]?.createdAt || '') : 'N/A'}</p>
                  <p className="text-sm text-gray-400">Last Memory</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search memories by content, tags, or event type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search'}
              </Button>
              {searchResults !== null && (
                <Button variant="outline" onClick={() => { setSearchResults(null); setSearchQuery(''); }}>
                  <X className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Filter */}
        <div className="flex gap-2 mb-6">
          {['all', 'evolution', 'discovery', 'learning', 'task', 'error'].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === type 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <Card className="border-red-500/50 mb-6">
            <CardContent className="p-4 text-red-400">
              {error}
            </CardContent>
          </Card>
        )}

        {/* Memory List */}
        <div className="space-y-4">
          {filteredMemories.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Brain className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                <h3 className="text-xl font-semibold mb-2">No memories yet</h3>
                <p className="text-gray-400 mb-4">Start recording your agent's learning journey</p>
                <Button onClick={() => setShowRecordModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Record First Memory
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredMemories.map((memory) => (
              <Card key={memory.id} className="hover:border-purple-500/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getEventTypeColor(memory.eventType)}`}>
                          {memory.eventType}
                        </span>
                        <span className="text-sm text-gray-500">{formatDate(memory.createdAt)}</span>
                      </div>
                      <p className="text-gray-200 mb-3">{memory.content}</p>
                      {memory.tags && memory.tags.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Tag className="w-4 h-4 text-gray-500" />
                          {memory.tags.map((tag, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-white/5 rounded text-xs text-gray-400">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteMemory(memory.id)}
                      className="text-gray-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>

      {/* Record Memory Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Record New Memory</h2>
                <button onClick={() => setShowRecordModal(false)} className="p-1 hover:bg-white/10 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Event Type</label>
                <select
                  value={newMemory.eventType}
                  onChange={(e) => setNewMemory({ ...newMemory, eventType: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
                >
                  <option value="learning">Learning</option>
                  <option value="discovery">Discovery</option>
                  <option value="evolution">Evolution</option>
                  <option value="task">Task</option>
                  <option value="error">Error</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Content</label>
                <textarea
                  value={newMemory.content}
                  onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
                  placeholder="What did you learn or discover?"
                  rows={4}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={newMemory.tags}
                  onChange={(e) => setNewMemory({ ...newMemory, tags: e.target.value })}
                  placeholder="e.g., optimization, strategy, review"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowRecordModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleRecordMemory} disabled={recordLoading || !newMemory.content.trim()} className="flex-1">
                  {recordLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Record'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Footer />
    </div>
  );
}
