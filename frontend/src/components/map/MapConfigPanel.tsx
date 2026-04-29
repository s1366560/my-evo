"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Palette, BarChart2, Network, RotateCcw, Save, Download } from "lucide-react";

export interface MapConfig {
  // Display settings
  showLabels: boolean;
  labelSize: number; // 0-100
  showEdges: boolean;
  edgeOpacity: number; // 0-100
  showStats: boolean;
  // Visual settings
  nodeSizeBy: "gdi" | "none" | "type";
  colorScheme: "default" | "monochrome" | "vibrant" | "warm" | "cool";
  backgroundColor: string;
  // Physics settings
  physicsStrength: number; // 0-100
  linkDistance: number; // 0-200
  chargeStrength: number; // -200 to -30
  // Advanced
  maxNodes: number;
  showMinimap: boolean;
}

const DEFAULT_CONFIG: MapConfig = {
  showLabels: false,
  labelSize: 50,
  showEdges: true,
  edgeOpacity: 30,
  showStats: true,
  nodeSizeBy: "gdi",
  colorScheme: "default",
  backgroundColor: "transparent",
  physicsStrength: 50,
  linkDistance: 100,
  chargeStrength: -80,
  maxNodes: 500,
  showMinimap: false,
};

const COLOR_SCHEMES = [
  { id: "default", label: "Default", colors: { Gene: "#22c55e", Capsule: "#3b82f6", Recipe: "#f59e0b", Organism: "#a855f7" } },
  { id: "monochrome", label: "Monochrome", colors: { Gene: "#6b7280", Capsule: "#9ca3af", Recipe: "#d1d5db", Organism: "#f3f4f6" } },
  { id: "vibrant", label: "Vibrant", colors: { Gene: "#10b981", Capsule: "#6366f1", Recipe: "#f97316", Organism: "#ec4899" } },
  { id: "warm", label: "Warm", colors: { Gene: "#f59e0b", Capsule: "#ef4444", Recipe: "#fbbf24", Organism: "#dc2626" } },
  { id: "cool", label: "Cool", colors: { Gene: "#06b6d4", Capsule: "#3b82f6", Recipe: "#8b5cf6", Organism: "#06b6d4" } },
];

interface MapConfigPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: MapConfig;
  onChange: (config: MapConfig) => void;
  onReset?: () => void;
}

