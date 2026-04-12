"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Paperclip, X } from "lucide-react";
import { FileUpload, UploadedFile } from "@/components/ui/file-upload";
import MoldSelect from "@/components/ui/mold-select";

interface Tier {
  tier_label: string;
  quantity_type: string;
  quantity: number | null;
  sort_order: number;
}

interface ExistingTierCost {
  tier_label: string;
  quantity: number | null;
  total_subtotal: number | null;
  labor_cost: number | null;
  accessories_cost: number | null;
  container_info: string | null;
  tier_notes: string | null;
}

interface PackagingLine {
  id: string;
  type: "inner_carton" | "outer_carton" | "pallet" | "20GP" | "40GP" | "40HQ";
  config: string;
  l: string;
  w: string;
  h: string;
  cbm: string;
  tins: string;
}

interface TierCost {
  tier_label: string;
  quantity: string;
  total_subtotal: string;
  labor_cost: string;
  accessories_cost: string;
  container_info: string;
  tier_notes: string;
}

const PACKAGING_TYPE_LABELS: Record<string, string> = {
  inner_carton: "Inner Carton",
  outer_carton: "Outer Carton",
  pallet: "Pallet",
  "20GP": "20GP",
  "40GP": "40GP",
  "40HQ": "40HQ",
};

function autoContainer(quantityType: string): string {
  if (quantityType === "fcl_20ft") return "20GP";
  if (quantityType === "fcl_40ft") return "40GP";
  return "";
}

function makeTierCost(tier: Tier, existing?: ExistingTierCost): TierCost {
  return {
    tier_label: tier.tier_label,
    quantity: String(existing?.quantity ?? tier.quantity ?? ""),
    total_subtotal: existing?.total_subtotal != null ? String(existing.total_subtotal) : "",
    labor_cost: existing?.labor_cost != null ? String(existing.labor_cost) : "",
    accessories_cost: existing?.accessories_cost != null ? String(existing.accessories_cost) : "",
    container_info: existing?.container_info ?? autoContainer(tier.quantity_type),
    tier_notes: existing?.tier_notes ?? "",
  };
}

function makePackagingLine(): PackagingLine {
  return { id: Date.now().toString(), type: "outer_carton", config: "", l: "", w: "", h: "", cbm: "", tins: "" };
}

function calcCbm(l: string, w: string, h: string): string {
  const lv = parseFloat(l), wv = parseFloat(w), hv = parseFloat(h);
  if (lv && wv && hv) return ((lv * wv * hv) / 1_000_000_000).toFixed(4);
  return "";
}

