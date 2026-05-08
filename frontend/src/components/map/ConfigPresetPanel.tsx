'use client';

import React, { useState, useEffect } from 'react';
import { Bookmark, Save, Trash2, Download, Upload, X, Check } from 'lucide-react';

export interface MapConfig {
  layout: 'force' | 'radial' | 'hierarchical';
  nodeSize: 'score' | 'fixed' | 'calls';
  edgeStyle: 'line' | 'curve' | 'arrow';
  colorScheme: 'default' | 'heatmap' | 'categorical';
  showLabels: boolean;
  showScores: boolean;
  showEdges: boolean;
  animation: 'none' | 'gentle' | 'dynamic';
}

interface Preset {
  name: string;
  config: MapConfig;
  createdAt?: string;
}

interface ConfigPresetPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: MapConfig;
  onLoadPreset: (config: MapConfig) => void;
  onExportPresets?: (presets: Preset[]) => void;
  onImportPresets?: (presets: Preset[]) => void;
}

const STORAGE_KEY = 'evo-map-config-presets';

export function ConfigPresetPanel({
  isOpen,
  onClose,
  currentConfig,
  onLoadPreset,
  onExportPresets,
  onImportPresets,
}: ConfigPresetPanelProps) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'presets' | 'create'>('presets');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load presets from localStorage on mount or when opened
  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setPresets(JSON.parse(saved));
        else setPresets([]);
      } catch {
        setPresets([]);
      }
    }
  }, [isOpen]);

  const saveToStorage = (newPresets: Preset[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPresets));
    } catch {
      console.error('Failed to save presets to localStorage');
    }
  };

  const handleSavePreset = (name?: string) => {
    const presetName = name || newPresetName.trim();
    if (!presetName) return;

    const newPreset: Preset = {
      name: presetName,
      config: { ...currentConfig },
      createdAt: new Date().toISOString(),
    };

    const updated = [
      ...presets.filter((p) => p.name !== presetName),
      newPreset,
    ];
    setPresets(updated);
    saveToStorage(updated);
    setNewPresetName('');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleDeletePreset = (name: string) => {
    const updated = presets.filter((p) => p.name !== name);
    setPresets(updated);
    saveToStorage(updated);
  };

  const handleLoadPreset = (preset: Preset) => {
    onLoadPreset(preset.config);
    onClose();
  };

  const handleExportAll = () => {
    const data = JSON.stringify(presets, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evo-map-presets-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onExportPresets?.(presets);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as Preset[];
        if (!Array.isArray(data)) throw new Error('Invalid format');
        setPresets(data);
        saveToStorage(data);
        onImportPresets?.(data);
      } catch {
        alert('Failed to import presets. Invalid file format.');
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
        aria-labelledby="preset-panel-title"
        className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Bookmark className="w-5 h-5 text-purple-400" aria-hidden="true" />
            </div>
            <h2 id="preset-panel-title" className="text-lg font-semibold text-white">
              Configuration Presets
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close preset panel"
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800" role="tablist" aria-label="Preset panel tabs">
          <button
            role="tab"
            aria-selected={activeTab === 'presets'}
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'presets'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Bookmark className="w-4 h-4 inline mr-2" aria-hidden="true" />
            Saved Presets ({presets.length})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'create'}
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'create'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Save className="w-4 h-4 inline mr-2" aria-hidden="true" />
            Save Current
          </button>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[320px] max-h-[60vh] overflow-y-auto">
          {activeTab === 'presets' && (
            <div className="space-y-3">
              {/* Import/Export actions */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                <span className="text-sm text-gray-400">{presets.length} preset{presets.length !== 1 ? 's' : ''} saved</span>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    className="hidden"
                    aria-label="Import presets from JSON file"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                    title="Import presets"
                  >
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    Import
                  </button>
                  {presets.length > 0 && (
                    <button
                      onClick={handleExportAll}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                      title="Export all presets"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      Export
                    </button>
                  )}
                </div>
              </div>

              {/* Preset list */}
              {presets.length === 0 ? (
                <div className="text-center py-12">
                  <Bookmark className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No presets saved yet.</p>
                  <p className="text-gray-500 text-sm mt-1">Go to &quot;Save Current&quot; to create one.</p>
                </div>
              ) : (
                <ul className="space-y-2" aria-label="Configuration presets">
                  {presets.map((preset) => (
                    <li key={preset.name}>
                      <div className="flex items-center gap-3 p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors group">
                        <Bookmark className="w-4 h-4 text-purple-400 flex-shrink-0" aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{preset.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {preset.config.layout} &bull; {preset.config.nodeSize} &bull; {preset.config.animation}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleLoadPreset(preset)}
                            className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                            aria-label={`Load preset: ${preset.name}`}
                          >
                            Load
                          </button>
                          <button
                            onClick={() => handleDeletePreset(preset.name)}
                            className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg transition-colors"
                            aria-label={`Delete preset: ${preset.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'create' && (
            <div className="space-y-6">
              {/* Current config summary */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Current Configuration</h3>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-gray-500">Layout</dt><dd className="text-gray-300 capitalize">{currentConfig.layout}</dd></div>
                  <div><dt className="text-gray-500">Node Size</dt><dd className="text-gray-300 capitalize">{currentConfig.nodeSize}</dd></div>
                  <div><dt className="text-gray-500">Edge Style</dt><dd className="text-gray-300 capitalize">{currentConfig.edgeStyle}</dd></div>
                  <div><dt className="text-gray-500">Color</dt><dd className="text-gray-300 capitalize">{currentConfig.colorScheme}</dd></div>
                  <div><dt className="text-gray-500">Animation</dt><dd className="text-gray-300 capitalize">{currentConfig.animation}</dd></div>
                  <div><dt className="text-gray-500">Show</dt><dd className="text-gray-300">
                    {[currentConfig.showLabels && 'Labels', currentConfig.showScores && 'Scores', currentConfig.showEdges && 'Edges'].filter(Boolean).join(', ') || 'None'}
                  </dd></div>
                </dl>
              </div>

              {/* Save input */}
              <div className="space-y-3">
                <label htmlFor="preset-name-input" className="block text-sm font-medium text-gray-400">
                  Save as preset
                </label>
                <div className="flex gap-2">
                  <input
                    id="preset-name-input"
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="e.g. My Science Map, Default View..."
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newPresetName.trim()) handleSavePreset();
                    }}
                    maxLength={50}
                  />
                  <button
                    onClick={() => handleSavePreset()}
                    disabled={!newPresetName.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                    aria-label="Save current configuration as preset"
                  >
                    {saveSuccess ? (
                      <>
                        <Check className="w-4 h-4 text-green-400" aria-hidden="true" />
                        <span className="text-green-400">Saved!</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" aria-hidden="true" />
                        Save
                      </>
                    )}
                  </button>
                </div>
                {newPresetName.trim() && (
                  <p className="text-xs text-gray-500">
                    Will save as: <span className="text-purple-400">&quot;{newPresetName.trim()}&quot;</span>
                  </p>
                )}
              </div>

              {/* Existing preset names hint */}
              {presets.length > 0 && (
                <div className="pt-3 border-t border-gray-800">
                  <p className="text-xs text-gray-500 mb-2">Existing presets (saving will overwrite):</p>
                  <div className="flex flex-wrap gap-2">
                    {presets.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => {
                          setNewPresetName(p.name);
                          handleSavePreset(p.name);
                        }}
                        className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                        title={`Overwrite preset "${p.name}"`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfigPresetPanel;
