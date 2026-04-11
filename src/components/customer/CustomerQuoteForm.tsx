"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, Plus, Trash2 } from "lucide-react";

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
  fx_rate_rmb_to_jpy: number | null;
}

interface PrintingLine {
  part: string;
  spec: string;
}

interface Props {
  locale: string;
  quoteId: string;
  woNumber: string;
  companyName: string;
  projectName: string;
  sizeNote: string;
  ddpCalcs: DDPCalc[];
  moldType: string;
  moldCostNew: number | null;
  moldLeadTimeDays: number | null;
  defaultMaterial: string;
  defaultThickness: string;
  defaultPrintingLines: PrintingLine[];
  defaultPacking: string;
  fxRateFromDDP: number | null;
  existingCQ: Record<string, unknown> | null;
}

function fmtJpy(n: number | string | null | undefined): string {
  const num = typeof n === "string" ? parseInt(n) : (n ?? 0);
  if (!num || isNaN(num)) return "―";
  return num.toLocaleString("ja-JP");
}

function parseExistingLines(raw: unknown, fallback: PrintingLine[]): PrintingLine[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return (raw as PrintingLine[]).map((r) => ({
      part: String(r.part ?? ""),
      spec: String(r.spec ?? ""),
    }));
  }
  return fallback;
}

function parseExistingNotes(raw: unknown, fallback: string[]): string[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return (raw as unknown[]).map((r) => String(r));
  }
  return fallback;
}

