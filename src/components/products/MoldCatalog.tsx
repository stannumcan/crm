"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus, Search, ImagePlus, Loader2, X } from "lucide-react";

const SUPABASE_URL = "https://lwdxvcrvrzlfetelcemt.supabase.co";
const BUCKET = "quote-attachments";
const CATEGORIES = ["Rectangle", "Square", "Round", "Oval", "Polygon", "Sphere", "Novelty", "Specialty"];

interface Mold {
  id: string;
  mold_number: string;
  category: string | null;
  variant: string | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  dimensions: string | null;
  feature: string | null;
  image_url: string | null;
  is_active: boolean;
}

// ── Mold add/edit form ────────────────────────────────────────────────────────
function MoldForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Mold>;
  onSave: (data: Partial<Mold>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    mold_number: initial?.mold_number ?? "",
    category: initial?.category ?? "",
    variant: initial?.variant ?? "",
    length_mm: initial?.length_mm?.toString() ?? "",
    width_mm: initial?.width_mm?.toString() ?? "",
    height_mm: initial?.height_mm?.toString() ?? "",
    feature: initial?.feature ?? "",
    is_active: initial?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (field: string, value: string | boolean | null) =>
    setForm((prev) => ({ ...prev, [field]: value ?? "" }));

  const handleSave = async () => {
    if (!form.mold_number.trim()) { setErr("Mold number is required"); return; }
    setSaving(true);
    setErr("");
    try {
      await onSave({
        mold_number: form.mold_number.trim().toUpperCase(),
        category: form.category || null,
        variant: form.variant.trim() || null,
        length_mm: form.length_mm ? parseFloat(form.length_mm) : null,
        width_mm: form.width_mm ? parseFloat(form.width_mm) : null,
        height_mm: form.height_mm ? parseFloat(form.height_mm) : null,
        feature: form.feature.trim() || null,
        is_active: form.is_active,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unknown error");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Mold Number <span className="text-red-500">*</span></Label>
        <Input value={form.mold_number} onChange={(e) => set("mold_number", e.target.value)} placeholder="ML-1234" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Variant / Type</Label>
          <Input value={form.variant} onChange={(e) => set("variant", e.target.value)} placeholder="e.g. Lid Inside Roll" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Length (mm)</Label>
          <Input type="number" value={form.length_mm} onChange={(e) => set("length_mm", e.target.value)} placeholder="100" />
        </div>
        <div className="space-y-1.5">
          <Label>Width (mm)</Label>
          <Input type="number" value={form.width_mm} onChange={(e) => set("width_mm", e.target.value)} placeholder="100" />
        </div>
        <div className="space-y-1.5">
          <Label>Height (mm)</Label>
          <Input type="number" value={form.height_mm} onChange={(e) => set("height_mm", e.target.value)} placeholder="50" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Feature</Label>
        <Input value={form.feature} onChange={(e) => set("feature", e.target.value)} placeholder="e.g. Handle, Window, Hinge" />
      </div>
      {initial?.id && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} className="rounded" />
          <span className="text-sm">Active (shows in search)</span>
        </label>
      )}
      {err && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{err}</div>}
      <div className="flex gap-3 justify-end pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="button" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
      </div>
    </div>
  );
}

// ── Image cell ────────────────────────────────────────────────────────────────
function ImageCell({
  mold,
  onUploaded,
  onRemoved,
}: {
  mold: Mold;
  onUploaded: (url: string) => void;
  onRemoved: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `mold-images/${mold.id}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (error) throw error;
      const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
      const res = await fetch(`/api/molds/${mold.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: url }),
      });
      if (!res.ok) throw new Error("Failed to save");
      onUploaded(url);
    } catch (err) {
      alert("Upload failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    await fetch(`/api/molds/${mold.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: null }),
    });
    onRemoved();
  };

  return (
    <div className="flex items-center justify-center w-12 h-10">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
      />
      {uploading ? (
        <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
      ) : mold.image_url ? (
        <div className="relative group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mold.image_url}
            alt={mold.mold_number}
            className="w-10 h-10 object-contain rounded border border-border bg-muted"
          />
          {/* Hover overlay with change / remove buttons */}
          <div className="absolute inset-0 rounded bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
            <button
              type="button"
              title="Change image"
              onClick={() => inputRef.current?.click()}
              className="text-white hover:text-yellow-300 transition-colors"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              title="Remove image"
              onClick={handleRemove}
              className="text-white hover:text-red-400 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          title="Upload image"
          onClick={() => inputRef.current?.click()}
          className="w-10 h-10 rounded border border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <ImagePlus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Main catalog ──────────────────────────────────────────────────────────────
export default function MoldCatalog() {
  const [molds, setMolds] = useState<Mold[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editMold, setEditMold] = useState<Mold | null>(null);
  const [addModal, setAddModal] = useState(false);

  const fetchMolds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/molds?all=true");
      setMolds(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMolds(); }, [fetchMolds]);

  const filtered = molds.filter((m) => {
    if (!showInactive && !m.is_active) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.mold_number.toLowerCase().includes(q) ||
      (m.category ?? "").toLowerCase().includes(q) ||
      (m.variant ?? "").toLowerCase().includes(q) ||
      (m.feature ?? "").toLowerCase().includes(q)
    );
  });

  const handleCreate = async (data: Partial<Mold>) => {
    const res = await fetch("/api/molds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
    setAddModal(false);
    fetchMolds();
  };

  const handleUpdate = async (data: Partial<Mold>) => {
    if (!editMold) return;
    const res = await fetch(`/api/molds/${editMold.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
    setEditMold(null);
    fetchMolds();
  };

  const updateMoldImage = (moldId: string, url: string | null) => {
    setMolds((prev) => prev.map((m) => m.id === moldId ? { ...m, image_url: url } : m));
  };

  return (
    <>
      {/* Toolbar */}
      <div className="flex gap-3 items-center mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 h-9"
            placeholder="Search mold number, category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer text-muted-foreground">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
          Show inactive
        </label>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} molds</span>
        <Button size="sm" className="gap-1.5 h-9" onClick={() => setAddModal(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add Mold
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Loading...</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5 w-14">Image</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5 w-28">Mold #</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5 w-28">Category</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5">Variant</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5 w-36">Dimensions</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5 w-24">Feature</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5 w-16">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground py-12">No molds found</td>
                </tr>
              )}
              {filtered.map((m) => (
                <tr key={m.id} className={`align-middle hover:bg-muted/30 transition-colors ${!m.is_active ? "opacity-50" : ""}`}>
                  <td className="px-2 py-1.5">
                    <ImageCell
                      mold={m}
                      onUploaded={(url) => updateMoldImage(m.id, url)}
                      onRemoved={() => updateMoldImage(m.id, null)}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs font-medium">{m.mold_number}</td>
                  <td className="px-3 py-2 text-xs">{m.category ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{m.variant ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{m.dimensions ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{m.feature ?? "—"}</td>
                  <td className="px-3 py-2">
                    {m.is_active
                      ? <Badge variant="outline" className="text-xs text-green-700 border-green-200 bg-green-50">Active</Badge>
                      : <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                    }
                  </td>
                  <td className="pr-2 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setEditMold(m)}
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Mold">
        <MoldForm onSave={handleCreate} onCancel={() => setAddModal(false)} />
      </Modal>

      <Modal open={!!editMold} onClose={() => setEditMold(null)} title={`Edit ${editMold?.mold_number ?? ""}`}>
        {editMold && (
          <MoldForm initial={editMold} onSave={handleUpdate} onCancel={() => setEditMold(null)} />
        )}
      </Modal>
    </>
  );
}
