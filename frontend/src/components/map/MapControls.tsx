"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Layers,
  RotateCcw,
  MousePointer,
  Move,
} from "lucide-react";

interface MapControlsProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  onReset?: () => void;
  onTogglePin?: (mode: "select" | "pin") => void;
  onPhysicsChange?: (strength: number) => void;
  onToggleFullscreen?: () => void;
  pinMode?: "select" | "pin";
  physicsStrength?: number;
  zoomLevel?: number;
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onFitView,
  onReset,
  onTogglePin,
  onPhysicsChange,
  onToggleFullscreen,
  pinMode = "select",
  physicsStrength = 50,
  zoomLevel = 1,
}: MapControlsProps) {
  const [showSettings, setShowSettings] = useState(false);

  const handleZoomIn = useCallback(() => {
    onZoomIn?.();
  }, [onZoomIn]);

  const handleZoomOut = useCallback(() => {
    onZoomOut?.();
  }, [onZoomOut]);

  const handleFitView = useCallback(() => {
    onFitView?.();
  }, [onFitView]);

  const handleReset = useCallback(() => {
    onReset?.();
  }, [onReset]);

  const handleTogglePin = useCallback(() => {
    onTogglePin?.(pinMode === "select" ? "pin" : "select");
  }, [onTogglePin, pinMode]);

  const handlePhysicsChange = useCallback(
    (val: number[]) => {
      onPhysicsChange?.(val[0]);
    },
    [onPhysicsChange]
  );

  const handleToggleFullscreen = useCallback(() => {
    onToggleFullscreen?.();
  }, [onToggleFullscreen]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-2 shadow-sm">
        {/* Zoom controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleZoomIn}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Zoom In</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleZoomOut}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Zoom Out</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleFitView}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Fit to View</p>
          </TooltipContent>
        </Tooltip>

        <div className="my-0.5 h-px bg-[var(--color-border)]" />

        {/* Interaction mode */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={pinMode === "pin" ? "secondary" : "ghost"}
              className="h-8 w-8"
              onClick={handleTogglePin}
            >
              <Move className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{pinMode === "select" ? "Enable Node Pinning" : "Disable Node Pinning"}</p>
          </TooltipContent>
        </Tooltip>

        <div className="my-0.5 h-px bg-[var(--color-border)]" />

        {/* Settings toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={showSettings ? "secondary" : "ghost"}
              className="h-8 w-8"
              onClick={() => setShowSettings((s) => !s)}
            >
              <Layers className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Display Settings</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleReset}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Reset View</p>
          </TooltipContent>
        </Tooltip>

        {/* Fullscreen */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleToggleFullscreen}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Fullscreen</p>
          </TooltipContent>
        </Tooltip>

        {/* Zoom level indicator */}
        {zoomLevel !== 1 && (
          <div className="mt-1 text-center text-xs text-[var(--color-muted-foreground)]">
            {Math.round(zoomLevel * 100)}%
          </div>
        )}

        {/* Inline settings panel */}
        {showSettings && (
          <div className="mt-2 space-y-3 border-t border-[var(--color-border)] pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-muted-foreground)]">
                Physics
              </label>
              <Slider
                value={[physicsStrength]}
                min={0}
                max={100}
                step={10}
                onValueChange={handlePhysicsChange}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[var(--color-muted-foreground)]">
                <span>Static</span>
                <span>Dynamic</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
