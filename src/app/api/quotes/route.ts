import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const woId = searchParams.get("wo_id");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("quotations")
    .select("*, work_orders(wo_number, company_name, project_name), quotation_quantity_tiers(*)")
    .order("created_at", { ascending: false });

  if (woId) query = query.eq("wo_id", woId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { quantity_tiers, ...quotationData } = body;

  // Get version number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("quotations")
    .select("quote_version")
    .eq("wo_id", quotationData.wo_id)
    .order("quote_version", { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (existing?.quote_version ?? 0) + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quotation, error } = await (supabase as any)
    .from("quotations")
    .insert({ ...quotationData, quote_version: nextVersion })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert quantity tiers
  if (quantity_tiers?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("quotation_quantity_tiers").insert(
      quantity_tiers.map((t: { tier_label: string; quantity_type: string; quantity?: number; tier_notes?: string; sort_order: number }) => ({
        ...t,
        quotation_id: quotation.id,
      }))
    );
  }

  return NextResponse.json(quotation, { status: 201 });
}