export function MapConfigPanel({
  open,
  onOpenChange,
  config,
  onChange,
  onReset,
}: MapConfigPanelProps) {
  const [localConfig, setLocalConfig] = useState<MapConfig>(config);

  const handleChange = useCallback(
    (partial: Partial<MapConfig>) => {
      const next = { ...localConfig, ...partial };
      setLocalConfig(next);
      onChange(next);
    },
    [localConfig, onChange]
  );

  const handleReset = useCallback(() => {
    setLocalConfig(DEFAULT_CONFIG);
    onChange(DEFAULT_CONFIG);
    onReset?.();
  }, [onChange, onReset]);

  const handleApply = useCallback(() => {
    onChange(localConfig);
  }, [localConfig, onChange]);

  const handleSave = useCallback(() => {
    // Persist to localStorage
    try {
      localStorage.setItem("evo-map-config", JSON.stringify(localConfig));
      onOpenChange(false);
    } catch {
      // localStorage might be unavailable
    }
  }, [localConfig, onOpenChange]);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(localConfig, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "map-config.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [localConfig]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[var(--color-border)] bg-[var(--color-card-background)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Map Configuration
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="display" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="display" className="text-xs">
              <Palette className="mr-1 h-3 w-3" />
              Display
            </TabsTrigger>
            <TabsTrigger value="visual" className="text-xs">
              <BarChart2 className="mr-1 h-3 w-3" />
              Visual
            </TabsTrigger>
            <TabsTrigger value="physics" className="text-xs">
              <Network className="mr-1 h-3 w-3" />
              Physics
            </TabsTrigger>
          </TabsList>

          {/* Display tab */}
          <TabsContent value="display" className="space-y-4 pt-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-[var(--color-foreground)]">Show Labels</label>
              <Switch
                checked={localConfig.showLabels}
                onCheckedChange={(v) => handleChange({ showLabels: v })}
              />
            </div>

            {localConfig.showLabels && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
                  <label>Label Size</label>
                  <span>{localConfig.labelSize}%</span>
                </div>
                <Slider
                  value={[localConfig.labelSize]}
                  min={10}
                  max={100}
                  step={5}
                  onValueChange={([v]) => handleChange({ labelSize: v })}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="text-sm text-[var(--color-foreground)]">Show Edges</label>
              <Switch
                checked={localConfig.showEdges}
                onCheckedChange={(v) => handleChange({ showEdges: v })}
              />
            </div>

            {localConfig.showEdges && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
                  <label>Edge Opacity</label>
                  <span>{localConfig.edgeOpacity}%</span>
                </div>
                <Slider
                  value={[localConfig.edgeOpacity]}
                  min={5}
                  max={100}
                  step={5}
                  onValueChange={([v]) => handleChange({ edgeOpacity: v })}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="text-sm text-[var(--color-foreground)]">Show Stats</label>
              <Switch
                checked={localConfig.showStats}
                onCheckedChange={(v) => handleChange({ showStats: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-[var(--color-foreground)]">Show Minimap</label>
              <Switch
                checked={localConfig.showMinimap}
                onCheckedChange={(v) => handleChange({ showMinimap: v })}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
                <label>Max Nodes</label>
                <span>{localConfig.maxNodes}</span>
              </div>
              <Slider
                value={[localConfig.maxNodes]}
                min={50}
                max={2000}
                step={50}
                onValueChange={([v]) => handleChange({ maxNodes: v })}
              />
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Limit the maximum number of nodes to render
              </p>
            </div>
          </TabsContent>

          {/* Visual tab */}
          <TabsContent value="visual" className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-muted-foreground)]">
                Node Size
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["gdi", "none", "type"] as const).map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    variant={localConfig.nodeSizeBy === v ? "default" : "outline"}
                    className="text-xs"
                    onClick={() => handleChange({ nodeSizeBy: v })}
                  >
                    {v === "gdi" ? "By GDI" : v === "type" ? "By Type" : "Fixed"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--color-muted-foreground)]">
                Color Scheme
              </label>
              <div className="grid grid-cols-1 gap-2">
                {COLOR_SCHEMES.map((scheme) => (
                  <button
                    key={scheme.id}
                    type="button"
                    className={`flex items-center gap-3 rounded-lg border p-2 transition-colors ${
                      localConfig.colorScheme === scheme.id
                        ? "border-[var(--color-gene-green)] bg-[var(--color-gene-green)]/5"
                        : "border-[var(--color-border)] hover:border-[var(--color-muted-foreground)]"
                    }`}
                    onClick={() => handleChange({ colorScheme: scheme.id as MapConfig["colorScheme"] })}
                  >
                    <div className="flex gap-1">
                      {Object.values(scheme.colors).map((color, i) => (
                        <span
                          key={i}
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-medium text-[var(--color-foreground)]">
                      {scheme.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Physics tab */}
          <TabsContent value="physics" className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
                <label>Physics Strength</label>
                <span>{localConfig.physicsStrength}%</span>
              </div>
              <Slider
                value={[localConfig.physicsStrength]}
                min={0}
                max={100}
                step={5}
                onValueChange={([v]) => handleChange({ physicsStrength: v })}
              />
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Lower = more static layout, Higher = more dynamic
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
                <label>Link Distance</label>
                <span>{localConfig.linkDistance}</span>
              </div>
              <Slider
                value={[localConfig.linkDistance]}
                min={20}
                max={300}
                step={10}
                onValueChange={([v]) => handleChange({ linkDistance: v })}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
                <label>Repulsion Strength</label>
                <span>{Math.abs(localConfig.chargeStrength)}</span>
              </div>
              <Slider
                value={[Math.abs(localConfig.chargeStrength)]}
                min={10}
                max={300}
                step={10}
                onValueChange={([v]) => handleChange({ chargeStrength: -v })}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleReset}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleExport}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-[var(--color-gene-green)] text-white hover:bg-[var(--color-gene-green)]/90"
            onClick={handleSave}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Re-export DEFAULT_CONFIG for use in the map page
export { DEFAULT_CONFIG };
