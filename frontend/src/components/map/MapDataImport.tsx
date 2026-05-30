"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileText, X, AlertCircle, CheckCircle2, Download, FileJson, FileSpreadsheet } from "lucide-react";

interface ImportedNode {
  name: string;
  type?: string;
  author?: string;
  gdi_score?: number;
  description?: string;
  metadata?: Record<string, unknown>;
}

interface ParseResult {
  success: boolean;
  nodes: ImportedNode[];
  errors: string[];
  warnings: string[];
}

interface MapDataImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (nodes: ImportedNode[]) => void;
  supportedTypes?: string[];
}

function parseCSV(text: string): ParseResult {
  const lines = text.trim().split("\n");
  if (lines.length < 2) {
    return { success: false, nodes: [], errors: ["CSV must have a header row and at least one data row"], warnings: [] };
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ""));
  const nodes: ImportedNode[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parse (handles basic cases)
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    if (values.length !== headers.length) {
      warnings.push(`Line ${i + 1}: Column count mismatch (expected ${headers.length}, got ${values.length}). Skipping.`);
      continue;
    }

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.replace(/^["']|["']$/g, "") ?? "";
    });

    const name = row.name || row.title || row.asset_name || row.id;
    if (!name) {
      warnings.push(`Line ${i + 1}: No name field found. Skipping.`);
      continue;
    }

    const gdiRaw = row.gdi_score || row.gdi || row.score;
    const gdi_score = gdiRaw ? parseFloat(gdiRaw) : undefined;

    nodes.push({
      name,
      type: row.type || row.asset_type || undefined,
      author: row.author || row.owner || row.created_by || undefined,
      gdi_score: isNaN(gdi_score as number) ? undefined : gdi_score,
      description: row.description || row.summary || row.about || undefined,
      metadata: row,
    });
  }

  return { success: nodes.length > 0, nodes, errors, warnings };
}

