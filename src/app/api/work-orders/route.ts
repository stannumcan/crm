import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatWONumber } from "@/lib/calculations";

export async function GET() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("work_orders")
    .select("*, quotations(id, status, quote_version, created_at)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { company_name, project_name, region = "JP", created_by } = body;

  // Get current year (2-digit)
  const yearCode = new Date().getFullYear().toString().slice(-2);

  // Get next sequence number for this region+year
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lastWO } = await (supabase as any)
    .from("work_orders")
    .select("sequence_number")
    .eq("region", region)
    .eq("year_code", yearCode)
    .order("sequence_number", { ascending: false })
    .limit(1)
    .single();

  const nextSeq = (lastWO?.sequence_number ?? 0) + 1;
  const woNumber = formatWONumber(region, yearCode, nextSeq);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("work_orders")
    .insert({
      wo_number: woNumber,
      region,
      year_code: yearCode,
      sequence_number: nextSeq,
      company_name,
      project_name,
      created_by,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
