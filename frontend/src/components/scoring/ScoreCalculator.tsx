"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { scoreColor } from "./scoreUtils";
import { type GDIScoreResult, type AssetForScoring } from "@/lib/api/hooks";
import { GDI_DIMENSIONS } from "./constants";
import { TrendingUp, Loader2, Plus, Play, Trash2, Info } from "lucide-react";

type AssetType = "Gene" | "Capsule" | "Recipe";

function AssetForm({
  assetType, setAssetType, name, setName, content, setContent,
  signals, setSignals, ancestors, setAncestors,
  forkCount, setForkCount, vTotal, setVTotal, vPass, setVPass,
  onScore, onAdd, isPending,
}: {
  assetType: AssetType; setAssetType: (v: AssetType) => void;
  name: string; setName: (v: string) => void;
  content: string; setContent: (v: string) => void;
  signals: string; setSignals: (v: string) => void;
  ancestors: string; setAncestors: (v: string) => void;
  forkCount: number; setForkCount: (v: number) => void;
  vTotal: number; setVTotal: (v: number) => void;
  vPass: number; setVPass: (v: number) => void;
  onScore: () => void; onAdd: () => void; isPending: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Asset Parameters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type</label>
            <Select value={assetType} onValueChange={v => setAssetType(v as AssetType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Gene">Gene</SelectItem>
                <SelectItem value="Capsule">Capsule</SelectItem>
                <SelectItem value="Recipe">Recipe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name</label>
            <Input placeholder={`My ${assetType}`} value={name} onChange={e => setName(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Content</label>
          <Textarea placeholder="Paste code or description..." value={content}
            onChange={e => setContent(e.target.value)} rows={4} className="resize-none font-mono text-xs" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Signals <span className="font-normal text-xs text-muted-foreground">(comma-sep)</span></label>
            <Input placeholder="signal1, signal2" value={signals} onChange={e => setSignals(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Ancestors <span className="font-normal text-xs text-muted-foreground">(comma-sep)</span></label>
            <Input placeholder="gene-001" value={ancestors} onChange={e => setAncestors(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Fork Count</label>
            <Input type="number" min={0} value={forkCount} onChange={e => setForkCount(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tests ({vTotal})</label>
            <Input type="range" min={0} max={20} value={vTotal}
              onChange={e => { const v = Number(e.target.value); setVTotal(v); if (vPass > v) setVPass(v); }} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Passed ({vPass})</label>
            <Input type="range" min={0} max={vTotal} value={vPass} onChange={e => setVPass(Number(e.target.value))} />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="w-3 h-3" />
          Pass rate: {vTotal > 0 ? ((vPass / vTotal) * 100).toFixed(0) : 0}%
        </div>
        <div className="flex gap-3">
          <Button onClick={onScore} disabled={isPending} className="flex-1">
            {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scoring</> : <><TrendingUp className="w-4 h-4 mr-2" />Score Now</>}
          </Button>
          <Button variant="outline" onClick={onAdd} className="flex-1">
            <Plus className="w-4 h-4 mr-2" />Batch
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultsPanel({ results }: { results: GDIScoreResult[] }) {
  return (
    <div className="space-y-4">
      {results.map(r => <ScoreCard key={r.asset_id} r={r} />)}
      {results.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <TrendingUp className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Fill in parameters and click <strong>Score Now</strong> to see your GDI breakdown.</p>
        </Card>
      )}
    </div>
  );
}

function BatchPanel({
  queue, batchRes, onRemove, onRun, isPending,
}: {
  queue: AssetForScoring[]; batchRes: GDIScoreResult[];
  onRemove: (idx: number) => void; onRun: () => void; isPending: boolean;
}) {
  if (queue.length === 0 && batchRes.length === 0) return null;
  return (
    <div className="space-y-4">
      {queue.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Batch Queue ({queue.length})</CardTitle>
              <Button size="sm" onClick={onRun} disabled={isPending}>
                {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Running</> : <><Play className="w-4 h-4 mr-2" />Score All</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {queue.map((a, idx) => (
                <div key={a.asset_id} className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={a.asset_type === "Gene" ? "gene" : a.asset_type === "Capsule" ? "capsule" : "recipe"}>{a.asset_type}</Badge>
                    <span>{a.name}</span>
                    <span className="text-xs text-muted-foreground">{a.signals.length} signals</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onRemove(idx)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {batchRes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Batch Results ({batchRes.length})</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {batchRes.map(r => <ScoreCard key={r.asset_id} r={r} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreCard({ r }: { r: GDIScoreResult }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Badge variant={r.asset_type === "Gene" ? "gene" : r.asset_type === "Capsule" ? "capsule" : "recipe"}>
            {r.asset_type}
          </Badge>
          <span className="text-2xl font-bold tabular-nums" style={{ color: scoreColor(r.overall) }}>
            {r.overall.toFixed(1)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-center text-xs text-muted-foreground">
          CI: [{r.gdi_lower} – {r.gdi_upper}] · Confidence: {(r.confidence * 100).toFixed(0)}%
        </div>
        <div className="space-y-2">
          {GDI_DIMENSIONS.map(({ name, color }) => {
            const val = (r.dimensions as Record<string, number>)[name.toLowerCase()] ?? 0;
            return (
              <div key={name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{name}</span>
                  <span className="font-medium tabular-nums" style={{ color }}>{val.toFixed(1)}</span>
                </div>
                <Progress value={val} className="h-1.5"
                  style={{ "--progress-foreground": color } as React.CSSProperties}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function ScoreCalculator() {
  const [assetType, setAssetType] = useState<AssetType>("Gene");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [signals, setSignals] = useState("");
  const [ancestors, setAncestors] = useState("");
  const [forkCount, setForkCount] = useState(0);
  const [vTotal, setVTotal] = useState(5);
  const [vPass, setVPass] = useState(4);
  const [results, setResults] = useState<GDIScoreResult[]>([]);
  const [queue, setQueue] = useState<AssetForScoring[]>([]);
  const [batchRes, setBatchRes] = useState<GDIScoreResult[]>([]);

  const singleMut = useMutation({
    mutationFn: async (asset: AssetForScoring) => {
      const res = await fetch("/gdi/score/batch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ assets: [asset] }),
      });
      if (!res.ok) throw new Error(res.statusText);
      const d = await res.json();
      if (d.failed?.length) throw new Error(d.failed[0].error);
      return d.scores[0] as GDIScoreResult;
    },
    onSuccess: (d) => setResults(prev => [d, ...prev.filter(r => r.asset_id !== d.asset_id)]),
  });

  const batchMut = useMutation({
    mutationFn: async (assets: AssetForScoring[]) => {
      const res = await fetch("/gdi/score/batch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ assets }),
      });
      if (!res.ok) throw new Error(res.statusText);
      const d = await res.json();
      return d.scores as GDIScoreResult[];
    },
    onSuccess: (d) => { setBatchRes(d); setQueue([]); },
  });

  const buildAsset = (): AssetForScoring => ({
    asset_id: `calc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    asset_type: assetType,
    name: name || `${assetType} asset`,
    content,
    signals: signals.split(",").map(s => s.trim()).filter(Boolean),
    ancestors: ancestors.split(",").map(a => a.trim()).filter(Boolean),
    fork_count: forkCount,
    validation_results: Array.from({ length: vTotal }, (_, i) => ({ passed: i < vPass, test: `test_${i + 1}` })),
    created_at: new Date().toISOString(),
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <AssetForm
          assetType={assetType} setAssetType={setAssetType}
          name={name} setName={setName}
          content={content} setContent={setContent}
          signals={signals} setSignals={setSignals}
          ancestors={ancestors} setAncestors={setAncestors}
          forkCount={forkCount} setForkCount={setForkCount}
          vTotal={vTotal} setVTotal={setVTotal}
          vPass={vPass} setVPass={setVPass}
          onScore={() => singleMut.mutate(buildAsset())}
          onAdd={() => { const a = buildAsset(); setQueue(p => [...p, a]); setResults(prev => prev.filter(r => r.asset_id !== a.asset_id)); }}
          isPending={singleMut.isPending}
        />
        <ResultsPanel results={results} />
      </div>
      <BatchPanel
        queue={queue} batchRes={batchRes}
        onRemove={idx => setQueue(p => p.filter((_, i) => i !== idx))}
        onRun={() => batchMut.mutate(queue)}
        isPending={batchMut.isPending}
      />
      {singleMut.isError && (
        <p className="text-sm text-destructive">Score failed: {singleMut.error instanceof Error ? singleMut.error.message : "Unknown error"}</p>
      )}
    </div>
  );
}
