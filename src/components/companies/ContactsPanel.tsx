"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Plus, Pencil, Trash2, Star, Phone, Mail } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  name_ja: string | null;
  title: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  phone_direct: string | null;
  is_primary: boolean;
  notes: string | null;
}

function emptyContact(): Omit<Contact, "id"> {
  return {
    name: "", name_ja: null, title: null, department: null,
    email: null, phone: null, phone_direct: null, is_primary: false, notes: null,
  };
}

export default function ContactsPanel({
  companyId,
  initialContacts,
  locale,
}: {
  companyId: string;
  initialContacts: Contact[];
  locale: string;
}) {
  const [contacts, setContacts] = useState<Contact[]>(
    [...initialContacts].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(emptyContact());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const openNew = () => {
    setEditing(null);
    setForm(emptyContact());
    setError("");
    setModalOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditing(contact);
    setForm({ ...contact });
    setError("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      name_ja: form.name_ja || null,
      title: form.title || null,
      department: form.department || null,
      email: form.email || null,
      phone: form.phone || null,
      phone_direct: form.phone_direct || null,
      is_primary: form.is_primary,
      notes: form.notes || null,
    };

    try {
      if (editing) {
        const res = await fetch(`/api/companies/${companyId}/contacts`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, ...payload }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        const updated = await res.json();
        setContacts((prev) => {
          let arr = prev.map((c) => c.id === editing.id ? updated : c);
          if (updated.is_primary) arr = arr.map((c) => c.id !== updated.id ? { ...c, is_primary: false } : c);
          return arr.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
        });
      } else {
        const res = await fetch(`/api/companies/${companyId}/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        const created = await res.json();
        setContacts((prev) => {
          let arr = [...prev, created];
          if (created.is_primary) arr = arr.map((c) => c.id !== created.id ? { ...c, is_primary: false } : c);
          return arr.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
        });
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contact: Contact) => {
    if (!confirm(`Remove ${contact.name}?`)) return;
    try {
      await fetch(`/api/companies/${companyId}/contacts?contact_id=${contact.id}`, { method: "DELETE" });
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
    } catch {
      alert("Failed to delete contact");
    }
  };

  const setF = (field: keyof typeof form, value: string | boolean | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm">Contacts ({contacts.length})</CardTitle>
          <Button size="sm" variant="outline" className="gap-1" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" />
            Add Contact
          </Button>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <p className="text-sm">No contacts added yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 group">
                  {/* Avatar */}
                  <div className="flex-shrink-0 h-9 w-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{contact.name}</span>
                      {contact.name_ja && <span className="text-gray-400 text-xs">{contact.name_ja}</span>}
                      {contact.is_primary && (
                        <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 gap-1">
                          <Star className="h-2.5 w-2.5" />
                          Primary
                        </Badge>
                      )}
                    </div>
                    {(contact.title || contact.department) && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[contact.title, contact.department].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-1">
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </a>
                      )}
                      {contact.phone && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </span>
                      )}
                      {contact.phone_direct && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Phone className="h-3 w-3" />
                          Direct: {contact.phone_direct}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(contact)}>
                      <Pencil className="h-3.5 w-3.5 text-gray-400" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(contact)}>
                      <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit — ${editing.name}` : "Add Contact"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input value={form.name} onChange={(e) => setF("name", e.target.value)} placeholder="e.g. Natsuki Tanaka" />
            </div>
            <div className="space-y-2">
              <Label>Japanese Name</Label>
              <Input value={form.name_ja ?? ""} onChange={(e) => setF("name_ja", e.target.value)} placeholder="e.g. 田中奈津樹" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title / 役職</Label>
              <Input value={form.title ?? ""} onChange={(e) => setF("title", e.target.value)} placeholder="e.g. 部長, Manager" />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={form.department ?? ""} onChange={(e) => setF("department", e.target.value)} placeholder="e.g. 購買部" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email ?? ""} onChange={(e) => setF("email", e.target.value)} placeholder="tanaka@company.co.jp" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone ?? ""} onChange={(e) => setF("phone", e.target.value)} placeholder="06-1234-5678" />
            </div>
            <div className="space-y-2">
              <Label>Direct Line</Label>
              <Input value={form.phone_direct ?? ""} onChange={(e) => setF("phone_direct", e.target.value)} placeholder="Direct / Mobile" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <textarea
              className="w-full min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.notes ?? ""}
              onChange={(e) => setF("notes", e.target.value)}
              placeholder="Any notes..."
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_primary}
              onChange={(e) => setF("is_primary", e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium">Primary contact</span>
          </label>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Add Contact"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
