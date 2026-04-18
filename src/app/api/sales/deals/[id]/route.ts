import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditedUpdate, auditedDelete } from "@/lib/sales-audit";
import { PIPELINE_STAGES } from "@/lib/sales-constants";

const VALID_STAGES = PIPELINE_STAGES.map((s) => s.value);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("sales_deals")
    .select("*, company:companies(id, name, domain, industry), contact:company_contacts(id, name, title, email)")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: existing, error: fetchErr } = await sb
    .from("sales_deals")
    .select("id, division_id")
    .eq("id", id)
    .single();
  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const changes: Record<string, unknown> = {};
  if (body.stage !== undefined && VALID_STAGES.includes(body.stage)) changes.stage = body.stage;
  if (body.contact_id !== undefined) changes.contact_id = body.contact_id || null;
  if (body.product_interest !== undefined) changes.product_interest = body.product_interest?.trim() || null;
  if (body.estimated_volume !== undefined) changes.estimated_volume = body.estimated_volume?.trim() || null;
  if (body.estimated_value !== undefined) changes.estimated_value = body.estimated_value != null ? Number(body.estimated_value) : null;
  if (body.next_action !== undefined) changes.next_action = body.next_action?.trim() || null;
  if (body.next_action_date !== undefined) changes.next_action_date = body.next_action_date || null;
  if (body.close_date !== undefined) changes.close_date = body.close_date || null;
  if (body.loss_reason !== undefined) changes.loss_reason = body.loss_reason?.trim() || null;
  if (body.notes !== undefined) changes.notes = body.notes?.trim() || null;
  if (body.owner_id !== undefined) changes.owner_id = body.owner_id || null;

  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await auditedUpdate(sb, "sales_deals", id, changes, user.id, existing.division_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: existing, error: fetchErr } = await sb
    .from("sales_deals")
    .select("id, division_id")
    .eq("id", id)
    .single();
  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const { error } = await auditedDelete(sb, "sales_deals", id, user.id, existing.division_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
