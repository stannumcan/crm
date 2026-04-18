import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditedUpdate } from "@/lib/sales-audit";
import Anthropic from "@anthropic-ai/sdk";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: companyId } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Fetch company with contacts
  const { data: company, error: fetchErr } = await sb
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();
  if (fetchErr || !company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const { data: contacts } = await sb
    .from("company_contacts")
    .select("name, title, email, email_confidence")
    .eq("company_id", companyId)
    .limit(10);

  const { data: news } = await sb
    .from("sales_company_news")
    .select("headline, summary")
    .eq("company_id", companyId)
    .limit(5);

  // Build company profile for scoring
  const profile = [
    `Company: ${company.name}`,
    company.domain ? `Domain: ${company.domain}` : null,
    company.industry ? `Industry: ${company.industry}` : null,
    company.employee_count ? `Employees: ${company.employee_count}` : null,
    company.description ? `Description: ${company.description}` : null,
    company.import_data_notes ? `Import Data: ${company.import_data_notes}` : null,
    company.current_packaging ? `Current Packaging: ${company.current_packaging}` : null,
    contacts?.length ? `Key Contacts: ${contacts.map((c: { name: string; title: string | null }) => `${c.name} (${c.title ?? "no title"})`).join(", ")}` : null,
    news?.length ? `Recent News: ${news.map((n: { headline: string }) => n.headline).join("; ")}` : null,
  ].filter(Boolean).join("\n");

  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: `You are a lead scoring assistant for Stannum Can, a decorative tin packaging manufacturer (8,000+ molds, 25M/month production). Score prospects 0-100 based on how likely they are to buy custom tin packaging. Consider: industry fit (confectionery, bakery, coffee/tea, candles, cosmetics, gifts, gourmet, health/beauty are best), company size, current packaging situation, import activity, and contact accessibility. Respond with ONLY valid JSON: {"score": <number>, "reason": "<1-2 sentences>"}`,
      messages: [{ role: "user", content: `Score this prospect:\n\n${profile}` }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const parsed = JSON.parse(text.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    const score = Math.min(100, Math.max(0, Math.round(Number(parsed.score))));
    const reason = String(parsed.reason || "").slice(0, 500);

    const { data: updated, error: updateErr } = await auditedUpdate(
      sb,
      "companies",
      companyId,
      {
        relevancy_score: score,
        relevancy_reason: reason,
        relevancy_updated_at: new Date().toISOString(),
      },
      user.id,
      company.division_id
    );

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ score, reason, company: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Scoring failed" },
      { status: 500 }
    );
  }
}
