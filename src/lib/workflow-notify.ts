import { createAdminClient } from "@/lib/supabase/admin";
import { getResend, EMAIL_FROM, EMAIL_REPLY_TO } from "@/lib/email";
import { buildQuoteEmail } from "@/lib/email-template";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://japan-crm.vercel.app";

interface Attachment {
  filename: string;
  content: Buffer;
}

function resolveSubject(
  template: string | null,
  fallback: string,
  vars: { company: string; project: string; wo: string; mold?: string; step?: string; ref?: string },
  pricingChanged = false,
): string {
  let subject: string;
  if (template) {
    subject = template
      .replace(/\{company\}/gi, vars.company)
      .replace(/\{project\}/gi, vars.project)
      .replace(/\{wo\}/gi, vars.wo)
      .replace(/\{mold\}/gi, vars.mold ?? "")
      .replace(/\{step\}/gi, vars.step ?? "")
      .replace(/\{ref\}/gi, vars.ref ?? "");
  } else {
    subject = fallback;
  }
  return pricingChanged ? `⚠ PRICING CHANGED - ${subject}` : subject;
}

export async function notifyWorkflowStep(quotationId: string, newStatus: string) {
  try {
    const supabase = createAdminClient();

    // Get workflow step config
    const { data: step } = await supabase
      .from("workflow_steps")
      .select("*")
      .eq("step_key", newStatus)
      .single();

    if (!step || !step.send_email || !step.assignee_emails?.length) {
      return;
    }

    // Get quotation + work order + tiers
    const { data: quote } = await supabase
      .from("quotations")
      .select("*, work_orders(wo_number, company_name, project_name), quotation_quantity_tiers(*)")
      .eq("id", quotationId)
      .single();

    if (!quote) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = quote as any;
    const wo = q.work_orders;
    const woNumber = wo?.wo_number ?? "—";
    const companyName = wo?.company_name ?? "—";
    const projectName = wo?.project_name ?? "—";
    const tiers = q.quotation_quantity_tiers ?? [];

    const sections = buildSections(q, tiers);

    // Download attachments to include in email
    const emailAttachments = await downloadAttachments(q.attachments);

    const isPricingChanged = q.pricing_changed === true;

    const html = buildQuoteEmail({
      stepLabel: step.label,
      taskDescription: step.task_description,
      woNumber,
      companyName,
      projectName,
      quoteVersion: q.quote_version ?? 1,
      sections,
      ctaUrl: `${APP_URL}/en/quotes/${quotationId}/request`,
      ctaLabel: "Open in CRM",
      pricingChanged: isPricingChanged,
    });

    const subject = resolveSubject(
      step.subject_template,
      `[${woNumber}] ${step.label} — ${companyName}`,
      { company: companyName, project: projectName, wo: woNumber, step: step.label },
      isPricingChanged,
    );

    const resend = getResend();

    for (const email of step.assignee_emails) {
      const { data: sendResult, error: sendError } = await resend.emails.send({
        from: EMAIL_FROM,
        replyTo: EMAIL_REPLY_TO,
        to: email,
        subject,
        html,
        attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
      });

      if (sendError) {
        console.error(`[workflow-notify] Resend error for ${email}:`, JSON.stringify(sendError));
        continue;
      }

      console.log(`[workflow-notify] Email sent to ${email}, id: ${sendResult?.id}`);

      await supabase.from("workflow_email_log").insert({
        quotation_id: quotationId,
        step_key: newStatus,
        recipient_email: email,
        subject,
      });
    }
  } catch (err) {
    console.error(`[workflow-notify] Failed for ${quotationId} → ${newStatus}:`, err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSections(quote: any, tiers: any[]) {
  const sections: { label: string; rows: { label: string; value: string }[] }[] = [];

  // ── Quote details ─────────────────────────────────────────────
  const details: { label: string; value: string }[] = [];
  details.push({ label: "Urgency", value: quote.urgency ? "Urgent" : "Normal" });
  if (quote.deadline) details.push({ label: "Deadline", value: new Date(quote.deadline).toLocaleDateString() });
  details.push({ label: "Shipping Info", value: quote.shipping_info_required ? "Required" : "Not required" });
  if (quote.design_count) details.push({ label: "Design Count", value: String(quote.design_count) });
  sections.push({ label: "Quote Details", rows: details });

  // ── Line Items (molds with per-item printing/embossing) ─────
  const molds = quote.molds as { value: string; type: string; size: string; thickness: string | null; design_count?: number; variant_label?: string; printing_lines?: { surface: string; part: string; spec: string }[]; embossing_lines?: { component: string; notes?: string }[] }[] | null;
  if (molds?.length) {
    const moldRows: { label: string; value: string }[] = [];
    molds.forEach((m, i) => {
      const parts: string[] = [];
      parts.push(m.value || "—");
      if (m.variant_label) parts.push(`(${m.variant_label})`);
      if (m.size) parts.push(m.size);
      if (m.thickness) parts.push(`${m.thickness}mm`);
      parts.push(`(${m.type})`);
      if (m.design_count && m.design_count > 1) parts.push(`× ${m.design_count} designs`);
      moldRows.push({ label: `Line ${i + 1}`, value: parts.join("  ·  ") });
      // Per-item printing
      if (m.printing_lines?.length) {
        m.printing_lines.forEach((ln) => {
          if (ln.spec) moldRows.push({ label: `  Printing`, value: `${ln.surface}/${ln.part}: ${ln.spec}` });
        });
      }
      // Per-item embossing
      if (m.embossing_lines?.length) {
        m.embossing_lines.forEach((ln) => {
          if (ln.component) moldRows.push({ label: `  Embossing`, value: `${ln.component}${ln.notes ? ` — ${ln.notes}` : ""}` });
        });
      }
    });
    sections.push({ label: "Line Items", rows: moldRows });
  } else if (quote.mold_number) {
    const moldRows: { label: string; value: string }[] = [];
    moldRows.push({ label: "Mold #", value: quote.mold_number });
    sections.push({ label: "Mold Information", rows: moldRows });
  }

  // ── Legacy printing (for old quotes without per-item printing) ──
  if (!molds?.some((m) => m.printing_lines?.length)) {
    const printing: { label: string; value: string }[] = [];
    if (quote.printing_lid) printing.push({ label: "Lid", value: quote.printing_lid });
    if (quote.printing_body) printing.push({ label: "Body", value: quote.printing_body });
    if (quote.printing_bottom) printing.push({ label: "Bottom", value: quote.printing_bottom });
    if (quote.printing_inner) printing.push({ label: "Inner", value: quote.printing_inner });
    if (printing.length > 0) sections.push({ label: "Printing", rows: printing });
  }

  // ── Legacy embossment ─────────────────────────────────────────
  if (!molds?.some((m) => m.embossing_lines?.length) && quote.embossment) {
    const emboss: { label: string; value: string }[] = [];
    emboss.push({ label: "Embossment", value: "Yes" });
    if (quote.embossment_components) emboss.push({ label: "Components", value: quote.embossment_components });
    if (quote.embossment_notes) emboss.push({ label: "Notes", value: quote.embossment_notes });
    sections.push({ label: "Embossment", rows: emboss });
  }

  // ── Quantity tiers ────────────────────────────────────────────
  if (tiers.length > 0) {
    const tierRows = tiers
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
      .map((t: { tier_label: string; quantity: number; quantity_type: string; tier_notes?: string }) => ({
        label: `Tier ${t.tier_label}`,
        value: `${t.quantity?.toLocaleString() ?? "—"} ${t.quantity_type ?? "units"}${t.tier_notes ? ` — ${t.tier_notes}` : ""}`,
      }));
    sections.push({ label: "Quantity Tiers", rows: tierRows });
  }

  // ── Internal notes ────────────────────────────────────────────
  if (quote.internal_notes) {
    sections.push({ label: "Internal Notes", rows: [{ label: "Notes", value: quote.internal_notes }] });
  }

  return sections;
}

// ── Factory sheet–specific notification ──────────────────────────────────────

export async function notifyFactorySheet(sheetId: string, quotationId: string, pricingChanged = false) {
  try {
    const supabase = createAdminClient();

    // Get workflow step config for pending_wilfred
    const { data: step } = await supabase
      .from("workflow_steps")
      .select("*")
      .eq("step_key", "pending_wilfred")
      .single();

    if (!step || !step.send_email || !step.assignee_emails?.length) return;

    // Get the factory sheet with all details
    const { data: sheet } = await supabase
      .from("factory_cost_sheets")
      .select("*, factory_cost_tiers(*)")
      .eq("id", sheetId)
      .single();

    if (!sheet) return;

    // Get quotation + work order
    const { data: quote } = await supabase
      .from("quotations")
      .select("*, work_orders(wo_number, company_name, project_name)")
      .eq("id", quotationId)
      .single();

    if (!quote) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wo = (quote as any).work_orders;
    const woNumber = wo?.wo_number ?? "—";
    const companyName = wo?.company_name ?? "—";
    const projectName = wo?.project_name ?? "—";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = sheet as any;
    const moldNumber = s.mold_number ?? "—";
    const refNumber = s.ref_number ?? null;

    const subject = resolveSubject(
      step.subject_template,
      `Pricing Request - ${refNumber ?? `${woNumber} - ${moldNumber}`} - ${companyName} - ${projectName}`,
      { company: companyName, project: projectName, wo: woNumber, mold: moldNumber, step: step.label, ref: refNumber ?? "" },
      pricingChanged,
    );

    // Build sections from factory sheet data
    const sections = buildFactorySheetSections(s);

    const html = buildQuoteEmail({
      stepLabel: step.label,
      taskDescription: step.task_description,
      woNumber,
      companyName,
      projectName,
      quoteVersion: quote.quote_version ?? 1,
      sections,
      ctaUrl: `${APP_URL}/en/quotes/${quotationId}/factory-sheet/${sheetId}`,
      ctaLabel: "Open Factory Sheet",
      pricingChanged,
    });

    // Look up mold image from the molds table if not on the sheet
    let moldImageUrl = s.mold_image_url as string | null;
    if (!moldImageUrl && s.mold_number) {
      const { data: moldRecord } = await supabase
        .from("molds")
        .select("image_url")
        .eq("mold_number", s.mold_number)
        .single();
      moldImageUrl = moldRecord?.image_url ?? null;
    }

    // Convert relative paths to absolute URLs
    if (moldImageUrl && moldImageUrl.startsWith("/")) {
      moldImageUrl = `${APP_URL}${moldImageUrl}`;
    }

    // Collect attachments: mold picture + written sheet scans
    const fileAttachments: { name: string; url: string }[] = [];

    if (moldImageUrl) {
      fileAttachments.push({ name: `mold-${moldNumber}.jpg`, url: moldImageUrl });
    }

    if (Array.isArray(s.attachments)) {
      for (const att of s.attachments) {
        if (att.url && att.name) fileAttachments.push({ name: att.name, url: att.url });
      }
    }

    const emailAttachments = await downloadAttachments(fileAttachments);

    const resend = getResend();

    for (const email of step.assignee_emails) {
      const { data: sendResult, error: sendError } = await resend.emails.send({
        from: EMAIL_FROM,
        replyTo: EMAIL_REPLY_TO,
        to: email,
        subject,
        html,
        attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
      });

      if (sendError) {
        console.error(`[workflow-notify] Resend error for ${email}:`, JSON.stringify(sendError));
        continue;
      }

      console.log(`[workflow-notify] Factory sheet email sent to ${email}, id: ${sendResult?.id}`);

      await supabase.from("workflow_email_log").insert({
        quotation_id: quotationId,
        step_key: "pending_wilfred",
        recipient_email: email,
        subject,
      });
    }
  } catch (err) {
    console.error(`[workflow-notify] Factory sheet notify failed for ${sheetId}:`, err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFactorySheetSections(sheet: any) {
  const sections: { label: string; rows: { label: string; value: string }[] }[] = [];

  // Mold info
  const mold: { label: string; value: string }[] = [];
  if (sheet.ref_number) mold.push({ label: "Ref #", value: sheet.ref_number });
  if (sheet.mold_number) mold.push({ label: "Mold Number", value: sheet.mold_number });
  if (sheet.product_dimensions) mold.push({ label: "Dimensions", value: sheet.product_dimensions });
  if (sheet.steel_thickness) mold.push({ label: "Thickness", value: `${sheet.steel_thickness}mm` });
  if (sheet.sheet_date) mold.push({ label: "Sheet Date", value: new Date(sheet.sheet_date).toLocaleDateString() });
  if (mold.length > 0) sections.push({ label: "Mold Information", rows: mold });

  // Printing
  const printingLines = sheet.printing_lines as { surface: string; part: string; spec: string }[] | null;
  if (printingLines?.length) {
    const rows = printingLines.map((ln) => ({
      label: `${ln.surface}${ln.part ? ` / ${ln.part}` : ""}`,
      value: ln.spec || "—",
    }));
    sections.push({ label: "Printing", rows });
  }

  // Embossing
  const embossingLines = sheet.embossing_lines as { component: string; cost_rmb: string; notes: string }[] | null;
  if (embossingLines?.length) {
    const rows = embossingLines.map((ln) => ({
      label: ln.component || "Embossing",
      value: `${ln.cost_rmb ? `¥${ln.cost_rmb} RMB` : ""}${ln.notes ? ` — ${ln.notes}` : ""}`.trim() || "—",
    }));
    sections.push({ label: "Embossing", rows });
  }

  // Mold costs
  const costs: { label: string; value: string }[] = [];
  if (sheet.mold_cost_new) costs.push({ label: "New Mold Cost", value: `¥${Number(sheet.mold_cost_new).toLocaleString()} RMB` });
  if (sheet.mold_cost_modify) costs.push({ label: "Adjustment Cost", value: `¥${Number(sheet.mold_cost_modify).toLocaleString()} RMB` });
  if (sheet.mold_lead_time_days) costs.push({ label: "Lead Time", value: `${sheet.mold_lead_time_days} days` });
  if (costs.length > 0) sections.push({ label: "Mold Costs", rows: costs });

  // Packaging
  const pkgLines = sheet.packaging_lines as { type: string; config: string; l: number; w: number; h: number; cbm: number; tins: number }[] | null;
  if (pkgLines?.length) {
    const rows = pkgLines.map((p) => ({
      label: p.type,
      value: [
        p.config,
        p.l && p.w && p.h ? `${p.l}×${p.w}×${p.h}mm` : null,
        p.cbm ? `${p.cbm} m³` : null,
        p.tins ? `${p.tins} tins` : null,
      ].filter(Boolean).join(" · ") || "—",
    }));
    sections.push({ label: "Packaging", rows });
  }

  // Tier costs
  const tierCosts = sheet.factory_cost_tiers as { tier_label: string; quantity: number; total_subtotal: number; labor_cost: number; accessories_cost: number }[] | null;
  if (tierCosts?.length) {
    const rows = tierCosts.map((t) => ({
      label: `Tier ${t.tier_label} (${t.quantity?.toLocaleString() ?? "—"} pcs)`,
      value: [
        t.total_subtotal ? `Total: ¥${Number(t.total_subtotal).toFixed(4)}` : null,
        t.labor_cost ? `Labor: ¥${Number(t.labor_cost).toFixed(4)}` : null,
        t.accessories_cost ? `Acc: ¥${Number(t.accessories_cost).toFixed(4)}` : null,
      ].filter(Boolean).join(" · ") || "—",
    }));
    sections.push({ label: "Cost per Tier (RMB/pc)", rows });
  }

  return sections;
}

// Download file attachments from Supabase Storage URLs
async function downloadAttachments(
  attachments: { name: string; url: string }[] | null | undefined
): Promise<Attachment[]> {
  if (!attachments?.length) return [];

  const results: Attachment[] = [];

  for (const att of attachments) {
    try {
      const res = await fetch(att.url);
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      results.push({ filename: att.name, content: buffer });
    } catch {
      console.error(`[workflow-notify] Failed to download attachment: ${att.name}`);
    }
  }

  return results;
}
