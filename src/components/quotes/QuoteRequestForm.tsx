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
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Modal } from "@/components/ui/modal";

interface MoldEntry {
  id: string;
  type: "existing" | "new";
  value: string;       // mold number or new mold description
  size: string;        // e.g. 200×200×40mm BH
  design_count: string; // number of designs for this mold
}

interface MoldRecord {
  id: string;
  mold_number: string;
  hm_number: string;
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

interface WOOption {
  id: string;
  wo_number: string;
  project_name: string;
}

// Quick-create workorder modal
function QuickWOForm({
  companyId,
  companyName,
  onCreated,
  onCancel,
}: {
  companyId: string;
  companyName: string;
  onCreated: (wo: WOOption) => void;
  onCancel: () => void;
}) {
  const [projectName, setProjectName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSave = async () => {
    if (!projectName.trim()) { setErr("Project name is required"); return; }
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/workorders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: companyName, company_id: companyId, project_name: projectName.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const wo = await res.json();
      onCreated({ id: wo.id, wo_number: wo.wo_number, project_name: wo.project_name });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unknown error");
      setSaving(false);
    }
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

const TIER_LABELS = ["A", "B", "C", "D", "E", "F"];

// Quick-create company modal (same as WOForm)
function QuickCompanyForm({
  initialName,
  onCreated,
  onCancel,
}: {
  initialName: string;
  onCreated: (company: { id: string; name: string; name_ja: string | null }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [nameJa, setNameJa] = useState("");
  const [nameZh, setNameZh] = useState("");
  const [country, setCountry] = useState("JP");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSave = async () => {
    if (!name.trim()) { setErr("Name is required"); return; }
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), name_ja: nameJa || null, name_zh: nameZh || null, country }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      onCreated(await res.json());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unknown error");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Fill in basic details — you can complete the full profile later.</p>
      <div className="space-y-2">
        <Label>Company Name <span className="text-red-500">*</span></Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Japanese Name</Label>
          <Input value={nameJa} onChange={(e) => setNameJa(e.target.value)} placeholder="e.g. ユニバーサル・スタジオ" />
        </div>
        <div className="space-y-2">
          <Label>Chinese Name</Label>
          <Input value={nameZh} onChange={(e) => setNameZh(e.target.value)} />
        </div>
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

export default function QuoteRequestForm({
  locale,
  prefilledWoId,
  prefilledWoNumber,
  prefilledCompanyId,
  prefilledCompanyName,
}: {
  locale: string;
  prefilledWoId?: string;
  prefilledWoNumber?: string;
  prefilledCompanyId?: string;
  prefilledCompanyName?: string;
}) {
  const t = useTranslations("quotes");
  const tw = useTranslations("workorders");
  const tc = useTranslations("common");
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Company selector ─────────────────────────────────────────────
  const [companyOptions, setCompanyOptions] = useState<ComboboxOption[]>([]);
  const [companySearchLoading, setCompanySearchLoading] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(prefilledCompanyId ?? "");
  const [selectedCompanyName, setSelectedCompanyName] = useState(prefilledCompanyName ?? "");
  const [newCompanyModal, setNewCompanyModal] = useState(false);
  const [newCompanyInitialName, setNewCompanyInitialName] = useState("");

  // ── Workorder selector ───────────────────────────────────────────
  const [woOptions, setWoOptions] = useState<WOOption[]>([]);
  const [woComboOptions, setWoComboOptions] = useState<ComboboxOption[]>([]);
  const [woLoading, setWoLoading] = useState(false);
  const [selectedWoId, setSelectedWoId] = useState(prefilledWoId ?? "");
  const [selectedWoNumber, setSelectedWoNumber] = useState(prefilledWoNumber ?? "");
  const [newWoModal, setNewWoModal] = useState(false);

  // ── Request info ─────────────────────────────────────────────────
  const [urgency, setUrgency] = useState(false);
  const [shippingInfoRequired, setShippingInfoRequired] = useState(false);

  // ── Product spec ─────────────────────────────────────────────────
  const [molds, setMolds] = useState<MoldEntry[]>([
    { id: "1", type: "existing", value: "", size: "", design_count: "1" },
  ]);
  const [printingNotes, setPrintingNotes] = useState("");
  const [embossmentNotes, setEmbossmentNotes] = useState("");

  // ── Quantity tiers ────────────────────────────────────────────────
  const [tiers, setTiers] = useState<QuantityTier[]>([
    { id: "1", tier_label: "A", quantity_type: "units", quantity: "", tier_notes: "" },
    { id: "2", tier_label: "B", quantity_type: "units", quantity: "", tier_notes: "" },
  ]);

  const [internalNotes, setInternalNotes] = useState("");

  // ── Company fetch ─────────────────────────────────────────────────
  const fetchCompanies = async (q: string) => {
    setCompanySearchLoading(true);
    try {
      const res = await fetch(`/api/companies?q=${encodeURIComponent(q)}`);
      const data = await res.json() as { id: string; name: string; name_ja: string | null; city: string | null; prefecture: string | null }[];
      setCompanyOptions(data.map((c) => ({
        value: c.id,
        label: c.name,
        sublabel: [c.name_ja, c.city, c.prefecture].filter(Boolean).join(" · ") || undefined,
      })));
    } catch { /* ignore */ } finally {
      setCompanySearchLoading(false);
    }
  };

  // ── Workorder fetch (when company changes) ────────────────────────
  const fetchWorkorders = async (companyId: string, keepSelection = false) => {
    setWoLoading(true);
    if (!keepSelection) { setSelectedWoId(""); setSelectedWoNumber(""); }
    try {
      const res = await fetch(`/api/workorders?company_id=${companyId}`);
      const data = await res.json() as WOOption[];
      setWoOptions(data);
      setWoComboOptions(data.map((w) => ({
        value: w.id,
        label: w.wo_number,
        sublabel: w.project_name,
      })));
    } catch { /* ignore */ } finally {
      setWoLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies("");
    // Pre-fill company option label so combobox displays it
    if (prefilledCompanyId && prefilledCompanyName) {
      setCompanyOptions([{ value: prefilledCompanyId, label: prefilledCompanyName }]);
    }
    // Pre-fill WO options so the combobox shows the pre-selected WO
    if (prefilledCompanyId) {
      fetchWorkorders(prefilledCompanyId, true);
    }
    if (prefilledWoId && prefilledWoNumber) {
      setWoComboOptions([{ value: prefilledWoId, label: prefilledWoNumber, sublabel: "" }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCompanySelect = (option: ComboboxOption) => {
    setSelectedCompanyId(option.value);
    setSelectedCompanyName(option.label);
    fetchWorkorders(option.value);
  };

  const handleAddNewCompany = (name: string) => {
    setNewCompanyInitialName(name);
    setNewCompanyModal(true);
  };

  const handleCompanyCreated = (company: { id: string; name: string; name_ja: string | null }) => {
    setSelectedCompanyId(company.id);
    setSelectedCompanyName(company.name);
    setCompanyOptions((prev) => [
      { value: company.id, label: company.name, sublabel: company.name_ja ?? undefined },
      ...prev.filter((o) => o.value !== company.id),
    ]);
    setNewCompanyModal(false);
    fetchWorkorders(company.id);
  };

  // ── Mold search ───────────────────────────────────────────────────
  const [moldOptions, setMoldOptions] = useState<Record<string, ComboboxOption[]>>({});
  const [moldSearchCache, setMoldSearchCache] = useState<Record<string, ComboboxOption[]>>({});

  const searchMolds = async (moldId: string, q: string) => {
    const cacheKey = q.toLowerCase();
    if (moldSearchCache[cacheKey]) {
      setMoldOptions((prev) => ({ ...prev, [moldId]: moldSearchCache[cacheKey] }));
      return;
    }
    try {
      const res = await fetch(`/api/molds?q=${encodeURIComponent(q)}`);
      const data = await res.json() as MoldRecord[];
      const opts = data.map((m) => ({
        value: m.mold_number,
        label: m.mold_number,
        sublabel: [m.variant, m.dimensions, m.feature].filter(Boolean).join(" · "),
      }));
      setMoldSearchCache((prev) => ({ ...prev, [cacheKey]: opts }));
      setMoldOptions((prev) => ({ ...prev, [moldId]: opts }));
    } catch { /* ignore */ }
  };

  // ── Mold handlers ──────────────────────────────────────────────────
  const addMold = () => setMolds((prev) => [...prev, { id: Date.now().toString(), type: "existing", value: "", size: "", design_count: "1" }]);
  const removeMold = (id: string) => { if (molds.length > 1) setMolds((prev) => prev.filter((m) => m.id !== id)); };
  // Use functional updater so batched calls compose correctly (not stale-closure overwrite)
  const updateMold = (id: string, field: keyof MoldEntry, val: string) =>
    setMolds((prev) => prev.map((m) => m.id === id ? { ...m, [field]: val } : m));
  const updateMoldFields = (id: string, fields: Partial<MoldEntry>) =>
    setMolds((prev) => prev.map((m) => m.id === id ? { ...m, ...fields } : m));

  // ── Tier handlers ───────────────────────────────────────────────────
  const addTier = () => {
    if (tiers.length >= 6) return;
    setTiers([...tiers, { id: Date.now().toString(), tier_label: TIER_LABELS[tiers.length], quantity_type: "units", quantity: "", tier_notes: "" }]);
  };
  const removeTier = (id: string) => { if (tiers.length > 1) setTiers(tiers.filter((t) => t.id !== id)); };
  const updateTier = (id: string, field: keyof QuantityTier, value: string) =>
    setTiers(tiers.map((t) => t.id === id ? { ...t, [field]: value } : t));

  // ── Submit ──────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) { setError("Please select a company."); return; }
    if (!selectedWoId) { setError("Please select a workorder."); return; }
    setLoading(true);
    setError("");

    const payload = {
      wo_id: selectedWoId,
      urgency,
      shipping_info_required: shippingInfoRequired,
      molds: molds
        .map(({ type, value, size, design_count }) => ({
          type,
          value: value.trim(),
          size: size.trim() || null,
          design_count: parseInt(design_count) || 1,
        }))
        .filter((m) => m.value),
      printing_notes: printingNotes || null,
      embossment_notes: embossmentNotes || null,
      internal_notes: internalNotes || null,
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
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create quote");
      }
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
              <Label>
                {tw("company")} <span className="text-red-500">*</span>
              </Label>
              <Combobox
                options={companyOptions}
                value={selectedCompanyId}
                onSelect={handleCompanySelect}
                onSearch={fetchCompanies}
                onAddNew={handleAddNewCompany}
                placeholder="Search company..."
                loading={companySearchLoading}
                addNewLabel="Add new company"
              />
              {selectedCompanyId && (
                <p className="text-xs text-green-600">✓ {selectedCompanyName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                {tw("title")} <span className="text-red-500">*</span>
              </Label>
              <Combobox
                options={woComboOptions}
                value={selectedWoId}
                onSelect={(opt) => {
                  const wo = woOptions.find((w) => w.id === opt.value);
                  setSelectedWoId(opt.value);
                  setSelectedWoNumber(wo?.wo_number ?? opt.label);
                }}
                onAddNew={() => setNewWoModal(true)}
                placeholder={!selectedCompanyId ? "Select a company first..." : woLoading ? "Loading workorders..." : "Select workorder..."}
                loading={woLoading}
                disabled={!selectedCompanyId}
                addNewLabel="Create new workorder"
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

        {/* Product Spec */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t("productSpec")}</CardTitle></CardHeader>
          <CardContent className="space-y-5">

            {/* Molds table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("molds")}</Label>
                <Button type="button" variant="outline" size="sm" onClick={addMold} className="gap-1 h-7 text-xs">
                  <Plus className="h-3 w-3" />
                  {t("addMold")}
                </Button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-32">{t("moldType")}</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">{t("moldNumber")}</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-44">{t("sizeDimensions")}</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-24">{t("designCount")}</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {molds.map((mold) => (
                    <tr key={mold.id} className="align-middle">
                      <td className="px-3 py-2">
                        <Select value={mold.type} onValueChange={(v) => v && updateMold(mold.id, "type", v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="existing">{t("existing")}</SelectItem>
                            <SelectItem value="new">{t("newMold")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        {mold.type === "existing" ? (
                          <Combobox
                            options={moldOptions[mold.id] ?? []}
                            value={mold.value}
                            onSelect={(opt) => {
                              const allOpts = Object.values(moldOptions).flat();
                              const found = allOpts.find((o) => o.value === opt.value);
                              // Single functional update avoids stale-closure overwrite
                              const parts = found?.sublabel?.split(" · ") ?? [];
                              const dims = parts.find((p) => /\d+x\d+/.test(p));
                              updateMoldFields(mold.id, {
                                value: opt.value,
                                ...(dims && !mold.size ? { size: dims } : {}),
                              });
                            }}
                            onSearch={(q) => searchMolds(mold.id, q)}
                            onAddNew={(q) => updateMoldFields(mold.id, { type: "new", value: q })}
                            addNewLabel="New mold (not in catalog)"
                            placeholder="ML-1004B"
                          />
                        ) : (
                          <Input
                            className="h-8 text-sm"
                            value={mold.value}
                            onChange={(e) => updateMold(mold.id, "value", e.target.value)}
                            placeholder={t("newMoldPlaceholder")}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="h-8 text-sm"
                          value={mold.size}
                          onChange={(e) => updateMold(mold.id, "size", e.target.value)}
                          placeholder="200×200×40mm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="1"
                          max="20"
                          className="h-8 text-sm"
                          value={mold.design_count}
                          onChange={(e) => updateMold(mold.id, "design_count", e.target.value)}
                          placeholder="1"
                        />
                      </td>
                      <td className="pr-2 py-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeMold(mold.id)} disabled={molds.length <= 1} className="h-7 w-7 p-0">
                          <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Printing */}
            <div className="space-y-2">
              <Label>{t("printing")}</Label>
              <textarea
                className="w-full min-h-[72px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={printingNotes}
                onChange={(e) => setPrintingNotes(e.target.value)}
                placeholder="e.g. White base coat + CMYK + gloss varnish. Lid: matte finish."
              />
            </div>

            {/* Embossment */}
            <div className="space-y-2">
              <Label>
                {t("embossment")}
                <span className="text-gray-400 text-xs font-normal ml-2">{t("embossmentHint")}</span>
              </Label>
              <Input
                value={embossmentNotes}
                onChange={(e) => setEmbossmentNotes(e.target.value)}
                placeholder={t("embossmentComponentsPlaceholder")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Quantity Tiers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">{t("quantityTiers")}</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addTier} disabled={tiers.length >= 6} className="gap-1 h-7 text-xs">
              <Plus className="h-3 w-3" />
              {t("addTier")}
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
                      <span className="flex items-center justify-center h-7 w-7 rounded bg-gray-100 text-xs font-bold text-gray-600">
                        {tier.tier_label}
                      </span>
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
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder={t("internalNotesPlaceholder")}
            />
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => router.back()}>{tc("cancel")}</Button>
          <Button type="submit" disabled={loading}>{loading ? tc("loading") : t("submitRequest")}</Button>
        </div>
      </form>

      <Modal open={newCompanyModal} onClose={() => setNewCompanyModal(false)} title="Add New Company">
        <QuickCompanyForm
          initialName={newCompanyInitialName}
          onCreated={handleCompanyCreated}
          onCancel={() => setNewCompanyModal(false)}
        />
      </Modal>

      <Modal open={newWoModal} onClose={() => setNewWoModal(false)} title="New Workorder">
        <QuickWOForm
          companyId={selectedCompanyId}
          companyName={selectedCompanyName}
          onCreated={(wo) => {
            setWoOptions((prev) => [wo, ...prev]);
            setWoComboOptions((prev) => [{ value: wo.id, label: wo.wo_number, sublabel: wo.project_name }, ...prev]);
            setSelectedWoId(wo.id);
            setSelectedWoNumber(wo.wo_number);
            setNewWoModal(false);
          }}
          onCancel={() => setNewWoModal(false)}
        />
      </Modal>
    </>
  );
}
