"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dna, Package, ChefHat, FlaskConical, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiClient, type AssetType } from "@/lib/api/client";

const ASSET_TYPES: { value: AssetType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: "Gene", label: "Gene", icon: <Dna className="h-5 w-5" />, description: "A reusable AI capability or technique" },
  { value: "Capsule", label: "Capsule", icon: <Package className="h-5 w-5" />, description: "A packaged workflow or agent configuration" },
  { value: "Recipe", label: "Recipe", icon: <ChefHat className="h-5 w-5" />, description: "A step-by-step process or prompt template" },
  { value: "Organism", label: "Organism", icon: <FlaskConical className="h-5 w-5" />, description: "A complex multi-component AI system" },
];

const SIGNAL_OPTIONS = [" novelty", " efficiency", " accuracy", " speed", " reliability", " creativity", " safety", " scalability"];

interface FormState { name: string; type: AssetType; description: string; dna: string; signals: string[]; }
interface FormErrors { name?: string; type?: string; description?: string; dna?: string; }
type SubmitStatus = "idle" | "submitting" | "success" | "error";

export default function BrowseNewPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({ name: "", type: "Gene", description: "", dna: "", signals: [] });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [publishedAssetId, setPublishedAssetId] = useState<string>("");

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.name.trim()) newErrors.name = "Name is required";
    else if (form.name.length < 3) newErrors.name = "Name must be at least 3 characters";
    else if (form.name.length > 64) newErrors.name = "Name must be less than 64 characters";
    if (!form.type) newErrors.type = "Asset type is required";
    if (!form.description.trim()) newErrors.description = "Description is required";
    else if (form.description.length < 10) newErrors.description = "Description must be at least 10 characters";
    else if (form.description.length > 500) newErrors.description = "Description must be less than 500 characters";
    if (!form.dna.trim()) newErrors.dna = "DNA code is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitStatus("submitting");
    setErrorMessage("");
    try {
      const response = await apiClient.publish({ name: form.name, type: form.type, description: form.description, dna: form.dna, signals: form.signals.length > 0 ? form.signals : undefined });
      setPublishedAssetId(response.asset_id);
      setSubmitStatus("success");
    } catch (err) {
      setSubmitStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to publish asset");
    }
  };

  const toggleSignal = (signal: string) => {
    setForm((prev) => ({ ...prev, signals: prev.signals.includes(signal) ? prev.signals.filter((s) => s !== signal) : [...prev.signals, signal] }));
  };

  if (submitStatus === "success") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Link href="/browse" className="inline-flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Browse
        </Link>
        <Card className="border-[var(--color-gene-green)]/30 bg-gradient-to-br from-[var(--color-card-background)] to-[var(--color-gene-green)]/5">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4 py-8">
              <div className="rounded-full bg-[var(--color-gene-green)]/10 p-4"><CheckCircle2 className="h-12 w-12 text-[var(--color-gene-green)]" /></div>
              <div className="space-y-2">
                <h2 className="evomap-display text-2xl font-bold">Asset Published!</h2>
                <p className="text-[var(--color-muted-foreground)]">Your {form.type.toLowerCase()} "{form.name}" has been published to the EvoMap ecosystem.</p>
              </div>
              <div className="pt-4 flex gap-3">
                <Button variant="outline" onClick={() => { setSubmitStatus("idle"); setForm({ name: "", type: "Gene", description: "", dna: "", signals: [] }); setPublishedAssetId(""); }}>Publish Another</Button>
                <Button onClick={() => router.push(`/browse/${publishedAssetId}`)}>View Asset</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/browse" className="inline-flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Browse
      </Link>
      <div className="space-y-2">
        <h1 className="evomap-display text-3xl font-bold">Publish Asset</h1>
        <p className="text-[var(--color-muted-foreground)]">Share your AI capability with the EvoMap ecosystem</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Asset Information</CardTitle><CardDescription>Basic details about your asset</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Asset Type *</label>
              <div className="grid grid-cols-2 gap-3">
                {ASSET_TYPES.map((type) => (
                  <button key={type.value} type="button" onClick={() => setForm((prev) => ({ ...prev, type: type.value }))}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${form.type === type.value ? "border-[var(--color-gene-green)] bg-[var(--color-gene-green)]/10 text-[var(--color-gene-green)]" : "border-[var(--color-border-strong)] hover:border-[var(--color-gene-green)]/40"}`}>
                    <div className={form.type === type.value ? "text-[var(--color-gene-green)]" : "text-[var(--color-foreground-soft)]"}>{type.icon}</div>
                    <div className="text-center"><div className="font-medium text-sm">{type.label}</div></div>
                  </button>
                ))}
              </div>
              {errors.type && <p className="text-sm text-[var(--color-destructive)]">{errors.type}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Name *</label>
              <Input id="name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="e.g., context-scheduler"
                className={errors.name ? "border-[var(--color-destructive)]" : ""} />
              {errors.name && <p className="text-sm text-[var(--color-destructive)]">{errors.name}</p>}
              <p className="text-xs text-[var(--color-muted-foreground)]">A unique identifier for your asset (3-64 characters)</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">Description *</label>
              <Textarea id="description" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Describe what this asset does..."
                rows={4} className={errors.description ? "border-[var(--color-destructive)]" : ""} />
              {errors.description && <p className="text-sm text-[var(--color-destructive)]">{errors.description}</p>}
              <p className="text-xs text-[var(--color-muted-foreground)]">{form.description.length}/500 characters</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>DNA Code</CardTitle><CardDescription>The core code or configuration that defines your asset</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="dna" className="text-sm font-medium">DNA / Code *</label>
              <Textarea id="dna" value={form.dna} onChange={(e) => setForm((prev) => ({ ...prev, dna: e.target.value }))} placeholder="Enter the core logic, prompt, or configuration..."
                rows={8} className={`font-mono text-sm ${errors.dna ? "border-[var(--color-destructive)]" : ""}`} />
              {errors.dna && <p className="text-sm text-[var(--color-destructive)]">{errors.dna}</p>}
              <p className="text-xs text-[var(--color-muted-foreground)]">Core implementation: code, prompt template, or configuration object.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Signals (Optional)</CardTitle><CardDescription>Characteristics that describe your asset</CardDescription></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {SIGNAL_OPTIONS.map((signal) => (
                <button key={signal} type="button" onClick={() => toggleSignal(signal)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-all ${form.signals.includes(signal) ? "border-[var(--color-gene-green)] bg-[var(--color-gene-green)]/10 text-[var(--color-gene-green)]" : "border-[var(--color-border-strong)] text-[var(--color-foreground-soft)] hover:border-[var(--color-gene-green)]/40"}`}>
                  {signal}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {submitStatus === "error" && (
          <Card className="border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/5">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-[var(--color-destructive)] shrink-0 mt-0.5" />
                <div><p className="font-medium text-[var(--color-destructive)]">Publishing Failed</p><p className="text-sm text-[var(--color-muted-foreground)]">{errorMessage}</p></div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-end gap-3 pb-6">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={submitStatus === "submitting"}>
            {submitStatus === "submitting" ? <span className="animate-pulse">Publishing...</span> : "Publish Asset"}
          </Button>
        </div>
      </form>
    </div>
  );
}
