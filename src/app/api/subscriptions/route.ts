import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickDivisionId } from "@/lib/divisions-server";

const BILLING_CYCLES = ["monthly", "quarterly", "annual", "one_time"] as const;
const STATUSES = ["active", "trial", "canceled"] as const;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("subscriptions")
    .select("*")
    .order("next_renewal_on", { ascending: true, nullsFirst: false });

  if (status && (STATUSES as readonly string[]).includes(status)) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  if (!body.service_name?.trim()) {
    return NextResponse.json({ error: "service_name is required" }, { status: 400 });
  }
  if (body.cost_amount === undefined || body.cost_amount === null || Number.isNaN(Number(body.cost_amount))) {
    return NextResponse.json({ error: "cost_amount is required" }, { status: 400 });
  }
  if (!body.cost_currency?.trim()) {
    return NextResponse.json({ error: "cost_currency is required" }, { status: 400 });
  }
  if (!(BILLING_CYCLES as readonly string[]).includes(body.billing_cycle)) {
    return NextResponse.json({ error: "billing_cycle must be one of: " + BILLING_CYCLES.join(", ") }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const divisionId = await pickDivisionId(supabase as any, user.id, body.division_id);
  if (!divisionId) {
    return NextResponse.json(
      { error: "Active division not set. Pick a division before creating a subscription." },
      { status: 400 }
    );
  }

  const row = {
    division_id: divisionId,
    service_name: String(body.service_name).trim(),
    vendor: body.vendor?.trim() || null,
    category: body.category?.trim() || null,
    cost_amount: Number(body.cost_amount),
    cost_currency: String(body.cost_currency).trim().toUpperCase(),
    billing_cycle: body.billing_cycle,
    started_on: body.started_on || null,
    next_renewal_on: body.next_renewal_on || null,
    auto_renew: body.auto_renew !== false,
    payment_method: body.payment_method?.trim() || null,
    owner_id: body.owner_id || null,
    status: (STATUSES as readonly string[]).includes(body.status) ? body.status : "active",
    cancel_url: body.cancel_url?.trim() || null,
    notes: body.notes?.trim() || null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("subscriptions")
    .insert(row)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
