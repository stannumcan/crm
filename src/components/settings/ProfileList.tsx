"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Users, Loader2 } from "lucide-react";

interface Profile {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface Props {
  profiles: Profile[];
  userCounts: Record<string, number>;
  locale: string;
}

export default function ProfileList({ profiles: initial, userCounts, locale }: Props) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>(initial);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) { setCreateErr("Name is required"); return; }
    setCreating(true);
    setCreateErr("");
    try {
      const res = await fetch("/api/admin/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const created: Profile = await res.json();
      setProfiles((prev) => [...prev, created]);
      setCreateOpen(false);
      setNewName(""); setNewDesc("");
      // Navigate to editor for the new profile
      router.push(`/${locale}/settings/profiles/${created.id}`);
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : "Failed to create profile");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (profile: Profile) => {
    const count = userCounts[profile.id] ?? 0;
    const msg = count > 0
      ? `Delete "${profile.name}"? ${count} user${count > 1 ? "s" : ""} will lose their profile assignment.`
      : `Delete "${profile.name}"? This cannot be undone.`;
    if (!confirm(msg)) return;
    await fetch(`/api/admin/profiles/${profile.id}`, { method: "DELETE" });
    setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold">Permission Profiles</h2>
          <p className="text-sm text-muted-foreground">{profiles.length} profile{profiles.length !== 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New Profile
        </Button>
      </div>

      {profiles.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg py-12 text-center text-sm text-muted-foreground">
          No profiles yet. Create one to control what users can see and do.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Profile Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Description</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Users</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{p.description ?? <span className="italic">—</span>}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Users className="h-3 w-3" />
                      {userCounts[p.id] ?? 0}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost" size="sm" className="h-7 w-7 p-0"
                        title="Edit permissions"
                        onClick={() => router.push(`/${locale}/settings/profiles/${p.id}`)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-7 w-7 p-0"
                        title="Delete"
                        onClick={() => handleDelete(p)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Permission Profile">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name <span className="text-red-500">*</span></Label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Sales Rep" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional description" />
          </div>
          {createErr && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{createErr}</div>
          )}
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Creating...</> : "Create & Edit"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
