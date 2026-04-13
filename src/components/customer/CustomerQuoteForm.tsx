"use client";

import React, { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, Plus, Trash2, ImagePlus, X } from "lucide-react";

const SUPABASE_URL = "https://lwdxvcrvrzlfetelcemt.supabase.co";
const BUCKET = "quote-attachments";

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
  surface: string; // 外面 | 内面
  part: string;    // 蓋 | 身 | 底 | 蓋・身 | 蓋・身・底 | custom
  spec: string;
}

const SURFACE_OPTIONS_JA = ["外面", "内面"];
const SURFACE_OPTIONS_EN = ["Outside", "Inside"];
const PART_PRESETS_JA = ["蓋", "身", "底", "蓋・身", "蓋・身・底"];
const PART_PRESETS_EN = ["Lid", "Body", "Bottom", "Lid & Body", "Lid, Body & Bottom"];
const ALL_KNOWN_PARTS = [...PART_PRESETS_JA, ...PART_PRESETS_EN];

interface Contact {
  id: string;
  name: string;
  department: string | null;
  phone: string | null;
  phone_direct: string | null;
}

interface Props {
  locale: string;
  quoteId: string;
  costSheetId?: string;
  moldNumber?: string;
  woNumber: string;
  companyName: string;
  companyId: string | null;
  contacts: Contact[];
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
  quoteImages: { name: string; url: string }[];
  moldImageUrl: string | null;
  existingCQ: Record<string, unknown> | null;
}

function fmtJpy(n: number | string | null | undefined): string {
  const num = typeof n === "string" ? parseInt(n) : (n ?? 0);
  if (!num || isNaN(num)) return "―";
  return num.toLocaleString("ja-JP");
}