function parseJSON(text: string): ParseResult {
  try {
    const data = JSON.parse(text);
    const nodes: ImportedNode[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Handle array of nodes or object with nodes key
    let items: unknown[] = [];
    if (Array.isArray(data)) {
      items = data;
    } else if (typeof data === "object" && data !== null) {
      const keys = Object.keys(data);
      // Try common keys
      const nodeKey = keys.find((k) => Array.isArray(data[k]));
      if (nodeKey) {
        items = data[nodeKey];
      } else {
        // Treat the whole object as a single node
        items = [data];
      }
    }

    if (!items.length) {
      return { success: false, nodes: [], errors: ["No nodes found in JSON"], warnings: [] };
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as Record<string, unknown>;
      if (typeof item !== "object" || item === null) {
        warnings.push(`Item ${i + 1}: Not a valid object. Skipping.`);
        continue;
      }

      const name = (item.name || item.title || item.id || item.asset_name || item.node_name) as string | undefined;
      if (!name) {
        warnings.push(`Item ${i + 1}: No name field found. Skipping.`);
        continue;
      }

      const gdiRaw = item.gdi_score || item.gdi || item.score || item.gdiScore;
      const gdi_score = typeof gdiRaw === "number" ? gdiRaw : undefined;

      // Extract type from known fields
      const type = (item.type || item.asset_type || item.node_type) as string | undefined;

      nodes.push({
        name,
        type: typeof type === "string" ? type : undefined,
        author: (item.author || item.owner || item.created_by) as string | undefined,
        gdi_score,
        description: (item.description || item.summary || item.about) as string | undefined,
        metadata: item as Record<string, unknown>,
      });
    }

    return { success: nodes.length > 0, nodes, errors, warnings };
  } catch (e) {
    return { success: false, nodes: [], errors: [`Invalid JSON: ${(e as Error).message}`], warnings: [] };
  }
}

export function MapDataImport({
  open,
  onOpenChange,
  onImport,
  supportedTypes = ["Gene", "Capsule", "Recipe", "Organism"],
}: MapDataImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    setSelectedFile(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const ext = file.name.split(".").pop()?.toLowerCase();
      const result = ext === "json" || ext === "geojson" ? parseJSON(text) : parseCSV(text);
      setParseResult(result);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleImportConfirm = useCallback(() => {
    if (parseResult?.success) {
      onImport(parseResult.nodes);
      onOpenChange(false);
      setParseResult(null);
      setSelectedFile(null);
    }
  }, [parseResult, onImport, onOpenChange]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setParseResult(null);
    setSelectedFile(null);
  }, [onOpenChange]);

  const downloadTemplate = useCallback((format: "csv" | "json") => {
    if (format === "csv") {
      const csv = "name,type,author,gdi_score,description\nMy Asset,Gene,author_id,75.5,A sample gene asset";
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "map_import_template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const json = JSON.stringify([
        { name: "My Asset", type: "Gene", author: "author_id", gdi_score: 75.5, description: "A sample gene asset" },
      ], null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "map_import_template.json";
      a.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg border-[var(--color-border)] bg-[var(--color-card-background)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import Map Data
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template download */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => downloadTemplate("csv")}
            >
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
              CSV Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => downloadTemplate("json")}
            >
              <FileJson className="mr-1.5 h-3.5 w-3.5" />
              JSON Template
            </Button>
          </div>

          {/* Drop zone */}
          <div
            className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragActive
                ? "border-[var(--color-gene-green)] bg-[var(--color-gene-green)]/5"
                : "border-[var(--color-border)] bg-[var(--color-muted-background)]"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,.geojson"
              className="absolute inset-0 w-full cursor-pointer opacity-0"
              onChange={handleFileInput}
            />
            <FileText className="mx-auto mb-2 h-8 w-8 text-[var(--color-muted-foreground)]" />
            <p className="text-sm font-medium text-[var(--color-foreground)]">
              {dragActive ? "Drop file here" : "Drag & drop or click to select"}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Supports CSV, JSON, GeoJSON files
            </p>
          </div>

          {/* Parse results */}
          {parseResult && (
            <div className="space-y-3">
              {/* Errors */}
              {parseResult.errors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
                  <div className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
                    <AlertCircle className="h-4 w-4" />
                    {parseResult.errors.length} Error(s)
                  </div>
                  <ul className="mt-1 space-y-0.5 text-xs text-red-600 dark:text-red-400">
                    {parseResult.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {parseResult.warnings.length > 0 && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950">
                  <div className="flex items-center gap-2 text-sm font-semibold text-yellow-700 dark:text-yellow-300">
                    <AlertCircle className="h-4 w-4" />
                    {parseResult.warnings.length} Warning(s)
                  </div>
                  <ul className="mt-1 space-y-0.5 text-xs text-yellow-600 dark:text-yellow-400">
                    {parseResult.warnings.slice(0, 5).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                    {parseResult.warnings.length > 5 && (
                      <li>...and {parseResult.warnings.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Success preview */}
              {parseResult.success && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
                    <div className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-300">
                      <CheckCircle2 className="h-4 w-4" />
                      Ready to import {parseResult.nodes.length} node(s)
                    </div>
                  </div>

                  {/* Preview table */}
                  <div className="max-h-48 overflow-auto rounded-lg border border-[var(--color-border)]">
                    <table className="w-full text-xs">
                      <thead className="bg-[var(--color-muted-background)]">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium text-[var(--color-muted-foreground)]">Name</th>
                          <th className="px-2 py-1.5 text-left font-medium text-[var(--color-muted-foreground)]">Type</th>
                          <th className="px-2 py-1.5 text-right font-medium text-[var(--color-muted-foreground)]">GDI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseResult.nodes.slice(0, 10).map((node, i) => (
                          <tr key={i} className="border-t border-[var(--color-border)]">
                            <td className="px-2 py-1.5 text-[var(--color-foreground)]">{node.name}</td>
                            <td className="px-2 py-1.5 text-[var(--color-muted-foreground)]">
                              {node.type || "—"}
                            </td>
                            <td className="px-2 py-1.5 text-right text-[var(--color-muted-foreground)]">
                              {node.gdi_score ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parseResult.nodes.length > 10 && (
                      <div className="border-t border-[var(--color-border)] px-2 py-1.5 text-xs text-[var(--color-muted-foreground)]">
                        ...and {parseResult.nodes.length - 10} more
                      </div>
                    )}
                  </div>

                  {/* Supported types */}
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    Valid types: {supportedTypes.join(", ")}
                  </p>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setParseResult(null);
                        setSelectedFile(null);
                      }}
                    >
                      Choose Different File
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-[var(--color-gene-green)] text-white hover:bg-[var(--color-gene-green)]/90"
                      onClick={handleImportConfirm}
                    >
                      Import {parseResult.nodes.length} Node(s)
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
