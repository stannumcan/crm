"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScanLine, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface Tier {
  tier_label: string;
  quantity_type: string;
  quantity: number | null;
  sort_order: number;
}

interface ComponentCost {
  component: string;
  cut_size: string;
  layout: string;
  steel_unit_price: string;
  printing_requirements: string;
  printing_cost_per_sheet: string;
  printing_unit_price: string;
}

interface TierCost {
  tier_label: string;
  quantity: string;
  steel_cost: string;
  printing_cost: string;
  packaging_cost: string;
  shipping_cost: string;
  total_subtotal: string;
  labor_cost: string;
  accessories_cost: string;
  container_info: string;
}

const COMPONENTS = ["lid", "body", "bottom", "inner_lid"] as const;
const COMPONENT_LABELS: Record<string, string> = {
  lid: "Lid (盖)",
  body: "Body (身)",
  bottom: "Bottom (底)",
  inner_lid: "Inner Lid (内盖)",
};

function makeComponentCost(component: string): ComponentCost {
  return { component, cut_size: "", layout: "", steel_unit_price: "", printing_requirements: "", printing_cost_per_sheet: "", printing_unit_price: "" };
}

function makeTierCost(tier_label: string, quantity: number | null): TierCost {
  return {
    tier_label,
    quantity: quantity ? String(quantity) : "",
    steel_cost: "", printing_cost: "", packaging_cost: "", shipping_cost: "",
    total_subtotal: "", labor_cost: "", accessories_cost: "", container_info: "",
  };
}

