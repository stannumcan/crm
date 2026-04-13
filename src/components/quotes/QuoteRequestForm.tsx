"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertCircle, Paperclip, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Modal } from "@/components/ui/modal";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";

// ── Types ──────────────────────────────────────────────────────────────────

interface PrintingLine { surface: string; part: string; spec: string }
interface EmbossingLine { component: string; notes: string }

interface LineItem {
  id: string;
  type: "existing" | "new";
  mold_number: string;
  size: string;
  thickness: string;
  design_count: string;
  variant_label: string;
  printing_lines: PrintingLine[];
  embossing_lines: EmbossingLine[];
  expanded: boolean;
}

interface MoldRecord {
  id: string;
  mold_number: string;
  category: string;
  variant: string;
  dimensions: string;
  feature: string | null;
}

interface QuantityTier {
  id: string;
  tier_label: string;
  quantity_type: "units" | "fcl_20ft" | "fcl_40ft";
  quantity: string;
  tier_notes: string;
}

interface WOOption { id: string; wo_number: string; project_name: string }

// ── Printing constants ─────────────────────────────────────────────────────

const SURFACE_KEYS = ["outside", "inside"] as const;
const PART_KEYS = ["lid", "body", "bottom", "lid_body", "lid_body_bottom"] as const;
const SURFACE_LABELS: Record<string, Record<string, string>> = {
  outside: { en: "Outside", ja: "外面" }, inside: { en: "Inside", ja: "内面" },
};
const PART_LABELS: Record<string, Record<string, string>> = {
  lid: { en: "Lid", ja: "蓋" }, body: { en: "Body", ja: "身" }, bottom: { en: "Bottom", ja: "底" },
  lid_body: { en: "Lid & Body", ja: "蓋・身" }, lid_body_bottom: { en: "Lid, Body & Bottom", ja: "蓋・身・底" },
};
const PART_TO_KEY: Record<string, string> = {};
for (const [key, labels] of Object.entries(PART_LABELS)) {
  PART_TO_KEY[key] = key;
  for (const v of Object.values(labels)) PART_TO_KEY[v] = key;
}

function surfaceLabel(key: string, lang: string) { return SURFACE_LABELS[key]?.[lang] ?? key; }
function partLabel(key: string, lang: string) { return PART_LABELS[key]?.[lang] ?? key; }

// ── Helpers ────────────────────────────────────────────────────────────────

function makeLineItem(partial?: Partial<LineItem>): LineItem {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    type: "existing",
    mold_number: "",
    size: "",
    thickness: "",
    design_count: "1",
    variant_label: "",
    printing_lines: [{ surface: "outside", part: "", spec: "" }],
    embossing_lines: [],
    expanded: true,
    ...partial,
  };
}

function duplicateLineItem(item: LineItem): LineItem {
  return {
    ...item,
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    variant_label: item.variant_label ? `${item.variant_label} (copy)` : "copy",
    expanded: true,
  };
}

// ── Quick-create modals ────────────────────────────────────────────────────

function QuickWOForm({ companyId, companyName, onCreated, onCancel }: {
  companyId: string; companyName: string; onCreated: (wo: WOOption) => void; onCancel: () => void;
}) {
  const [projectName, setProjectName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const handleSave = async () => {
    if (!projectName.trim()) { setErr("Project name is required"); return; }
    setSaving(true); setErr("");
    try {
      const res = await fetch("/api/workorders", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: companyName, company_id: companyId, project_name: projectName.trim() }) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const wo = await res.json();
      onCreated({ id: wo.id, wo_number: wo.wo_number, project_name: wo.project_name });
    } catch (e) { setErr(e instanceof Error ? e.message : "Unknown error"); setSaving(false); }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Creating a workorder for <strong>{companyName}</strong>.</p>
      <div className="space-y-2">
        <Label>Project Name <span className="text-red-500">*</span></Label>
        <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Star Shaped Tin New Mold" autoFocus />
      </div>
      {err && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{err}</div>}
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="button" onClick={handleSave} disabled={saving}>{saving ? "Creating..." : "Create Workorder"}</Button>
      </div>
    </div>
  );
}

