import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MILESTONE_DEFS, milestonesForFlow, type MouldFlow } from "@/lib/milestones";

// GET — list milestones for a workorder (creates them if missing)
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Get the WO's mould_flow
  const { data: wo } = await db.from("work_orders").select("mould_flow").eq("id", id).single();
  if (!wo) return NextResponse.json({ error: "Workorder not found" }, { status: 404 });

  const flow = wo.mould_flow as MouldFlow;

  // Fetch existing milestones
  const { data: existing } = await db
    .from("workorder_milestones")
    .select("*")
    .eq("workorder_id", id)
    .order("sort_order");

  let milestones = existing ?? [];

  // Auto-seed if no milestones exist yet
  if (milestones.length === 0) {
    const applicable = milestonesForFlow(flow);
    const allDefs = MILESTONE_DEFS;

    const rows = allDefs.map((def) => ({
      workorder_id: id,
      milestone_key: def.key,
      sort_order: def.sortOrder,
      status: applicable.some((a) => a.key === def.key) ? "pending" : "not_applicable",
    }));

    const { data: seeded } = await db
      .from("workorder_milestones")
      .insert(rows)
      .select("*");

    milestones = seeded ?? [];
    milestones.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order);
  }

  return NextResponse.json(milestones);
}

// PATCH — update a single milestone (mark complete, add notes/details, skip)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const { milestone_key, status, notes, details, attachments, completed_at } = body;

  if (!milestone_key) {
    return NextResponse.json({ error: "milestone_key is required" }, { status: 400 });
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Get current user for completed_by
  const { data: { user } } = await supabase.auth.getUser();

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (status !== undefined) update.status = status;
  if (notes !== undefined) update.notes = notes;
  if (details !== undefined) update.details = details;
  if (attachments !== undefined) update.attachments = attachments;

  if (status === "completed") {
    update.completed_at = completed_at ?? new Date().toISOString();
    update.completed_by = user?.id ?? null;
  }

  if (status === "skipped") {
    update.completed_at = null;
    update.completed_by = null;
  }

  const { data, error } = await db
    .from("workorder_milestones")
    .update(update)
    .eq("workorder_id", id)
    .eq("milestone_key", milestone_key)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
