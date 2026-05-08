'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Dna, FlaskConical, Star, Eye, Zap } from 'lucide-react';

interface AssetCardProps {
  id: string;
  name: string;
  description: string;
  type: 'gene' | 'capsule';
  tags: string[];
  gdiScore: number;
  author: string;
  views: number;
  calls: number;
  gepProtocol: boolean;
  onClick?: () => void;
}

export function AssetCard({
  name,
  description,
  type,
  tags,
  gdiScore,
  author,
  views,
  calls,
  gepProtocol,
  onClick,
}: AssetCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const TypeIcon = type === 'gene' ? Dna : FlaskConical;
  const typeColor = type === 'gene' ? 'text-purple-400' : 'text-cyan-400';
  const typeBg = type === 'gene' ? 'bg-purple-500/20' : 'bg-cyan-500/20';
  const glowColor = type === 'gene' ? 'rgba(139, 92, 246, 0.4)' : 'rgba(6, 182, 212, 0.4)';

  return (
    <div
      className={`relative transition-all duration-300 ${isHovered ? 'scale-[1.02]' : 'scale-100'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow effect */}
      <div
        className={`absolute -inset-1 rounded-xl opacity-0 transition-opacity duration-300 ${isHovered ? 'opacity-100' : ''}`}
        style={{
          background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)`,
          filter: 'blur(8px)',
        }}
      />
      <Card
        hover
        className={`cursor-pointer relative z-10 transition-all duration-300 ${
          isHovered
            ? 'border-purple-500/50 shadow-lg shadow-purple-500/20 bg-white/10'
            : ''
        }`}
        onClick={onClick}
      >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${typeBg}`}>
              <TypeIcon className={`w-5 h-5 ${typeColor}`} />
            </div>
            <div>
              <CardTitle className="text-base">{name}</CardTitle>
              <span className="text-xs text-gray-500">by {author}</span>
            </div>
          </div>
          {gepProtocol && (
            <span className="px-2 py-0.5 text-[10px] font-medium bg-green-500/20 text-green-400 rounded">
              GEP
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="line-clamp-2 mb-3">
          {description}
        </CardDescription>
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className={`px-2 py-0.5 text-xs rounded transition-all duration-200 ${
                isHovered
                  ? 'bg-purple-500/30 text-purple-300 scale-105'
                  : 'bg-white/5 text-gray-400'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              <span>{views.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              <span>{calls.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Star className={`w-4 h-4 ${gdiScore >= 0.7 ? 'text-yellow-400' : 'text-gray-500'}`} />
            <span className="text-sm font-medium">{(gdiScore * 100).toFixed(0)}</span>
          </div>
        </div>
      </CardFooter>
    </Card>
    </div>
  );
}

interface AssetStatsProps {
  totalAssets: number;
  totalCalls: number;
  todayCalls: number;
  gepAssets: number;
}

export function AssetStats({ totalAssets, totalCalls, todayCalls, gepAssets }: AssetStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <p className="text-2xl font-bold text-white">{totalAssets.toLocaleString()}</p>
        <p className="text-sm text-gray-400">PROMOTED</p>
      </div>
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <p className="text-2xl font-bold text-white">{totalCalls.toLocaleString()}</p>
        <p className="text-sm text-gray-400">TOTAL CALLS</p>
      </div>
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <p className="text-2xl font-bold text-white">{todayCalls.toLocaleString()}</p>
        <p className="text-sm text-gray-400">TODAY</p>
      </div>
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <p className="text-2xl font-bold text-green-400">{gepAssets.toLocaleString()}</p>
        <p className="text-sm text-gray-400">GEP PROTOCOL</p>
      </div>
    </div>
  );
}
