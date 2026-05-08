'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Play, Pause, Settings, Save, Download, Upload, Image } from 'lucide-react';
import { DataConfigPanel } from '@/components/map/DataConfigPanel';
import { useMapStore, MapConfig } from '@/store/mapStore';

export default function MapPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();

  const {
    nodes, setNodes, edges, config, setConfig,
    selectedNodeId, setSelectedNodeId,
    isPlaying, setIsPlaying,
    zoom, setZoom, offset, setOffset,
  } = useMapStore();

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!isPlaying || config.animation === 'none') return;
    const strength = config.animation === 'dynamic' ? 0.02 : 0.01;
    const damping = config.animation === 'dynamic' ? 0.85 : 0.9;

    const simulation = () => {
      setNodes(nodes.map((node) => {
        if (node.fx !== undefined) return node;
        let fx = 0, fy = 0;
        nodes.forEach((other) => {
          if (other.id === node.id) return;
          const dx = node.x - other.x, dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 500 / (dist * dist);
          fx += (dx / dist) * force; fy += (dy / dist) * force;
        });
        fx += (dimensions.width / 2 - node.x) * 0.001;
        fy += (dimensions.height / 2 - node.y) * 0.001;
        const vx = (node.vx + fx * strength) * damping;
        const vy = (node.vy + fy * strength) * damping;
        let x = Math.max(30, Math.min(dimensions.width - 30, node.x + vx));
        let y = Math.max(30, Math.min(dimensions.height - 30, node.y + vy));
        return { ...node, x, y, vx, vy };
      }));
      animationRef.current = requestAnimationFrame(simulation);
    };
    animationRef.current = requestAnimationFrame(simulation);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isPlaying, dimensions, nodes, config.animation, setNodes]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    canvas.width = dimensions.width * 2; canvas.height = dimensions.height * 2; ctx.scale(2, 2);
    ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    ctx.save(); ctx.translate(offset.x, offset.y); ctx.scale(zoom, zoom);

    if (config.showEdges) {
      edges.forEach((edge) => {
        const source = nodes.find((n) => n.id === edge.source);
        const target = nodes.find((n) => n.id === edge.target);
        if (!source || !target) return;
        ctx.beginPath();
        if (config.edgeStyle === 'curve') {
          const mx = (source.x + target.x) / 2, my = (source.y + target.y) / 2 - 30;
          ctx.moveTo(source.x, source.y); ctx.quadraticCurveTo(mx, my, target.x, target.y);
        } else { ctx.moveTo(source.x, source.y); ctx.lineTo(target.x, target.y); }
        ctx.strokeStyle = `rgba(139, 92, 246, ${edge.strength * 0.4})`; ctx.lineWidth = edge.strength * 3; ctx.stroke();
      });
    }

    const getColor = (node: typeof nodes[0]) => {
      if (config.colorScheme === 'heatmap') {
        const t = node.score / 100;
        return `rgb(${Math.round(255*t)},${Math.round(100*(1-t))},${Math.round(255*(1-t))})`;
      }
      const colors: Record<string, string> = { gene: '#8b5cf6', capsule: '#06b6d4', recipe: '#f59e0b' };
      return colors[node.type] || '#8b5cf6';
    };

    nodes.forEach((node) => {
      const isHovered = hoveredNode === node.id;
      const isSelected = selectedNodeId === node.id;
      let baseRadius = config.nodeSize === 'score' ? 10 + (node.score / 100) * 16 : 16;
      const radius = isHovered || isSelected ? baseRadius + 4 : baseRadius;
      const nodeColor = getColor(node);

      if (isHovered || isSelected) {
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 2);
        gradient.addColorStop(0, nodeColor + '60'); gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(node.x, node.y, radius * 2, 0, Math.PI * 2); ctx.fill();
      }

      ctx.beginPath(); ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor; ctx.fill();
      ctx.strokeStyle = isSelected ? '#ffffff' : nodeColor; ctx.lineWidth = isSelected ? 3 : 1; ctx.stroke();

      if (config.showScores) {
        ctx.fillStyle = '#ffffff'; ctx.font = `bold ${Math.round(radius * 0.6)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(node.score.toString(), node.x, node.y);
      }
      if (config.showLabels) {
        ctx.fillStyle = '#e5e7eb'; ctx.font = '12px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(node.label, node.x, node.y + radius + 14);
      }
    });
    ctx.restore();
  }, [nodes, edges, dimensions, zoom, offset, hoveredNode, selectedNodeId, config]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / zoom;
    const y = (e.clientY - rect.top - offset.y) / zoom;
    const hovered = nodes.find((node) => { const dx = node.x - x, dy = node.y - y; return Math.sqrt(dx * dx + dy * dy) < 20; });
    setHoveredNode(hovered?.id || null);
    if (draggedNode) setNodes(nodes.map((node) => node.id === draggedNode ? { ...node, x, y, vx: 0, vy: 0 } : node));
  }, [nodes, offset, zoom, draggedNode, setNodes]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / zoom;
    const y = (e.clientY - rect.top - offset.y) / zoom;
    const clicked = nodes.find((node) => { const dx = node.x - x, dy = node.y - y; return Math.sqrt(dx * dx + dy * dy) < 20; });
    if (clicked) {
      setSelectedNodeId(clicked.id); setDraggedNode(clicked.id); setIsPlaying(false);
      setNodes(nodes.map((node) => node.id === clicked.id ? { ...node, fx: x, fy: y } : node));
    } else { setSelectedNodeId(null); }
  }, [nodes, offset, zoom, setSelectedNodeId, setIsPlaying, setNodes]);

  const handleMouseUp = useCallback(() => {
    if (draggedNode) {
      setDraggedNode(null);
      setNodes(nodes.map((node) => node.id === draggedNode ? { ...node, fx: undefined, fy: undefined } : node));
    }
  }, [draggedNode, nodes, setNodes]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    setImportError(null);
    setImportSuccess(null);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    const validTypes = ['.json', '.csv'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validTypes.includes(fileExt)) {
      setImportError(`Invalid file type. Please upload ${validTypes.join(' or ')} files.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (fileExt === '.json') {
          const data = JSON.parse(content);
          if (data.nodes && data.edges) {
            useMapStore.getState().loadMapData(data.nodes, data.edges);
            setImportSuccess(`Successfully imported ${data.nodes.length} nodes and ${data.edges.length} connections!`);
            setTimeout(() => setImportSuccess(null), 3000);
          } else {
            setImportError('Invalid JSON format. Expected { nodes: [], edges: [] }');
          }
        } else if (fileExt === '.csv') {
          // Parse CSV
          const lines = content.trim().split('\n');
          if (lines.length < 2) {
            setImportError('CSV file must have at least a header and one data row.');
            return;
          }
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          const nodeIndex = headers.indexOf('id');
          const labelIndex = headers.indexOf('label');
          const typeIndex = headers.indexOf('type');
          const scoreIndex = headers.indexOf('score');

          if (nodeIndex === -1 || labelIndex === -1) {
            setImportError('CSV must have "id" and "label" columns.');
            return;
          }

          const newNodes = lines.slice(1).map((line, i) => {
            const cols = line.split(',');
            return {
              id: cols[nodeIndex]?.trim() || `node-${i}`,
              label: cols[labelIndex]?.trim() || `Node ${i}`,
              type: (typeIndex >= 0 ? cols[typeIndex]?.trim() : 'gene') as 'gene' | 'capsule' | 'recipe',
              score: scoreIndex >= 0 ? parseInt(cols[scoreIndex]?.trim() || '50') : 50,
              x: Math.random() * (dimensions.width - 100) + 50,
              y: Math.random() * (dimensions.height - 100) + 50,
              vx: 0,
              vy: 0,
            };
          });

          // Create edges between nodes (simple: connect consecutive nodes)
          const newEdges: { source: string; target: string; strength: number }[] = [];
          for (let i = 0; i < newNodes.length - 1; i++) {
            newEdges.push({
              source: newNodes[i].id,
              target: newNodes[i + 1].id,
              strength: 0.5,
            });
          }

          useMapStore.getState().loadMapData(newNodes, newEdges);
          setImportSuccess(`Successfully imported ${newNodes.length} nodes from CSV!`);
          setTimeout(() => setImportSuccess(null), 3000);
        }
      } catch (err) {
        setImportError('Failed to parse file. Please check the format.');
        console.error('Import error:', err);
      }
    };
    reader.readAsText(file);
  }, [dimensions]);

  // Export map to PNG image
  const handleExportToPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `evo-map-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export to PNG failed:', err);
      alert('Failed to export map as PNG. Please try again.');
    }
  }, []);

  const handleConfigChange = (newConfig: MapConfig) => setConfig(newConfig);

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setImportError(null);
      setImportSuccess(null);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.nodes && data.edges) {
          useMapStore.getState().loadMapData(data.nodes, data.edges);
          setImportSuccess(`Imported ${data.nodes.length} nodes and ${data.edges.length} edges!`);
          setTimeout(() => setImportSuccess(null), 3000);
        } else {
          setImportError('Invalid JSON: missing nodes or edges array');
        }
      } catch {
        setImportError('Failed to parse JSON file');
        console.error('Failed to import data');
      }
    };
    input.click();
  };

  const handleExportData = () => {
    const data = { nodes: nodes.map(({ x, y, vx, vy, ...rest }) => rest), edges, config, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `evo-map-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    const encoded = btoa(JSON.stringify({ nodes, edges, config }));
    const url = `${window.location.origin}/map?data=${encoded}`;
    navigator.clipboard.writeText(url);
    alert('Map URL copied to clipboard!');
  };

  const handleSave = async () => {
    const mapData = {
      nodes: nodes.map(({ x, y, vx, vy, fx, fy, ...rest }) => rest),
      edges,
      config,
      savedAt: new Date().toISOString()
    };

    try {
      // Try to save to backend API
      const response = await fetch('/api/frontend/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapData),
      });

      const result = await response.json();

      if (response.ok) {
        // Also download as JSON for local backup
        const blob = new Blob([JSON.stringify(mapData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `evo-map-saved-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        alert('Map saved successfully! (Synced to server and downloaded locally)');
      } else {
        // Fallback to local download if API fails
        console.warn('API save failed, falling back to local download:', result.error);
        const blob = new Blob([JSON.stringify(mapData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `evo-map-saved-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        alert('Map saved locally (server sync failed)');
      }
    } catch (error) {
      console.error('Save error:', error);
      // Fallback to local download
      const blob = new Blob([JSON.stringify(mapData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evo-map-saved-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      alert('Map saved locally (offline mode)');
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/50">
        <div>
          <h1 className="text-xl font-bold">Evolution Map</h1>
          <p className="text-sm text-gray-400">{nodes.length} nodes • {edges.length} connections</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} className="p-2 hover:bg-purple-600/30 rounded-lg transition-colors" title="Save Map">
            <Save className="w-5 h-5" />
          </button>
          <button onClick={handleExportToPNG} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Export as PNG">
            <Image className="w-5 h-5" />
          </button>
          <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button onClick={() => setZoom(Math.min(zoom * 1.2, 3))} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ZoomIn className="w-5 h-5" /></button>
          <button onClick={() => setZoom(Math.max(zoom / 1.2, 0.5))} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ZoomOut className="w-5 h-5" /></button>
          <button onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><Maximize2 className="w-5 h-5" /></button>
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors"><Settings className="w-5 h-5" /></button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag and drop overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 bg-purple-900/80 backdrop-blur-sm flex items-center justify-center border-4 border-dashed border-purple-400">
            <div className="text-center">
              <Upload className="w-16 h-16 text-purple-300 mx-auto mb-4" />
              <p className="text-2xl font-semibold text-white">Drop your data file here</p>
              <p className="text-purple-300 mt-2">Supports JSON and CSV formats</p>
            </div>
          </div>
        )}

        {/* Import/Export notifications */}
        {importError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 text-red-200 px-6 py-3 rounded-lg border border-red-500/50 shadow-lg animate-pulse">
            {importError}
          </div>
        )}
        {importSuccess && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-green-900/90 text-green-200 px-6 py-3 rounded-lg border border-green-500/50 shadow-lg">
            {importSuccess}
          </div>
        )}

        <canvas
          ref={canvasRef} className="absolute inset-0 w-full h-full cursor-crosshair"
          style={{ width: dimensions.width, height: dimensions.height }}
          onMouseMove={handleMouseMove} onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        />

        {selectedNode && (
          <div className="absolute right-4 top-4 w-72 bg-black/80 backdrop-blur-lg border border-white/10 rounded-xl p-4">
            <h3 className="font-semibold mb-2">{selectedNode.label}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Type</span>
                <span className={`px-2 py-0.5 rounded text-xs ${selectedNode.type === 'gene' ? 'bg-purple-500/20 text-purple-400' : selectedNode.type === 'capsule' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-amber-500/20 text-amber-400'}`}>{selectedNode.type}</span>
              </div>
              <div className="flex justify-between"><span className="text-gray-400">Score</span><span>{selectedNode.score}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">ID</span><span className="text-xs">{selectedNode.id}</span></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors">Edit</button>
              <button className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">View Details</button>
            </div>
          </div>
        )}

        <div className="absolute left-4 bottom-4 bg-black/80 backdrop-blur-lg border border-white/10 rounded-xl p-3">
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500" /><span className="text-gray-400">Gene</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-cyan-500" /><span className="text-gray-400">Capsule</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-gray-400">Recipe</span></div>
          </div>
        </div>

        <div className="absolute left-4 top-4 bg-black/80 backdrop-blur-lg border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-400">
          {Math.round(zoom * 100)}%
        </div>

        <DataConfigPanel onConfigChange={handleConfigChange} onImportData={handleImportData} onExportData={handleExportData} onShare={handleShare} />
      </div>
    </div>
  );
}
