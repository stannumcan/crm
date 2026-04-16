import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MILESTONE_DEFS, milestonesForFlow, type MouldFlow } from "@/lib/milestones";

// POST — delete existing milestones and re-seed for a (potentially new) flow.
// Called when the user changes the mould_flow on a workorder.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { flow } = await request.json();

  if (!["new", "existing", "modification"].includes(flow)) {
    return NextResponse.json({ error: "Invalid flow" }, { status: 400 });
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Preserve any already-completed milestones so we don't lose history
  const { data: existing } = await db
    .from("workorder_milestones")
    .select("milestone_key, status, completed_at, completed_by, notes, details, attachments")
    .eq("workorder_id", id);

  const completed = new Map<string, typeof existing[0]>();
  for (const m of (existing ?? [])) {
    if (m.status === "completed" || m.status === "skipped") {
      completed.set(m.milestone_key, m);
    }
  }

  // Delete all and re-seed
  await db.from("workorder_milestones").delete().eq("workorder_id", id);

  const applicable = milestonesForFlow(flow as MouldFlow);
  const rows = MILESTONE_DEFS.map((def) => {
    const prev = completed.get(def.key);
    const isApplicable = applicable.some((a) => a.key === def.key);
    return {
      workorder_id: id,
      milestone_key: def.key,
      sort_order: def.sortOrder,
      status: prev?.status ?? (isApplicable ? "pending" : "not_applicable"),
      completed_at: prev?.completed_at ?? null,
      completed_by: prev?.completed_by ?? null,
      notes: prev?.notes ?? null,
      details: prev?.details ?? {},
      attachments: prev?.attachments ?? [],
    };
  });

  await db.from("workorder_milestones").insert(rows);

  return NextResponse.json({ reseeded: true, flow });
}
