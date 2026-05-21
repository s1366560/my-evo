"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useMapGraph, type MapFilters as MapFilterType, type MapNode } from "@/lib/hooks/use-map-data";
import { MapFilters } from "@/components/map/MapFilters";
import { MapStatsBar } from "@/components/map/MapStatsBar";
import { MapNodePanel } from "@/components/map/MapNodePanel";
import { MapControls } from "@/components/map/MapControls";
import { MapDataImport } from "@/components/map/MapDataImport";
import { MapConfigPanel, DEFAULT_CONFIG, type MapConfig } from "@/components/map/MapConfigPanel";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, X, Upload, Settings } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/lib/hooks/useDebounce";
import type { MapVisualizationHandle } from "@/components/map/MapVisualization";

// ===== PERFORMANCE: Lazy load heavy map visualization component =====
const MapVisualization = dynamic(
  () => import("@/components/map/MapVisualization").then((mod) => mod.MapVisualization),
  {
    ssr: false, // Map visualization requires browser APIs
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[var(--color-muted-background)]">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-gene-green)] border-t-transparent" />
          <p className="text-sm text-[var(--color-muted-foreground)]">Loading visualization engine...</p>
        </div>
      </div>
    ),
  }
);

export default function MapPage() {
  const [filters, setFilters] = useState<MapFilterType>({});
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | undefined>();
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [nodeSheetOpen, setNodeSheetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState<MapConfig>(DEFAULT_CONFIG);
  const [pinMode, setPinMode] = useState<"select" | "pin">("select");
  const [physicsStrength, setPhysicsStrength] = useState(50);

  // Refs for map controls
  const mapRef = useRef<MapVisualizationHandle>(null);
  const zoomInRef = useRef<(() => void) | null>(null);
  const zoomOutRef = useRef<(() => void) | null>(null);
  const fitViewRef = useRef<(() => void) | null>(null);
  const resetViewRef = useRef<(() => void) | null>(null);

  // Debounce filter changes to avoid excessive re-renders
  const debouncedFilters = useDebounce(filters, 300);

  const { data, isLoading, isError, error } = useMapGraph(debouncedFilters);

  const handleNodeClick = useCallback((node: MapNode) => {
    setSelectedNode(node);
    setHighlightedNodeId(node.id);
    setNodeSheetOpen(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedNode(null);
    setHighlightedNodeId(undefined);
    setNodeSheetOpen(false);
  }, []);

  const handleTypeFilter = useCallback(
    (type: string) => {
      setFilters((prev) => ({
        ...prev,
        type: type === "all" ? undefined : (type as MapFilterType["type"]),
      }));
    },
    []
  );

  const handleImport = useCallback((nodes: Array<{ name: string; type?: string; author?: string; gdi_score?: number; description?: string }>) => {
    // In production, this would send nodes to the backend API.
    // For now, show a toast or notification that import was received.
    console.log(`[Map] Imported ${nodes.length} nodes:`, nodes);
  }, []);

  const handleConfigChange = useCallback((newConfig: MapConfig) => {
    setConfig(newConfig);
    // Derive physics strength from config
    setPhysicsStrength(newConfig.physicsStrength);
  }, []);

  const handlePhysicsChange = useCallback((strength: number) => {
    setPhysicsStrength(strength);
    setConfig((prev) => ({ ...prev, physicsStrength: strength }));
  }, []);

  const handleTogglePin = useCallback((mode: "select" | "pin") => {
    setPinMode(mode);
  }, []);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Sticky header bar */}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-[var(--color-foreground)] sm:text-xl">
              Ecosystem Map
            </h1>
            <p className="hidden text-xs text-[var(--color-muted-foreground)] sm:block">
              Interactive force-directed graph of all assets in the EvoMap ecosystem
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Import button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              className="hidden sm:flex"
            >
              <Upload className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            {/* Config button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfigOpen(true)}
              className="hidden sm:flex"
            >
              <Settings className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Configure</span>
            </Button>
            {data && (
              <div className="hidden sm:block">
                <MapStatsBar
                  stats={data.stats}
                  selectedType={filters.type}
                  onTypeFilter={handleTypeFilter}
                />
              </div>
            )}
            {/* Mobile filter toggle */}
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden"
              onClick={() => setFilterSheetOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Filters</span>
            </Button>
          </div>
        </div>
        {/* Mobile action bar */}
        <div className="mt-2 flex gap-2 sm:hidden">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setConfigOpen(true)}
          >
            <Settings className="mr-1.5 h-3.5 w-3.5" />
            Configure
          </Button>
        </div>
        {/* Mobile stats row */}
        {data && (
          <div className="mt-2 sm:hidden">
            <MapStatsBar
              stats={data.stats}
              selectedType={filters.type}
              onTypeFilter={handleTypeFilter}
            />
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar — filters */}
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-background)] p-4 lg:block xl:w-72">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              <p className="font-semibold">Failed to load map data</p>
              <p className="mt-1 text-xs">{(error as Error)?.message ?? "Unknown error"}</p>
            </div>
          ) : data ? (
            <MapFilters
              value={filters}
              onChange={setFilters}
              stats={data.stats}
            />
          ) : null}
        </aside>

        {/* Map canvas */}
        <main className="relative flex-1 overflow-hidden bg-[var(--color-muted-background)]">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="space-y-3 text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-gene-green)] border-t-transparent" />
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  Loading ecosystem graph...
                </p>
              </div>
            </div>
          ) : data ? (
            <>
              {/* Map controls overlay — top right */}
              <div className="absolute right-4 top-4 z-10">
                <MapControls
                  onZoomIn={() => zoomInRef.current?.()}
                  onZoomOut={() => zoomOutRef.current?.()}
                  onFitView={() => fitViewRef.current?.()}
                  onReset={() => resetViewRef.current?.()}
                  onTogglePin={handleTogglePin}
                  onPhysicsChange={handlePhysicsChange}
                  pinMode={pinMode}
                  physicsStrength={physicsStrength}
                />
              </div>

              <MapVisualization
                ref={mapRef}
                data={data}
                onNodeClick={handleNodeClick}
                highlightedNodeId={highlightedNodeId}
                config={config}
                physicsStrength={physicsStrength}
                onZoomInRef={zoomInRef}
                onZoomOutRef={zoomOutRef}
                onFitViewRef={fitViewRef}
                onResetRef={resetViewRef}
              />

              {/* Desktop selected node panel — bottom-right overlay */}
              {selectedNode && (
                <div className="absolute bottom-4 right-4 hidden w-72 md:block">
                  <MapNodePanel node={selectedNode} onClose={handleClosePanel} />
                </div>
              )}

              {/* Legend — bottom-left */}
              <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-card-background)_90%,transparent)] p-3 backdrop-blur-sm">
                <p className="mb-1 text-xs font-semibold text-[var(--color-muted-foreground)]">Legend</p>
                {[
                  { label: "Gene", color: "#22c55e" },
                  { label: "Capsule", color: "#3b82f6" },
                  { label: "Recipe", color: "#f59e0b" },
                  { label: "Organism", color: "#a855f7" },
                  { label: "Selected", color: "#facc15" },
                  { label: "Hovered", color: "#fb923c" },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs text-[var(--color-muted-foreground)]">{label}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </main>
      </div>

      {/* Mobile filters sheet */}
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="left" className="w-[20rem] border-r border-[var(--color-border)] bg-[var(--color-background)] p-0">
          <SheetHeader className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-background)] px-5 py-4">
            <SheetTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Map Filters
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto p-5">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </div>
            ) : isError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                <p className="font-semibold">Failed to load map data</p>
                <p className="mt-1 text-xs">{(error as Error)?.message ?? "Unknown error"}</p>
              </div>
            ) : data ? (
              <MapFilters
                value={filters}
                onChange={setFilters}
                stats={data.stats}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile node detail sheet */}
      <Sheet open={nodeSheetOpen} onOpenChange={setNodeSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] border-t border-[var(--color-border)] bg-[var(--color-background)] p-0">
          <SheetHeader className="sticky top-0 z-10 flex flex-row items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-background)] px-5 py-4">
            <SheetTitle>Node Details</SheetTitle>
            <Button variant="ghost" size="sm" onClick={handleClosePanel}>
              <X className="h-4 w-4" />
            </Button>
          </SheetHeader>
          <div className="overflow-y-auto p-5">
            {selectedNode && (
              <MapNodePanel node={selectedNode} onClose={handleClosePanel} />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Data import dialog */}
      <MapDataImport
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImport}
      />

      {/* Config panel dialog */}
      <MapConfigPanel
        open={configOpen}
        onOpenChange={setConfigOpen}
        config={config}
        onChange={handleConfigChange}
        onReset={() => {
          setConfig(DEFAULT_CONFIG);
          setPhysicsStrength(DEFAULT_CONFIG.physicsStrength);
        }}
      />
    </div>
  );
}