function QuickCompanyForm({ initialName, onCreated, onCancel }: {
  initialName: string; onCreated: (company: { id: string; name: string; name_ja: string | null }) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [nameJa, setNameJa] = useState("");
  const [nameZh, setNameZh] = useState("");
  const [country, setCountry] = useState("JP");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const handleSave = async () => {
    if (!name.trim()) { setErr("Name is required"); return; }
    setSaving(true); setErr("");
    try {
      const res = await fetch("/api/companies", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), name_ja: nameJa || null, name_zh: nameZh || null, country }) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      onCreated(await res.json());
    } catch (e) { setErr(e instanceof Error ? e.message : "Unknown error"); setSaving(false); }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Fill in basic details — you can complete the full profile later.</p>
      <div className="space-y-2">
        <Label>Company Name <span className="text-red-500">*</span></Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Japanese Name</Label><Input value={nameJa} onChange={(e) => setNameJa(e.target.value)} placeholder="e.g. ユニバーサル・スタジオ" /></div>
        <div className="space-y-2"><Label>Chinese Name</Label><Input value={nameZh} onChange={(e) => setNameZh(e.target.value)} /></div>
      </div>
      <div className="space-y-2">
        <Label>Country</Label>
        <Select value={country} onValueChange={(v) => v && setCountry(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="JP">Japan (JP)</SelectItem>
            <SelectItem value="CN">China (CN)</SelectItem>
            <SelectItem value="CA">Canada (CA)</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {err && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{err}</div>}
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="button" onClick={handleSave} disabled={saving}>{saving ? "Creating..." : "Create Company"}</Button>
      </div>
    </div>
  );
}

// ── Main Form ──────────────────────────────────────────────────────────────

const TIER_LABELS = ["A", "B", "C", "D", "E", "F"];

export default function QuoteRequestForm({
  locale,
  prefilledWoId, prefilledWoNumber, prefilledCompanyId, prefilledCompanyName,
}: {
  locale: string;
  prefilledWoId?: string; prefilledWoNumber?: string;
  prefilledCompanyId?: string; prefilledCompanyName?: string;
}) {
  const t = useTranslations("quotes");
  const tw = useTranslations("workorders");
  const tc = useTranslations("common");
  const router = useRouter();
  const lang = (locale === "ja" || locale === "zh") ? "ja" : "en";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Company selector
  const [companyOptions, setCompanyOptions] = useState<ComboboxOption[]>([]);
  const [companySearchLoading, setCompanySearchLoading] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(prefilledCompanyId ?? "");
  const [selectedCompanyName, setSelectedCompanyName] = useState(prefilledCompanyName ?? "");
  const [newCompanyModal, setNewCompanyModal] = useState(false);
  const [newCompanyInitialName, setNewCompanyInitialName] = useState("");

  // ── Workorder selector
  const [woOptions, setWoOptions] = useState<WOOption[]>([]);
  const [woComboOptions, setWoComboOptions] = useState<ComboboxOption[]>([]);
  const [woLoading, setWoLoading] = useState(false);
  const [selectedWoId, setSelectedWoId] = useState(prefilledWoId ?? "");
  const [selectedWoNumber, setSelectedWoNumber] = useState(prefilledWoNumber ?? "");
  const [newWoModal, setNewWoModal] = useState(false);

  // ── Request info
  const [urgency, setUrgency] = useState(false);
  const [shippingInfoRequired, setShippingInfoRequired] = useState(false);

  // ── Line items (replaces old molds + shared printing/embossing)
  const [lineItems, setLineItems] = useState<LineItem[]>([makeLineItem()]);

  // ── Quantity tiers
  const [tiers, setTiers] = useState<QuantityTier[]>([
    { id: "1", tier_label: "A", quantity_type: "units", quantity: "", tier_notes: "" },
    { id: "2", tier_label: "B", quantity_type: "units", quantity: "", tier_notes: "" },
  ]);

  const [internalNotes, setInternalNotes] = useState("");
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [sessionId] = useState(() => crypto.randomUUID());

  // ── Company/WO fetchers
  const fetchCompanies = async (q: string) => {
    setCompanySearchLoading(true);
    try {
      const res = await fetch(`/api/companies?q=${encodeURIComponent(q)}`);
      const data = await res.json() as { id: string; name: string; name_ja: string | null; city: string | null; prefecture: string | null }[];
      setCompanyOptions(data.map((c) => ({
        value: c.id, label: c.name,
        sublabel: [c.name_ja, c.city, c.prefecture].filter(Boolean).join(" · ") || undefined,
      })));
    } catch {} finally { setCompanySearchLoading(false); }
  };

  const fetchWorkorders = async (companyId: string, keepSelection = false) => {
    setWoLoading(true);
    if (!keepSelection) { setSelectedWoId(""); setSelectedWoNumber(""); }
    try {
      const res = await fetch(`/api/workorders?company_id=${companyId}`);
      const data = await res.json() as WOOption[];
      setWoOptions(data);
      setWoComboOptions(data.map((w) => ({ value: w.id, label: w.wo_number, sublabel: w.project_name })));
    } catch {} finally { setWoLoading(false); }
  };

  useEffect(() => {
    fetchCompanies("");
    if (prefilledCompanyId && prefilledCompanyName) {
      setCompanyOptions([{ value: prefilledCompanyId, label: prefilledCompanyName }]);
    }
    if (prefilledCompanyId) fetchWorkorders(prefilledCompanyId, true);
    if (prefilledWoId && prefilledWoNumber) {
      setWoComboOptions([{ value: prefilledWoId, label: prefilledWoNumber, sublabel: "" }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCompanySelect = (option: ComboboxOption) => {
    setSelectedCompanyId(option.value); setSelectedCompanyName(option.label);
    fetchWorkorders(option.value);
  };

  // ── Mold search
  const [moldOptions, setMoldOptions] = useState<Record<string, ComboboxOption[]>>({});
  const [moldSearchCache, setMoldSearchCache] = useState<Record<string, ComboboxOption[]>>({});

  const searchMolds = async (itemId: string, q: string) => {
    const cacheKey = q.toLowerCase();
    if (moldSearchCache[cacheKey]) { setMoldOptions((prev) => ({ ...prev, [itemId]: moldSearchCache[cacheKey] })); return; }
    try {
      const res = await fetch(`/api/molds?q=${encodeURIComponent(q)}`);
      const data = await res.json() as MoldRecord[];
      const opts = data.map((m) => ({
        value: m.mold_number, label: m.mold_number,
        sublabel: [m.variant, m.dimensions, m.feature].filter(Boolean).join(" · "),
      }));
      setMoldSearchCache((prev) => ({ ...prev, [cacheKey]: opts }));
      setMoldOptions((prev) => ({ ...prev, [itemId]: opts }));
    } catch {}
  };

  // ── Line item handlers
  const updateItem = (id: string, fields: Partial<LineItem>) =>
    setLineItems((prev) => prev.map((li) => li.id === id ? { ...li, ...fields } : li));

  const removeItem = (id: string) => {
    if (lineItems.length > 1) setLineItems((prev) => prev.filter((li) => li.id !== id));
  };

  const updatePrintingLine = (itemId: string, idx: number, field: keyof PrintingLine, val: string) =>
    setLineItems((prev) => prev.map((li) => li.id !== itemId ? li : {
      ...li, printing_lines: li.printing_lines.map((ln, i) => i === idx ? { ...ln, [field]: val } : ln),
    }));

  const addPrintingLine = (itemId: string) =>
    setLineItems((prev) => prev.map((li) => li.id !== itemId ? li : {
      ...li, printing_lines: [...li.printing_lines, { surface: "outside", part: "", spec: "" }],
    }));

  const removePrintingLine = (itemId: string, idx: number) =>
    setLineItems((prev) => prev.map((li) => li.id !== itemId ? li : {
      ...li, printing_lines: li.printing_lines.filter((_, i) => i !== idx),
    }));

  const updateEmbossingLine = (itemId: string, idx: number, field: keyof EmbossingLine, val: string) =>
    setLineItems((prev) => prev.map((li) => li.id !== itemId ? li : {
      ...li, embossing_lines: li.embossing_lines.map((ln, i) => i === idx ? { ...ln, [field]: val } : ln),
    }));

  const addEmbossingLine = (itemId: string) =>
    setLineItems((prev) => prev.map((li) => li.id !== itemId ? li : {
      ...li, embossing_lines: [...li.embossing_lines, { component: "", notes: "" }],
    }));

  const removeEmbossingLine = (itemId: string, idx: number) =>
    setLineItems((prev) => prev.map((li) => li.id !== itemId ? li : {
      ...li, embossing_lines: li.embossing_lines.filter((_, i) => i !== idx),
    }));

  // ── Tier handlers
  const addTier = () => {
    if (tiers.length >= 6) return;
    setTiers([...tiers, { id: Date.now().toString(), tier_label: TIER_LABELS[tiers.length], quantity_type: "units", quantity: "", tier_notes: "" }]);
  };
  const removeTier = (id: string) => { if (tiers.length > 1) setTiers(tiers.filter((t) => t.id !== id)); };
  const updateTier = (id: string, field: keyof QuantityTier, value: string) =>
    setTiers(tiers.map((t) => t.id === id ? { ...t, [field]: value } : t));

  // ── Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) { setError("Please select a company."); return; }
    if (!selectedWoId) { setError("Please select a workorder."); return; }
    const validItems = lineItems.filter((li) => li.mold_number.trim());
    if (validItems.length === 0) { setError("Add at least one line item with a mold."); return; }
    setLoading(true); setError("");

    const payload = {
      wo_id: selectedWoId,
      urgency,
      shipping_info_required: shippingInfoRequired,
      molds: validItems.map((li, idx) => ({
        line: idx + 1,
        type: li.type,
        value: li.mold_number.trim(),
        size: li.size.trim() || null,
        thickness: li.thickness.trim() || null,
        design_count: parseInt(li.design_count) || 1,
        variant_label: li.variant_label.trim() || null,
        printing_lines: li.printing_lines.filter((ln) => ln.spec || ln.part),
        embossing_lines: li.embossing_lines.filter((ln) => ln.component),
      })),
      internal_notes: internalNotes || null,
      attachments: attachments.length ? attachments : null,
      status: "pending_factory",
      quantity_tiers: tiers.map((t, i) => ({
        tier_label: t.tier_label,
        quantity_type: t.quantity_type,
        quantity: t.quantity_type === "units" ? (parseInt(t.quantity) || null) : null,
        tier_notes: t.tier_notes || null,
        sort_order: i,
      })),
    };

    try {
      const res = await fetch("/api/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error ?? "Failed to create quote"); }
      const quote = await res.json();
      router.push(`/${locale}/quotes/${quote.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">

        {/* Company + Workorder */}
        <Card>
          <CardHeader><CardTitle className="text-base">{tw("title")} &amp; {t("customer")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("company")} <span className="text-red-500">*</span></Label>
              <Combobox
                options={companyOptions} value={selectedCompanyId}
                onSelect={handleCompanySelect}
                onSearch={fetchCompanies} loading={companySearchLoading}
                onAddNew={(name) => { setNewCompanyInitialName(name); setNewCompanyModal(true); }}
                addNewLabel="Add new company"
                placeholder={t("companyPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{tw("title")} <span className="text-red-500">*</span></Label>
              <Combobox
                options={woComboOptions} value={selectedWoId}
                onSelect={(opt) => { setSelectedWoId(opt.value); setSelectedWoNumber(opt.label); }}
                onSearch={() => {}} loading={woLoading}
                onAddNew={() => setNewWoModal(true)}
                addNewLabel="Create new workorder"
                placeholder="Select workorder..."
                disabled={!selectedCompanyId}
              />
              {selectedWoId && (() => {
                const wo = woOptions.find((w) => w.id === selectedWoId);
                return <p className="text-xs text-green-600">✓ {wo?.wo_number} — {wo?.project_name}</p>;
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Request Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t("requestInfo")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={urgency} onChange={(e) => setUrgency(e.target.checked)} className="rounded" />
                <span className="text-sm font-medium">{t("urgency")}</span>
                {urgency && <Badge variant="destructive" className="text-xs">URGENT</Badge>}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={shippingInfoRequired} onChange={(e) => setShippingInfoRequired(e.target.checked)} className="rounded" />
                <span className="text-sm font-medium">{t("shippingInfoRequired")}</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Line Items</h3>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setLineItems((prev) => [...prev, makeLineItem()])} className="gap-1 h-7 text-xs">
                <Plus className="h-3 w-3" /> Add Line Item
              </Button>
            </div>
          </div>

          {lineItems.map((item, itemIdx) => (
            <Card key={item.id} className={item.expanded ? "" : "bg-muted/20"}>
              {/* Line item header — always visible */}
              <CardHeader className="pb-2 cursor-pointer" onClick={() => updateItem(item.id, { expanded: !item.expanded })}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs">{itemIdx + 1}</Badge>
                    <span className="font-mono text-sm font-semibold">{item.mold_number || "New item"}</span>
                    {item.variant_label && <Badge variant="secondary" className="text-xs">{item.variant_label}</Badge>}
                    {item.printing_lines.length > 0 && item.printing_lines.some((ln) => ln.spec) && (
                      <span className="text-xs text-muted-foreground">
                        {item.printing_lines.filter((ln) => ln.spec).length} printing
                      </span>
                    )}
                    {item.embossing_lines.length > 0 && (
                      <span className="text-xs text-muted-foreground">{item.embossing_lines.length} embossing</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0"
                      title="Duplicate"
                      onClick={(e) => { e.stopPropagation(); setLineItems((prev) => [...prev, duplicateLineItem(item)]); }}
                    >
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0"
                      onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                      disabled={lineItems.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                    </Button>
                    {item.expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </CardHeader>

              {/* Expanded content */}
              {item.expanded && (
                <CardContent className="space-y-4 pt-0">
                  {/* Mold selection row */}
                  <div className="grid grid-cols-6 gap-3">
                    <div className="col-span-1 space-y-1">
                      <Label className="text-xs">{t("moldType")}</Label>
                      <Select value={item.type} onValueChange={(v) => v && updateItem(item.id, { type: v as "existing" | "new" })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="existing">{t("existing")}</SelectItem>
                          <SelectItem value="new">{t("newMold")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">{t("moldNumber")}</Label>
                      {item.type === "existing" ? (
                        <Combobox
                          options={moldOptions[item.id] ?? []} value={item.mold_number}
                          onSelect={(opt) => {
                            const allOpts = Object.values(moldOptions).flat();
                            const found = allOpts.find((o) => o.value === opt.value);
                            const parts = found?.sublabel?.split(" · ") ?? [];
                            const dims = parts.find((p) => /\d+x\d+/.test(p));
                            updateItem(item.id, { mold_number: opt.value, ...(dims && !item.size ? { size: dims } : {}) });
                          }}
                          onSearch={(q) => searchMolds(item.id, q)}
                          onAddNew={(q) => updateItem(item.id, { type: "new", mold_number: q })}
                          addNewLabel="New mold (not in catalog)"
                          placeholder="ML-1004B"
                        />
                      ) : (
                        <Input className="h-8 text-sm" value={item.mold_number}
                          onChange={(e) => updateItem(item.id, { mold_number: e.target.value })}
                          placeholder={t("newMoldPlaceholder")} />
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("sizeDimensions")}</Label>
                      <Input className="h-8 text-sm" value={item.size}
                        onChange={(e) => updateItem(item.id, { size: e.target.value })} placeholder="200×200×40mm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Thickness (mm)</Label>
                      <Input className="h-8 text-sm" value={item.thickness}
                        onChange={(e) => updateItem(item.id, { thickness: e.target.value })} placeholder="0.25" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Variant Label</Label>
                      <Input className="h-8 text-sm" value={item.variant_label}
                        onChange={(e) => updateItem(item.id, { variant_label: e.target.value })} placeholder="e.g. Gloss" />
                    </div>
                  </div>

                  {/* Printing */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Printing</Label>
                      <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] gap-1"
                        onClick={() => addPrintingLine(item.id)}>
                        <Plus className="h-2.5 w-2.5" /> Add
                      </Button>
                    </div>
                    {item.printing_lines.map((ln, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <select className="flex h-7 rounded-md border border-input bg-background px-2 text-xs w-24 shrink-0"
                          value={ln.surface} onChange={(e) => updatePrintingLine(item.id, i, "surface", e.target.value)}>
                          {SURFACE_KEYS.map((k) => <option key={k} value={k}>{surfaceLabel(k, lang)}</option>)}
                        </select>
                        {PART_TO_KEY[ln.part] !== undefined || ln.part === "" ? (
                          <select className="flex h-7 rounded-md border border-input bg-background px-2 text-xs w-32 shrink-0"
                            value={ln.part} onChange={(e) => updatePrintingLine(item.id, i, "part", e.target.value === "__custom__" ? "" : e.target.value)}>
                            <option value="">— Select —</option>
                            {PART_KEYS.map((k) => <option key={k} value={k}>{partLabel(k, lang)}</option>)}
                            <option value="__custom__">+ Custom...</option>
                          </select>
                        ) : (
                          <Input className="h-7 text-xs w-32 shrink-0" value={ln.part}
                            onChange={(e) => updatePrintingLine(item.id, i, "part", e.target.value)}
                            placeholder="Custom part"
                            onBlur={(e) => { if (!e.target.value.trim()) updatePrintingLine(item.id, i, "part", ""); }} />
                        )}
                        <Input className="flex-1 h-7 text-xs" placeholder="Spec e.g. 4C+1PMS Coat Gloss"
                          value={ln.spec} onChange={(e) => updatePrintingLine(item.id, i, "spec", e.target.value)} />
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0"
                          onClick={() => removePrintingLine(item.id, i)} disabled={item.printing_lines.length <= 1}>
                          <Trash2 className="h-3 w-3 text-gray-400" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Embossing */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Embossing</Label>
                      <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] gap-1"
                        onClick={() => addEmbossingLine(item.id)}>
                        <Plus className="h-2.5 w-2.5" /> Add
                      </Button>
                    </div>
                    {item.embossing_lines.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No embossing</p>
                    ) : (
                      item.embossing_lines.map((ln, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <Input className="flex-1 h-7 text-xs" placeholder="Component e.g. Lid top"
                            value={ln.component} onChange={(e) => updateEmbossingLine(item.id, i, "component", e.target.value)} />
                          <Input className="flex-1 h-7 text-xs" placeholder="Notes"
                            value={ln.notes} onChange={(e) => updateEmbossingLine(item.id, i, "notes", e.target.value)} />
                          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0"
                            onClick={() => removeEmbossingLine(item.id, i)}>
                            <Trash2 className="h-3 w-3 text-gray-400" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {/* Quantity Tiers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">{t("quantityTiers")}</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addTier} disabled={tiers.length >= 6} className="gap-1 h-7 text-xs">
              <Plus className="h-3 w-3" /> {t("addTier")}
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2 w-10">{t("tier")}</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-36">{t("quantityType")}</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-40">{t("quantity")}</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("notes")}</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tiers.map((tier) => (
                  <tr key={tier.id} className="align-middle">
                    <td className="px-4 py-2">
                      <span className="flex items-center justify-center h-7 w-7 rounded bg-gray-100 text-xs font-bold text-gray-600">{tier.tier_label}</span>
                    </td>
                    <td className="px-3 py-2">
                      <Select value={tier.quantity_type} onValueChange={(v) => v && updateTier(tier.id, "quantity_type", v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="units">{t("units")}</SelectItem>
                          <SelectItem value="fcl_20ft">{t("fcl20ft")}</SelectItem>
                          <SelectItem value="fcl_40ft">{t("fcl40ft")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      {tier.quantity_type === "units" ? (
                        <Input type="number" min="1" value={tier.quantity} onChange={(e) => updateTier(tier.id, "quantity", e.target.value)} placeholder="e.g. 20,000" className="h-8 text-sm" />
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded bg-amber-50 border border-amber-200 text-xs text-amber-700">
                          {tier.quantity_type === "fcl_20ft" ? "20ft" : "40ft"} — {t("fclCalcNote")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Input value={tier.tier_notes} onChange={(e) => updateTier(tier.id, "tier_notes", e.target.value)} placeholder={t("tierNotesPlaceholder")} className="h-8 text-sm" />
                    </td>
                    <td className="pr-3 py-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeTier(tier.id)} disabled={tiers.length <= 1} className="h-7 w-7 p-0">
                        <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Attachments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-gray-400" /> Attachments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FileUpload sessionId={sessionId} onChange={setAttachments} />
          </CardContent>
        </Card>

        {/* Internal Notes */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t("internalNotes")}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-start gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-500">{t("internalNotesHint")}</p>
            </div>
            <textarea
              className="w-full min-h-[90px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)}
              placeholder={t("internalNotesPlaceholder")}
            />
          </CardContent>
        </Card>

        {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => router.back()}>{tc("cancel")}</Button>
          <Button type="submit" disabled={loading}>{loading ? tc("loading") : t("submitRequest")}</Button>
        </div>
      </form>

      <Modal open={newCompanyModal} onClose={() => setNewCompanyModal(false)} title="Add New Company">
        <QuickCompanyForm initialName={newCompanyInitialName} onCreated={(company) => {
          setSelectedCompanyId(company.id); setSelectedCompanyName(company.name);
          setCompanyOptions((prev) => [{ value: company.id, label: company.name, sublabel: company.name_ja ?? undefined }, ...prev.filter((o) => o.value !== company.id)]);
          setNewCompanyModal(false); fetchWorkorders(company.id);
        }} onCancel={() => setNewCompanyModal(false)} />
      </Modal>

      <Modal open={newWoModal} onClose={() => setNewWoModal(false)} title="New Workorder">
        <QuickWOForm companyId={selectedCompanyId} companyName={selectedCompanyName} onCreated={(wo) => {
          setWoOptions((prev) => [wo, ...prev]);
          setWoComboOptions((prev) => [{ value: wo.id, label: wo.wo_number, sublabel: wo.project_name }, ...prev]);
          setSelectedWoId(wo.id); setSelectedWoNumber(wo.wo_number); setNewWoModal(false);
        }} onCancel={() => setNewWoModal(false)} />
      </Modal>
    </>
  );
}
