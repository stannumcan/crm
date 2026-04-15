"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Trash2, PauseCircle, PlayCircle, Pencil, Loader2, Eye, EyeOff, KeyRound } from "lucide-react";

interface Profile { id: string; name: string; }
interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  profile: {
    display_name: string | null;
    suspended: boolean;
    profile_id: string | null;
    permission_profiles: { id: string; name: string } | null;
  } | null;
}

export default function UserManagement({ profiles }: { profiles: Profile[] }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteProfile, setInviteProfile] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [inviting, setSaving] = useState(false);
  const [inviteErr, setInviteErr] = useState("");

  // Edit modal
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editProfile, setEditProfile] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load");
      setUsers(await res.json());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { setInviteErr("Email is required"); return; }
    if (invitePassword && invitePassword.length < 6) {
      setInviteErr("Password must be at least 6 characters"); return;
    }
    setSaving(true);
    setInviteErr("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          display_name: inviteName,
          profile_id: inviteProfile || null,
          password: invitePassword || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setInviteOpen(false);
      setInviteEmail(""); setInviteName(""); setInviteProfile(""); setInvitePassword("");
      setShowInvitePassword(false);
      fetchUsers();
    } catch (e) {
      setInviteErr(e instanceof Error ? e.message : "Failed to invite");
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async (user: User, suspend: boolean) => {
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: suspend }),
    });
    fetchUsers();
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Delete ${user.email}? This cannot be undone.`)) return;
    await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    fetchUsers();
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditName(user.profile?.display_name ?? "");
    setEditProfile(user.profile?.profile_id ?? "");
    setEditPassword("");
    setShowEditPassword(false);
    setEditErr("");
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    if (editPassword && editPassword.length < 6) {
      setEditErr("Password must be at least 6 characters"); return;
    }
    setEditSaving(true);
    setEditErr("");
    try {
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: editName,
          profile_id: editProfile || null,
          password: editPassword || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setEditUser(null);
      fetchUsers();
    } catch (e) {
      setEditErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setEditSaving(false);
    }
  };

  const isSuspended = (u: User) => u.profile?.suspended || (!!u.banned_until && new Date(u.banned_until) > new Date());

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold">Users</h2>
          <p className="text-sm text-muted-foreground">{users.length} total</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4" /> Invite User
        </Button>
      </div>

      {err && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mb-4">{err}</div>}

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Name / Email</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Permission Profile</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Status</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Last Sign In</th>
              <th className="w-32" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {loading && (
              <tr><td colSpan={5} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
            )}
            {!loading && users.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">No users yet. Invite someone to get started.</td></tr>
            )}
            {users.map((u) => {
              const suspended = isSuspended(u);
              return (
                <tr key={u.id} className={`hover:bg-muted/30 transition-colors ${suspended ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    {u.profile?.display_name && (
                      <p className="font-medium text-sm">{u.profile.display_name}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {u.profile?.permission_profiles ? (
                      <Badge variant="outline" className="text-xs">{u.profile.permission_profiles.name}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No profile</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {suspended
                      ? <Badge variant="destructive" className="text-xs">Suspended</Badge>
                      : <Badge variant="outline" className="text-xs text-green-700 border-green-200 bg-green-50">Active</Badge>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit" onClick={() => openEdit(u)}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-7 w-7 p-0"
                        title={suspended ? "Activate" : "Suspend"}
                        onClick={() => handleSuspend(u, !suspended)}
                      >
                        {suspended
                          ? <PlayCircle className="h-3.5 w-3.5 text-green-600" />
                          : <PauseCircle className="h-3.5 w-3.5 text-amber-500" />
                        }
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Delete" onClick={() => handleDelete(u)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Invite modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite User">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email <span className="text-red-500">*</span></Label>
            <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="user@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Display Name</Label>
            <Input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Full name" />
          </div>
          <div className="space-y-1.5">
            <Label>Permission Profile</Label>
            <Select value={inviteProfile} onValueChange={(v) => setInviteProfile(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Select profile..." /></SelectTrigger>
              <SelectContent>
                {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Initial Password <span className="text-xs text-muted-foreground font-normal">— optional</span></Label>
            <p className="text-xs text-muted-foreground">
              If set, the user is created with this password and can sign in immediately.
              Leave blank to send a magic-link invite instead.
            </p>
            <div className="relative">
              <Input
                type={showInvitePassword ? "text" : "password"}
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                placeholder="At least 6 characters"
                className="pr-9 font-mono"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowInvitePassword(!showInvitePassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showInvitePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {inviteErr && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{inviteErr}</div>}
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? "Saving..." : invitePassword ? "Create User" : "Send Invite"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Edit ${editUser?.email ?? ""}`}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Display Name</Label>
            <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Full name" />
          </div>
          <div className="space-y-1.5">
            <Label>Permission Profile</Label>
            <Select value={editProfile} onValueChange={(v) => setEditProfile(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Select profile..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">No profile</SelectItem>
                {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Set Password */}
          <div className="space-y-1.5 rounded-lg border p-3" style={{ borderColor: "oklch(0.88 0.04 230)", background: "oklch(0.98 0.01 230)" }}>
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-blue-600" />
              Set New Password <span className="text-xs text-muted-foreground font-normal">— optional</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Overrides the user&apos;s current password. They&apos;ll need to sign in with this new password.
              Leave blank to keep existing password.
            </p>
            <div className="relative">
              <Input
                type={showEditPassword ? "text" : "password"}
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="pr-9 font-mono h-8"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowEditPassword(!showEditPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {editErr && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{editErr}</div>}
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editSaving}>{editSaving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