export default function FactorySheetForm({
  locale,
  quoteId,
  tiers,
  existingSheet,
  existingTierCosts,
  moldNumber,
  productDimensions,
  tinThickness,
  printingLid: defaultPrintingLid,
  printingBody: defaultPrintingBody,
  printingBottom: defaultPrintingBottom,
  printingInner: defaultPrintingInner,
  printingNotes: defaultPrintingNotes,
  embossment: defaultEmbossment,
  embossmentComponents: defaultEmbossmentComponents,
  embossmentNotes: defaultEmbossmentNotes,
  returnTo,
}: {
  locale: string;
  quoteId: string;
  tiers: Tier[];
  existingSheet: Record<string, unknown> | null;
  existingTierCosts: ExistingTierCost[];
  moldNumber: string;
  productDimensions: string;
  tinThickness?: string;
  // Pre-filled from quote request
  printingLid?: string;
  printingBody?: string;
  printingBottom?: string;
  printingInner?: string;
  printingNotes?: string;
  embossment?: boolean;
  embossmentComponents?: string;
  embossmentNotes?: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const sessionId = useId().replace(/:/g, "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Attachments: existing (already saved) + newly uploaded
  const [existingAttachments, setExistingAttachments] = useState<UploadedFile[]>(() => {
    const saved = existingSheet?.attachments;
    if (Array.isArray(saved)) return saved as UploadedFile[];
    return [];
  });
  const [newAttachments, setNewAttachments] = useState<UploadedFile[]>([]);

  // Sheet Info
  const [sheetDate, setSheetDate] = useState(String(existingSheet?.sheet_date ?? ""));
  const [moldNum, setMoldNum] = useState(String(existingSheet?.mold_number ?? moldNumber));
  const [productDims, setProductDims] = useState(String(existingSheet?.product_dimensions ?? productDimensions));
  const [steelThickness, setSteelThickness] = useState(
    existingSheet?.steel_thickness != null ? String(existingSheet.steel_thickness) : (tinThickness ?? "")
  );

  // Printing & Embossing
  const [printingLid, setPrintingLid] = useState(String(existingSheet?.printing_lid ?? defaultPrintingLid ?? ""));
  const [printingBody, setPrintingBody] = useState(String(existingSheet?.printing_body ?? defaultPrintingBody ?? ""));
  const [printingBottom, setPrintingBottom] = useState(String(existingSheet?.printing_bottom ?? defaultPrintingBottom ?? ""));
  const [printingInner, setPrintingInner] = useState(String(existingSheet?.printing_inner ?? defaultPrintingInner ?? ""));
  const [printingNotesVal, setPrintingNotesVal] = useState(String(existingSheet?.printing_notes ?? defaultPrintingNotes ?? ""));
  const [embossmentFlag, setEmbossmentFlag] = useState(
    existingSheet?.embossment != null ? Boolean(existingSheet.embossment) : (defaultEmbossment ?? false)
  );
  const [embossmentComp, setEmbossmentComp] = useState(String(existingSheet?.embossment_components ?? defaultEmbossmentComponents ?? ""));
  const [embossmentNotesVal, setEmbossmentNotesVal] = useState(String(existingSheet?.embossment_notes ?? defaultEmbossmentNotes ?? ""));

  // Mold Costs
  const [moldCostNew, setMoldCostNew] = useState(String(existingSheet?.mold_cost_new ?? ""));
  const [moldCostAdjust, setMoldCostAdjust] = useState(String(existingSheet?.mold_cost_modify ?? ""));
  const [moldLeadTime, setMoldLeadTime] = useState(String(existingSheet?.mold_lead_time_days ?? ""));

  // Packaging lines (dynamic table)
  const [packagingLines, setPackagingLines] = useState<PackagingLine[]>(() => {
    const existing = existingSheet?.packaging_lines;
    if (Array.isArray(existing) && existing.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (existing as any[]).map((p, i) => ({
        id: String(i),
        type: p.type ?? "outer_carton",
        config: String(p.config ?? ""),
        l: String(p.l ?? ""),
        w: String(p.w ?? ""),
        h: String(p.h ?? ""),
        cbm: String(p.cbm ?? ""),
        tins: String(p.tins ?? ""),
      }));
    }
    return [makePackagingLine()];
  });

  // Tier costs
  const [tierCosts, setTierCosts] = useState<TierCost[]>(() =>
    tiers.map((t) => {
      const existing = existingTierCosts.find((e) => e.tier_label === t.tier_label);
      return makeTierCost(t, existing);
    })
  );

  // Packaging line handlers
  const addLine = () => setPackagingLines((prev) => [...prev, { ...makePackagingLine(), id: Date.now().toString() }]);
  const removeLine = (id: string) => setPackagingLines((prev) => prev.filter((l) => l.id !== id));
  const updateLine = (id: string, field: keyof PackagingLine, value: string) =>
    setPackagingLines((prev) => prev.map((l) => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      if (field === "l" || field === "w" || field === "h") {
        updated.cbm = calcCbm(
          field === "l" ? value : l.l,
          field === "w" ? value : l.w,
          field === "h" ? value : l.h,
        );
      }
      return updated;
    }));

  const updateTier = (label: string, field: keyof TierCost, value: string) =>
    setTierCosts((prev) => prev.map((t) => t.tier_label === label ? { ...t, [field]: value } : t));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const allAttachments = [...existingAttachments, ...newAttachments];
    if (allAttachments.length === 0) {
      setError("At least one attachment (written sheet scan) is required.");
      setLoading(false);
      return;
    }

    const sheetPayload = {
      quotation_id: quoteId,
      sheet_date: sheetDate || null,
      mold_number: moldNum || null,
      product_dimensions: productDims || null,
      steel_thickness: parseFloat(steelThickness) || null,
      printing_lid: printingLid || null,
      printing_body: printingBody || null,
      printing_bottom: printingBottom || null,
      printing_inner: printingInner || null,
      printing_notes: printingNotesVal || null,
      embossment: embossmentFlag,
      embossment_components: embossmentComp || null,
      embossment_notes: embossmentNotesVal || null,
      mold_cost_new: parseFloat(moldCostNew) || null,
      mold_cost_modify: parseFloat(moldCostAdjust) || null,
      mold_lead_time_days: parseInt(moldLeadTime) || null,
      attachments: allAttachments,
      packaging_lines: packagingLines.map(({ id: _id, ...p }) => ({
        type: p.type,
        config: p.config || null,
        l: parseFloat(p.l) || null,
        w: parseFloat(p.w) || null,
        h: parseFloat(p.h) || null,
        cbm: parseFloat(p.cbm) || null,
        tins: parseInt(p.tins) || null,
      })),
    };

    const tiersPayload = tierCosts.map((t) => ({
      tier_label: t.tier_label,
      quantity: parseInt(t.quantity) || null,
      total_subtotal: parseFloat(t.total_subtotal) || null,
      labor_cost: parseFloat(t.labor_cost) || null,
      accessories_cost: parseFloat(t.accessories_cost) || null,
      container_info: t.container_info || null,
      tier_notes: t.tier_notes || null,
    }));

    try {
      const method = existingSheet ? "PATCH" : "POST";
      const body = existingSheet
        ? { id: existingSheet.id, ...sheetPayload, tiers: tiersPayload }
        : { ...sheetPayload, tiers: tiersPayload };

      const res = await fetch("/api/factory-sheets", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      router.push(returnTo ?? `/${locale}/quotes/${quoteId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">

      {/* Sheet Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Sheet Info</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Sheet Date</Label>
              <Input type="date" value={sheetDate} onChange={(e) => setSheetDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Mold Number</Label>
              <MoldSelect
                value={moldNum}
                onChange={(num, dims) => {
                  setMoldNum(num);
                  if (dims && !productDims) setProductDims(dims);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Product Dimensions</Label>
              <Input value={productDims} onChange={(e) => setProductDims(e.target.value)} placeholder="200×200×40mm" />
            </div>
            <div className="space-y-2">
              <Label>板厚 Tin Thickness (mm)</Label>
              <Input
                type="number"
                step="0.01"
                value={steelThickness}
                onChange={(e) => setSteelThickness(e.target.value)}
                placeholder="0.25"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Printing Requirements */}
      <Card>
        <CardHeader><CardTitle className="text-base">Printing Requirements (印刷)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Lid (盖)</Label>
              <Input value={printingLid} onChange={(e) => setPrintingLid(e.target.value)} placeholder="e.g. 4C+0C, CMYK" />
            </div>
            <div className="space-y-2">
              <Label>Body (身)</Label>
              <Input value={printingBody} onChange={(e) => setPrintingBody(e.target.value)} placeholder="e.g. 4C+2C" />
            </div>
            <div className="space-y-2">
              <Label>Bottom (底)</Label>
              <Input value={printingBottom} onChange={(e) => setPrintingBottom(e.target.value)} placeholder="e.g. 1C+0C" />
            </div>
            <div className="space-y-2">
              <Label>Inner (内)</Label>
              <Input value={printingInner} onChange={(e) => setPrintingInner(e.target.value)} placeholder="e.g. gold lacquer" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Label>Printing Notes</Label>
            <Input value={printingNotesVal} onChange={(e) => setPrintingNotesVal(e.target.value)} placeholder="Additional printing notes..." />
          </div>
        </CardContent>
      </Card>

      {/* Embossment */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Embossment (起鼓)</CardTitle>
          <button
            type="button"
            onClick={() => setEmbossmentFlag(!embossmentFlag)}
            className="relative w-10 h-5 rounded-full transition-colors"
            style={{ background: embossmentFlag ? "var(--primary)" : "oklch(0.85 0 0)" }}
          >
            <div
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
              style={{ left: embossmentFlag ? "calc(100% - 18px)" : "2px" }}
            />
          </button>
        </CardHeader>
        {embossmentFlag && (
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Components</Label>
                <Input value={embossmentComp} onChange={(e) => setEmbossmentComp(e.target.value)} placeholder="e.g. Lid top, body band" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={embossmentNotesVal} onChange={(e) => setEmbossmentNotesVal(e.target.value)} placeholder="Embossment details..." />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Mold Costs */}
      <Card>
        <CardHeader><CardTitle className="text-base">Mold Costs (模具费)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>New Mold Cost (RMB)</Label>
              <Input type="number" step="0.01" value={moldCostNew} onChange={(e) => setMoldCostNew(e.target.value)} placeholder="40000" />
            </div>
            <div className="space-y-2">
              <Label>Adjustment Cost (RMB)</Label>
              <Input type="number" step="0.01" value={moldCostAdjust} onChange={(e) => setMoldCostAdjust(e.target.value)} placeholder="1000" />
            </div>
            <div className="space-y-2">
              <Label>Lead Time (days)</Label>
              <Input type="number" value={moldLeadTime} onChange={(e) => setMoldLeadTime(e.target.value)} placeholder="30" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Packaging & Logistics */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Packaging & Logistics</CardTitle>
          <Button type="button" variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={addLine}>
            <Plus className="h-3 w-3" /> Add Line
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-36">Type</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-28">Config</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-20">L (mm)</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-20">W (mm)</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-20">H (mm)</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-24">CBM (m³)</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-20">Tins</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {packagingLines.map((line) => (
                <tr key={line.id} className="align-middle">
                  <td className="px-3 py-2">
                    <Select value={line.type} onValueChange={(v) => v && updateLine(line.id, "type", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PACKAGING_TYPE_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Input className="h-8 text-sm" value={line.config} onChange={(e) => updateLine(line.id, "config", e.target.value)} placeholder="e.g. 4×6" />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" className="h-8 text-sm" value={line.l} onChange={(e) => updateLine(line.id, "l", e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" className="h-8 text-sm" value={line.w} onChange={(e) => updateLine(line.id, "w", e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" className="h-8 text-sm" value={line.h} onChange={(e) => updateLine(line.id, "h", e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <Input className="h-8 text-sm bg-gray-50" value={line.cbm} readOnly placeholder="auto" />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" className="h-8 text-sm" value={line.tins} onChange={(e) => updateLine(line.id, "tins", e.target.value)} placeholder="0" />
                  </td>
                  <td className="pr-2 py-2">
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeLine(line.id)} disabled={packagingLines.length <= 1}>
                      <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Cost Summary per Tier */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cost Summary per Tier (总成本合计)</CardTitle>
          <p className="text-xs text-gray-500 mt-1">All values in RMB. Container auto-filled from quote request type.</p>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-10">Tier</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-24">Qty</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-28 text-blue-700">总成本合计</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-24">Labour</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-24">Accessories</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-24">Container</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tierCosts.map((tier) => (
                <tr key={tier.tier_label} className="align-middle">
                  <td className="px-3 py-2">
                    <span className="flex items-center justify-center h-8 w-8 rounded bg-gray-100 text-xs font-bold text-gray-600">
                      {tier.tier_label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" className="h-8 text-sm" value={tier.quantity} onChange={(e) => updateTier(tier.tier_label, "quantity", e.target.value)} placeholder="qty" />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" step="0.0001" className="h-8 text-sm border-blue-200 focus:border-blue-400" value={tier.total_subtotal} onChange={(e) => updateTier(tier.tier_label, "total_subtotal", e.target.value)} placeholder="0.0000" />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" step="0.0001" className="h-8 text-sm" value={tier.labor_cost} onChange={(e) => updateTier(tier.tier_label, "labor_cost", e.target.value)} placeholder="0.0000" />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" step="0.0001" className="h-8 text-sm" value={tier.accessories_cost} onChange={(e) => updateTier(tier.tier_label, "accessories_cost", e.target.value)} placeholder="0.0000" />
                  </td>
                  <td className="px-3 py-2">
                    <Input className="h-8 text-sm" value={tier.container_info} onChange={(e) => updateTier(tier.tier_label, "container_info", e.target.value)} placeholder="e.g. 20GP" />
                  </td>
                  <td className="px-3 py-2">
                    <Input className="h-8 text-sm" value={tier.tier_notes} onChange={(e) => updateTier(tier.tier_label, "tier_notes", e.target.value)} placeholder="Optional notes" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Attachments (required) */}
      <Card className="border-amber-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-amber-600" />
            Written Sheet Scan
            <span className="text-xs font-normal text-red-500 ml-1">* required</span>
          </CardTitle>
          <p className="text-xs text-gray-500 mt-1">Attach a photo or scan of the original factory cost sheet.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Existing saved attachments */}
          {existingAttachments.length > 0 && (
            <ul className="space-y-1.5">
              {existingAttachments.map((f, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-2 rounded-md border border-gray-100 bg-gray-50 text-sm">
                  <Paperclip className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-blue-700 hover:underline font-medium">
                    {f.name}
                  </a>
                  <button
                    type="button"
                    onClick={() => setExistingAttachments((prev) => prev.filter((_, j) => j !== i))}
                    className="text-gray-300 hover:text-gray-500 flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {/* New uploads */}
          <FileUpload
            sessionId={`factory-sheets/${sessionId}`}
            onChange={setNewAttachments}
          />
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.push(returnTo ?? `/${locale}/quotes/${quoteId}`)}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : existingSheet ? "Update Sheet" : "Save & Submit to Wilfred"}
        </Button>
      </div>
    </form>
  );
}
