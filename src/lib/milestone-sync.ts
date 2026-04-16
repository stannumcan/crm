// ─────────────────────────────────────────────────────────────
// Auto-sync workorder milestones from quote state
//
// Called after key quote events (quote created, customer quote saved,
// quote approved) to automatically mark the corresponding WO
// milestones as completed without manual action.
// ─────────────────────────────────────────────────────────────

import { createAdminClient } from "@/lib/supabase/admin";

export async function syncMilestonesFromQuote(quotationId: string) {
  const supabase = createAdminClient();

  // Get the quote + its WO + downstream state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quote } = await (supabase as any)
    .from("quotations")
    .select(`
      id, status, wo_id, created_at,
      customer_quotes(id, is_current, created_at)
    `)
    .eq("id", quotationId)
    .single();

  if (!quote?.wo_id) return;

  const woId = quote.wo_id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Ensure milestones exist (they're auto-seeded on first GET, but we
  // might be called before anyone has viewed the WO detail page).
  const { data: existing } = await db
    .from("workorder_milestones")
    .select("milestone_key")
    .eq("workorder_id", woId)
    .limit(1);

  if (!existing || existing.length === 0) {
    // Trigger a seed by calling the milestones GET logic inline.
    // We can't call our own API route from a server context, so seed directly.
    const { data: wo } = await db.from("work_orders").select("mould_flow").eq("id", woId).single();
    if (wo) {
      const { MILESTONE_DEFS, milestonesForFlow } = await import("@/lib/milestones");
      const flow = wo.mould_flow as "new" | "existing" | "modification";
      const applicable = milestonesForFlow(flow);
      const rows = MILESTONE_DEFS.map((def) => ({
        workorder_id: woId,
        milestone_key: def.key,
        sort_order: def.sortOrder,
        status: applicable.some((a) => a.key === def.key) ? "pending" : "not_applicable",
      }));
      await db.from("workorder_milestones").insert(rows);
    }
  }

  // Helper: mark a milestone complete if it's currently pending
  const markIfPending = async (key: string, completedAt?: string) => {
    await db
      .from("workorder_milestones")
      .update({
        status: "completed",
        completed_at: completedAt ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("workorder_id", woId)
      .eq("milestone_key", key)
      .eq("status", "pending");
  };

  // Quote Requested — mark when any quote exists for this WO
  await markIfPending("quote_requested", quote.created_at);

  // Customer Quote Sent — mark when a current customer_quote exists
  const customerQuotes = Array.isArray(quote.customer_quotes) ? quote.customer_quotes : [];
  const hasCurrentCQ = customerQuotes.some((cq: { is_current?: boolean }) => cq.is_current !== false);
  if (hasCurrentCQ) {
    const cqDate = customerQuotes.find((cq: { is_current?: boolean }) => cq.is_current !== false)?.created_at;
    await markIfPending("quote_sent", cqDate);
  }

  // Price Accepted — mark when quote status is 'approved'
  if (quote.status === "approved") {
    await markIfPending("price_accepted");
  }
}
