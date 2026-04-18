import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getListDivisionFilter } from "@/lib/divisions-server";
import { getCurrentSeasonalFocus, STALE_THRESHOLD_DAYS, STALE_STAGES } from "@/lib/sales-constants";
import Anthropic from "@anthropic-ai/sdk";

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const divisionFilter = await getListDivisionFilter();

  // 1. Overdue follow-ups
  const today = new Date().toISOString().split("T")[0];
  let overdueQuery = sb
    .from("sales_activities")
    .select("id, company_id, type, subject, follow_up_date, company:companies(name)")
    .lt("follow_up_date", today)
    .not("follow_up_date", "is", null)
    .order("follow_up_date", { ascending: true })
    .limit(10);
  if (divisionFilter) overdueQuery = overdueQuery.eq("division_id", divisionFilter);
  const { data: overdue } = await overdueQuery;

  // 2. Actions due today
  let dueQuery = sb
    .from("sales_deals")
    .select("id, company_id, stage, next_action, next_action_date, company:companies(name)")
    .eq("next_action_date", today)
    .order("stage", { ascending: true })
    .limit(10);
  if (divisionFilter) dueQuery = dueQuery.eq("division_id", divisionFilter);
  const { data: dueToday } = await dueQuery;

  // 3. Pipeline summary (counts by stage)
  let pipelineQuery = sb
    .from("sales_deals")
    .select("stage, estimated_value")
    .not("stage", "in", "(won,lost)");
  if (divisionFilter) pipelineQuery = pipelineQuery.eq("division_id", divisionFilter);
  const { data: pipelineRaw } = await pipelineQuery;

  const pipelineSummary: Record<string, { count: number; value: number }> = {};
  for (const deal of pipelineRaw ?? []) {
    if (!pipelineSummary[deal.stage]) pipelineSummary[deal.stage] = { count: 0, value: 0 };
    pipelineSummary[deal.stage].count++;
    pipelineSummary[deal.stage].value += Number(deal.estimated_value ?? 0);
  }

  // 4. Stale leads (stuck in stage > threshold days)
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - STALE_THRESHOLD_DAYS);
  let staleQuery = sb
    .from("sales_deals")
    .select("id, company_id, stage, updated_at, company:companies(name)")
    .in("stage", STALE_STAGES)
    .lt("updated_at", staleDate.toISOString())
    .order("updated_at", { ascending: true })
    .limit(10);
  if (divisionFilter) staleQuery = staleQuery.eq("division_id", divisionFilter);
  const { data: staleDeals } = await staleQuery;

  // 5. Recent activity
  let recentQuery = sb
    .from("sales_activities")
    .select("id, type, subject, outcome, created_at, company:companies(name)")
    .order("created_at", { ascending: false })
    .limit(5);
  if (divisionFilter) recentQuery = recentQuery.eq("division_id", divisionFilter);
  const { data: recentActivity } = await recentQuery;

  // 6. Pending enrichment count
  let pendingQuery = sb
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("enrichment_status", "pending");
  if (divisionFilter) pendingQuery = pendingQuery.eq("division_id", divisionFilter);
  const { count: pendingCount } = await pendingQuery;

  const seasonal = getCurrentSeasonalFocus();

  const rawData = {
    date: today,
    seasonal,
    overdue_follow_ups: overdue ?? [],
    actions_due_today: dueToday ?? [],
    pipeline_summary: pipelineSummary,
    stale_deals: staleDeals ?? [],
    recent_activity: recentActivity ?? [],
    pending_enrichment_count: pendingCount ?? 0,
  };

  // Call Haiku for a prioritized summary
  try {
    const anthropic = new Anthropic();
    const briefingText = JSON.stringify(rawData, null, 2);

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: "You are a sales briefing assistant for a tin packaging manufacturer. Given today's pipeline data, produce a concise morning briefing: (1) Top 3 priorities for today, (2) Stale deals that need attention, (3) Seasonal outreach recommendation. Be actionable and specific. Respond in plain text, not JSON.",
      messages: [{ role: "user", content: `Today's pipeline data:\n\n${briefingText}` }],
    });

    const aiSummary = msg.content[0].type === "text" ? msg.content[0].text : "";
    return NextResponse.json({ ...rawData, ai_summary: aiSummary });
  } catch {
    // If Haiku fails, return raw data without AI summary
    return NextResponse.json({ ...rawData, ai_summary: null });
  }
}
