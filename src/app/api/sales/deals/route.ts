import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickDivisionId } from "@/lib/divisions-server";
import { auditedInsert } from "@/lib/sales-audit";
import { PIPELINE_STAGES } from "@/lib/sales-constants";

const VALID_STAGES = PIPELINE_STAGES.map((s) => s.value);

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const divisionId = searchParams.get("division_id");
  const stage = searchParams.get("stage");
  const companyId = searchParams.get("company_id");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("sales_deals")
    .select("*, company:companies(id, name, domain, industry)")
    .order("updated_at", { ascending: false });

  if (divisionId) query = query.eq("division_id", divisionId);
  if (stage) query = query.eq("stage", stage);
  if (companyId) query = query.eq("company_id", companyId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.company_id) {
    return NextResponse.json({ error: "company_id is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const divisionId = await pickDivisionId(sb, user.id, body.division_id);
  if (!divisionId) {
    return NextResponse.json(
      { error: "Active division not set. Pick a division before creating a deal." },
      { status: 400 }
    );
  }

  const stage = VALID_STAGES.includes(body.stage) ? body.stage : "new";

  const row = {
    division_id: divisionId,
    company_id: body.company_id,
    contact_id: body.contact_id || null,
    stage,
    product_interest: body.product_interest?.trim() || null,
    estimated_volume: body.estimated_volume?.trim() || null,
    estimated_value: body.estimated_value != null ? Number(body.estimated_value) : null,
    next_action: body.next_action?.trim() || null,
    next_action_date: body.next_action_date || null,
    close_date: body.close_date || null,
    loss_reason: body.loss_reason?.trim() || null,
    notes: body.notes?.trim() || null,
    owner_id: body.owner_id || user.id,
  };

  const { data, error } = await auditedInsert(sb, "sales_deals", row, user.id, divisionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
