"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Loader2, CheckSquare, Square } from "lucide-react";
import { PAGE_PERMISSIONS, FIELD_PERMISSIONS, type PageKey, type FieldFormKey } from "@/lib/permissions";

interface Profile {
  id: string;
  name: string;
  description: string | null;
  permissions: Record<string, unknown>;
}

interface Props {
  profile: Profile;
  locale: string;
}

type Permissions = {
  pages: Record<string, Record<string, boolean>>;
  fields: Record<string, Record<string, boolean>>;
};

function toEditable(raw: Record<string, unknown>): Permissions {
  const pages = (raw.pages ?? {}) as Record<string, Record<string, boolean>>;
  const fields = (raw.fields ?? {}) as Record<string, Record<string, boolean>>;
  return { pages, fields };
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-6 mb-2 first:mt-0">
      {children}
    </h3>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none group">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="text-primary focus:outline-none"
        aria-checked={checked}
        role="checkbox"
      >
        {checked
          ? <CheckSquare className="h-4 w-4 text-primary" />
          : <Square className="h-4 w-4 text-muted-foreground group-hover:text-primary/60 transition-colors" />
        }
      </button>
      <span className="text-sm">{label}</span>
    </label>
  );
}

export default function ProfileEditor({ profile, locale }: Props) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description ?? "");
  const [perms, setPerms] = useState<Permissions>(() => toEditable(profile.permissions ?? {}));
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [saved, setSaved] = useState(false);

  const setPage = (key: string, action: string, value: boolean) => {
    setPerms((prev) => ({
      ...prev,
      pages: {
        ...prev.pages,
        [key]: { ...(prev.pages[key] ?? {}), [action]: value },
      },
    }));
  };

  const setAllPage = (key: string, value: boolean) => {
    const actions = PAGE_PERMISSIONS[key as PageKey].actions;
    setPerms((prev) => ({
      ...prev,
      pages: {
        ...prev.pages,
        [key]: Object.fromEntries(actions.map((a) => [a, value])),
      },
    }));
  };

  const setField = (formKey: string, fieldKey: string, value: boolean) => {
    setPerms((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        [formKey]: { ...(prev.fields[formKey] ?? {}), [fieldKey]: value },
      },
    }));
  };

  const setAllFields = (formKey: string, value: boolean) => {
    const fieldKeys = Object.keys(FIELD_PERMISSIONS[formKey as FieldFormKey].fields);
    setPerms((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        [formKey]: Object.fromEntries(fieldKeys.map((k) => [k, value])),
      },
    }));
  };

  const handleSave = async () => {
    if (!name.trim()) { setSaveErr("Name is required"); return; }
    setSaving(true);
    setSaveErr("");
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/profiles/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          permissions: perms,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Group page permissions by group label
  const groups: Record<string, { key: string; def: (typeof PAGE_PERMISSIONS)[PageKey] }[]> = {};
  for (const [key, def] of Object.entries(PAGE_PERMISSIONS)) {
    if (!groups[def.group]) groups[def.group] = [];
    groups[def.group].push({ key, def });
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost" size="sm" className="h-8 w-8 p-0"
          onClick={() => router.push(`/${locale}/settings/profiles`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Edit Profile</h2>
          <p className="text-xs text-muted-foreground">Configure what users with this profile can see and do</p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
            : saved
              ? <><Save className="h-4 w-4" /> Saved!</>
              : <><Save className="h-4 w-4" /> Save</>
          }
        </Button>
      </div>

      {saveErr && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mb-4">{saveErr}</div>
      )}

      {/* Basic info */}
      <div className="border border-border rounded-lg bg-card p-4 mb-4 space-y-3">
        <div className="space-y-1.5">
          <Label>Profile Name <span className="text-red-500">*</span></Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sales Rep" className="max-w-sm" />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" className="max-w-sm" />
        </div>
      </div>

      {/* Page permissions */}
      <div className="border border-border rounded-lg bg-card p-4 mb-4">
        <h3 className="text-sm font-semibold mb-4">Page Access</h3>
        {Object.entries(groups).map(([groupName, items]) => (
          <div key={groupName} className="mb-5 last:mb-0">
            <SectionHeader>{groupName}</SectionHeader>
            <div className="space-y-3">
              {items.map(({ key, def }) => {
                const pagePerms = perms.pages[key] ?? {};
                const allChecked = def.actions.every((a) => pagePerms[a]);
                const someChecked = def.actions.some((a) => pagePerms[a]);
                return (
                  <div key={key} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium">{def.label}</span>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => setAllPage(key, !allChecked)}
                      >
                        {allChecked ? "Deselect all" : someChecked ? "Select all" : "Select all"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {def.actions.map((action) => (
                        <Checkbox
                          key={action}
                          checked={!!pagePerms[action]}
                          onChange={(v) => setPage(key, action, v)}
                          label={action.charAt(0).toUpperCase() + action.slice(1)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Field permissions */}
      <div className="border border-border rounded-lg bg-card p-4">
        <h3 className="text-sm font-semibold mb-4">Field Visibility</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Control which fields are visible to users with this profile. Hidden fields are omitted from forms and views.
        </p>
        <div className="space-y-4">
          {Object.entries(FIELD_PERMISSIONS).map(([formKey, formDef]) => {
            const formPerms = perms.fields[formKey] ?? {};
            const fieldKeys = Object.keys(formDef.fields);
            const allChecked = fieldKeys.every((f) => formPerms[f]);
            return (
              <div key={formKey} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{formDef.label}</span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => setAllFields(formKey, !allChecked)}
                  >
                    {allChecked ? "Deselect all" : "Select all"}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.entries(formDef.fields) as [string, string][]).map(([fieldKey, fieldLabel]) => (
                    <Checkbox
                      key={fieldKey}
                      checked={!!formPerms[fieldKey]}
                      onChange={(v) => setField(formKey, fieldKey, v)}
                      label={fieldLabel}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
            : <><Save className="h-4 w-4" /> Save Changes</>
          }
        </Button>
      </div>
    </div>
  );
}
