'use client';

import React, { useState, useCallback } from 'react';
import { X, Download, Image, FileJson, FileCode, Copy, Check } from 'lucide-react';

interface ExportOptions {
  format: 'png' | 'svg' | 'json';
  scale: 1 | 2 | 3 | 4;
  includeBackground: boolean;
  backgroundColor: string;
  padding: number;
  filename: string;
}

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  onCopyToClipboard?: () => void;
  currentFilename?: string;
}

const defaultOptions: ExportOptions = {
  format: 'png',
  scale: 2,
  includeBackground: true,
  backgroundColor: '#0a0a0f',
  padding: 20,
  filename: `evo-map-${new Date().toISOString().split('T')[0]}`,
};

const formatOptions = [
  { value: 'png', label: 'PNG', icon: Image, desc: 'Best for sharing, raster image' },
  { value: 'svg', label: 'SVG', icon: FileCode, desc: 'Vector format, scalable' },
  { value: 'json', label: 'JSON', icon: FileJson, desc: 'Raw data for reimport' },
];

const scaleOptions = [
  { value: 1, label: '1x', desc: 'Standard' },
  { value: 2, label: '2x', desc: 'Retina display' },
  { value: 3, label: '3x', desc: 'High DPI' },
  { value: 4, label: '4x', desc: 'Ultra high DPI' },
];

export function ExportDialog({
  isOpen,
  onClose,
  onExport,
  onCopyToClipboard,
  currentFilename = 'evo-map',
}: ExportDialogProps) {
  const [options, setOptions] = useState<ExportOptions>({
    ...defaultOptions,
    filename: currentFilename,
  });
  const [copied, setCopied] = useState(false);

  const handleExport = useCallback(() => {
    onExport(options);
    onClose();
  }, [options, onExport, onClose]);

  const handleCopyToClipboard = useCallback(async () => {
    if (onCopyToClipboard) {
      onCopyToClipboard();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [onCopyToClipboard]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" aria-hidden="true" />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Download className="w-5 h-5 text-purple-400" aria-hidden="true" />
            </div>
            <h2 id="export-dialog-title" className="text-lg font-semibold text-white">
              Export Map
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Format Selection */}
          <fieldset>
            <legend className="text-sm font-medium text-gray-400 mb-3">
              Format
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {formatOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = options.format === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setOptions({ ...options, format: option.value as ExportOptions['format'] })}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-500/20 text-white'
                        : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <Icon className="w-5 h-5" aria-hidden="true" />
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="text-xs opacity-70">{option.desc}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Scale Selection (PNG only) */}
          {options.format === 'png' && (
            <fieldset>
              <legend className="text-sm font-medium text-gray-400 mb-3">
                Resolution
              </legend>
              <div className="flex gap-2">
                {scaleOptions.map((option) => {
                  const isSelected = options.scale === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setOptions({ ...options, scale: option.value as ExportOptions['scale'] })}
                      className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                        isSelected
                          ? 'border-purple-500 bg-purple-500/20 text-white'
                          : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                      }`}
                      aria-pressed={isSelected}
                    >
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="text-xs opacity-70">{option.desc}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* Background Toggle (PNG only) */}
          {options.format === 'png' && (
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-300">Include background</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={options.includeBackground}
                  onClick={() => setOptions({ ...options, includeBackground: !options.includeBackground })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    options.includeBackground ? 'bg-purple-600' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      options.includeBackground ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>

              {options.includeBackground && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-400">Color</label>
                  <input
                    type="color"
                    value={options.backgroundColor}
                    onChange={(e) => setOptions({ ...options, backgroundColor: e.target.value })}
                    className="w-10 h-8 rounded cursor-pointer"
                    aria-label="Background color"
                  />
                  <input
                    type="text"
                    value={options.backgroundColor}
                    onChange={(e) => setOptions({ ...options, backgroundColor: e.target.value })}
                    className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 font-mono"
                    placeholder="#000000"
                    aria-label="Background color hex"
                  />
                </div>
              )}
            </div>
          )}

          {/* Padding */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-400">Padding</label>
              <span className="text-sm text-gray-300">{options.padding}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={options.padding}
              onChange={(e) => setOptions({ ...options, padding: parseInt(e.target.value) })}
              className="w-full accent-purple-600"
              aria-label="Export padding in pixels"
            />
          </div>

          {/* Filename */}
          <div className="space-y-2">
            <label htmlFor="export-filename" className="text-sm font-medium text-gray-400">
              Filename
            </label>
            <div className="flex items-center gap-2">
              <input
                id="export-filename"
                type="text"
                value={options.filename}
                onChange={(e) => setOptions({ ...options, filename: e.target.value })}
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200"
                placeholder="evo-map"
              />
              <span className="text-gray-500 text-sm">.{options.format}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-800 bg-gray-900">
          {onCopyToClipboard && (
            <button
              onClick={handleCopyToClipboard}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy to Clipboard</span>
                </>
              )}
            </button>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-scale-in { animation: scale-in 200ms ease-out; }
      `}</style>
    </div>
  );
}

export default ExportDialog;
