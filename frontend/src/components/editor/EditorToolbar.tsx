"use client";
import { useCallback, useRef } from "react";
import { Download, Upload, Undo2, Redo2, Trash2, Plus, ZoomIn, ZoomOut, AlignCenter, Wand2, FileJson, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useEditorStore } from "@/lib/stores/editor-store";

interface EditorToolbarProps {
  onZoomIn?: () => void; onZoomOut?: () => void; onFitView?: () => void;
  onAddNode?: (type: "Gene"|"Capsule"|"Recipe"|"Organism") => void;
  onAiGenerate?: () => void;
}

export function EditorToolbar({ onZoomIn, onZoomOut, onFitView, onAddNode, onAiGenerate }: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { nodes, edges, history, historyIndex, exportAsJson, undo, redo, clearAll, isAiGenerating, setIsAiGenerating } = useEditorStore();
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { try { useEditorStore.getState().importFromJson(JSON.parse(ev.target?.result as string)); } catch { /* */ } };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const handleAiGenerate = useCallback(() => {
    setIsAiGenerating(true);
    onAiGenerate?.();
    setTimeout(() => setIsAiGenerating(false), 3000);
  }, [onAiGenerate, setIsAiGenerating]);

  const nodeTypes = [
    { type: "Gene" as const, color: "bg-[var(--color-gene-green)]" },
    { type: "Capsule" as const, color: "bg-[var(--color-capsule-blue)]" },
    { type: "Recipe" as const, color: "bg-[var(--color-recipe-amber)]" },
    { type: "Organism" as const, color: "bg-[var(--color-organism-purple)]" },
  ];

  return (
    <div className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] px-2 py-1.5 shadow-sm">
      {/* Undo/Redo */}
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={undo} disabled={!canUndo} title="Undo"><Undo2 className="h-4 w-4" /></Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={redo} disabled={!canRedo} title="Redo"><Redo2 className="h-4 w-4" /></Button>
      <div className="mx-1 h-5 w-px bg-[var(--color-border)]" />
      {/* Add Node */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs"><Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">Add</span></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {nodeTypes.map(({ type, color }) => (
            <DropdownMenuItem key={type} onSelect={() => onAddNode?.(type)} className="gap-2"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{type}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="mx-1 h-5 w-px bg-[var(--color-border)]" />
      {/* Zoom */}
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onZoomIn} title="Zoom in"><ZoomIn className="h-4 w-4" /></Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onZoomOut} title="Zoom out"><ZoomOut className="h-4 w-4" /></Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onFitView} title="Fit view"><AlignCenter className="h-4 w-4" /></Button>
      <div className="mx-1 h-5 w-px bg-[var(--color-border)]" />
      {/* AI Generate */}
      <Button variant="default" size="sm" className="h-8 gap-1.5 bg-[var(--color-gene-green)] px-2.5 text-xs hover:bg-[var(--color-gene-green)]/90" onClick={handleAiGenerate} disabled={isAiGenerating}>
        {isAiGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{isAiGenerating ? "Generating…" : "AI"}</span>
      </Button>
      {/* Export */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs"><Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">Export</span></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={exportAsJson} className="gap-2"><FileJson className="h-4 w-4" />JSON</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => useEditorStore.getState().exportAsPng()} className="gap-2"><ImageIcon className="h-4 w-4" />PNG</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Import */}
      <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={() => fileInputRef.current?.click()}><Upload className="h-3.5 w-3.5" /><span className="hidden sm:inline">Import</span></Button>
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      <div className="mx-1 h-5 w-px bg-[var(--color-border)]" />
      {/* Clear */}
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={clearAll} disabled={!nodes.length && !edges.length} title="Clear all"><Trash2 className="h-4 w-4" /></Button>
      {/* Stats */}
      {(nodes.length > 0 || edges.length > 0) && (
        <span className="ml-1 rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs text-[var(--color-muted-foreground)]">{nodes.length}n · {edges.length}e</span>
      )}
    </div>
  );
}
