"use client";

import { useState, useEffect } from "react";
import { X, Trash2, Tag, Type, AlignLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useEditorStore, type EditorNode, type NodeType } from "@/lib/stores/editor-store";

interface NodeEditPanelProps { nodeId: string | null; onClose: () => void; }

const TC: Record<NodeType, string> = {
  Gene: "bg-[var(--color-gene-green)]",
  Capsule: "bg-[var(--color-capsule-blue)]",
  Recipe: "bg-[var(--color-recipe-amber)]",
  Organism: "bg-[var(--color-organism-purple)]",
};

export function NodeEditPanel({ nodeId, onClose }: NodeEditPanelProps) {
  const { nodes, updateNode, deleteNode } = useEditorStore();
  const node = nodes.find((n) => n.id === nodeId) ?? null;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    if (node) { setName(node.name); setDescription(node.description ?? ""); setTags(node.tags ?? []); }
  }, [node]);

  if (!node) return null;

  const currentNodeId = node.id;
  function save() { updateNode(currentNodeId, { name, description, tags }); }
  function handleDelete() { deleteNode(currentNodeId); onClose(); }
  function addTag() {
    const t = newTag.trim();
    if (t && !tags.includes(t)) { setTags([...tags, t]); setNewTag(""); }
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] shadow-lg">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${TC[node.type]}`} /><span className="text-xs font-medium text-[var(--color-muted-foreground)]">Edit Node</span></div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-1"><label className="text-xs font-medium text-[var(--color-muted-foreground)]">Type</label><Badge variant="outline" className="gap-1.5"><span className={`h-2 w-2 rounded-full ${TC[node.type]}`} />{node.type}</Badge></div>
        <div className="space-y-1"><label className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted-foreground)]"><Type className="h-3 w-3" />Name</label><Input value={name} onChange={(e) => setName(e.target.value)} onBlur={save} placeholder="Node name" className="h-9" /></div>
        <div className="space-y-1"><label className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted-foreground)]"><AlignLeft className="h-3 w-3" />Description</label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} onBlur={save} placeholder="Describe this node..." rows={3} className="resize-none text-sm" /></div>
        <div className="space-y-2"><label className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted-foreground)]"><Tag className="h-3 w-3" />Tags</label>
          <div className="flex flex-wrap gap-1.5">{tags.map((t) => (<Badge key={t} variant="secondary" className="gap-1 text-xs">{t}<button onClick={() => setTags(tags.filter((x) => x !== t))} className="ml-0.5 rounded hover:text-destructive"><X className="h-3 w-3" /></button></Badge>))}</div>
          <div className="flex gap-1.5"><Input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); }}} placeholder="Add tag..." className="h-8 text-xs" /><Button size="sm" variant="secondary" className="h-8 px-2" onClick={addTag}>Add</Button></div>
        </div>
        <div className="space-y-1"><label className="text-xs font-medium text-[var(--color-muted-foreground)]">Position</label><div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-xs font-mono text-[var(--color-muted-foreground)]">x: {node.position.x.toFixed(1)}, y: {node.position.y.toFixed(1)}</div></div>
      </div>
      <div className="border-t border-[var(--color-border)] p-3"><Button variant="destructive" size="sm" className="w-full gap-1.5" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5" />Delete Node</Button></div>
    </div>
  );
}