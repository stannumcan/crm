import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getResend, EMAIL_FROM } from "@/lib/email";
import { buildQuoteEmail } from "@/lib/email-template";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jp.stannumcan.ca";

// POST { quotation_id, new_status }
// Looks up the workflow step for new_status, sends email to assignees
export async function POST(request: Request) {
  const body = await request.json();
  const { quotation_id, new_status } = body;

  if (!quotation_id || !new_status) {
    return NextResponse.json({ error: "quotation_id and new_status required" }, { status: 400 });
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Get the workflow step config for this status
  const { data: step } = await db
    .from("workflow_steps")
    .select("*")
    .eq("step_key", new_status)
    .single();

  if (!step || !step.send_email || !step.assignee_emails?.length) {
    return NextResponse.json({ skipped: true, reason: "No email configured for this step" });
  }

  // Get quotation + work order info
  const { data: quote } = await db
    .from("quotations")
    .select("*, work_orders(wo_number, company_name, project_name)")
    .eq("id", quotation_id)
    .single();

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const wo = quote.work_orders;
  const woNumber = wo?.wo_number ?? "—";
  const companyName = wo?.company_name ?? "—";
  const projectName = wo?.project_name ?? "—";

  // Build form summary sections based on step
  const sections = buildSections(quote, new_status);

  const html = buildQuoteEmail({
    stepLabel: step.label,
    taskDescription: step.task_description,
    woNumber,
    companyName,
    projectName,
    quoteVersion: quote.quote_version ?? 1,
    sections,
    ctaUrl: `${APP_URL}/en/quotes/${quotation_id}/request`,
    ctaLabel: "Open in CRM",
  });

  const subject = `[${woNumber}] ${step.label} — ${companyName}`;

  try {
    const resend = getResend();

    for (const email of step.assignee_emails) {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: email,
        subject,
        html,
      });

      // Log the email
      await db.from("workflow_email_log").insert({
        quotation_id,
        step_key: new_status,
        recipient_email: email,
        subject,
      });
    }

    return NextResponse.json({ sent: step.assignee_emails.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Email send failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSections(quote: any, status: string) {
  const sections: { label: string; rows: { label: string; value: string }[] }[] = [];

  // Always include basic quote info
  const basic: { label: string; value: string }[] = [];
  if (quote.urgency) basic.push({ label: "Urgency", value: quote.urgency ? "Urgent" : "Normal" });
  if (quote.deadline) basic.push({ label: "Deadline", value: new Date(quote.deadline).toLocaleDateString() });
  if (quote.shipping_info_required !== undefined) {
    basic.push({ label: "Shipping Info", value: quote.shipping_info_required ? "Required" : "Not required" });
  }
  if (basic.length > 0) sections.push({ label: "Quote Details", rows: basic });

  // Mold info if available
  if (quote.mold_number || quote.can_size) {
    const mold: { label: string; value: string }[] = [];
    if (quote.mold_number) mold.push({ label: "Mold #", value: quote.mold_number });
    if (quote.can_size) mold.push({ label: "Can Size", value: quote.can_size });
    if (quote.tin_thickness) mold.push({ label: "Thickness", value: `${quote.tin_thickness}mm` });
    sections.push({ label: "Mold Information", rows: mold });
  }

  // Printing if available
  if (quote.printing_interior || quote.printing_exterior) {
    const print: { label: string; value: string }[] = [];
    if (quote.printing_interior) print.push({ label: "Interior", value: quote.printing_interior });
    if (quote.printing_exterior) print.push({ label: "Exterior", value: quote.printing_exterior });
    if (quote.embossment) print.push({ label: "Embossment", value: quote.embossment });
    sections.push({ label: "Printing & Finish", rows: print });
  }

  return sections;
}
