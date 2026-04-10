"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertCircle } from "lucide-react";

interface MoldEntry {
  id: string;
  type: "existing" | "new";
  value: string; // mold number for existing, description for new
}

interface QuantityTier {
  id: string;
  tier_label: string;
  quantity_type: "units" | "fcl_20ft" | "fcl_40ft";
  quantity: string;
  tier_notes: string;
}

const TIER_LABELS = ["A", "B", "C", "D", "E", "F"];

export default function QuoteRequestForm({
  locale,
  woId,
  woNumber,
}: {
  locale: string;
  woId: string;
  woNumber: string;
}) {
  const t = useTranslations("quotes");
  const tc = useTranslations("common");
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Request info
  const [urgency, setUrgency] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [designCount, setDesignCount] = useState("1");
  const [shippingInfoRequired, setShippingInfoRequired] = useState(false);

  // Product spec
  const [molds, setMolds] = useState<MoldEntry[]>([
    { id: "1", type: "existing", value: "" },
  ]);
  const [sizeDimensions, setSizeDimensions] = useState("");
  const [printingNotes, setPrintingNotes] = useState("");
  const [embossmentNotes, setEmbossmentNotes] = useState("");

  // Quantity tiers
  const [tiers, setTiers] = useState<QuantityTier[]>([
    { id: "1", tier_label: "A", quantity_type: "units", quantity: "", tier_notes: "" },
    { id: "2", tier_label: "B", quantity_type: "units", quantity: "", tier_notes: "" },
  ]);

  const [internalNotes, setInternalNotes] = useState("");

  // ── Mold handlers ──────────────────────────────────────────────
  const addMold = () => {
    setMolds([...molds, { id: Date.now().toString(), type: "existing", value: "" }]);
  };

  const removeMold = (id: string) => {
    if (molds.length <= 1) return;
    setMolds(molds.filter((m) => m.id !== id));
  };

  const updateMold = (id: string, field: keyof MoldEntry, value: string) => {
    setMolds(molds.map((m) => m.id === id ? { ...m, [field]: value } : m));
  };

  // ── Tier handlers ───────────────────────────────────────────────
  const addTier = () => {
    if (tiers.length >= 6) return;
    setTiers([...tiers, {
      id: Date.now().toString(),
      tier_label: TIER_LABELS[tiers.length],
      quantity_type: "units",
      quantity: "",
      tier_notes: "",
    }]);
  };

  const removeTier = (id: string) => {
    if (tiers.length <= 1) return;
    setTiers(tiers.filter((t) => t.id !== id));
  };

  const updateTier = (id: string, field: keyof QuantityTier, value: string) => {
    setTiers(tiers.map((t) => t.id === id ? { ...t, [field]: value } : t));
  };

  // ── Submit ──────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      wo_id: woId,
      urgency,
      deadline: deadline || null,
      design_count: parseInt(designCount) || 1,
      shipping_info_required: shippingInfoRequired,
      molds: molds.map(({ type, value }) => ({ type, value: value.trim() })).filter((m) => m.value),
      size_dimensions: sizeDimensions || null,
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* WO Reference */}
      <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <span className="text-sm text-blue-700 font-medium">{t("workOrder")}:</span>
        <span className="font-mono font-bold text-blue-800">{woNumber}</span>
      </div>

      {/* Request Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t("requestInfo")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={urgency}
                onChange={(e) => setUrgency(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium">{t("urgency")}</span>
              {urgency && <Badge variant="destructive" className="text-xs">URGENT</Badge>}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={shippingInfoRequired}
                onChange={(e) => setShippingInfoRequired(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium">{t("shippingInfoRequired")}</span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deadline">{t("deadline")}</Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("designCount")}</Label>
              <Select value={designCount} onValueChange={(v) => v && setDesignCount(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} {t("design")}{n > 1 ? "s" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Spec */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t("productSpec")}</CardTitle></CardHeader>
        <CardContent className="space-y-5">

          {/* Molds */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("molds")}</Label>
              <Button type="button" variant="outline" size="sm" onClick={addMold} className="gap-1 h-7 text-xs">
                <Plus className="h-3 w-3" />
                {t("addMold")}
              </Button>
            </div>
            <div className="space-y-2">
              {molds.map((mold) => (
                <div key={mold.id} className="flex items-center gap-2">
                  <Select
                    value={mold.type}
                    onValueChange={(v) => v && updateMold(mold.id, "type", v)}
                  >
                    <SelectTrigger className="w-36 shrink-0 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="existing">{t("existing")}</SelectItem>
                      <SelectItem value="new">{t("newMold")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="flex-1 text-sm"
                    value={mold.value}
                    onChange={(e) => updateMold(mold.id, "value", e.target.value)}
                    placeholder={mold.type === "existing" ? "ML-1004B" : t("newMoldPlaceholder")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMold(mold.id)}
                    disabled={molds.length <= 1}
                    className="shrink-0 px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="space-y-2">
            <Label htmlFor="size">{t("sizeDimensions")}</Label>
            <Input
              id="size"
              value={sizeDimensions}
              onChange={(e) => setSizeDimensions(e.target.value)}
              placeholder="e.g. 200×200×40mm BH"
            />
          </div>

          {/* Printing */}
          <div className="space-y-2">
            <Label htmlFor="printing">{t("printing")}</Label>
            <textarea
              id="printing"
              className="w-full min-h-[72px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={printingNotes}
              onChange={(e) => setPrintingNotes(e.target.value)}
              placeholder="e.g. White base coat + CMYK + gloss varnish. Lid: matte finish."
            />
          </div>

          {/* Embossment */}
          <div className="space-y-2">
            <Label htmlFor="embossment">
              {t("embossment")}
              <span className="text-gray-400 text-xs font-normal ml-2">{t("embossmentHint")}</span>
            </Label>
            <Input
              id="embossment"
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addTier}
            disabled={tiers.length >= 6}
            className="gap-1 h-7 text-xs"
          >
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
                    <Select
                      value={tier.quantity_type}
                      onValueChange={(v) => v && updateTier(tier.id, "quantity_type", v)}
                    >
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
                      <Input
                        type="number"
                        min="1"
                        value={tier.quantity}
                        onChange={(e) => updateTier(tier.id, "quantity", e.target.value)}
                        placeholder="e.g. 20,000"
                        className="h-8 text-sm"
                      />
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded bg-amber-50 border border-amber-200 text-xs text-amber-700">
                        {tier.quantity_type === "fcl_20ft" ? "20ft" : "40ft"} — {t("fclCalcNote")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={tier.tier_notes}
                      onChange={(e) => updateTier(tier.id, "tier_notes", e.target.value)}
                      placeholder={t("tierNotesPlaceholder")}
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="pr-3 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTier(tier.id)}
                      disabled={tiers.length <= 1}
                      className="h-7 w-7 p-0"
                    >
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
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? tc("loading") : t("submitRequest")}
        </Button>
      </div>
    </form>
  );
}
