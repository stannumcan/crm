import { createAdminClient } from "@/lib/supabase/admin";
import { getResend, EMAIL_FROM, EMAIL_REPLY_TO } from "@/lib/email";
import { buildQuoteEmail } from "@/lib/email-template";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://japan-crm.vercel.app";

interface Attachment {
  filename: string;
  content: Buffer;
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
    });

    const subject = `[${woNumber}] ${step.label} — ${companyName}`;

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

  // ── Molds ─────────────────────────────────────────────────────
  const molds = quote.molds as { value: string; type: string; size: string; thickness: string | null; design_count?: number }[] | null;
  if (molds?.length) {
    const moldRows: { label: string; value: string }[] = [];
    molds.forEach((m, i) => {
      const parts: string[] = [];
      parts.push(m.value || "—");
      if (m.size) parts.push(m.size);
      if (m.thickness) parts.push(`${m.thickness}mm`);
      parts.push(`(${m.type})`);
      if (m.design_count && m.design_count > 1) parts.push(`× ${m.design_count} designs`);
      moldRows.push({ label: `Mold ${i + 1}`, value: parts.join("  ·  ") });
    });
    sections.push({ label: "Molds", rows: moldRows });
  } else if (quote.mold_number) {
    // Fallback to legacy single-mold fields
    const moldRows: { label: string; value: string }[] = [];
    moldRows.push({ label: "Mold #", value: quote.mold_number });
    if (quote.mold_type) moldRows.push({ label: "Type", value: quote.mold_type });
    if (quote.size_dimensions) moldRows.push({ label: "Size", value: quote.size_dimensions });
    sections.push({ label: "Mold Information", rows: moldRows });
  }

  // ── Printing ──────────────────────────────────────────────────
  const printing: { label: string; value: string }[] = [];
  if (quote.printing_lid) printing.push({ label: "Lid", value: quote.printing_lid });
  if (quote.printing_body) printing.push({ label: "Body", value: quote.printing_body });
  if (quote.printing_bottom) printing.push({ label: "Bottom", value: quote.printing_bottom });
  if (quote.printing_inner) printing.push({ label: "Inner", value: quote.printing_inner });
  if (quote.printing_notes) printing.push({ label: "Notes", value: quote.printing_notes });
  if (printing.length > 0) sections.push({ label: "Printing", rows: printing });

  // ── Embossment ────────────────────────────────────────────────
  if (quote.embossment) {
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
