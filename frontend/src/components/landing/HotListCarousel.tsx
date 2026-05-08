'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Sparkles, ChevronLeft, ChevronRight, Star, TrendingUp, Users, ExternalLink } from 'lucide-react';

interface HotAsset {
  id: string;
  name: string;
  description: string;
  type: 'gene' | 'capsule';
  score: number;
  author: string;
  downloads: number;
  tags: string[];
}

// Mock hot assets data (in production, this would come from an API)
const mockHotAssets: HotAsset[] = [
  {
    id: 'gene-001',
    name: 'Optimized RAG Pipeline',
    description: 'Production-ready retrieval-augmented generation pipeline with semantic caching.',
    type: 'gene',
    score: 94,
    author: 'EvoAgent',
    downloads: 12847,
    tags: ['RAG', 'NLP', 'Production'],
  },
  {
    id: 'gene-002',
    name: 'Multi-Agent Orchestrator',
    description: 'Coordination framework for multiple AI agents solving complex tasks.',
    type: 'gene',
    score: 91,
    author: 'SwarmLabs',
    downloads: 8934,
    tags: ['Agents', 'Orchestration', 'AI'],
  },
  {
    id: 'capsule-001',
    name: 'Benchmark Results: LLM Comparison',
    description: 'Comprehensive evaluation of 15 LLMs across 50+ tasks.',
    type: 'capsule',
    score: 88,
    author: 'EvalHub',
    downloads: 5621,
    tags: ['Benchmark', 'LLM', 'Research'],
  },
  {
    id: 'gene-003',
    name: 'Error Recovery Patterns',
    description: 'Robust error handling strategies for LLM-based applications.',
    type: 'gene',
    score: 86,
    author: 'SafeAI',
    downloads: 4210,
    tags: ['Error Handling', 'Reliability', 'Patterns'],
  },
  {
    id: 'capsule-002',
    name: 'Code Generation Case Study',
    description: 'Real-world analysis of AI-assisted code generation performance.',
    type: 'capsule',
    score: 85,
    author: 'CodeMetrics',
    downloads: 3892,
    tags: ['Code Gen', 'Analysis', 'Case Study'],
  },
  {
    id: 'gene-004',
    name: 'Context Window Optimization',
    description: 'Techniques for maximizing effectiveness within token limits.',
    type: 'gene',
    score: 84,
    author: 'TokenWise',
    downloads: 3156,
    tags: ['Context', 'Optimization', 'Efficiency'],
  },
];

function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function HotListCarousel() {
  const [hotAssets, setHotAssets] = useState<HotAsset[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchHotAssets = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/frontend/assets/hot?limit=6');
        if (response.ok) {
          const data = await response.json();
          if (data.assets && data.assets.length > 0) {
            setHotAssets(data.assets);
          } else {
            // Fallback to mock data if no real assets exist
            setHotAssets(mockHotAssets);
          }
        } else {
          setHotAssets(mockHotAssets);
        }
      } catch {
        setHotAssets(mockHotAssets);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHotAssets();
  }, []);

  const scrollToIndex = (index: number) => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const cards = container.children;
    if (cards[index]) {
      cards[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
    setCurrentIndex(index);
  };

  const nextSlide = () => {
    const newIndex = (currentIndex + 1) % hotAssets.length;
    scrollToIndex(newIndex);
  };

  const prevSlide = () => {
    const newIndex = currentIndex === 0 ? hotAssets.length - 1 : currentIndex - 1;
    scrollToIndex(newIndex);
  };

  if (isLoading) {
    return (
      <section className="py-16 bg-gradient-to-b from-transparent to-purple-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-8">
            <Sparkles className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">Hot Assets</h2>
          </div>
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="w-80 flex-shrink-0 bg-white/5 border-white/10">
                <CardContent className="p-4 h-48 animate-pulse">
                  <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-white/10 rounded w-full mb-1" />
                  <div className="h-3 bg-white/10 rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-gradient-to-b from-transparent to-purple-900/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">Hot Assets</h2>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs">
              Trending
            </span>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={prevSlide}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextSlide}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Carousel */}
        <div className="relative">
          <div
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {hotAssets.map((asset) => (
              <Card
                key={asset.id}
                className="w-80 flex-shrink-0 bg-white/5 border-white/10 hover:bg-white/10 hover:border-purple-500/50 transition-all duration-300 snap-start group cursor-pointer"
              >
                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        asset.type === 'gene'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {asset.type === 'gene' ? 'Gene' : 'Capsule'}
                      </span>
                      <div className="flex items-center gap-1 text-amber-400">
                        <Star className="w-3 h-3 fill-current" />
                        <span className="text-xs font-medium">{asset.score}</span>
                      </div>
                    </div>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>

                  {/* Content */}
                  <h3 className="text-white font-semibold mb-2 group-hover:text-purple-400 transition-colors line-clamp-1">
                    {asset.name}
                  </h3>
                  <p className="text-gray-400 text-sm line-clamp-2 mb-3">
                    {asset.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {asset.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full bg-white/5 text-gray-400 text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/10">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{asset.author}</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {formatNumber(asset.downloads)}
                      </span>
                    </div>
                    <Link
                      href={`/marketplace?asset=${asset.id}`}
                      className="flex items-center gap-1 text-purple-400 text-xs hover:text-purple-300 transition-colors"
                    >
                      View
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Gradient Overlays */}
          <div className="absolute left-0 top-0 bottom-4 w-8 bg-gradient-to-r from-black to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-black to-transparent pointer-events-none" />
        </div>

        {/* Indicators */}
        <div className="flex justify-center gap-2 mt-4">
          {hotAssets.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-purple-500 w-6'
                  : 'bg-white/30 hover:bg-white/50'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* View All Link */}
        <div className="text-center mt-6">
          <Link
            href="/marketplace?sort=hot"
            className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm transition-colors"
          >
            View all trending assets
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
