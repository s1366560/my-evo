"use client";

import { useState } from "react";
import { useRegisterCapsule, useValidateCapsule } from "@/lib/api/hooks/use-gep-capsule";
import type { ValidationResult } from "@/lib/api/hooks/use-gep-types";
import type { CapsulePublishFormProps } from "./types";

export function CapsulePublishForm({ onSuccess, onCancel }: CapsulePublishFormProps) {
  const [form, setForm] = useState({ name: "", description: "", content: "", strategy: ["", ""], gene_ids: [] as string[] });
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const registerCapsule = useRegisterCapsule();
  const validateCapsule = useValidateCapsule();

  const req = () => ({ name: form.name, description: form.description, content: form.content, strategy: form.strategy.filter(s => s.trim()), gene_ids: form.gene_ids.filter(Boolean) });
  const handleValidate = async () => { setValidating(true); try { const res = await validateCapsule.mutateAsync(req()); if (res.success) setResult(res.data ?? null); } catch (err) { setResult({ valid: false, errors: [{ field: "request", message: (err as Error).message, code: "VALIDATION_ERROR" }], warnings: [] }); } finally { setValidating(false); } };
  const handleSubmit = async () => { try { const r = await registerCapsule.mutateAsync(req()); onSuccess?.(r.data?.node_id ?? r.data?.asset_id ?? ""); } catch {} };

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium mb-1">Name *</label>
        <input className="w-full px-3 py-2 border rounded-md bg-background" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., data-processor" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description *</label>
        <textarea className="w-full px-3 py-2 border rounded-md bg-background" rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe what this capsule does..." />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Content * (min 50 chars)</label>
        <textarea className="w-full px-3 py-2 border rounded-md bg-background font-mono text-sm" rows={8} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="Paste your executable code or configuration here..." />
        <p className="text-xs text-muted-foreground mt-1">{form.content.length} / 50 min characters</p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Gene IDs (optional)</label>
        <input className="w-full px-3 py-2 border rounded-md bg-background" value={form.gene_ids.join(", ")} onChange={e => setForm(p => ({ ...p, gene_ids: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))} placeholder="gene_xxx, gene_yyy (comma separated)" />
      </div>
      <StrategyEditor steps={form.strategy} onChange={v => setForm(p => ({ ...p, strategy: v }))} />
      {result && (
        <div className={`p-4 rounded-md ${result.valid ? "bg-green-500/10 border border-green-500" : "bg-red-500/10 border border-red-500"}`}>
          <div className="font-medium">{result.valid ? "✓ Valid" : "✗ Invalid"}</div>
          {result.errors.map((e: { field: string; message: string }, i: number) => <div key={i} className="text-sm mt-1"><span className="font-medium">{e.field}:</span> {e.message}</div>)}
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={handleValidate} disabled={validating || !form.name || !form.content} className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50">{validating ? "..." : "Validate"}</button>
        <button type="button" onClick={handleSubmit} disabled={registerCapsule.isPending || !result?.valid || !form.name || !form.content} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50">{registerCapsule.isPending ? "..." : "Publish"}</button>
        {onCancel && <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-md hover:bg-muted">Cancel</button>}
      </div>
      {registerCapsule.isError && <div className="text-destructive text-sm">Error: {(registerCapsule.error as Error)?.message}</div>}
    </div>
  );
}

function StrategyEditor({ steps, onChange }: { steps: string[]; onChange: (v: string[]) => void }) {
  const add = () => onChange([...steps, ""]);
  const remove = (i: number) => { if (steps.length > 2) onChange(steps.filter((_, idx) => idx !== i)); };
  const update = (i: number, v: string) => onChange(steps.map((s, idx) => idx === i ? v : s));
  return (
    <div>
      <label className="block text-sm font-medium mb-1">Strategy * (min 2 steps)</label>
      {steps.map((s, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <input className="flex-1 px-3 py-2 border rounded-md bg-background" value={s} onChange={e => update(i, e.target.value)} placeholder={`Step ${i + 1}`} />
          {steps.length > 2 && <button type="button" onClick={() => remove(i)} className="px-3 text-destructive hover:bg-destructive/10 rounded-md">✕</button>}
        </div>
      ))}
      <button type="button" onClick={add} className="text-sm text-primary hover:underline">+ Add step</button>
    </div>
  );
}