export default function FactorySheetForm({
  locale,
  quoteId,
  tiers,
  existingSheet,
  moldNumber,
  productDimensions,
}: {
  locale: string;
  quoteId: string;
  tiers: Tier[];
  existingSheet: Record<string, unknown> | null;
  moldNumber: string;
  productDimensions: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── OCR ──────────────────────────────────────────────────────────────
  const [ocrState, setOcrState] = useState<"idle" | "scanning" | "done" | "error">("idle");
  const [ocrMessage, setOcrMessage] = useState("");
  const scanInputRef = useRef<HTMLInputElement>(null);

  const handleScanFile = async (file: File) => {
    setOcrState("scanning");
    setOcrMessage("");
    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/ocr-factory-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType: file.type }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "OCR failed");
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = await res.json() as Record<string, any>;

      // Fill header fields
      if (d.factory_ref_no != null) setFactoryRefNo(String(d.factory_ref_no));
      if (d.sheet_date != null) setSheetDate(String(d.sheet_date));
      if (d.mold_number != null) setMoldNum(String(d.mold_number));
      if (d.product_dimensions != null) setProductDims(String(d.product_dimensions));
      if (d.steel_type != null) setSteelType(String(d.steel_type));
      if (d.steel_thickness != null) setSteelThickness(String(d.steel_thickness));
      if (d.steel_price_per_ton != null) setSteelPricePerTon(String(d.steel_price_per_ton));
      if (d.process != null) setProcess(String(d.process));
      if (d.accessories_name != null) setAccessoriesName(String(d.accessories_name));
      if (d.accessories_description != null) setAccessoriesDesc(String(d.accessories_description));

      // Carton / pallet
      if (d.outer_carton_qty != null) setOuterCartonQty(String(d.outer_carton_qty));
      if (d.outer_carton_config != null) setOuterCartonConfig(String(d.outer_carton_config));
      if (d.outer_carton_l != null) setOuterCartonL(String(d.outer_carton_l));
      if (d.outer_carton_w != null) setOuterCartonW(String(d.outer_carton_w));
      if (d.outer_carton_h != null) setOuterCartonH(String(d.outer_carton_h));
      if (d.outer_carton_cbm != null) setOuterCartonCbm(String(d.outer_carton_cbm));
      if (d.inner_carton_qty != null) setInnerCartonQty(String(d.inner_carton_qty));
      if (d.pallet_type != null) setPalletType(String(d.pallet_type));
      if (d.pallet_l != null) setPalletL(String(d.pallet_l));
      if (d.pallet_w != null) setPalletW(String(d.pallet_w));
      if (d.pallet_h != null) setPalletH(String(d.pallet_h));
      if (d.pallet_config != null) setPalletConfig(String(d.pallet_config));
      if (d.cans_per_pallet != null) setCansPerPallet(String(d.cans_per_pallet));

      // Mold costs
      if (d.mold_cost_new != null) setMoldCostNew(String(d.mold_cost_new));
      if (d.mold_cost_modify != null) setMoldCostModify(String(d.mold_cost_modify));
      if (d.mold_lead_time_days != null) setMoldLeadTime(String(d.mold_lead_time_days));

      // Components
      if (Array.isArray(d.components) && d.components.length > 0) {
        setComponents((prev) => prev.map((existing) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const match = d.components.find((c: any) => c.component === existing.component);
          if (!match) return existing;
          return {
            ...existing,
            cut_size: match.cut_size != null ? String(match.cut_size) : existing.cut_size,
            layout: match.layout != null ? String(match.layout) : existing.layout,
            steel_unit_price: match.steel_unit_price != null ? String(match.steel_unit_price) : existing.steel_unit_price,
            printing_requirements: match.printing_requirements != null ? String(match.printing_requirements) : existing.printing_requirements,
            printing_cost_per_sheet: match.printing_cost_per_sheet != null ? String(match.printing_cost_per_sheet) : existing.printing_cost_per_sheet,
            printing_unit_price: match.printing_unit_price != null ? String(match.printing_unit_price) : existing.printing_unit_price,
          };
        }));
      }

      // Tiers
      if (Array.isArray(d.tiers) && d.tiers.length > 0) {
        setTierCosts((prev) => {
          if (prev.length === 0) return prev;
          return prev.map((existing, i) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const match = d.tiers.find((t: any) => t.tier_label === existing.tier_label) ?? d.tiers[i];
            if (!match) return existing;
            return {
              ...existing,
              quantity: match.quantity != null ? String(match.quantity) : existing.quantity,
              steel_cost: match.steel_cost != null ? String(match.steel_cost) : existing.steel_cost,
              printing_cost: match.printing_cost != null ? String(match.printing_cost) : existing.printing_cost,
              packaging_cost: match.packaging_cost != null ? String(match.packaging_cost) : existing.packaging_cost,
              shipping_cost: match.shipping_cost != null ? String(match.shipping_cost) : existing.shipping_cost,
              total_subtotal: match.total_subtotal != null ? String(match.total_subtotal) : existing.total_subtotal,
              labor_cost: match.labor_cost != null ? String(match.labor_cost) : existing.labor_cost,
              accessories_cost: match.accessories_cost != null ? String(match.accessories_cost) : existing.accessories_cost,
              container_info: match.container_info != null ? String(match.container_info) : existing.container_info,
            };
          });
        });
      }

      // Count non-null extracted fields for summary
      const count = Object.values(d).filter((v) => v != null && !Array.isArray(v)).length
        + (d.components?.reduce((acc: number, c: Record<string, unknown>) => acc + Object.values(c).filter((v) => v != null).length, 0) ?? 0)
        + (d.tiers?.reduce((acc: number, t: Record<string, unknown>) => acc + Object.values(t).filter((v) => v != null).length, 0) ?? 0);

      setOcrState("done");
      setOcrMessage(`Extracted ${count} values — review fields below and correct any errors before saving.`);
    } catch (err) {
      setOcrState("error");
      setOcrMessage(err instanceof Error ? err.message : "OCR failed");
    } finally {
      if (scanInputRef.current) scanInputRef.current.value = "";
    }
  };

  // Sheet header fields
  const [factoryRefNo, setFactoryRefNo] = useState(String(existingSheet?.factory_ref_no ?? ""));
  const [sheetDate, setSheetDate] = useState(String(existingSheet?.sheet_date ?? ""));
  const [moldNum, setMoldNum] = useState(String(existingSheet?.mold_number ?? moldNumber));
  const [productDims, setProductDims] = useState(String(existingSheet?.product_dimensions ?? productDimensions));
  const [steelType, setSteelType] = useState(String(existingSheet?.steel_type ?? ""));
  const [steelThickness, setSteelThickness] = useState(String(existingSheet?.steel_thickness ?? ""));
  const [steelPricePerTon, setSteelPricePerTon] = useState(String(existingSheet?.steel_price_per_ton ?? ""));
  const [process, setProcess] = useState(String(existingSheet?.process ?? ""));
  const [accessoriesName, setAccessoriesName] = useState(String(existingSheet?.accessories_name ?? ""));
  const [accessoriesDesc, setAccessoriesDesc] = useState(String(existingSheet?.accessories_description ?? ""));

  // Carton / pallet
  const [outerCartonQty, setOuterCartonQty] = useState(String(existingSheet?.outer_carton_qty ?? ""));
  const [outerCartonConfig, setOuterCartonConfig] = useState(String(existingSheet?.outer_carton_config ?? ""));
  const [outerCartonL, setOuterCartonL] = useState(String(existingSheet?.outer_carton_l ?? ""));
  const [outerCartonW, setOuterCartonW] = useState(String(existingSheet?.outer_carton_w ?? ""));
  const [outerCartonH, setOuterCartonH] = useState(String(existingSheet?.outer_carton_h ?? ""));
  const [outerCartonCbm, setOuterCartonCbm] = useState(String(existingSheet?.outer_carton_cbm ?? ""));
  const [innerCartonQty, setInnerCartonQty] = useState(String(existingSheet?.inner_carton_qty ?? ""));
  const [palletType, setPalletType] = useState(String(existingSheet?.pallet_type ?? ""));
  const [palletL, setPalletL] = useState(String(existingSheet?.pallet_l ?? ""));
  const [palletW, setPalletW] = useState(String(existingSheet?.pallet_w ?? ""));
  const [palletH, setPalletH] = useState(String(existingSheet?.pallet_h ?? ""));
  const [palletConfig, setPalletConfig] = useState(String(existingSheet?.pallet_config ?? ""));
  const [cansPerPallet, setCansPerPallet] = useState(String(existingSheet?.cans_per_pallet ?? ""));

  // Mold costs
  const [moldCostNew, setMoldCostNew] = useState(String(existingSheet?.mold_cost_new ?? ""));
  const [moldCostModify, setMoldCostModify] = useState(String(existingSheet?.mold_cost_modify ?? ""));
  const [moldLeadTime, setMoldLeadTime] = useState(String(existingSheet?.mold_lead_time_days ?? ""));

  // Component costs (one per component)
  const [components, setComponents] = useState<ComponentCost[]>(
    COMPONENTS.map(makeComponentCost)
  );

  // Tier cost rows
  const [tierCosts, setTierCosts] = useState<TierCost[]>(
    tiers.map((t) => makeTierCost(t.tier_label, t.quantity))
  );

  const updateComponent = (index: number, field: keyof ComponentCost, value: string) => {
    setComponents(components.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const updateTierCost = (index: number, field: keyof TierCost, value: string) => {
    setTierCosts(tierCosts.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  // Auto-calc outer carton CBM when L/W/H change
  const calcCbm = (l: string, w: string, h: string) => {
    const lv = parseFloat(l), wv = parseFloat(w), hv = parseFloat(h);
    if (lv && wv && hv) {
      setOuterCartonCbm(((lv * wv * hv) / 1_000_000).toFixed(6));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      quotation_id: quoteId,
      factory_ref_no: factoryRefNo || null,
      sheet_date: sheetDate || null,
      mold_number: moldNum || null,
      product_dimensions: productDims || null,
      steel_type: steelType || null,
      steel_thickness: parseFloat(steelThickness) || null,
      steel_price_per_ton: parseFloat(steelPricePerTon) || null,
      process: process || null,
      accessories_name: accessoriesName || null,
      accessories_description: accessoriesDesc || null,
      outer_carton_qty: parseInt(outerCartonQty) || null,
      outer_carton_config: outerCartonConfig || null,
      outer_carton_l: parseFloat(outerCartonL) || null,
      outer_carton_w: parseFloat(outerCartonW) || null,
      outer_carton_h: parseFloat(outerCartonH) || null,
      outer_carton_cbm: parseFloat(outerCartonCbm) || null,
      inner_carton_qty: parseInt(innerCartonQty) || null,
      pallet_type: palletType || null,
      pallet_l: parseFloat(palletL) || null,
      pallet_w: parseFloat(palletW) || null,
      pallet_h: parseFloat(palletH) || null,
      pallet_config: palletConfig || null,
      cans_per_pallet: parseInt(cansPerPallet) || null,
      mold_cost_new: parseFloat(moldCostNew) || null,
      mold_cost_modify: parseFloat(moldCostModify) || null,
      mold_lead_time_days: parseInt(moldLeadTime) || null,
      components: components.map((c) => ({
        component: c.component,
        cut_size: c.cut_size || null,
        layout: c.layout || null,
        steel_unit_price: parseFloat(c.steel_unit_price) || null,
        printing_requirements: c.printing_requirements || null,
        printing_cost_per_sheet: parseFloat(c.printing_cost_per_sheet) || null,
        printing_unit_price: parseFloat(c.printing_unit_price) || null,
      })),
      tiers: tierCosts.map((t) => ({
        tier_label: t.tier_label,
        quantity: parseInt(t.quantity) || 0,
        steel_cost: parseFloat(t.steel_cost) || null,
        printing_cost: parseFloat(t.printing_cost) || null,
        packaging_cost: parseFloat(t.packaging_cost) || null,
        shipping_cost: parseFloat(t.shipping_cost) || null,
        total_subtotal: parseFloat(t.total_subtotal) || null,
        labor_cost: parseFloat(t.labor_cost) || null,
        accessories_cost: parseFloat(t.accessories_cost) || null,
        container_info: t.container_info || null,
      })),
    };

    try {
      const method = existingSheet ? "PATCH" : "POST";
      const body = existingSheet ? { id: existingSheet.id, ...payload } : payload;
      const res = await fetch("/api/factory-sheets", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save factory cost sheet");
      }
      router.push(`/${locale}/quotes/${quoteId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">

      {/* OCR scan bar */}
      <div className="flex items-center gap-3 p-4 rounded-lg border border-dashed border-gray-200 bg-gray-50">
        <ScanLine className="h-5 w-5 text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-700">Scan factory sheet</p>
          <p className="text-xs text-gray-400">Upload a photo or scan — Claude will read the values and pre-fill the form</p>
        </div>
        {ocrState === "done" && (
          <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-1.5 max-w-xs">
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{ocrMessage}</span>
          </div>
        )}
        {ocrState === "error" && (
          <div className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-1.5 max-w-xs">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{ocrMessage}</span>
          </div>
        )}
        <input
          ref={scanInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleScanFile(f); }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={ocrState === "scanning"}
          onClick={() => scanInputRef.current?.click()}
          className="flex-shrink-0 gap-2"
        >
          {ocrState === "scanning" ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Scanning...</>
          ) : (
            <><ScanLine className="h-4 w-4" />Scan Sheet</>
          )}
        </Button>
      </div>

      {/* Sheet Header */}
      <Card>
        <CardHeader><CardTitle className="text-base">Sheet Info</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Factory Ref No.</Label>
              <Input value={factoryRefNo} onChange={(e) => setFactoryRefNo(e.target.value)} placeholder="e.g. GZ-2026-045" />
            </div>
            <div className="space-y-2">
              <Label>Sheet Date</Label>
              <Input type="date" value={sheetDate} onChange={(e) => setSheetDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Mold Number (ML-XXXX)</Label>
              <Input value={moldNum} onChange={(e) => setMoldNum(e.target.value)} placeholder="ML-1004B" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Product Dimensions</Label>
              <Input value={productDims} onChange={(e) => setProductDims(e.target.value)} placeholder="e.g. 200×200×40mm BH" />
            </div>
            <div className="space-y-2">
              <Label>Process</Label>
              <Input value={process} onChange={(e) => setProcess(e.target.value)} placeholder="e.g. 2片" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Steel Type (铁料)</Label>
              <Input value={steelType} onChange={(e) => setSteelType(e.target.value)} placeholder="e.g. MR" />
            </div>
            <div className="space-y-2">
              <Label>Thickness (mm)</Label>
              <Input type="number" step="0.01" value={steelThickness} onChange={(e) => setSteelThickness(e.target.value)} placeholder="0.23" />
            </div>
            <div className="space-y-2">
              <Label>Steel Price/Ton (RMB)</Label>
              <Input type="number" step="0.01" value={steelPricePerTon} onChange={(e) => setSteelPricePerTon(e.target.value)} placeholder="e.g. 5800" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Accessories Name (配件)</Label>
              <Input value={accessoriesName} onChange={(e) => setAccessoriesName(e.target.value)} placeholder="e.g. 塑胶圈, 铁线圈" />
            </div>
            <div className="space-y-2">
              <Label>Accessories Detail</Label>
              <Input value={accessoriesDesc} onChange={(e) => setAccessoriesDesc(e.target.value)} placeholder="e.g. 塑胶圈0.23元，铁线圈1.4元" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mold Costs */}
      <Card>
        <CardHeader><CardTitle className="text-base">Mold Costs (模具费)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>New Mold Cost (RMB)</Label>
            <Input type="number" step="0.01" value={moldCostNew} onChange={(e) => setMoldCostNew(e.target.value)} placeholder="e.g. 40000" />
          </div>
          <div className="space-y-2">
            <Label>Modify Cost (RMB)</Label>
            <Input type="number" step="0.01" value={moldCostModify} onChange={(e) => setMoldCostModify(e.target.value)} placeholder="e.g. 1000" />
          </div>
          <div className="space-y-2">
            <Label>Mold Lead Time (days)</Label>
            <Input type="number" value={moldLeadTime} onChange={(e) => setMoldLeadTime(e.target.value)} placeholder="e.g. 30" />
          </div>
        </CardContent>
      </Card>

      {/* Component Costs */}
      <Card>
        <CardHeader><CardTitle className="text-base">Component Costs (印刷 / 铁料 per component)</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-6">
            {components.map((comp, i) => (
              <div key={comp.component}>
                {i > 0 && <Separator className="mb-6" />}
                <p className="text-sm font-semibold text-gray-700 mb-3">{COMPONENT_LABELS[comp.component]}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Cut Size (mm)</Label>
                    <Input value={comp.cut_size} onChange={(e) => updateComponent(i, "cut_size", e.target.value)} placeholder="e.g. 680×500" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Layout (排版)</Label>
                    <Input value={comp.layout} onChange={(e) => updateComponent(i, "layout", e.target.value)} placeholder="e.g. 6×8" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Steel Unit Price (RMB)</Label>
                    <Input type="number" step="0.0001" value={comp.steel_unit_price} onChange={(e) => updateComponent(i, "steel_unit_price", e.target.value)} placeholder="0.0000" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Printing Requirements</Label>
                    <Input value={comp.printing_requirements} onChange={(e) => updateComponent(i, "printing_requirements", e.target.value)} placeholder="e.g. 4色+白" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Printing Cost/Sheet (RMB)</Label>
                    <Input type="number" step="0.01" value={comp.printing_cost_per_sheet} onChange={(e) => updateComponent(i, "printing_cost_per_sheet", e.target.value)} placeholder="0.00" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Printing Unit Price (RMB)</Label>
                    <Input type="number" step="0.0001" value={comp.printing_unit_price} onChange={(e) => updateComponent(i, "printing_unit_price", e.target.value)} placeholder="0.0000" className="text-sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Carton & Pallet */}
      <Card>
        <CardHeader><CardTitle className="text-base">Carton & Pallet Spec</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Outer Carton Qty</Label>
              <Input type="number" value={outerCartonQty} onChange={(e) => setOuterCartonQty(e.target.value)} placeholder="24" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Config (e.g. 4×6)</Label>
              <Input value={outerCartonConfig} onChange={(e) => setOuterCartonConfig(e.target.value)} placeholder="4×6" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Inner Carton Qty</Label>
              <Input type="number" value={innerCartonQty} onChange={(e) => setInnerCartonQty(e.target.value)} placeholder="6" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CBM (auto)</Label>
              <Input value={outerCartonCbm} readOnly className="text-sm bg-gray-50" placeholder="auto" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">L (mm)</Label>
              <Input type="number" value={outerCartonL} onChange={(e) => { setOuterCartonL(e.target.value); calcCbm(e.target.value, outerCartonW, outerCartonH); }} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">W (mm)</Label>
              <Input type="number" value={outerCartonW} onChange={(e) => { setOuterCartonW(e.target.value); calcCbm(outerCartonL, e.target.value, outerCartonH); }} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">H (mm)</Label>
              <Input type="number" value={outerCartonH} onChange={(e) => { setOuterCartonH(e.target.value); calcCbm(outerCartonL, outerCartonW, e.target.value); }} className="text-sm" />
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Pallet Type</Label>
              <Input value={palletType} onChange={(e) => setPalletType(e.target.value)} placeholder="e.g. EUR" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">L (mm)</Label>
              <Input type="number" value={palletL} onChange={(e) => setPalletL(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">W (mm)</Label>
              <Input type="number" value={palletW} onChange={(e) => setPalletW(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">H (mm)</Label>
              <Input type="number" value={palletH} onChange={(e) => setPalletH(e.target.value)} className="text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Pallet Config</Label>
              <Input value={palletConfig} onChange={(e) => setPalletConfig(e.target.value)} placeholder="e.g. 4×3 cartons" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cans per Pallet</Label>
              <Input type="number" value={cansPerPallet} onChange={(e) => setCansPerPallet(e.target.value)} className="text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost Tiers — 总成本合计 per quantity tier */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cost Summary per Tier (总成本合计)</CardTitle>
          <p className="text-xs text-gray-500 mt-1">Enter the cost breakdown for each quantity tier from the factory sheet. All values in RMB.</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Column headers */}
            <div className="grid grid-cols-10 gap-2 text-xs font-medium text-gray-500 px-1">
              <div>Tier</div>
              <div>Qty</div>
              <div>Steel</div>
              <div>Printing</div>
              <div>Packaging</div>
              <div>Shipping</div>
              <div className="font-bold text-gray-700">总成本合计</div>
              <div>Labour</div>
              <div>Accessories</div>
              <div>Container</div>
            </div>
            {tierCosts.map((tier, i) => (
              <div key={tier.tier_label} className="grid grid-cols-10 gap-2 items-center">
                <div className="flex items-center justify-center h-9 w-9 rounded-md bg-gray-100 text-sm font-bold text-gray-600">
                  {tier.tier_label}
                </div>
                <Input
                  type="number"
                  value={tier.quantity}
                  onChange={(e) => updateTierCost(i, "quantity", e.target.value)}
                  placeholder="qty"
                  className="text-sm"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={tier.steel_cost}
                  onChange={(e) => updateTierCost(i, "steel_cost", e.target.value)}
                  placeholder="0.00"
                  className="text-sm"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={tier.printing_cost}
                  onChange={(e) => updateTierCost(i, "printing_cost", e.target.value)}
                  placeholder="0.00"
                  className="text-sm"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={tier.packaging_cost}
                  onChange={(e) => updateTierCost(i, "packaging_cost", e.target.value)}
                  placeholder="0.00"
                  className="text-sm"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={tier.shipping_cost}
                  onChange={(e) => updateTierCost(i, "shipping_cost", e.target.value)}
                  placeholder="0.00"
                  className="text-sm"
                />
                <Input
                  type="number"
                  step="0.0001"
                  value={tier.total_subtotal}
                  onChange={(e) => updateTierCost(i, "total_subtotal", e.target.value)}
                  placeholder="0.0000"
                  className="text-sm font-medium border-blue-300 focus:border-blue-500"
                />
                <Input
                  type="number"
                  step="0.0001"
                  value={tier.labor_cost}
                  onChange={(e) => updateTierCost(i, "labor_cost", e.target.value)}
                  placeholder="0.0000"
                  className="text-sm"
                />
                <Input
                  type="number"
                  step="0.0001"
                  value={tier.accessories_cost}
                  onChange={(e) => updateTierCost(i, "accessories_cost", e.target.value)}
                  placeholder="0.0000"
                  className="text-sm"
                />
                <Input
                  value={tier.container_info}
                  onChange={(e) => updateTierCost(i, "container_info", e.target.value)}
                  placeholder="e.g. 1×20ft"
                  className="text-sm"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.push(`/${locale}/quotes/${quoteId}`)}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : existingSheet ? "Update Sheet" : "Save & Submit to Wilfred"}
        </Button>
      </div>
    </form>
  );
}
