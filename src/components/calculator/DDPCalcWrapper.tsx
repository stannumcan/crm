"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Loader2 } from "lucide-react";
import DDPCalcForm from "@/components/calculator/DDPCalcForm";

interface SheetData {
  id: string;
  moldNumber: string | null;
  quoteInfo: {
    companyName: string; projectName: string; woNumber: string; canSize: string;
    moldNumber: string; tinThickness: number | null; moldCostNew: number | null;
    moldCostModify: number | null; moldLeadTime: number | null;
  };
  packagingDefaults: {
    pcsPerCarton: number | null; boxL: number | null; boxW: number | null; boxH: number | null;
    palletL: number | null; palletW: number | null; palletH: number | null;
    boxesPerPallet: number | null; pcsPerPallet: number | null;
    containers: { type: string; pcsPerContainer: number | null }[];
  };
  approvedCalcs: { tier_label: string; quantity: number; estimated_cost_rmb: number | null; approved: boolean; quantity_type: string }[];
  existingDDP: Record<string, unknown>[];
  hasSaved: boolean;
}

interface DDPSettings {
  lcl_rate_per_cbm: number;
  lcl_base_fee: number;
  fcl_20gp_jpy: number;
  fcl_40gp_jpy: number;
  fcl_40hq_jpy: number;
  margin_values: number[];
}

export default function DDPCalcWrapper({
  locale,
  quoteId,
  sheets: initialSheets,
  shippingRates,
}: {
  locale: string;
  quoteId: string;
  sheets: SheetData[];
  shippingRates: DDPSettings;
}) {
  const router = useRouter();
  const [savedSheets, setSavedSheets] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    initialSheets.forEach((s) => { if (s.hasSaved) initial.add(s.id); });
    return initial;
  });
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");

  const allSaved = initialSheets.every((s) => savedSheets.has(s.id));

  const handleComplete = async () => {
    setCompleting(true);
    setError("");
    try {
      const res = await fetch("/api/ddp-calc/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotation_id: quoteId }),
      });
      if (!res.ok) throw new Error("Failed to complete");
      router.push(`/${locale}/quotes/${quoteId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setCompleting(false);
    }
  };

  const markSaved = (sheetId: string) => {
    setSavedSheets((prev) => new Set(prev).add(sheetId));
  };

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center gap-3 flex-wrap">
        {initialSheets.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5">
            {savedSheets.has(s.id) ? (
              <Badge variant="outline" className="text-xs text-green-700 border-green-200 bg-green-50 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {s.moldNumber ?? "Mold"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs gap-1">
                {s.moldNumber ?? "Mold"}
              </Badge>
            )}
          </div>
        ))}
        <span className="text-xs text-muted-foreground ml-1">
          {savedSheets.size}/{initialSheets.length} saved
        </span>
      </div>

      {/* Mold tabs */}
      {initialSheets.length === 1 ? (
        <DDPCalcForm
          locale={locale}
          quoteId={quoteId}
          costSheetId={initialSheets[0].id}
          quoteInfo={initialSheets[0].quoteInfo}
          packagingDefaults={initialSheets[0].packagingDefaults}
          approvedCalcs={initialSheets[0].approvedCalcs}
          existingDDP={initialSheets[0].existingDDP}
          shippingRates={shippingRates}
          onSaved={() => markSaved(initialSheets[0].id)}
        />
      ) : (
        <Tabs defaultValue={initialSheets[0].id}>
          <TabsList className="mb-4">
            {initialSheets.map((sheet) => (
              <TabsTrigger key={sheet.id} value={sheet.id} className="gap-1.5">
                {savedSheets.has(sheet.id) && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                {sheet.moldNumber ?? "Mold"}
              </TabsTrigger>
            ))}
          </TabsList>
          {initialSheets.map((sheet) => (
            <TabsContent key={sheet.id} value={sheet.id}>
              <DDPCalcForm
                locale={locale}
                quoteId={quoteId}
                costSheetId={sheet.id}
                quoteInfo={sheet.quoteInfo}
                packagingDefaults={sheet.packagingDefaults}
                approvedCalcs={sheet.approvedCalcs}
                existingDDP={sheet.existingDDP}
                shippingRates={shippingRates}
                onSaved={() => markSaved(sheet.id)}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Bottom actions */}
      <div className="flex gap-3 justify-end border-t pt-4">
        <Button type="button" variant="outline" onClick={() => router.push(`/${locale}/quotes/${quoteId}`)}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleComplete}
          disabled={!allSaved || completing}
          className={allSaved ? "bg-green-600 hover:bg-green-700" : ""}
        >
          {completing ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Completing...</>
          ) : allSaved ? (
            "Complete All & Send"
          ) : (
            `Save all moulds first (${savedSheets.size}/${initialSheets.length})`
          )}
        </Button>
      </div>
    </div>
  );
}
