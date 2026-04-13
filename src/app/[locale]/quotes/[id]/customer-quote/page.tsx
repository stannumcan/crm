import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CustomerQuoteForm from "@/components/customer/CustomerQuoteForm";
import CustomerQuoteWrapper from "@/components/customer/CustomerQuoteWrapper";

export default async function CustomerQuotePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const tc = await getTranslations("common");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: quote } = await db
    .from("quotations")
    .select(`
      id, status, mold_type, mold_number, size_dimensions, embossment,
      design_count, shipping_info_required, molds,
      printing_lid, printing_body, printing_bottom, printing_inner, printing_notes,
      work_orders(id, wo_number, company_name, project_name, company_id),
      quotation_quantity_tiers(tier_label, quantity_type, quantity, sort_order),
      factory_cost_sheets(
        id, mold_number, mold_cost_new, mold_cost_modify, mold_lead_time_days,
        steel_type, steel_thickness, product_dimensions, version, is_current,
        outer_carton_qty, outer_carton_config,
        printing_lines, embossing_lines, mold_image_url,
        wilfred_calculations(tier_label, quantity, estimated_cost_rmb, approved, is_current),
        wilfred_embossing_cost, wilfred_mold_cost_new, wilfred_mold_cost_adjust
      ),
      natsuki_ddp_calculations!quotation_id(
        id, tier_label, quantity, unit_price_jpy, total_revenue_jpy,
        selected_margin, shipping_cost_jpy, total_cost_jpy, manufacturing_cost_jpy,
        fx_rate_rmb_to_jpy, cost_sheet_id, version, is_current, based_on_ddp_version
      ),
      customer_quotes(*, is_current, version, cost_sheet_id, based_on_ddp_version)
    `)
    .eq("id", id)
    .single();

  if (!quote) notFound();

  const wo = quote.work_orders as {
    id: string; wo_number: string; company_name: string; project_name: string; company_id: string | null;
  } | null;

  // Fetch contacts
  type Contact = { id: string; name: string; department: string | null; phone: string | null; phone_direct: string | null };
  let contacts: Contact[] = [];
  if (wo?.company_id) {
    const { data: contactRows } = await db
      .from("company_contacts")
      .select("id, name, department, phone, phone_direct")
      .eq("company_id", wo.company_id)
      .order("is_primary", { ascending: false })
      .order("name");
    contacts = (contactRows as Contact[]) ?? [];
  }

  // Fetch quote images
  const { data: attachmentRows } = await db
    .from("quotation_attachments")
    .select("file_name, file_url, file_type")
    .eq("quotation_id", id)
    .order("uploaded_at", { ascending: false });

  const quoteImages = ((attachmentRows ?? []) as { file_name: string; file_url: string; file_type: string | null }[])
    .filter((a) => (a.file_type ?? "").startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(a.file_name))
    .map((a) => ({ name: a.file_name, url: a.file_url }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sheets = ((Array.isArray(quote.factory_cost_sheets) ? quote.factory_cost_sheets : quote.factory_cost_sheets ? [quote.factory_cost_sheets] : []) as any[])
    .filter((s: { is_current?: boolean }) => s.is_current !== false);
  const currentSheetIds = new Set(sheets.map((s: { id: string }) => s.id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allDDPCalcs = ((quote.natsuki_ddp_calculations ?? []) as any[])
    .filter((d: { is_current?: boolean; cost_sheet_id?: string }) =>
      d.is_current !== false && (!d.cost_sheet_id || currentSheetIds.has(d.cost_sheet_id)));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allCQs = ((Array.isArray(quote.customer_quotes) ? quote.customer_quotes : quote.customer_quotes ? [quote.customer_quotes] : []) as any[])
    .filter((cq: { is_current?: boolean; cost_sheet_id?: string }) =>
      cq.is_current !== false && (!cq.cost_sheet_id || currentSheetIds.has(cq.cost_sheet_id)));

  // Build per-mould data
  // Count existing customer quotes for this WO to generate sequential numbers
  const existingCQCount = allCQs.length;
  let nextSeq = existingCQCount + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const moldTabs: any[] = [];

  for (const sheet of sheets) {
    const moldNumber = sheet.mold_number ?? null;

    // DDP calcs for this sheet
    const ddpCalcs = allDDPCalcs.filter((d: { cost_sheet_id: string }) => d.cost_sheet_id === sheet.id);
    if (ddpCalcs.length === 0) continue; // Skip moulds without DDP calc

    // Existing customer quote for this sheet
    const existingCQ = allCQs.find((cq: { cost_sheet_id: string }) => cq.cost_sheet_id === sheet.id) ?? null;

    // Generate quote number: Q{woNumber}{3-digit seq}
    const defaultQuoteNumber = existingCQ?.winhoop_quote_number
      ?? `Q${wo?.wo_number ?? ""}${String(nextSeq).padStart(3, "0")}`;
    if (!existingCQ) nextSeq++;

    // Printing lines from factory sheet (or fall back to quotation)
    const printingLines = Array.isArray(sheet.printing_lines) && sheet.printing_lines.length > 0
      ? sheet.printing_lines
      : [
          quote.printing_lid && { surface: "外面", part: "蓋", spec: quote.printing_lid },
          quote.printing_body && { surface: "外面", part: "身", spec: quote.printing_body },
          quote.printing_bottom && { surface: "外面", part: "底", spec: quote.printing_bottom },
          quote.printing_inner && { surface: "内面", part: "蓋", spec: quote.printing_inner },
        ].filter(Boolean);

    const defaultMaterial = sheet.steel_type ?? "スタンダード";
    const defaultThickness = sheet.steel_thickness ? `${sheet.steel_thickness}㎜` : "";
    const defaultPacking = [
      sheet.outer_carton_qty && `${sheet.outer_carton_qty}缶/箱`,
      sheet.outer_carton_config,
    ].filter(Boolean).join("　");
    const sizeNote = sheet.product_dimensions ?? (quote.size_dimensions as string) ?? "";
    const fxRateFromDDP = ddpCalcs[0]?.fx_rate_rmb_to_jpy ?? null;

    // Mold image from factory sheet or molds table
    let moldImageUrl = sheet.mold_image_url ?? null;
    if (!moldImageUrl && moldNumber) {
      const { data: moldRow } = await db
        .from("molds")
        .select("image_url")
        .eq("mold_number", moldNumber)
        .maybeSingle();
      moldImageUrl = moldRow?.image_url ?? null;
    }

    // Mold cost — use wilfred's approved values if available, fall back to factory sheet
    const moldCostNew = sheet.wilfred_mold_cost_new ?? sheet.mold_cost_new ?? null;

    moldTabs.push({
      sheetId: sheet.id,
      moldNumber,
      defaultQuoteNumber,
      hasSaved: !!existingCQ,
      cqVersion: existingCQ?.version ?? undefined,
      basedOnDdpVersion: existingCQ?.based_on_ddp_version ?? null,
      sizeNote,
      ddpCalcs,
      moldType: (quote.mold_type as string) ?? "existing",
      moldCostNew,
      moldLeadTimeDays: sheet.mold_lead_time_days ?? null,
      defaultMaterial,
      defaultThickness,
      defaultPrintingLines: printingLines,
      defaultPacking,
      fxRateFromDDP,
      moldImageUrl,
      existingCQ,
    });
  }

  if (moldTabs.length === 0) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/${locale}/quotes/${id}`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> {tc("back")}
            </Button>
          </Link>
        </div>
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-8 text-center text-amber-700">
          <p className="font-medium">DDP calculations not found.</p>
          <p className="text-sm mt-1">Complete the DDP calculation step first.</p>
          <Link href={`/${locale}/quotes/${id}/ddp-calc`} className="inline-block mt-4">
            <Button variant="outline">Go to DDP Calc</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${locale}/quotes/${id}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> {tc("back")}
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">御見積書 — Customer Quote</h1>
          {wo && (
            <p className="text-sm text-gray-500">
              {wo.wo_number} · {wo.project_name} · {wo.company_name}
            </p>
          )}
        </div>
      </div>

      <CustomerQuoteWrapper
        tabs={moldTabs.map((t: { sheetId: string; moldNumber: string | null; hasSaved: boolean; cqVersion?: number; basedOnDdpVersion?: number }) => ({
          sheetId: t.sheetId,
          moldNumber: t.moldNumber,
          hasSaved: t.hasSaved,
          cqVersion: t.cqVersion,
          basedOnDdpVersion: t.basedOnDdpVersion,
        }))}
        forms={Object.fromEntries(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          moldTabs.map((tab: any) => [
            tab.sheetId,
            <CustomerQuoteForm
              key={tab.sheetId}
              locale={locale}
              quoteId={id}
              costSheetId={tab.sheetId}
              moldNumber={tab.moldNumber ?? undefined}
              defaultQuoteNumber={tab.defaultQuoteNumber}
              woNumber={wo?.wo_number ?? ""}
              companyName={wo?.company_name ?? ""}
              companyId={wo?.company_id ?? null}
              contacts={contacts}
              projectName={wo?.project_name ?? ""}
              sizeNote={tab.sizeNote}
              ddpCalcs={tab.ddpCalcs}
              moldType={tab.moldType}
              moldCostNew={tab.moldCostNew}
              moldLeadTimeDays={tab.moldLeadTimeDays}
              defaultMaterial={tab.defaultMaterial}
              defaultThickness={tab.defaultThickness}
              defaultPrintingLines={tab.defaultPrintingLines}
              defaultPacking={tab.defaultPacking}
              fxRateFromDDP={tab.fxRateFromDDP}
              quoteImages={quoteImages}
              moldImageUrl={tab.moldImageUrl}
              existingCQ={tab.existingCQ}
            />,
          ])
        )}
      />
    </div>
  );
}
