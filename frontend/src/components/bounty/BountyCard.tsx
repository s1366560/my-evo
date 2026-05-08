'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Target, Clock, User, DollarSign, Tag, CheckCircle, Circle, Award } from 'lucide-react';

interface BountyCardProps {
  id: string;
  title: string;
  description: string;
  tags: string[];
  author: string;
  createdAt: string;
  credits: number;
  status: 'open' | 'closed' | 'in_progress';
  taskType: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  onClaim?: () => void;
  onView?: () => void;
}

export function BountyCard({
  title,
  description,
  tags,
  author,
  createdAt,
  credits,
  status,
  taskType,
  difficulty,
  onClaim,
  onView,
}: BountyCardProps) {
  const isOpen = status === 'open';
  const difficultyColor = {
    beginner: 'bg-green-500/20 text-green-400',
    intermediate: 'bg-yellow-500/20 text-yellow-400',
    advanced: 'bg-red-500/20 text-red-400',
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card hover className="group">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base mb-1">{title}</CardTitle>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <User className="w-3.5 h-3.5" />
              <span>{author}</span>
              <span>•</span>
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDate(createdAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {difficulty && (
              <span className={`px-2 py-0.5 text-xs rounded ${difficultyColor[difficulty]}`}>
                {difficulty}
              </span>
            )}
            <span
              className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded ${
                isOpen
                  ? 'bg-green-500/20 text-green-400'
                  : status === 'in_progress'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {isOpen ? <Circle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
              {status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="line-clamp-2 mb-3">
          {description}
        </CardDescription>
        <div className="flex flex-wrap gap-1.5">
          <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">
            {taskType}
          </span>
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs bg-white/5 text-gray-400 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1 text-amber-400">
            <DollarSign className="w-4 h-4" />
            <span className="font-medium">{credits}</span>
            <span className="text-xs text-gray-500 ml-1">credits</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onView}
            >
              View
            </Button>
            {isOpen && (
              <Button
                variant="default"
                size="sm"
                onClick={onClaim}
              >
                Claim
              </Button>
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

interface BountyStatsProps {
  total: number;
  withBounty: number;
  totalReward: number;
}

export function BountyStats({ total, withBounty, totalReward }: BountyStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="bg-white/5 rounded-lg p-4 border border-white/10 text-center">
        <p className="text-3xl font-bold text-white">{total}</p>
        <p className="text-sm text-gray-400">TOTAL</p>
      </div>
      <div className="bg-white/5 rounded-lg p-4 border border-white/10 text-center">
        <p className="text-3xl font-bold text-green-400">{withBounty}</p>
        <p className="text-sm text-gray-400">WITH BOUNTY</p>
      </div>
      <div className="bg-white/5 rounded-lg p-4 border border-white/10 text-center">
        <p className="text-3xl font-bold text-amber-400">{totalReward.toLocaleString()}</p>
        <p className="text-sm text-gray-400">TOTAL REWARD</p>
      </div>
    </div>
  );
}
