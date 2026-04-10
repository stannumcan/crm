"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertCircle } from "lucide-react";

interface QuantityTier {
  id: string;
  tier_label: string;
  quantity_type: "units" | "fcl_20ft" | "fcl_40ft";
  quantity: string; // string for input
}

const TIER_LABELS = ["A", "B", "C", "D", "E", "F"];
const QUANTITY_TYPES = [
  { value: "units", labelKey: "units" },
  { value: "fcl_20ft", labelKey: "fcl20ft" },
  { value: "fcl_40ft", labelKey: "fcl40ft" },
];

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

  // Form state
  const [urgency, setUrgency] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [moldType, setMoldType] = useState<"existing" | "new">("existing");
  const [moldNumber, setMoldNumber] = useState("");
  const [sizeDimensions, setSizeDimensions] = useState("");
  const [printingLid, setPrintingLid] = useState("");
  const [printingBody, setPrintingBody] = useState("");
  const [printingBottom, setPrintingBottom] = useState("");
  const [printingInner, setPrintingInner] = useState("");
  const [embossment, setEmbossment] = useState(false);
  const [embossmentComponents, setEmbossmentComponents] = useState("");
  const [designCount, setDesignCount] = useState("1");
  const [shippingInfoRequired, setShippingInfoRequired] = useState(false);
  const [internalNotes, setInternalNotes] = useState("");

  // Quantity tiers
  const [tiers, setTiers] = useState<QuantityTier[]>([
    { id: "1", tier_label: "A", quantity_type: "units", quantity: "" },
    { id: "2", tier_label: "B", quantity_type: "units", quantity: "" },
  ]);

  const addTier = () => {
    if (tiers.length >= 6) return;
    const nextLabel = TIER_LABELS[tiers.length];
    setTiers([...tiers, {
      id: Date.now().toString(),
      tier_label: nextLabel,
      quantity_type: "units",
      quantity: "",
    }]);
  };

  const removeTier = (id: string) => {
    if (tiers.length <= 1) return;
    setTiers(tiers.filter((t) => t.id !== id));
  };

  const updateTier = (id: string, field: keyof QuantityTier, value: string) => {
    setTiers(tiers.map((t) => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      wo_id: woId,
      urgency,
      deadline: deadline || null,
      mold_type: moldType,
      mold_number: moldNumber || null,
      size_dimensions: sizeDimensions || null,
      printing_lid: printingLid || null,
      printing_body: printingBody || null,
      printing_bottom: printingBottom || null,
      printing_inner: printingInner || null,
      embossment,
      embossment_components: embossmentComponents || null,
      design_count: parseInt(designCount) || 1,
      shipping_info_required: shippingInfoRequired,
      internal_notes: internalNotes || null,
      status: "pending_factory",
      quantity_tiers: tiers.map((t, i) => ({
        tier_label: t.tier_label,
        quantity_type: t.quantity_type,
        quantity: t.quantity_type === "units" ? (parseInt(t.quantity) || null) : null,
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

      {/* Urgency + Deadline */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t("requestInfo")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
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
                    <SelectItem key={n} value={String(n)}>{n} {t("design")}{n > 1 ? "s" : ""}</SelectItem>
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
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("moldType")}</Label>
              <Select value={moldType} onValueChange={(v) => v && setMoldType(v as "existing" | "new")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="existing">{t("existing")}</SelectItem>
                  <SelectItem value="new">{t("newMold")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="moldNumber">
                {t("moldNumber")}
                {moldType === "existing" && <span className="text-gray-400 text-xs ml-1">(ML-XXXX)</span>}
              </Label>
              <Input
                id="moldNumber"
                value={moldNumber}
                onChange={(e) => setMoldNumber(e.target.value)}
                placeholder={moldType === "existing" ? "ML-1004B" : t("newMoldPlaceholder")}
                required={moldType === "existing"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="size">{t("sizeDimensions")}</Label>
            <Input
              id="size"
              value={sizeDimensions}
              onChange={(e) => setSizeDimensions(e.target.value)}
              placeholder="e.g. 200x200x40mm BH"
            />
          </div>

          {/* Printing per component */}
          <div className="space-y-3">
            <Label>{t("printing")}</Label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "lid", value: printingLid, setter: setPrintingLid },
                { key: "body", value: printingBody, setter: setPrintingBody },
                { key: "bottom", value: printingBottom, setter: setPrintingBottom },
                { key: "inner", value: printingInner, setter: setPrintingInner },
              ].map(({ key, value, setter }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">{t(`printing_${key}`)}</Label>
                  <Input
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={`e.g. White coating + CMYK + Glossy`}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Embossment */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={embossment}
                onChange={(e) => setEmbossment(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium">{t("embossment")}</span>
            </label>
            {embossment && (
              <Input
                value={embossmentComponents}
                onChange={(e) => setEmbossmentComponents(e.target.value)}
                placeholder={t("embossmentComponentsPlaceholder")}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quantity Tiers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("quantityTiers")}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addTier}
            disabled={tiers.length >= 6}
            className="gap-2"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("addTier")}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
              <div className="col-span-2">{t("tier")}</div>
              <div className="col-span-4">{t("quantityType")}</div>
              <div className="col-span-5">{t("quantity")}</div>
              <div className="col-span-1"></div>
            </div>
            {tiers.map((tier) => (
              <div key={tier.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-2">
                  <div className="flex items-center justify-center h-9 w-9 rounded-md bg-gray-100 text-sm font-bold text-gray-600">
                    {tier.tier_label}
                  </div>
                </div>
                <div className="col-span-4">
                  <Select
                    value={tier.quantity_type}
                    onValueChange={(v) => v && updateTier(tier.id, "quantity_type", v)}
                  >
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {QUANTITY_TYPES.map((qt) => (
                        <SelectItem key={qt.value} value={qt.value}>
                          {t(qt.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-5">
                  {tier.quantity_type === "units" ? (
                    <Input
                      type="number"
                      min="1"
                      value={tier.quantity}
                      onChange={(e) => updateTier(tier.id, "quantity", e.target.value)}
                      placeholder="e.g. 20000"
                    />
                  ) : (
                    <div className="flex items-center h-9 px-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-700">
                      {tier.quantity_type === "fcl_20ft" ? "20ft FCL" : "40ft FCL"} — {t("fclCalcNote")}
                    </div>
                  )}
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTier(tier.id)}
                    disabled={tiers.length <= 1}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Internal Notes */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t("internalNotes")}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-500">{t("internalNotesHint")}</p>
          </div>
          <textarea
            className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
