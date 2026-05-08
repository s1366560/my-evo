'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { ChevronLeft, ChevronRight, Database, Layers, Palette, Share2, Download, Upload, Save, Trash2, Bookmark } from 'lucide-react';

interface MapConfig {
  layout: 'force' | 'radial' | 'hierarchical';
  nodeSize: 'score' | 'fixed' | 'calls';
  edgeStyle: 'line' | 'curve' | 'arrow';
  colorScheme: 'default' | 'heatmap' | 'categorical';
  showLabels: boolean;
  showScores: boolean;
  showEdges: boolean;
  animation: 'none' | 'gentle' | 'dynamic';
}

interface DataConfigPanelProps {
  onConfigChange?: (config: MapConfig) => void;
  onImportData?: () => void;
  onExportData?: () => void;
  onShare?: () => void;
}

const defaultConfig: MapConfig = {
  layout: 'force',
  nodeSize: 'score',
  edgeStyle: 'line',
  colorScheme: 'default',
  showLabels: true,
  showScores: true,
  showEdges: true,
  animation: 'gentle',
};

export function DataConfigPanel({ onConfigChange, onImportData, onExportData, onShare }: DataConfigPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<MapConfig>(defaultConfig);
  const [activeSection, setActiveSection] = useState<'data' | 'style' | 'display'>('data');
  const [presets, setPresets] = useState<{ name: string; config: MapConfig }[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [showPresetInput, setShowPresetInput] = useState(false);

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('map-config-presets');
      if (saved) {
        setPresets(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load presets:', e);
    }
  }, []);

  const savePreset = (name: string) => {
    const newPresets = [...presets.filter(p => p.name !== name), { name, config }];
    setPresets(newPresets);
    try {
      localStorage.setItem('map-config-presets', JSON.stringify(newPresets));
    } catch (e) {
      console.error('Failed to save presets:', e);
    }
    setNewPresetName('');
    setShowPresetInput(false);
  };

  const loadPreset = (preset: { name: string; config: MapConfig }) => {
    setConfig(preset.config);
    onConfigChange?.(preset.config);
  };

  const deletePreset = (name: string) => {
    const newPresets = presets.filter(p => p.name !== name);
    setPresets(newPresets);
    try {
      localStorage.setItem('map-config-presets', JSON.stringify(newPresets));
    } catch (e) {
      console.error('Failed to delete preset:', e);
    }
  };

  const updateConfig = (key: keyof MapConfig, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-l-lg transition-all ${isOpen ? 'translate-x-64' : ''}`}
      >
        {isOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>

      <div className={`fixed right-0 top-0 h-full w-64 bg-black/90 backdrop-blur-lg border-l border-white/10 z-30 transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-white/10">
            <h2 className="font-semibold text-white">Configuration</h2>
          </div>

          <div className="flex border-b border-white/10">
            {(['data', 'style', 'display'] as const).map((section) => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`flex-1 py-2 text-xs font-medium ${activeSection === section ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400'}`}
              >
                {section === 'data' && <Database className="w-4 h-4 mx-auto mb-1" />}
                {section === 'style' && <Palette className="w-4 h-4 mx-auto mb-1" />}
                {section === 'display' && <Layers className="w-4 h-4 mx-auto mb-1" />}
                {section.charAt(0).toUpperCase() + section.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeSection === 'data' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full" onClick={onImportData}>
                    <Upload className="w-4 h-4 mr-2" />Import
                  </Button>
                  <Button variant="outline" size="sm" className="w-full" onClick={onExportData}>
                    <Download className="w-4 h-4 mr-2" />Export
                  </Button>
                  <Button variant="outline" size="sm" className="w-full" onClick={onShare}>
                    <Share2 className="w-4 h-4 mr-2" />Share
                  </Button>
                </div>
              </div>
            )}

            {activeSection === 'style' && (
              <div className="space-y-4">
                <Select label="Layout" options={[
                  { value: 'force', label: 'Force Directed' },
                  { value: 'radial', label: 'Radial' },
                  { value: 'hierarchical', label: 'Hierarchical' },
                ]} value={config.layout} onChange={(e) => updateConfig('layout', e.target.value)} />
                <Select label="Node Size" options={[
                  { value: 'score', label: 'By Score' },
                  { value: 'fixed', label: 'Fixed' },
                  { value: 'calls', label: 'By Calls' },
                ]} value={config.nodeSize} onChange={(e) => updateConfig('nodeSize', e.target.value)} />
                <Select label="Edge Style" options={[
                  { value: 'line', label: 'Line' },
                  { value: 'curve', label: 'Curve' },
                  { value: 'arrow', label: 'Arrow' },
                ]} value={config.edgeStyle} onChange={(e) => updateConfig('edgeStyle', e.target.value)} />
                <Select label="Color" options={[
                  { value: 'default', label: 'Default' },
                  { value: 'heatmap', label: 'Heatmap' },
                  { value: 'categorical', label: 'Categorical' },
                ]} value={config.colorScheme} onChange={(e) => updateConfig('colorScheme', e.target.value)} />

                {/* Presets Section */}
                <div className="pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs text-gray-400">Presets</label>
                    <button
                      onClick={() => setShowPresetInput(!showPresetInput)}
                      className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" /> Save
                    </button>
                  </div>

                  {showPresetInput && (
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        placeholder="Preset name"
                        className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white placeholder-gray-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newPresetName.trim()) {
                            savePreset(newPresetName.trim());
                          }
                        }}
                      />
                      <button
                        onClick={() => newPresetName.trim() && savePreset(newPresetName.trim())}
                        className="px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs"
                      >
                        Save
                      </button>
                    </div>
                  )}

                  {presets.length > 0 ? (
                    <div className="space-y-1">
                      {presets.map((preset) => (
                        <div key={preset.name} className="flex items-center gap-1">
                          <button
                            onClick={() => loadPreset(preset)}
                            className="flex-1 text-left px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded flex items-center gap-1"
                          >
                            <Bookmark className="w-3 h-3 text-purple-400" />
                            {preset.name}
                          </button>
                          <button
                            onClick={() => deletePreset(preset.name)}
                            className="p-1 text-gray-500 hover:text-red-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">No saved presets</p>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'display' && (
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={config.showLabels} onChange={(e) => updateConfig('showLabels', e.target.checked)} className="w-4 h-4" />
                  <span className="text-sm text-gray-300">Labels</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={config.showScores} onChange={(e) => updateConfig('showScores', e.target.checked)} className="w-4 h-4" />
                  <span className="text-sm text-gray-300">Scores</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={config.showEdges} onChange={(e) => updateConfig('showEdges', e.target.checked)} className="w-4 h-4" />
                  <span className="text-sm text-gray-300">Edges</span>
                </label>
                <div className="pt-2 border-t border-white/10">
                  <label className="block text-xs text-gray-400 mb-2">Animation</label>
                  <Select options={[
                    { value: 'none', label: 'None' },
                    { value: 'gentle', label: 'Gentle' },
                    { value: 'dynamic', label: 'Dynamic' },
                  ]} value={config.animation} onChange={(e) => updateConfig('animation', e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-white/10">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setConfig(defaultConfig)}>
              Reset Defaults
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
