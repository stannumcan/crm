import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatWONumber } from "@/lib/calculations";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company_id");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("work_orders")
    .select("*, quotations(id, status, quote_version, created_at)")
    .order("created_at", { ascending: false });

  if (companyId) query = query.eq("company_id", companyId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { company_name, company_id, project_name, region = "JP", created_by } = body;

  const yearCode = new Date().getFullYear().toString().slice(-2);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lastWO } = await (supabase as any)
    .from("work_orders")
    .select("sequence_number")
    .eq("region", region)
    .eq("year_code", yearCode)
    .order("sequence_number", { ascending: false })
    .limit(1)
    .single();

  // Optional floor set via app_settings.wo_sequence_start, keyed by "{region}-{yearCode}".
  // Lets us resume numbering from an imported historical counter without inserting placeholder rows.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: startSetting } = await (supabase as any)
    .from("app_settings")
    .select("value")
    .eq("key", "wo_sequence_start")
    .single();
  const floor = Number(startSetting?.value?.[`${region}-${yearCode}`] ?? 0) || 0;

  const nextSeq = Math.max((lastWO?.sequence_number ?? 0) + 1, floor);
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
      company_id: company_id || null,
      project_name,
      created_by,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