function parseExistingLines(raw: unknown, fallback: PrintingLine[]): PrintingLine[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return (raw as PrintingLine[]).map((r) => {
      // New format already has surface field
      if (r.surface) return { surface: String(r.surface), part: String(r.part ?? ""), spec: String(r.spec ?? "") };
      // Legacy format: part was e.g. "外面（蓋）" — split it
      const legacy = String(r.part ?? "");
      const match = legacy.match(/^(外面|内面)[（(](.+?)[)）]$/);
      if (match) return { surface: match[1], part: match[2], spec: String(r.spec ?? "") };
      return { surface: "外面", part: legacy, spec: String(r.spec ?? "") };
    });
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
  costSheetId,
  moldNumber: moldNumberProp,
  woNumber,
  companyName,
  companyId,
  contacts: initialContacts,
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
  quoteImages,
  moldImageUrl,
  existingCQ,
}: Props) {
  const router = useRouter();
  const isJa = locale === "ja" || locale === "zh";
  const SURFACE_OPTIONS = isJa ? SURFACE_OPTIONS_JA : SURFACE_OPTIONS_EN;
  const PART_PRESETS = isJa ? PART_PRESETS_JA : PART_PRESETS_EN;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // ── contacts state ──────────────────────────────────────────
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactDept, setNewContactDept] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [addingContact, setAddingContact] = useState(false);

  const handleAddContact = async () => {
    if (!newContactName.trim() || !companyId) return;
    setAddingContact(true);
    try {
      const res = await fetch("/api/company-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          name: newContactName.trim(),
          department: newContactDept.trim() || null,
          phone: newContactPhone.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to add contact");
      const created: Contact = await res.json();
      setContacts((prev) => [...prev, created]);
      // Auto-select the new contact
      setCustomerContact(created.name);
      setCustomerDept(created.department ?? "");
      setCustomerTel(created.phone ?? "");
      // Reset form
      setNewContactName("");
      setNewContactDept("");
      setNewContactPhone("");
      setShowAddContact(false);
    } catch {
      // silent — contact list still updates on next page load
    } finally {
      setAddingContact(false);
    }
  };

  // ── product image state ────────────────────────────────────
  const [productImageUrl, setProductImageUrl] = useState<string>(
    String(existingCQ?.product_image_url ?? moldImageUrl ?? "")
  );
  const [imageTab, setImageTab] = useState<"quote" | "mold" | "upload">("quote");
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(async (file: File) => {
    setImageUploading(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `product-images/${quoteId}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
      setProductImageUrl(url);
    } catch (err) {
      alert("Image upload failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setImageUploading(false);
    }
  }, [quoteId]);

  const handlePrint = async () => {
    if (!printRef.current) return;
    setPrinting(true);
    try {
      const [h2cMod, jspdfMod] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      // Handle both default and named exports across bundler variants
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html2canvas: any = (h2cMod as any).default ?? h2cMod;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { jsPDF } = jspdfMod as any;

      const el = printRef.current;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onclone: (clonedDoc: any) => {
          // Remove all external stylesheets — print document is fully inline-styled
          clonedDoc.querySelectorAll('link[rel="stylesheet"], style').forEach((el: Element) => el.remove());
        },
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const printW = pageW - margin * 2;
      const printH = (canvas.height * printW) / canvas.width;

      if (printH <= pageH - margin * 2) {
        // Fits on one page
        pdf.addImage(imgData, "JPEG", margin, margin, printW, printH);
      } else {
        // Multi-page: slice the canvas into A4-height segments
        const pageHeightPx = (canvas.width * (pageH - margin * 2)) / printW;
        let yOffset = 0;
        while (yOffset < canvas.height) {
          const sliceH = Math.min(pageHeightPx, canvas.height - yOffset);
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvas.width;
          pageCanvas.height = sliceH;
          const ctx = pageCanvas.getContext("2d")!;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(canvas, 0, -yOffset);
          const sliceData = pageCanvas.toDataURL("image/jpeg", 0.98);
          const slicePrintH = (sliceH * printW) / canvas.width;
          if (yOffset > 0) pdf.addPage();
          pdf.addImage(sliceData, "JPEG", margin, margin, printW, slicePrintH);
          yOffset += pageHeightPx;
        }
      }

      pdf.save(`${quoteNumber || "見積書"}.pdf`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("PDF generation failed:", err);
      alert(`PDF error: ${msg}`);
    } finally {
      setPrinting(false);
    }
  };

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
    String(existingCQ?.item_name ?? moldNumberProp ?? projectName)
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
    setPrintingLines((prev) => [...prev, { surface: SURFACE_OPTIONS[0], part: "", spec: "" }]);

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
        cost_sheet_id: costSheetId ?? null,
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
        product_image_url: productImageUrl || null,
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

  // ── shared cell styles (inline — Tailwind stripped by html2canvas) ──────────
  const S = {
    cell: {
      border: "1px solid #9ca3af",
      padding: "4px 8px",
      fontSize: "11px",
      verticalAlign: "top" as const,
    } as React.CSSProperties,
    labelCell: {
      border: "1px solid #9ca3af",
      padding: "4px 8px",
      fontSize: "11px",
      verticalAlign: "top" as const,
      backgroundColor: "#f3f4f6",
      fontWeight: 500,
      whiteSpace: "nowrap" as const,
      width: "112px",
    } as React.CSSProperties,
    labelCellWide: {
      border: "1px solid #9ca3af",
      padding: "4px 8px",
      fontSize: "11px",
      verticalAlign: "top" as const,
      backgroundColor: "#f3f4f6",
      fontWeight: 500,
      whiteSpace: "nowrap" as const,
      width: "144px",
    } as React.CSSProperties,
    thCell: {
      border: "1px solid #9ca3af",
      padding: "4px 8px",
      fontSize: "11px",
      textAlign: "center" as const,
      color: "#fff",
    } as React.CSSProperties,
    tdCenter: {
      border: "1px solid #9ca3af",
      padding: "4px 8px",
      fontSize: "11px",
      textAlign: "center" as const,
      verticalAlign: "top" as const,
    } as React.CSSProperties,
  };

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
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {/* Company name — read-only, pulled from quote */}
              <div className="space-y-1">
                <Label className="text-xs">顧客名 Company</Label>
                <div className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground items-center">
                  {customerName}
                </div>
              </div>

              {/* Contact — dropdown from company_contacts */}
              <div className="space-y-1">
                <Label className="text-xs">担当者 Contact</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={customerContact}
                  onChange={(e) => {
                    const selected = contacts.find((c) => c.name === e.target.value);
                    setCustomerContact(e.target.value);
                    if (selected) {
                      setCustomerDept(selected.department ?? "");
                      setCustomerTel(selected.phone_direct ?? selected.phone ?? "");
                    }
                  }}
                >
                  <option value="">— 選択 / 未設定 —</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}{c.department ? ` (${c.department})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department — auto-filled or manual */}
              <div className="space-y-1">
                <Label className="text-xs">部署名 Department</Label>
                <Input value={customerDept} onChange={(e) => setCustomerDept(e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">TEL</Label>
                <Input value={customerTel} onChange={(e) => setCustomerTel(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">FAX</Label>
                <Input value={customerFax} onChange={(e) => setCustomerFax(e.target.value)} />
              </div>
            </div>

            {/* Add new contact */}
            {companyId && (
              <div>
                {!showAddContact ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => setShowAddContact(true)}
                  >
                    <Plus className="h-3 w-3" />
                    担当者を追加 Add New Contact
                  </Button>
                ) : (
                  <div className="border rounded-md p-3 space-y-2 bg-gray-50">
                    <p className="text-xs font-medium text-gray-600">新しい担当者 New Contact</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">名前 Name *</Label>
                        <Input
                          className="text-xs"
                          value={newContactName}
                          onChange={(e) => setNewContactName(e.target.value)}
                          placeholder="田中 太郎"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">部署 Department</Label>
                        <Input
                          className="text-xs"
                          value={newContactDept}
                          onChange={(e) => setNewContactDept(e.target.value)}
                          placeholder="購買部"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">TEL</Label>
                        <Input
                          className="text-xs"
                          value={newContactPhone}
                          onChange={(e) => setNewContactPhone(e.target.value)}
                          placeholder="06-0000-0000"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="text-xs"
                        onClick={handleAddContact}
                        disabled={addingContact || !newContactName.trim()}
                      >
                        {addingContact ? "保存中..." : "保存 Save"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => setShowAddContact(false)}
                      >
                        キャンセル
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
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
                    {/* Col 1: 外面 / 内面 */}
                    <select
                      className="flex h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring w-20"
                      value={ln.surface}
                      onChange={(e) => updatePrintingLine(i, "surface", e.target.value)}
                    >
                      {SURFACE_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>

                    {/* Col 2: part preset or custom text */}
                    {ALL_KNOWN_PARTS.includes(ln.part) || ln.part === "" ? (
                      <select
                        className="flex h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring w-36"
                        value={ln.part}
                        onChange={(e) => {
                          if (e.target.value === "__custom__") {
                            updatePrintingLine(i, "part", "");
                          } else {
                            updatePrintingLine(i, "part", e.target.value);
                          }
                        }}
                      >
                        <option value="">{isJa ? "— 選択 —" : "— Select —"}</option>
                        {PART_PRESETS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                        <option value="__custom__">{isJa ? "＋ カスタム..." : "+ Custom..."}</option>
                      </select>
                    ) : (
                      <Input
                        className="h-8 text-xs w-36"
                        value={ln.part}
                        onChange={(e) => updatePrintingLine(i, "part", e.target.value)}
                        placeholder={isJa ? "カスタム部位" : "Custom part"}
                        onBlur={(e) => {
                          // If user blanked it out, revert to preset dropdown
                          if (!e.target.value.trim()) updatePrintingLine(i, "part", "");
                        }}
                      />
                    )}

                    {/* Col 3: spec */}
                    <Input
                      className="flex-1 text-xs"
                      placeholder={isJa ? "仕様 e.g. 白コート+特②..." : "Spec e.g. 4C+0C, CMYK..."}
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

            {/* Product Image Picker */}
            <div className="space-y-2 pt-1 border-t">
              <Label className="text-xs">製品画像 Product Image</Label>

              {/* Current image preview */}
              {productImageUrl && (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={productImageUrl}
                    alt="product"
                    className="h-24 w-auto border rounded object-contain bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={() => setProductImageUrl("")}
                    className="absolute -top-1 -right-1 bg-white border rounded-full p-0.5 text-gray-400 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Source tabs */}
              <div className="flex gap-1 text-xs">
                {(["quote", "mold", "upload"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setImageTab(tab)}
                    className={`px-3 py-1 rounded border text-xs ${imageTab === tab ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
                  >
                    {tab === "quote" ? "Quote Files" : tab === "mold" ? "Mold Image" : "Upload New"}
                  </button>
                ))}
              </div>

              {/* Quote images grid */}
              {imageTab === "quote" && (
                quoteImages.length === 0 ? (
                  <p className="text-xs text-gray-400">No images attached to this quote.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {quoteImages.map((img) => (
                      <button
                        key={img.url}
                        type="button"
                        onClick={() => setProductImageUrl(img.url)}
                        className={`border-2 rounded p-0.5 ${productImageUrl === img.url ? "border-blue-500" : "border-gray-200 hover:border-gray-400"}`}
                        title={img.name}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={img.name} className="h-16 w-auto object-contain" />
                      </button>
                    ))}
                  </div>
                )
              )}

              {/* Mold image */}
              {imageTab === "mold" && (
                moldImageUrl ? (
                  <button
                    type="button"
                    onClick={() => setProductImageUrl(moldImageUrl!)}
                    className={`border-2 rounded p-0.5 ${productImageUrl === moldImageUrl ? "border-blue-500" : "border-gray-200 hover:border-gray-400"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={moldImageUrl} alt="mold" className="h-24 w-auto object-contain" />
                  </button>
                ) : (
                  <p className="text-xs text-gray-400">No image on file for this mold. Upload one in the Products page.</p>
                )
              )}

              {/* Upload new */}
              {imageTab === "upload" && (
                <div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImageUpload(f);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={imageUploading}
                  >
                    <ImagePlus className="h-3 w-3" />
                    {imageUploading ? "Uploading..." : "Choose Image File"}
                  </Button>
                </div>
              )}
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
          onClick={handlePrint}
          disabled={printing}
          className="gap-2"
        >
          <Printer className="h-4 w-4" />
          {printing ? "生成中..." : "PDF ダウンロード"}
        </Button>
        <Button type="button" onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Save Quote Record"}
        </Button>
      </div>

      {/* ═══════════════════════════════════════════════════════
          PRINT DOCUMENT — always visible, A4-style
      ═══════════════════════════════════════════════════════ */}
      <div
        ref={printRef}
        style={{
          background: "#fff",
          border: "1px solid #d1d5db",
          fontFamily: "'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif",
          fontSize: "11px",
          padding: "24px 32px",
          maxWidth: "794px",
          margin: "0 auto",
        }}
      >
        {/* ── Date top-right ── */}
        <div style={{ textAlign: "right", marginBottom: "4px", fontSize: "11px" }}>
          日付 : {displayDate}
        </div>

        {/* ── Title row ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
          <div style={{ flex: 1 }} />
          <div
            style={{ fontSize: "18px", letterSpacing: "0.3em", flex: 2, textAlign: "center", fontWeight: 700 }}
          >
            御　見　積　書
          </div>
          <div style={{ flex: 1, fontSize: "11px", textAlign: "right" }}>
            見積番号: {quoteNumber}
          </div>
        </div>

        <div style={{ marginBottom: "12px", borderBottom: "2px solid #000" }} />

        {/* ── Two-column: customer left | WINHOOP right ── */}
        <table style={{ width: "100%", marginBottom: "12px", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              {/* Customer block */}
              <td style={{ verticalAlign: "top", width: "55%", paddingRight: "16px" }}>
                <div
                  style={{ fontWeight: 700, fontSize: "15px", borderBottom: "1px solid #000", paddingBottom: "2px", marginBottom: "4px" }}
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
              <td style={{ verticalAlign: "top", width: "45%", fontSize: "11px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "13px" }}>
                      株式会社WINHOOP
                    </div>
                    <div>〒541-0044</div>
                    <div>大阪市中央区伏見町４丁目４番９号</div>
                    <div>オーエックス淀屋橋ビル３F</div>
                    <div>TEL：06-7176-9388 / FAX：050-3488-7396</div>
                    <div>Email : info@winhoop.com</div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/stamp-winhoop.png"
                      alt="WINHOOP stamp"
                      width={72}
                      height={72}
                      style={{ opacity: 0.9 }}
                      crossOrigin="anonymous"
                    />
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Intro line ── */}
        <div style={{ marginBottom: "12px", fontSize: "11px" }}>
          下記の通りお見積申し上げます。
        </div>

        {/* ── Item details + optional product image ── */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "stretch" }}>
          {/* Left: item details table */}
          <table
            style={{ flex: 1, borderCollapse: "collapse", fontSize: "11px" }}
          >
            <tbody>
              {/* アイテム / サイズ */}
              <tr>
                <td style={S.labelCell}>アイテム</td>
                <td style={{ ...S.cell, width: "30%" }}>
                  {itemName}
                </td>
                <td style={S.labelCell}>サイズ</td>
                <td style={S.cell}>{sizeNoteState}</td>
              </tr>
              {/* 素材 / 厚さ */}
              <tr>
                <td style={S.labelCell}>素材</td>
                <td style={S.cell}>{material}</td>
                <td style={S.labelCell}>厚さ</td>
                <td style={S.cell}>{thickness}</td>
              </tr>
              {/* 印刷方法 rows */}
              {printingLines.length === 0 ? (
                <tr>
                  <td style={S.labelCell}>印刷方法</td>
                  <td style={S.cell} colSpan={3}></td>
                </tr>
              ) : (
                printingLines.map((ln, i) => (
                  <tr key={i}>
                    <td style={S.labelCell}>
                      {i === 0 ? "印刷方法" : ""}
                    </td>
                    <td style={S.cell}>
                      {ln.surface && ln.part ? `${ln.surface}（${ln.part}）` : ln.part || ln.surface}
                    </td>
                    <td style={S.cell} colSpan={2}>
                      {ln.spec}
                    </td>
                  </tr>
                ))
              )}
              {/* 梱包方法 */}
              <tr>
                <td style={S.labelCell}>梱包方法</td>
                <td style={S.cell} colSpan={3}>
                  {packingDetails}
                </td>
              </tr>
              {/* 金型代 */}
              {(moldType === "new" || moldCostJpy) && (
                <>
                  <tr>
                    <td style={S.labelCell} rowSpan={2}>
                      金型代
                    </td>
                    <td style={S.cell}>金型費用</td>
                    <td style={{ ...S.cell, textAlign: "right" }} colSpan={2}>
                      {moldCostJpy ? fmtJpy(moldCostJpy) : "―"}
                    </td>
                  </tr>
                  <tr>
                    <td style={S.cell}>エンボスプレート</td>
                    <td style={{ ...S.cell, textAlign: "right" }} colSpan={2}>
                      {embossCostJpy ? fmtJpy(embossCostJpy) : "―"}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          {/* Right: product image (only if set) */}
          {productImageUrl && (
            <div
              style={{
                width: "140px",
                flexShrink: 0,
                border: "1px solid #9ca3af",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "4px",
                backgroundColor: "#fafafa",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={productImageUrl}
                alt="product"
                crossOrigin="anonymous"
                style={{ maxWidth: "100%", maxHeight: "160px", objectFit: "contain" }}
              />
            </div>
          )}
        </div>

        {/* ── Pricing table ── */}
        <table
          style={{ width: "100%", marginBottom: "8px", borderCollapse: "collapse", fontSize: "11px" }}
        >
          <thead>
            <tr style={{ backgroundColor: "#4a4a4a", color: "#fff" }}>
              <th style={{ ...S.thCell, width: "33%" }}>
                ご発注ロット数
              </th>
              <th style={{ ...S.thCell, width: "33%" }}>
                単価
              </th>
              <th style={{ ...S.thCell, width: "34%" }}>
                ご発注合計金額（税別）
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedCalcs.map((calc) => (
              <tr key={calc.id}>
                <td style={{ ...S.tdCenter, fontWeight: 600 }}>
                  {calc.quantity.toLocaleString("ja-JP")}
                </td>
                <td style={S.tdCenter}>
                  {calc.unit_price_jpy != null
                    ? calc.unit_price_jpy.toLocaleString("ja-JP")
                    : "―"}
                </td>
                <td style={S.tdCenter}>
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
          style={{ width: "100%", marginBottom: "8px", borderCollapse: "collapse", fontSize: "11px" }}
        >
          <tbody>
            <tr>
              <td style={S.labelCellWide} rowSpan={2}>
                サンプル費用
              </td>
              <td style={S.cell} colSpan={3}>
                {sampleCostMachineJpy
                  ? `${fmtJpy(sampleCostMachineJpy)}円/回（サンプル校正機使用の場合、1種あたり）`
                  : "―"}
              </td>
            </tr>
            <tr>
              <td style={S.cell} colSpan={3}>
                {sampleCostPlasticJpy
                  ? `プラサンプル　${fmtJpy(sampleCostPlasticJpy)}円/個`
                  : "―"}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Lead times ── */}
        <table
          style={{ width: "100%", marginBottom: "8px", borderCollapse: "collapse", fontSize: "11px" }}
        >
          <tbody>
            <tr>
              <td style={S.labelCellWide} rowSpan={3}>
                製造日数
              </td>
              <td style={S.labelCell}>金型</td>
              <td style={S.cell}>{leadTimeMold}</td>
            </tr>
            <tr>
              <td style={S.labelCell}>サンプル</td>
              <td style={S.cell}>{leadTimeSample}</td>
            </tr>
            <tr>
              <td style={S.labelCell}>本生産</td>
              <td style={S.cell}>{leadTimeProduction}</td>
            </tr>
          </tbody>
        </table>

        {/* ── Payment terms ── */}
        <table
          style={{ width: "100%", marginBottom: "8px", borderCollapse: "collapse", fontSize: "11px" }}
        >
          <tbody>
            <tr>
              <td style={S.labelCellWide} rowSpan={2}>
                お支払い条件
              </td>
              <td style={S.labelCell}>金型・サンプル</td>
              <td style={S.cell}>{paymentTooling}</td>
            </tr>
            <tr>
              <td style={S.labelCell}>本生産</td>
              <td style={S.cell}>{paymentProduction}</td>
            </tr>
          </tbody>
        </table>

        {/* ── Validity / Delivery ── */}
        <table
          style={{ width: "100%", marginBottom: "12px", borderCollapse: "collapse", fontSize: "11px" }}
        >
          <tbody>
            <tr>
              <td style={S.labelCellWide}>お見積り有効期限</td>
              <td style={{ ...S.cell, width: "20%" }}>
                {validityDays}日間
              </td>
              <td style={S.labelCell}>納品条件</td>
              <td style={S.cell}>{deliveryCondition}</td>
            </tr>
          </tbody>
        </table>

        {/* ── Notes ── */}
        {notesLines.length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                fontWeight: 500,
                marginBottom: "4px",
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
