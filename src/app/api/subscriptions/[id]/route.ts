import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BILLING_CYCLES = ["monthly", "quarterly", "annual", "one_time"] as const;
const STATUSES = ["active", "trial", "canceled"] as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("subscriptions")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();

  if (body.billing_cycle !== undefined && !(BILLING_CYCLES as readonly string[]).includes(body.billing_cycle)) {
    return NextResponse.json({ error: "Invalid billing_cycle" }, { status: 400 });
  }
  if (body.status !== undefined && !(STATUSES as readonly string[]).includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  const allow = [
    "service_name","vendor","category","cost_amount","cost_currency",
    "billing_cycle","started_on","next_renewal_on","auto_renew",
    "payment_method","owner_id","status","cancel_url","notes",
  ];
  for (const k of allow) {
    if (k in body) patch[k] = body[k];
  }
  if (typeof patch.service_name === "string") patch.service_name = patch.service_name.trim();
  if (typeof patch.cost_currency === "string") patch.cost_currency = (patch.cost_currency as string).trim().toUpperCase();
  if (typeof patch.cost_amount === "string") patch.cost_amount = Number(patch.cost_amount);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("subscriptions")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("subscriptions")
    .delete()
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
