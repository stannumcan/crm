"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Loader2, StickyNote, Check, X } from "lucide-react";

export default function WorkorderNotes({
  workorderId,
  initialNotes,
}: {
  workorderId: string;
  initialNotes: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setErr("");
    try {
      const res = await fetch(`/api/workorders/${workorderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      setEditing(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setValue(initialNotes ?? "");
    setEditing(false);
    setErr("");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-amber-500" />
          Notes
        </CardTitle>
        {!editing && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Add any internal notes about this workorder..."
              className="w-full min-h-[120px] rounded-md border px-3 py-2 text-sm resize-y outline-none focus:border-primary"
              style={{ borderColor: "var(--border)", background: "var(--background)" }}
              autoFocus
            />
            {err && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {err}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving} className="gap-1">
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </Button>
            </div>
          </div>
        ) : initialNotes ? (
          <p className="text-sm whitespace-pre-wrap text-foreground">{initialNotes}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No notes yet. Click Edit to add.</p>
        )}
      </CardContent>
    </Card>
  );
}
