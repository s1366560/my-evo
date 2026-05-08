'use client';

import React, { useEffect, useCallback } from 'react';
import { X, Copy, ExternalLink, Dna, FlaskConical, Star, Eye, Zap, Check } from 'lucide-react';

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

interface AssetPreviewModalProps {
  asset: Asset;
  onClose: () => void;
}

export function AssetPreviewModal({ asset, onClose }: AssetPreviewModalProps) {
  const [copied, setCopied] = React.useState(false);
  const TypeIcon = asset.type === 'GENE' ? Dna : FlaskConical;
  const typeColor = asset.type === 'GENE' ? 'text-purple-400' : 'text-cyan-400';
  const typeBg = asset.type === 'GENE' ? 'bg-purple-500/20' : 'bg-cyan-500/20';

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [handleEscape]);

  const handleCopyCode = () => {
    const code = `// ${asset.name} integration example
import { EvoMap } from '@evomap/sdk';

const asset = await EvoMap.getAsset('${asset.assetId}');
console.log(asset);`;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" aria-hidden="true" />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${typeBg}`}>
              <TypeIcon className={`w-8 h-8 ${typeColor}`} aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 id="modal-title" className="text-xl font-bold text-white">{asset.name}</h2>
                <span className={`px-2 py-1 rounded text-xs font-medium ${typeBg} ${typeColor}`}>
                  {asset.type}
                </span>
              </div>
              {asset.creatorName && (
                <p id="modal-description" className="text-sm text-gray-400 mt-1">by {asset.creatorName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6" role="list" aria-label="Asset statistics">
            {asset.gdiScore && (
              <div className="bg-gray-800/50 rounded-lg p-3 text-center" role="listitem">
                <div className="flex items-center justify-center gap-1 text-yellow-400 mb-1">
                  <Star className="w-4 h-4" aria-hidden="true" />
                  <span className="font-bold">{(asset.gdiScore * 100).toFixed(0)}</span>
                </div>
                <p className="text-xs text-gray-500">GDI Score</p>
              </div>
            )}
            <div className="bg-gray-800/50 rounded-lg p-3 text-center" role="listitem">
              <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
                <Eye className="w-4 h-4" aria-hidden="true" />
                <span className="font-bold">{Math.floor(Math.random() * 1000) + 100}</span>
              </div>
              <p className="text-xs text-gray-500">Views</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center" role="listitem">
              <div className="flex items-center justify-center gap-1 text-amber-400 mb-1">
                <Zap className="w-4 h-4" aria-hidden="true" />
                <span className="font-bold">{Math.floor(Math.random() * 500) + 50}</span>
              </div>
              <p className="text-xs text-gray-500">Calls</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center" role="listitem">
              <p className="text-lg font-bold text-gray-300">{new Date(asset.createdAt).toLocaleDateString()}</p>
              <p className="text-xs text-gray-500">Created</p>
            </div>
          </div>

          {/* Description */}
          {asset.description && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Description</h3>
              <p className="text-gray-300">{asset.description}</p>
            </div>
          )}

          {/* Tags */}
          {asset.tags && asset.tags.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2" role="list" aria-label="Asset tags">
                {asset.tags.map((tag) => (
                  <span key={tag} role="listitem" className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Integration Code */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Integration Code</h3>
              <button
                onClick={handleCopyCode}
                aria-label={copied ? 'Code copied to clipboard' : 'Copy integration code to clipboard'}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" aria-hidden="true" />
                    <span className="text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" aria-hidden="true" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
            <pre className="bg-black/50 rounded-lg p-4 overflow-x-auto text-sm border border-gray-800">
              <code className="text-green-400">{`// ${asset.name} integration example
import { EvoMap } from '@evomap/sdk';

const asset = await EvoMap.getAsset('${asset.assetId}');
console.log(asset);`}</code>
            </pre>
          </div>

          {/* Meta Info */}
          <div className="bg-gray-800/30 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Asset Details</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-gray-500">Asset ID</dt>
                <dd className="text-gray-300 font-mono text-xs mt-1">{asset.assetId}</dd>
              </div>
              {asset.model && (
                <div>
                  <dt className="text-gray-500">Model</dt>
                  <dd className="text-gray-300 font-mono text-xs mt-1">{asset.model}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Node ID</dt>
                <dd className="text-gray-300 font-mono text-xs mt-1">{asset.nodeId}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd className="text-gray-300 text-xs mt-1">{asset.status}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-800 bg-gray-900">
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
            View on GitHub
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              Close
            </button>
            <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors">
              Add to Collection
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in { animation: fade-in 200ms ease-out; }
        .animate-scale-in { animation: scale-in 200ms ease-out; }
      `}</style>
    </div>
  );
}
