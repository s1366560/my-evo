'use client';

import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Sparkles, CheckCircle, AlertCircle, TrendingUp, Layers, Users, Zap } from 'lucide-react';

interface GDIScorePreviewProps {
  name: string;
  description: string;
  content: string;
  tags: string[];
  license: string;
  type: 'gene' | 'capsule';
}

interface ScoreBreakdown {
  overall: number;
  correctness: number;
  diversity: number;
  composability: number;
  helpfulness: number;
}

function calculateLocalScore(data: GDIScorePreviewProps): ScoreBreakdown {
  // Calculate correctness (30%)
  let correctness = 0.5;
  if (data.description && data.description.length > 50) correctness += 0.1;
  if (data.type === 'gene' && data.content) {
    correctness += 0.15;
    if (/function|class|const|let|return|import|export|async|await/.test(data.content)) {
      correctness += 0.1;
    }
  } else if (data.type === 'capsule' && data.content) {
    correctness += 0.15;
    if (data.content.length > 100) correctness += 0.1;
  }
  if (data.license && data.license !== 'CLOSED') correctness += 0.05;
  correctness = Math.min(correctness, 1.0);

  // Calculate diversity (20%)
  let diversity = 0.3;
  const uniqueTags = new Set(data.tags.map(t => t.toLowerCase()));
  if (uniqueTags.size >= 3) diversity += 0.3;
  else if (uniqueTags.size >= 1) diversity += uniqueTags.size * 0.1;
  const genericTags = ['ai', 'ml', 'nlp', 'general', 'basic'];
  const specificTags = data.tags.filter(t => !genericTags.includes(t.toLowerCase()));
  if (specificTags.length > 0) diversity += Math.min(specificTags.length * 0.05, 0.2);
  diversity = Math.min(diversity, 1.0);

  // Calculate composability (25%)
  let composability = 0.4;
  const contentSize = data.content?.length || 0;
  if (contentSize > 200) composability += 0.25;
  if (contentSize > 500) composability += 0.15;
  composability = Math.min(composability, 1.0);

  // Calculate helpfulness (25%)
  let helpfulness = 0.6;
  if (data.name.length > 5 && !/[0-9]{4,}/.test(data.name)) helpfulness += 0.1;
  if (data.description && data.description.length > 100) helpfulness += 0.1;
  if (data.tags.length > 0) helpfulness += 0.1;
  helpfulness = Math.min(helpfulness, 1.0);

  // Calculate overall weighted score
  const overall =
    0.30 * correctness +
    0.20 * diversity +
    0.25 * composability +
    0.25 * helpfulness;

  return {
    overall: Math.round(overall * 100) / 100,
    correctness: Math.round(correctness * 100) / 100,
    diversity: Math.round(diversity * 100) / 100,
    composability: Math.round(composability * 100) / 100,
    helpfulness: Math.round(helpfulness * 100) / 100,
  };
}

function getScoreColor(score: number): string {
  if (score >= 0.7) return 'text-emerald-400';
  if (score >= 0.5) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreBgColor(score: number): string {
  if (score >= 0.7) return 'bg-emerald-500';
  if (score >= 0.5) return 'bg-amber-500';
  return 'bg-red-500';
}

function getScoreStatus(score: number): { label: string; color: string } {
  if (score >= 0.7) return { label: 'Excellent', color: 'text-emerald-400' };
  if (score >= 0.5) return { label: 'Good', color: 'text-amber-400' };
  return { label: 'Needs Improvement', color: 'text-red-400' };
}

export function GDIScorePreview({ name, description, content, tags, license, type }: GDIScorePreviewProps) {
  const score = useMemo(() => calculateLocalScore({ name, description, content, tags, license, type }), [name, description, content, tags, license, type]);
  const status = getScoreStatus(score.overall);
  const hasEnoughData = name.length >= 3 && description.length >= 10 && content.length >= 20;

  const metrics = [
    { label: 'Correctness', value: score.correctness, weight: '30%', icon: CheckCircle },
    { label: 'Diversity', value: score.diversity, weight: '20%', icon: Layers },
    { label: 'Composability', value: score.composability, weight: '25%', icon: Users },
    { label: 'Helpfulness', value: score.helpfulness, weight: '25%', icon: TrendingUp },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-white" />
          <h3 className="font-semibold text-white text-sm">GDI Score Preview</h3>
        </div>
      </div>

      <CardContent className="p-4">
        {!hasEnoughData ? (
          <div className="text-center py-6">
            <AlertCircle className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              Fill in more fields to see your GDI score preview
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Need: name (3+), description (10+), content (20+)
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Overall Score */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-4 border-purple-500 bg-black/30">
                <span className={`text-3xl font-bold ${getScoreColor(score.overall)}`}>
                  {Math.round(score.overall * 100)}
                </span>
              </div>
              <div className={`text-sm font-medium mt-2 ${status.color}`}>
                {status.label}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Genetic Diversity Index
              </p>
            </div>

            {/* Score Breakdown */}
            <div className="space-y-2">
              {metrics.map((metric) => (
                <div key={metric.label} className="flex items-center gap-3">
                  <div className="w-20 text-xs text-gray-400 flex items-center gap-1">
                    <metric.icon className="w-3 h-3" />
                    {metric.label}
                  </div>
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getScoreBgColor(metric.value)}`}
                      style={{ width: `${metric.value * 100}%` }}
                    />
                  </div>
                  <div className={`w-8 text-xs font-medium text-right ${getScoreColor(metric.value)}`}>
                    {Math.round(metric.value * 100)}
                  </div>
                  <div className="w-6 text-xs text-gray-500 text-right">{metric.weight}</div>
                </div>
              ))}
            </div>

            {/* Tips */}
            <div className="border-t border-white/10 pt-3">
              <h4 className="text-xs font-medium text-gray-400 mb-2">Tips to improve:</h4>
              <ul className="space-y-1 text-xs text-gray-500">
                {score.correctness < 0.7 && (
                  <li className="flex items-start gap-1">
                    <Zap className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                    Add more detailed content with code patterns
                  </li>
                )}
                {score.diversity < 0.6 && (
                  <li className="flex items-start gap-1">
                    <Zap className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                    Add 3+ specific tags (avoid generic ones)
                  </li>
                )}
                {score.composability < 0.6 && (
                  <li className="flex items-start gap-1">
                    <Zap className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                    Expand your content to 500+ characters
                  </li>
                )}
                {score.helpfulness < 0.7 && (
                  <li className="flex items-start gap-1">
                    <Zap className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                    Write a description over 100 characters
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
