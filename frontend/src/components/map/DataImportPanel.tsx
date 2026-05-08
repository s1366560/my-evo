'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileJson, FileSpreadsheet, X, AlertCircle, CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react';

interface Node {
  id: string;
  label: string;
  type: 'gene' | 'capsule' | 'recipe';
  score: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface Edge {
  source: string;
  target: string;
  strength: number;
}

interface DataImportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (nodes: Node[], edges: Edge[]) => void;
  canvasWidth?: number;
  canvasHeight?: number;
}

type Step = 'upload' | 'preview' | 'confirm';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_NODES = 5000;

export function DataImportPanel({
  isOpen,
  onClose,
  onImportComplete,
  canvasWidth = 800,
  canvasHeight = 600,
}: DataImportPanelProps) {
  const [step, setStep] = useState<Step>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [parsedNodes, setParsedNodes] = useState<Node[]>([]);
  const [parsedEdges, setParsedEdges] = useState<Edge[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset on open
  React.useEffect(() => {
    if (isOpen) {
      setStep('upload');
      setError(null);
      setParsedNodes([]);
      setParsedEdges([]);
    }
  }, [isOpen]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) processFile(files[0]);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) processFile(files[0]);
  }, []);

  const processFile = useCallback((file: File) => {
    setError(null);
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['json', 'csv', 'tsv'].includes(ext || '')) {
      setError('Use JSON, CSV, or TSV files');
      return;
    }

    setFileType(ext);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        if (ext === 'json') {
          const data = JSON.parse(content);
          if (!data.nodes || !Array.isArray(data.nodes)) {
            setError('Invalid JSON. Need { nodes: [], edges: [] }');
            return;
          }
          const nodes: Node[] = data.nodes.map((n: Partial<Node>, i: number) => ({
            id: n.id || `node-${i}`,
            label: n.label || `Node ${i}`,
            type: (n.type as 'gene' | 'capsule' | 'recipe') || 'gene',
            score: n.score ?? 50,
            x: n.x ?? Math.random() * (canvasWidth - 100) + 50,
            y: n.y ?? Math.random() * (canvasHeight - 100) + 50,
            vx: 0,
            vy: 0,
          }));
          setParsedNodes(nodes.slice(0, MAX_NODES));
          setParsedEdges((data.edges || []).slice(0, 10000));
          setStep('preview');
        } else {
          // CSV/TSV
          const delimiter = ext === 'tsv' ? '\t' : ',';
          const lines = content.trim().split('\n');
          if (lines.length < 2) { setError('Need header + data rows'); return; }
          
          const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
          const idIdx = headers.indexOf('id');
          const labelIdx = headers.indexOf('label') !== -1 ? headers.indexOf('label') : headers.indexOf('name');
          const typeIdx = headers.indexOf('type');
          const scoreIdx = headers.indexOf('score');

          if (idIdx === -1 || labelIdx === -1) {
            setError('CSV needs "id" and "label" columns');
            return;
          }

          const nodes: Node[] = lines.slice(1).map((line, i) => {
            const cols = line.split(delimiter);
            return {
              id: cols[idIdx]?.trim() || `node-${i}`,
              label: cols[labelIdx]?.trim() || `Node ${i}`,
              type: (typeIdx >= 0 ? cols[typeIdx]?.trim().toLowerCase() : 'gene') as 'gene' | 'capsule' | 'recipe',
              score: scoreIdx >= 0 ? parseInt(cols[scoreIdx]) || 50 : 50,
              x: Math.random() * (canvasWidth - 100) + 50,
              y: Math.random() * (canvasHeight - 100) + 50,
              vx: 0,
              vy: 0,
            };
          }).slice(0, MAX_NODES);

          // Create sequential edges
          const edges: Edge[] = [];
          for (let i = 0; i < nodes.length - 1; i++) {
            edges.push({ source: nodes[i].id, target: nodes[i + 1].id, strength: 0.5 });
          }

          setParsedNodes(nodes);
          setParsedEdges(edges);
          setStep('preview');
        }
      } catch {
        setError('Failed to parse file');
      }
    };
    reader.readAsText(file);
  }, [canvasWidth, canvasHeight]);

  const handleConfirm = () => {
    onImportComplete(parsedNodes, parsedEdges);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 id="import-dialog-title" className="text-lg font-semibold text-white">
            Import Data
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragging ? 'border-purple-500 bg-purple-500/20' : 'border-gray-600 hover:border-gray-500'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept=".json,.csv,.tsv" onChange={handleFileSelect} className="hidden" />
                <Upload className={`w-12 h-12 mx-auto mb-3 ${isDragging ? 'text-purple-400' : 'text-gray-400'}`} />
                <p className="text-white font-medium">Drop file or click to browse</p>
                <p className="text-sm text-gray-400 mt-1">JSON, CSV, or TSV formats</p>
              </div>

              {/* Format cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <FileJson className="w-6 h-6 mx-auto mb-1 text-purple-400" />
                  <p className="text-xs text-white">JSON</p>
                  <p className="text-xs text-gray-500">nodes + edges</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <FileSpreadsheet className="w-6 h-6 mx-auto mb-1 text-green-400" />
                  <p className="text-xs text-white">CSV</p>
                  <p className="text-xs text-gray-500">comma sep</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <FileSpreadsheet className="w-6 h-6 mx-auto mb-1 text-blue-400" />
                  <p className="text-xs text-white">TSV</p>
                  <p className="text-xs text-gray-500">tab sep</p>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-green-400 font-medium">File parsed successfully</p>
                  <p className="text-sm text-gray-400">
                    {parsedNodes.length} nodes, {parsedEdges.length} edges
                  </p>
                </div>
              </div>

              {/* Node preview */}
              <div className="bg-gray-800/30 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-2">Preview (first 5 nodes)</p>
                <div className="space-y-2">
                  {parsedNodes.slice(0, 5).map((node, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">{node.label}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        node.type === 'gene' ? 'bg-purple-500/30 text-purple-400' :
                        node.type === 'capsule' ? 'bg-cyan-500/30 text-cyan-400' :
                        'bg-amber-500/30 text-amber-400'
                      }`}>{node.type}</span>
                      <span className="text-gray-500">score: {node.score}</span>
                    </div>
                  ))}
                </div>
                {parsedNodes.length > 5 && (
                  <p className="text-xs text-gray-500 mt-2">+ {parsedNodes.length - 5} more nodes</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">
            Cancel
          </button>
          {step === 'upload' && (
            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">
              Browse Files
            </button>
          )}
          {step === 'preview' && (
            <button onClick={handleConfirm} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium">
              Import {parsedNodes.length} Nodes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default DataImportPanel;