export default function CustomerQuoteForm({
  locale,
  quoteId,
  woNumber,
  companyName,
  projectName,
  sizeNote,
  ddpCalcs,
  moldType,
  moldCostNew,
  moldLeadTimeDays,
  defaultMaterial,
  defaultThickness,
  defaultPrintingLines,
  defaultPacking,
  fxRateFromDDP,
  existingCQ,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── editable state ──────────────────────────────────────────
  const [quoteNumber, setQuoteNumber] = useState(
    String(existingCQ?.winhoop_quote_number ?? `${woNumber}-Q1`)
  );
  const [dateSent, setDateSent] = useState(
    String(existingCQ?.date_sent ?? new Date().toISOString().slice(0, 10))
  );
  const [customerName, setCustomerName] = useState(
    String(existingCQ?.customer_name ?? companyName)
  );
  const [customerDept, setCustomerDept] = useState(
    String(existingCQ?.customer_dept ?? "")
  );
  const [customerContact, setCustomerContact] = useState(
    String(existingCQ?.customer_contact ?? "")
  );
  const [customerTel, setCustomerTel] = useState(
    String(existingCQ?.customer_tel ?? "")
  );
  const [customerFax, setCustomerFax] = useState(
    String(existingCQ?.customer_fax ?? "")
  );
  const [itemName, setItemName] = useState(
    String(existingCQ?.item_name ?? projectName)
  );
  const [sizeNoteState, setSizeNoteState] = useState(
    String(existingCQ?.size_note ?? sizeNote)
  );
  const [material, setMaterial] = useState(
    String(existingCQ?.material ?? defaultMaterial)
  );
  const [thickness, setThickness] = useState(
    String(existingCQ?.thickness ?? defaultThickness)
  );
  const [printingLines, setPrintingLines] = useState<PrintingLine[]>(
    parseExistingLines(existingCQ?.printing_lines, defaultPrintingLines)
  );
  const [packingDetails, setPackingDetails] = useState(
    String(existingCQ?.packing_details ?? defaultPacking)
  );

  const computedFxRate = fxRateFromDDP ?? 20;
  const [moldCostJpy, setMoldCostJpy] = useState(
    String(
      existingCQ?.mold_cost_jpy ??
        (moldCostNew ? Math.round(moldCostNew * computedFxRate) : "")
    )
  );
  const [embossCostJpy, setEmbossCostJpy] = useState(
    String(existingCQ?.emboss_cost_jpy ?? "")
  );
  const [sampleCostMachineJpy, setSampleCostMachineJpy] = useState(
    String(existingCQ?.sample_cost_machine_jpy ?? "55000")
  );
  const [sampleCostPlasticJpy, setSampleCostPlasticJpy] = useState(
    String(existingCQ?.sample_cost_plastic_jpy ?? "35000")
  );
  const [leadTimeMold, setLeadTimeMold] = useState(
    String(
      existingCQ?.lead_time_mold ??
        (moldLeadTimeDays ? `${moldLeadTimeDays}日程度` : "40日程度")
    )
  );
  const [leadTimeSample, setLeadTimeSample] = useState(
    String(existingCQ?.lead_time_sample ?? "15～20日＋空輸期間")
  );
  const [leadTimeProduction, setLeadTimeProduction] = useState(
    String(
      existingCQ?.lead_time_production ?? "最終ご発注後40－45日＋海上輸送（約2週間）"
    )
  );
  const [paymentTooling, setPaymentTooling] = useState(
    String(existingCQ?.payment_terms_tooling ?? "ご入金確認後に着手いたします")
  );
  const [paymentProduction, setPaymentProduction] = useState(
    String(
      existingCQ?.payment_terms_production ??
        "お届け後、末締めご請求、翌月末お支払にて"
    )
  );
  const [validityDays, setValidityDays] = useState(
    String(existingCQ?.validity_days ?? "30")
  );
  const [deliveryCondition, setDeliveryCondition] = useState(
    String(existingCQ?.delivery_condition ?? "御社倉庫にコンテナで一括納品")
  );
  const [fxRateNote, setFxRateNote] = useState(
    String(existingCQ?.fx_rate_note ?? fxRateFromDDP ?? "20")
  );

  const defaultNotes = [
    "本お見積りは現時点での概算お見積りとなります。",
    "本お見積りは1柄展開の場合のものとなります。",
    "本お見積りは事前お打ち合わせ済みのAQL2.5基準によるものです。",
    "サンプル作成は事前のお振込み完了頂き次第の着手となります。",
    `為替レート、１RMB＝${fxRateNote}円換算での算出としております。`,
    "本生産先出し等、空輸費用は別途発生いたします。",
    "コンテナ・パレットでの納品が不可の場合には、別途費用は発生しますが対応可能です。",
  ];

  const [notesLines, setNotesLines] = useState<string[]>(
    parseExistingNotes(existingCQ?.notes_lines, defaultNotes)
  );

  // ── helpers for dynamic rows ────────────────────────────────
  const updatePrintingLine = (idx: number, field: keyof PrintingLine, val: string) => {
    setPrintingLines((prev) =>
      prev.map((ln, i) => (i === idx ? { ...ln, [field]: val } : ln))
    );
  };
  const removePrintingLine = (idx: number) =>
    setPrintingLines((prev) => prev.filter((_, i) => i !== idx));
  const addPrintingLine = () =>
    setPrintingLines((prev) => [...prev, { part: "", spec: "" }]);

  const updateNote = (idx: number, val: string) =>
    setNotesLines((prev) => prev.map((n, i) => (i === idx ? val : n)));
  const removeNote = (idx: number) =>
    setNotesLines((prev) => prev.filter((_, i) => i !== idx));
  const addNote = () => setNotesLines((prev) => [...prev, ""]);

  // ── date display ────────────────────────────────────────────
  const displayDate = dateSent
    ? (() => {
        const d = new Date(dateSent);
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${mm}/${dd}/${d.getFullYear()}`;
      })()
    : "";

  // ── sorted calcs ────────────────────────────────────────────
  const sortedCalcs = [...ddpCalcs].sort((a, b) => a.quantity - b.quantity);

  // ── save ────────────────────────────────────────────────────
  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = {
        quotation_id: quoteId,
        ddp_calculation_id: ddpCalcs[0]?.id ?? null,
        winhoop_quote_number: quoteNumber,
        customer_name: customerName,
        customer_dept: customerDept || null,
        customer_contact: customerContact || null,
        customer_tel: customerTel || null,
        customer_fax: customerFax || null,
        date_sent: dateSent || null,
        item_name: itemName || null,
        size_note: sizeNoteState || null,
        material: material || null,
        thickness: thickness || null,
        printing_lines: printingLines,
        packing_details: packingDetails || null,
        mold_cost_jpy: parseInt(moldCostJpy) || null,
        emboss_cost_jpy: parseInt(embossCostJpy) || null,
        sample_cost_machine_jpy: parseInt(sampleCostMachineJpy) || null,
        sample_cost_plastic_jpy: parseInt(sampleCostPlasticJpy) || null,
        lead_time_mold: leadTimeMold || null,
        lead_time_sample: leadTimeSample || null,
        lead_time_production: leadTimeProduction || null,
        payment_terms_tooling: paymentTooling || null,
        payment_terms_production: paymentProduction || null,
        validity_days: parseInt(validityDays) || 30,
        delivery_condition: deliveryCondition || null,
        fx_rate_note: parseFloat(fxRateNote) || null,
        notes_lines: notesLines,
      };

      const method = existingCQ ? "PATCH" : "POST";
      const body = existingCQ
        ? JSON.stringify({ id: existingCQ.id, ...payload })
        : JSON.stringify(payload);

      const res = await fetch("/api/customer-quotes", {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error((data as { error?: string }).error ?? "Failed to save");
      }
      router.push(`/${locale}/quotes/${quoteId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  // ── shared cell style ───────────────────────────────────────
  const cellBase = "border border-gray-400 px-2 py-1 text-xs align-top";
  const labelCell = `${cellBase} bg-gray-100 font-medium whitespace-nowrap w-28`;
  const labelCellWide = `${cellBase} bg-gray-100 font-medium whitespace-nowrap w-36`;

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════
          EDIT PANEL (hidden on print)
      ═══════════════════════════════════════════════════════ */}
      <div className="print:hidden space-y-4">
        {/* Quote Header */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Quote Header</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">見積番号 Quote Number</Label>
              <Input value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">日付 Date</Label>
              <Input type="date" value={dateSent} onChange={(e) => setDateSent(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Customer Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">顧客情報 Customer</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">顧客名 Company</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">部署名 Department</Label>
              <Input value={customerDept} onChange={(e) => setCustomerDept(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">担当者 Contact</Label>
              <Input value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} placeholder="e.g. 早川" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">TEL</Label>
              <Input value={customerTel} onChange={(e) => setCustomerTel(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">FAX</Label>
              <Input value={customerFax} onChange={(e) => setCustomerFax(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Item Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">製品情報 Item Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">アイテム名 Item Name</Label>
                <Input value={itemName} onChange={(e) => setItemName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">サイズ Size</Label>
                <Input value={sizeNoteState} onChange={(e) => setSizeNoteState(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">素材 Material</Label>
                <Input value={material} onChange={(e) => setMaterial(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">厚さ Thickness</Label>
                <Input value={thickness} onChange={(e) => setThickness(e.target.value)} />
              </div>
            </div>

            {/* Printing lines */}
            <div className="space-y-1">
              <Label className="text-xs">印刷方法 Printing</Label>
              <div className="space-y-2">
                {printingLines.map((ln, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      className="w-44 text-xs"
                      placeholder="部位 e.g. 外面（蓋）"
                      value={ln.part}
                      onChange={(e) => updatePrintingLine(i, "part", e.target.value)}
                    />
                    <Input
                      className="flex-1 text-xs"
                      placeholder="仕様 e.g. 白コート+特②..."
                      value={ln.spec}
                      onChange={(e) => updatePrintingLine(i, "spec", e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePrintingLine(i)}
                    >
                      <Trash2 className="h-3 w-3 text-gray-400" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPrintingLine}
                  className="gap-1 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  行追加
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">梱包方法 Packing</Label>
              <Input value={packingDetails} onChange={(e) => setPackingDetails(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Costs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">費用 Costs</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">金型費用 Mold (JPY)</Label>
              <Input type="number" value={moldCostJpy} onChange={(e) => setMoldCostJpy(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">エンボスプレート (JPY)</Label>
              <Input type="number" value={embossCostJpy} onChange={(e) => setEmbossCostJpy(e.target.value)} placeholder="空欄 = ―" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">サンプル費（機械）(JPY)</Label>
              <Input type="number" value={sampleCostMachineJpy} onChange={(e) => setSampleCostMachineJpy(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">プラサンプル (JPY)</Label>
              <Input type="number" value={sampleCostPlasticJpy} onChange={(e) => setSampleCostPlasticJpy(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Lead Times & Payment */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">製造日数・お支払い条件</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">金型 Mold lead time</Label>
              <Input value={leadTimeMold} onChange={(e) => setLeadTimeMold(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">サンプル Sample lead time</Label>
              <Input value={leadTimeSample} onChange={(e) => setLeadTimeSample(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">本生産 Production lead time</Label>
              <Input value={leadTimeProduction} onChange={(e) => setLeadTimeProduction(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">金型・サンプル Payment (tooling)</Label>
              <Input value={paymentTooling} onChange={(e) => setPaymentTooling(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">本生産 Payment (production)</Label>
              <Input value={paymentProduction} onChange={(e) => setPaymentProduction(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Validity, Delivery, FX */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">有効期限・納品条件・為替</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">有効期限 Validity (days)</Label>
              <Input type="number" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">納品条件 Delivery condition</Label>
              <Input value={deliveryCondition} onChange={(e) => setDeliveryCondition(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">為替レート 1 RMB = X JPY</Label>
              <Input
                type="number"
                step="0.01"
                value={fxRateNote}
                onChange={(e) => setFxRateNote(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">その他 Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notesLines.map((note, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-xs text-gray-400 w-5 shrink-0">{i + 1}.</span>
                <Input
                  className="flex-1 text-xs"
                  value={note}
                  onChange={(e) => updateNote(i, e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeNote(i)}
                >
                  <Trash2 className="h-3 w-3 text-gray-400" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addNote}
              className="gap-1 text-xs"
            >
              <Plus className="h-3 w-3" />
              行追加
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════
          ACTION BUTTONS (hidden on print)
      ═══════════════════════════════════════════════════════ */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 print:hidden">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end print:hidden">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${locale}/quotes/${quoteId}`)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => window.print()}
          className="gap-2"
        >
          <Printer className="h-4 w-4" />
          印刷 / PDF
        </Button>
        <Button type="button" onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Save Quote Record"}
        </Button>
      </div>

      {/* ═══════════════════════════════════════════════════════
          PRINT DOCUMENT — always visible, A4-style
      ═══════════════════════════════════════════════════════ */}
      <div
        className="bg-white border border-gray-300 print:border-0 print:shadow-none"
        style={{
          fontFamily: "'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif",
          fontSize: "11px",
          padding: "24px 32px",
          maxWidth: "794px",
          margin: "0 auto",
        }}
      >
        {/* ── Date top-right ── */}
        <div className="text-right mb-1" style={{ fontSize: "11px" }}>
          日付 : {displayDate}
        </div>

        {/* ── Title row ── */}
        <div className="flex items-center justify-between mb-1">
          <div style={{ flex: 1 }} />
          <div
            className="text-center font-bold"
            style={{ fontSize: "18px", letterSpacing: "0.3em", flex: 2 }}
          >
            御　見　積　書
          </div>
          <div className="text-right" style={{ flex: 1, fontSize: "11px" }}>
            見積番号: {quoteNumber}
          </div>
        </div>

        <div className="mb-3" style={{ borderBottom: "2px solid #000" }} />

        {/* ── Two-column: customer left | WINHOOP right ── */}
        <table className="w-full mb-3" style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              {/* Customer block */}
              <td className="align-top" style={{ width: "55%", paddingRight: "16px" }}>
                <div
                  className="font-bold"
                  style={{ fontSize: "15px", borderBottom: "1px solid #000", paddingBottom: "2px", marginBottom: "4px" }}
                >
                  {customerName}&nbsp;御中
                </div>
                {customerDept && (
                  <div style={{ marginBottom: "2px" }}>
                    <span style={{ color: "#555" }}>部署名&nbsp;</span>
                    {customerDept}
                  </div>
                )}
                {customerContact && (
                  <div style={{ marginBottom: "2px" }}>
                    <span style={{ color: "#555" }}>担当者:&nbsp;</span>
                    {customerContact}&nbsp;様
                  </div>
                )}
                {customerTel && (
                  <div style={{ marginBottom: "2px" }}>
                    <span style={{ color: "#555" }}>TEL:&nbsp;</span>
                    {customerTel}
                  </div>
                )}
                {customerFax && (
                  <div>
                    <span style={{ color: "#555" }}>FAX:&nbsp;</span>
                    {customerFax}
                  </div>
                )}
              </td>

              {/* WINHOOP address — fixed */}
              <td className="align-top" style={{ width: "45%", fontSize: "11px" }}>
                <div className="font-bold" style={{ fontSize: "13px" }}>
                  株式会社WINHOOP
                </div>
                <div>〒541-0044</div>
                <div>大阪市中央区伏見町４丁目４番９号</div>
                <div>オーエックス淀屋橋ビル３F</div>
                <div>TEL：06-7176-9388 / FAX：050-3488-7396</div>
                <div>Email : info@winhoop.com</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Intro line ── */}
        <div className="mb-3" style={{ fontSize: "11px" }}>
          下記の通りお見積申し上げます。
        </div>

        {/* ── Item details table ── */}
        <table
          className="w-full mb-2"
          style={{ borderCollapse: "collapse", fontSize: "11px" }}
        >
          <tbody>
            {/* アイテム / サイズ */}
            <tr>
              <td className={labelCell}>アイテム</td>
              <td className={cellBase} style={{ width: "30%" }}>
                {itemName}
              </td>
              <td className={labelCell}>サイズ</td>
              <td className={cellBase}>{sizeNoteState}</td>
            </tr>
            {/* 素材 / 厚さ */}
            <tr>
              <td className={labelCell}>素材</td>
              <td className={cellBase}>{material}</td>
              <td className={labelCell}>厚さ</td>
              <td className={cellBase}>{thickness}</td>
            </tr>
            {/* 印刷方法 rows */}
            {printingLines.length === 0 ? (
              <tr>
                <td className={labelCell}>印刷方法</td>
                <td className={cellBase} colSpan={3}></td>
              </tr>
            ) : (
              printingLines.map((ln, i) => (
                <tr key={i}>
                  <td className={labelCell}>
                    {i === 0 ? "印刷方法" : ""}
                  </td>
                  <td className={cellBase}>{ln.part}</td>
                  <td className={cellBase} colSpan={2}>
                    {ln.spec}
                  </td>
                </tr>
              ))
            )}
            {/* 梱包方法 */}
            <tr>
              <td className={labelCell}>梱包方法</td>
              <td className={cellBase} colSpan={3}>
                {packingDetails}
              </td>
            </tr>
            {/* 金型代 */}
            {(moldType === "new" || moldCostJpy) && (
              <>
                <tr>
                  <td className={labelCell} rowSpan={2}>
                    金型代
                  </td>
                  <td className={cellBase}>金型費用</td>
                  <td className={cellBase} colSpan={2} style={{ textAlign: "right" }}>
                    {moldCostJpy ? fmtJpy(moldCostJpy) : "―"}
                  </td>
                </tr>
                <tr>
                  <td className={cellBase}>エンボスプレート</td>
                  <td className={cellBase} colSpan={2} style={{ textAlign: "right" }}>
                    {embossCostJpy ? fmtJpy(embossCostJpy) : "―"}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        {/* ── Pricing table ── */}
        <table
          className="w-full mb-2"
          style={{ borderCollapse: "collapse", fontSize: "11px" }}
        >
          <thead>
            <tr style={{ backgroundColor: "#4a4a4a", color: "#fff" }}>
              <th
                className="border border-gray-400 px-2 py-1 text-center"
                style={{ width: "33%" }}
              >
                ご発注ロット数
              </th>
              <th
                className="border border-gray-400 px-2 py-1 text-center"
                style={{ width: "33%" }}
              >
                単価
              </th>
              <th
                className="border border-gray-400 px-2 py-1 text-center"
                style={{ width: "34%" }}
              >
                ご発注合計金額（税別）
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedCalcs.map((calc) => (
              <tr key={calc.id}>
                <td
                  className="border border-gray-400 px-2 py-1 text-center"
                  style={{ fontWeight: 600 }}
                >
                  {calc.quantity.toLocaleString("ja-JP")}
                </td>
                <td className="border border-gray-400 px-2 py-1 text-center">
                  {calc.unit_price_jpy != null
                    ? calc.unit_price_jpy.toLocaleString("ja-JP")
                    : "―"}
                </td>
                <td className="border border-gray-400 px-2 py-1 text-center">
                  {calc.total_revenue_jpy != null
                    ? calc.total_revenue_jpy.toLocaleString("ja-JP")
                    : "―"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Sample costs ── */}
        <table
          className="w-full mb-2"
          style={{ borderCollapse: "collapse", fontSize: "11px" }}
        >
          <tbody>
            <tr>
              <td className={labelCellWide} rowSpan={2}>
                サンプル費用
              </td>
              <td className={cellBase} colSpan={3}>
                {sampleCostMachineJpy
                  ? `${fmtJpy(sampleCostMachineJpy)}円/回（サンプル校正機使用の場合、1種あたり）`
                  : "―"}
              </td>
            </tr>
            <tr>
              <td className={cellBase} colSpan={3}>
                {sampleCostPlasticJpy
                  ? `プラサンプル　${fmtJpy(sampleCostPlasticJpy)}円/個`
                  : "―"}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Lead times ── */}
        <table
          className="w-full mb-2"
          style={{ borderCollapse: "collapse", fontSize: "11px" }}
        >
          <tbody>
            <tr>
              <td className={labelCellWide} rowSpan={3}>
                製造日数
              </td>
              <td className={labelCell}>金型</td>
              <td className={cellBase}>{leadTimeMold}</td>
            </tr>
            <tr>
              <td className={labelCell}>サンプル</td>
              <td className={cellBase}>{leadTimeSample}</td>
            </tr>
            <tr>
              <td className={labelCell}>本生産</td>
              <td className={cellBase}>{leadTimeProduction}</td>
            </tr>
          </tbody>
        </table>

        {/* ── Payment terms ── */}
        <table
          className="w-full mb-2"
          style={{ borderCollapse: "collapse", fontSize: "11px" }}
        >
          <tbody>
            <tr>
              <td className={labelCellWide} rowSpan={2}>
                お支払い条件
              </td>
              <td className={labelCell}>金型・サンプル</td>
              <td className={cellBase}>{paymentTooling}</td>
            </tr>
            <tr>
              <td className={labelCell}>本生産</td>
              <td className={cellBase}>{paymentProduction}</td>
            </tr>
          </tbody>
        </table>

        {/* ── Validity / Delivery ── */}
        <table
          className="w-full mb-3"
          style={{ borderCollapse: "collapse", fontSize: "11px" }}
        >
          <tbody>
            <tr>
              <td className={labelCellWide}>お見積り有効期限</td>
              <td className={cellBase} style={{ width: "20%" }}>
                {validityDays}日間
              </td>
              <td className={labelCell}>納品条件</td>
              <td className={cellBase}>{deliveryCondition}</td>
            </tr>
          </tbody>
        </table>

        {/* ── Notes ── */}
        {notesLines.length > 0 && (
          <div className="mb-4">
            <div
              className="font-medium mb-1"
              style={{
                fontSize: "11px",
                borderBottom: "1px solid #bbb",
                paddingBottom: "2px",
              }}
            >
              その他
            </div>
            <ol
              style={{
                paddingLeft: "1.2em",
                margin: 0,
                fontSize: "11px",
                lineHeight: "1.7",
              }}
            >
              {notesLines.map((note, i) => (
                <li key={i} style={{ listStyleType: "disc" }}>
                  {note}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* ── Footer ── */}
        <div
          style={{
            borderTop: "1px solid #bbb",
            paddingTop: "8px",
            fontSize: "10px",
            color: "#555",
            lineHeight: "1.6",
          }}
        >
          <p>ご不明な点がございましたら、担当者までお気軽にお問い合わせください。</p>
          <p>何卒よろしくお願い申し上げます。</p>
        </div>
      </div>
    </div>
  );
}
