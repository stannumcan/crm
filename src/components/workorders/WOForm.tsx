"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Modal } from "@/components/ui/modal";

const REGIONS = [{ code: "JP", label: "Japan (JP)" }];

// Quick-create company form inside the modal
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
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          name_ja: nameJa || null,
          name_zh: nameZh || null,
          country,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const company = await res.json();
      onCreated(company);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Company not found. Fill in the basic details to add it now — you can complete the full profile later.
      </p>
      <div className="space-y-2">
        <Label>Company Name <span className="text-red-500">*</span></Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. USJ" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Japanese Name</Label>
          <Input value={nameJa} onChange={(e) => setNameJa(e.target.value)} placeholder="e.g. ユニバーサル・スタジオ" />
        </div>
        <div className="space-y-2">
          <Label>Chinese Name</Label>
          <Input value={nameZh} onChange={(e) => setNameZh(e.target.value)} placeholder="e.g. 环球影城" />
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
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Creating..." : "Create Company"}
        </Button>
      </div>
    </div>
  );
}

export default function WOForm({
  locale,
  prefilledCompanyId,
  prefilledCompanyName,
}: {
  locale: string;
  prefilledCompanyId?: string;
  prefilledCompanyName?: string;
}) {
  const t = useTranslations("workorders");
  const tc = useTranslations("common");
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [region, setRegion] = useState("JP");
  const [error, setError] = useState("");

  // Company combobox state
  const [companyOptions, setCompanyOptions] = useState<ComboboxOption[]>([]);
  const [companySearchLoading, setCompanySearchLoading] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(prefilledCompanyId ?? "");
  const [selectedCompanyName, setSelectedCompanyName] = useState(prefilledCompanyName ?? "");

  // New company modal
  const [newCompanyModal, setNewCompanyModal] = useState(false);
  const [newCompanyInitialName, setNewCompanyInitialName] = useState("");

  const fetchCompanies = async (q: string) => {
    setCompanySearchLoading(true);
    try {
      const url = `/api/companies?q=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      const data = await res.json() as { id: string; name: string; name_ja: string | null; city: string | null; prefecture: string | null }[];
      setCompanyOptions(
        data.map((c) => ({
          value: c.id,
          label: c.name,
          sublabel: [c.name_ja, c.city, c.prefecture].filter(Boolean).join(" · ") || undefined,
        }))
      );
    } catch {
      // ignore network errors
    } finally {
      setCompanySearchLoading(false);
    }
  };

  // Load initial list on mount
  useEffect(() => {
    fetchCompanies("");
    // Pre-fill from URL params (coming from company detail page)
    if (prefilledCompanyId && prefilledCompanyName) {
      setSelectedCompanyId(prefilledCompanyId);
      setSelectedCompanyName(prefilledCompanyName);
      setCompanyOptions([{ value: prefilledCompanyId, label: prefilledCompanyName }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCompanySelect = (option: ComboboxOption) => {
    setSelectedCompanyId(option.value);
    setSelectedCompanyName(option.label);
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) { setError("Please select or create a company."); return; }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: selectedCompanyName,
          company_id: selectedCompanyId,
          project_name: projectName,
          region,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create work order");
      }

      const wo = await res.json();
      router.push(`/${locale}/workorders/${wo.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("details")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("region")}</Label>
              <Select value={region} onValueChange={(v) => { if (v) setRegion(v); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => (
                    <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("company")}</Label>
              <Combobox
                options={companyOptions}
                value={selectedCompanyId}
                onSelect={handleCompanySelect}
                onSearch={fetchCompanies}
                onAddNew={handleAddNewCompany}
                placeholder="Search company name..."
                loading={companySearchLoading}
                addNewLabel="Add new company"
              />
              {selectedCompanyId && (
                <p className="text-xs text-green-600">✓ {selectedCompanyName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="project">{t("project")}</Label>
              <Input
                id="project"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Star Shaped Tin New Mold"
                required
              />
            </div>

            <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
              {t("autoAssignNote")}
            </div>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => router.push(`/${locale}/workorders`)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? tc("loading") : t("create")}
          </Button>
        </div>
      </form>

      {/* New company quick-create modal */}
      <Modal
        open={newCompanyModal}
        onClose={() => setNewCompanyModal(false)}
        title="Add New Company"
      >
        <QuickCompanyForm
          initialName={newCompanyInitialName}
          onCreated={handleCompanyCreated}
          onCancel={() => setNewCompanyModal(false)}
        />
      </Modal>
    </>
  );
}
