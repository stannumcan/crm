"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Printer } from "lucide-react";
import { formatJPY } from "@/lib/calculations";

interface DDPCalc {
  id: string;
  tier_label: string;
  quantity: number;
  unit_price_jpy: number | null;
  total_revenue_jpy: number | null;
  selected_margin: number | null;
  shipping_cost_jpy: number | null;
  total_cost_jpy: number | null;
  manufacturing_cost_jpy: number | null;
}

export default function CustomerQuoteForm({
  locale,
  quoteId,
  woNumber,
  companyName,
  projectName,
  ddpCalcs,
  moldType,
  moldCostNew,
  moldLeadTimeDays,
  existingCQ,
}: {
  locale: string;
  quoteId: string;
  woNumber: string;
  companyName: string;
  projectName: string;
  ddpCalcs: DDPCalc[];
  moldType: string;
  moldCostNew: number | null;
  moldLeadTimeDays: number | null;
  existingCQ: Record<string, unknown> | null;
}) {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [quoteNumber, setQuoteNumber] = useState(String(existingCQ?.winhoop_quote_number ?? `${woNumber}-Q1`));
  const [customerName, setCustomerName] = useState(String(existingCQ?.customer_name ?? companyName));
  const [customerContact, setCustomerContact] = useState(String(existingCQ?.customer_contact ?? ""));
  const [dateSent, setDateSent] = useState(String(existingCQ?.date_sent ?? new Date().toISOString().slice(0, 10)));
  const [moldCostJpy, setMoldCostJpy] = useState(String(existingCQ?.mold_cost_jpy ?? (moldCostNew ? Math.round(moldCostNew * 20) : "")));
  const [embossCostJpy, setEmbossCostJpy] = useState(String(existingCQ?.emboss_cost_jpy ?? ""));
  const [sampleCostJpy, setSampleCostJpy] = useState(String(existingCQ?.sample_cost_jpy ?? ""));
  const [leadTimeMold, setLeadTimeMold] = useState(String(existingCQ?.lead_time_mold ?? (moldLeadTimeDays ? `${moldLeadTimeDays}日` : "")));
  const [leadTimeSample, setLeadTimeSample] = useState(String(existingCQ?.lead_time_sample ?? "型承認後14日"));
  const [leadTimeProduction, setLeadTimeProduction] = useState(String(existingCQ?.lead_time_production ?? "量産承認後30日"));
  const [paymentTooling, setPaymentTooling] = useState(String(existingCQ?.payment_terms_tooling ?? "発注時50%、型完成時50%"));
  const [paymentProduction, setPaymentProduction] = useState(String(existingCQ?.payment_terms_production ?? "出荷前100%"));
  const [validityDays, setValidityDays] = useState(String(existingCQ?.validity_days ?? "30"));
  const [fxRateNote, setFxRateNote] = useState(String(existingCQ?.fx_rate_note ?? "20"));
  const [notes, setNotes] = useState(String(existingCQ?.notes ?? ""));

  const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
  const validUntil = new Date(Date.now() + parseInt(validityDays || "30") * 86400000)
    .toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = {
        quotation_id: quoteId,
        ddp_calculation_id: ddpCalcs[0]?.id ?? null,
        winhoop_quote_number: quoteNumber,
        customer_name: customerName,
        customer_contact: customerContact || null,
        date_sent: dateSent || null,
        mold_cost_jpy: parseInt(moldCostJpy) || null,
        emboss_cost_jpy: parseInt(embossCostJpy) || null,
        sample_cost_jpy: parseInt(sampleCostJpy) || null,
        lead_time_mold: leadTimeMold || null,
        lead_time_sample: leadTimeSample || null,
        lead_time_production: leadTimeProduction || null,
        payment_terms_tooling: paymentTooling || null,
        payment_terms_production: paymentProduction || null,
        validity_days: parseInt(validityDays) || 30,
        fx_rate_note: parseFloat(fxRateNote) || null,
        notes: notes || null,
      };

      const res = await fetch("/api/customer-quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }
      router.push(`/${locale}/quotes/${quoteId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Edit panel */}
      <Card className="print:hidden">
        <CardHeader><CardTitle className="text-base">Quote Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Quote Number</Label>
              <Input value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Customer Name (顧客名)</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contact Person (担当者)</Label>
              <Input value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} placeholder="e.g. 田中様" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Mold Cost JPY</Label>
              <Input type="number" value={moldCostJpy} onChange={(e) => setMoldCostJpy(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Emboss Cost JPY</Label>
              <Input type="number" value={embossCostJpy} onChange={(e) => setEmbossCostJpy(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sample Cost JPY</Label>
              <Input type="number" value={sampleCostJpy} onChange={(e) => setSampleCostJpy(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Validity (days)</Label>
              <Input type="number" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Lead Time: Mold (型製作)</Label>
              <Input value={leadTimeMold} onChange={(e) => setLeadTimeMold(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Lead Time: Sample (サンプル)</Label>
              <Input value={leadTimeSample} onChange={(e) => setLeadTimeSample(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Lead Time: Production (量産)</Label>
              <Input value={leadTimeProduction} onChange={(e) => setLeadTimeProduction(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payment Terms: Tooling (金型)</Label>
              <Input value={paymentTooling} onChange={(e) => setPaymentTooling(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Payment Terms: Production (生産)</Label>
              <Input value={paymentProduction} onChange={(e) => setPaymentProduction(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>FX Rate Note (1 RMB = X JPY)</Label>
              <Input type="number" step="0.01" value={fxRateNote} onChange={(e) => setFxRateNote(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes (備考)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 価格は為替レートにより変動する場合があります" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Japanese document preview */}
      <div ref={printRef} className="bg-white border border-gray-300 rounded-lg p-8 font-sans text-sm" style={{ fontFamily: "'Hiragino Sans', 'Yu Gothic', sans-serif" }}>
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-wider">お 見 積 書</h1>
            <p className="text-gray-500 text-xs mt-1">QUOTATION</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-bold text-lg">株式会社Winhoop</p>
            <p className="text-gray-600">見積番号: {quoteNumber}</p>
            <p className="text-gray-600">作成日: {today}</p>
            <p className="text-gray-600">有効期限: {validUntil}</p>
          </div>
        </div>

        <Separator className="mb-6" />

        {/* Customer info */}
        <div className="mb-6">
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="w-32 text-gray-500 py-1">宛先</td>
                <td className="font-semibold text-base">{customerName} 御中</td>
              </tr>
              {customerContact && (
                <tr>
                  <td className="text-gray-500 py-1">担当者</td>
                  <td>{customerContact} 様</td>
                </tr>
              )}
              <tr>
                <td className="text-gray-500 py-1">件名</td>
                <td>{projectName}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Price table */}
        <table className="w-full border-collapse mb-6">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="border border-gray-600 px-3 py-2 text-left text-xs">品目</th>
              <th className="border border-gray-600 px-3 py-2 text-right text-xs">数量</th>
              <th className="border border-gray-600 px-3 py-2 text-right text-xs">単価（円）</th>
              <th className="border border-gray-600 px-3 py-2 text-right text-xs">合計（円）</th>
              <th className="border border-gray-600 px-3 py-2 text-left text-xs">備考</th>
            </tr>
          </thead>
          <tbody>
            {ddpCalcs
              .sort((a, b) => a.tier_label.localeCompare(b.tier_label))
              .map((calc, idx) => (
                <tr key={calc.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="border border-gray-300 px-3 py-2">
                    {projectName}（{calc.tier_label}案）
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right font-mono">
                    {calc.quantity.toLocaleString()} 個
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right font-mono font-semibold">
                    {calc.unit_price_jpy ? calc.unit_price_jpy.toLocaleString() : "—"} 円
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right font-mono">
                    {calc.total_revenue_jpy ? calc.total_revenue_jpy.toLocaleString() : "—"} 円
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-xs text-gray-500">
                    DDP・税込
                  </td>
                </tr>
              ))}
            {moldType === "new" && moldCostJpy && (
              <tr className="bg-amber-50">
                <td className="border border-gray-300 px-3 py-2">金型費（新規）</td>
                <td className="border border-gray-300 px-3 py-2 text-right font-mono">1 式</td>
                <td className="border border-gray-300 px-3 py-2 text-right font-mono font-semibold">
                  {parseInt(moldCostJpy).toLocaleString()} 円
                </td>
                <td className="border border-gray-300 px-3 py-2 text-right font-mono">
                  {parseInt(moldCostJpy).toLocaleString()} 円
                </td>
                <td className="border border-gray-300 px-3 py-2 text-xs text-gray-500">別途</td>
              </tr>
            )}
            {embossCostJpy && (
              <tr className="bg-amber-50">
                <td className="border border-gray-300 px-3 py-2">エンボス加工費</td>
                <td className="border border-gray-300 px-3 py-2 text-right font-mono">1 式</td>
                <td className="border border-gray-300 px-3 py-2 text-right font-mono font-semibold">
                  {parseInt(embossCostJpy).toLocaleString()} 円
                </td>
                <td className="border border-gray-300 px-3 py-2 text-right font-mono">
                  {parseInt(embossCostJpy).toLocaleString()} 円
                </td>
                <td className="border border-gray-300 px-3 py-2 text-xs text-gray-500">別途</td>
              </tr>
            )}
            {sampleCostJpy && (
              <tr className="bg-amber-50">
                <td className="border border-gray-300 px-3 py-2">サンプル費</td>
                <td className="border border-gray-300 px-3 py-2 text-right font-mono">1 式</td>
                <td className="border border-gray-300 px-3 py-2 text-right font-mono font-semibold">
                  {parseInt(sampleCostJpy).toLocaleString()} 円
                </td>
                <td className="border border-gray-300 px-3 py-2 text-right font-mono">
                  {parseInt(sampleCostJpy).toLocaleString()} 円
                </td>
                <td className="border border-gray-300 px-3 py-2 text-xs text-gray-500">別途</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Conditions table */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <table className="text-sm w-full">
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-1.5 text-gray-500 w-32">納期（型製作）</td>
                <td className="py-1.5 font-medium">{leadTimeMold}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-1.5 text-gray-500">納期（サンプル）</td>
                <td className="py-1.5 font-medium">{leadTimeSample}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-1.5 text-gray-500">納期（量産）</td>
                <td className="py-1.5 font-medium">{leadTimeProduction}</td>
              </tr>
            </tbody>
          </table>
          <table className="text-sm w-full">
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-1.5 text-gray-500 w-32">お支払い（金型）</td>
                <td className="py-1.5 font-medium">{paymentTooling}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-1.5 text-gray-500">お支払い（量産）</td>
                <td className="py-1.5 font-medium">{paymentProduction}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-1.5 text-gray-500">参考為替レート</td>
                <td className="py-1.5 font-medium">1 元 ＝ {fxRateNote} 円</td>
              </tr>
            </tbody>
          </table>
        </div>

        {notes && (
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-500 font-semibold mb-1">備考</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
          </div>
        )}

        <div className="border-t border-gray-200 pt-4 mt-4 text-xs text-gray-400">
          <p>本見積書の有効期限は発行日より {validityDays} 日間です。価格は為替レートにより変動する場合があります。</p>
          <p className="mt-1">※ DDP価格（Delivered Duty Paid）：輸入関税・通関費用含む日本国内お届け価格</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 print:hidden">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end print:hidden">
        <Button type="button" variant="outline" onClick={() => router.push(`/${locale}/quotes/${quoteId}`)}>
          Cancel
        </Button>
        <Button type="button" variant="outline" onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Print / PDF
        </Button>
        <Button type="button" onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Save Quote Record"}
        </Button>
      </div>
    </div>
  );
}
