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
import { useDivision } from "@/lib/division-context";

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
  const { accessible_divisions, active_division, is_super_admin } = useDivision();

  const [loading, setLoading] = useState(false);
  const [projectName, setProjectName] = useState("");
  // For super-admins in combined view (active=null), they must explicitly pick.
  // For everyone else, division is fixed by their context — selector is hidden.
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>(active_division?.id ?? "");
  const [error, setError] = useState("");

  // Keep the selector in sync if active_division changes via the sidebar switcher
  useEffect(() => {
    if (active_division?.id) setSelectedDivisionId(active_division.id);
  }, [active_division?.id]);

  // Show the division picker only when there's a real choice — super-admin
  // in "All Divisions" mode, or any user with multiple divisions.
  const needsDivisionPicker = is_super_admin && !active_division;

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
    if (needsDivisionPicker && !selectedDivisionId) {
      setError("Please pick which division this work order belongs to.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/workorders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: selectedCompanyName,
          company_id: selectedCompanyId,
          project_name: projectName,
          // Send division_id explicitly when super-admin is creating from combined view.
          // Otherwise the API derives it from the user's active_division_id.
          division_id: needsDivisionPicker ? selectedDivisionId : undefined,
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
      <form onSubmit={handleSubmit} className="space-y-6 max-w-xl" autoComplete="off">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("details")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {needsDivisionPicker ? (
              // Super-admin in combined view must pick which division this WO belongs to.
              // The active division is null in that mode, so there's no implicit default.
              <div className="space-y-2">
                <Label>Division</Label>
                <Select value={selectedDivisionId} onValueChange={(v) => { if (v) setSelectedDivisionId(v); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a division" />
                  </SelectTrigger>
                  <SelectContent>
                    {accessible_divisions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  WO number prefix will be {accessible_divisions.find((d) => d.id === selectedDivisionId)?.wo_prefix ?? "—"} (e.g.{" "}
                  {accessible_divisions.find((d) => d.id === selectedDivisionId)?.wo_prefix ?? "JP"}260001)
                </p>
              </div>
            ) : (
              // Single division (or active division set): show as read-only context
              active_division && (
                <div className="space-y-2">
                  <Label>Division</Label>
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex items-center gap-2">
                    <span className="font-mono font-semibold">{active_division.code}</span>
                    <span className="text-muted-foreground">— {active_division.name}</span>
                  </div>
                </div>
              )
            )}

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
