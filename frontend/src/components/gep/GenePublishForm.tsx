"use client";

import { useState } from "react";
import { useGepPublishGene, useValidateGene } from "@/lib/api/hooks/use-gep-gene";
import type { GeneCategory, ValidationResult } from "@/lib/api/hooks/use-gep-types";
import type { GenePublishFormProps } from "./types";

export function GenePublishForm({ onSuccess, onCancel }: GenePublishFormProps) {
  const [form, setForm] = useState({ name: "", description: "", category: "" as GeneCategory | "", validation: [""], strategy: ["", ""] });
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const registerGene = useGepPublishGene();
  const validateGene = useValidateGene();

  const req = () => ({ name: form.name, description: form.description, category: form.category as GeneCategory, validation: form.validation.filter(v => v.trim()), strategy: form.strategy.filter(s => s.trim()) });
  const handleValidate = async () => { setValidating(true); try { const res = await validateGene.mutateAsync(req()); if (res.success) setResult(res.data ?? null); } catch (err) { setResult({ valid: false, errors: [{ field: "request", message: (err as Error).message, code: "VALIDATION_ERROR" }], warnings: [] }); } finally { setValidating(false); } };
  const handleSubmit = async () => { try { const r = await registerGene.mutateAsync(req()); onSuccess?.(r.data?.id ?? r.data?.node_id ?? ""); } catch (err) { /* handled via isError */ } };

  const cats = [{ v: "repair" as GeneCategory, l: "Repair" }, { v: "optimize" as GeneCategory, l: "Optimize" }, { v: "innovate" as GeneCategory, l: "Innovate" }, { v: "explore" as GeneCategory, l: "Explore" }];

  return (
    <div className="space-y-5">
      <Field label="Name *" hint="e.g., context-scheduler">
        <input className="w-full px-3 py-2 border rounded-md bg-background" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Name" />
      </Field>
      <Field label="Description *">
        <textarea className="w-full px-3 py-2 border rounded-md bg-background" rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe what this gene does..." />
      </Field>
      <Field label="Category *">
        <div className="grid grid-cols-2 gap-2">
          {cats.map(c => (
            <button key={c.v} type="button" onClick={() => setForm(p => ({ ...p, category: c.v }))}
              className={`p-3 border rounded-md text-left ${form.category === c.v ? "border-primary bg-primary/10" : "border-border hover:border-primary"}`}>
              <div className="font-medium">{c.l}</div>
            </button>
          ))}
        </div>
      </Field>
      <StepList label="Validation Steps *" steps={form.validation} onChange={v => setForm(p => ({ ...p, validation: v }))} min={1} />
      <StepList label="Strategy * (min 2)" steps={form.strategy} onChange={v => setForm(p => ({ ...p, strategy: v }))} min={2} />
      {result && (
        <div className={`p-4 rounded-md ${result.valid ? "bg-green-500/10 border border-green-500" : "bg-red-500/10 border border-red-500"}`}>
          <div className="font-medium">{result.valid ? "✓ Valid" : "✗ Invalid"}</div>
          {result.errors.map((e: { field: string; message: string }, i: number) => <div key={i} className="text-sm mt-1"><span className="font-medium">{e.field}:</span> {e.message}</div>)}
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={handleValidate} disabled={validating || !form.name || !form.category} className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50">{validating ? "..." : "Validate"}</button>
        <button type="button" onClick={handleSubmit} disabled={registerGene.isPending || !result?.valid || !form.name || !form.category} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50">{registerGene.isPending ? "..." : "Publish"}</button>
        {onCancel && <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-md hover:bg-muted">Cancel</button>}
      </div>
      {registerGene.isError && <div className="text-destructive text-sm">Error: {(registerGene.error as Error)?.message}</div>}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {hint && <p className="text-xs text-muted-foreground mb-1">{hint}</p>}
      {children}
    </div>
  );
}

function StepList({ label, steps, onChange, min }: { label: string; steps: string[]; onChange: (v: string[]) => void; min: number }) {
  const add = () => onChange([...steps, ""]);
  const remove = (i: number) => { if (steps.length > min) onChange(steps.filter((_, idx) => idx !== i)); };
  const update = (i: number, v: string) => onChange(steps.map((s, idx) => idx === i ? v : s));
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {steps.map((s, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <input className="flex-1 px-3 py-2 border rounded-md bg-background" value={s} onChange={e => update(i, e.target.value)} placeholder={`Step ${i + 1}`} />
          {steps.length > min && <button type="button" onClick={() => remove(i)} className="px-3 text-destructive hover:bg-destructive/10 rounded-md">✕</button>}
        </div>
      ))}
      <button type="button" onClick={add} className="text-sm text-primary hover:underline">+ Add step</button>
    </div>
  );
}
