import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatWONumber } from "@/lib/calculations";
import { pickDivisionId } from "@/lib/divisions-server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company_id");
  const divisionId = searchParams.get("division_id"); // optional filter (admin combined view)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("work_orders")
    .select("*, division:divisions(id, code, name, wo_prefix), quotations(id, status, quote_version, created_at)")
    .order("created_at", { ascending: false });

  if (companyId) query = query.eq("company_id", companyId);
  if (divisionId) query = query.eq("division_id", divisionId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { company_name, company_id, project_name, created_by } = body;

  // Resolve target division. Super-admins in combined view must pass
  // division_id explicitly; everyone else uses their active division.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const divisionId = await pickDivisionId(supabase as any, user.id, body.division_id);
  if (!divisionId) {
    return NextResponse.json(
      { error: "Active division not set. Pick a division before creating a work order." },
      { status: 400 }
    );
  }

  // Look up the division's wo_prefix to format the WO number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: division } = await (supabase as any)
    .from("divisions")
    .select("id, code, wo_prefix")
    .eq("id", divisionId)
    .single();
  if (!division) {
    return NextResponse.json({ error: "Division not found" }, { status: 404 });
  }
  const prefix: string = division.wo_prefix; // e.g. 'JP' or 'CA'

  const yearCode = new Date().getFullYear().toString().slice(-2);

  // Per-division sequence: highest sequence_number for this division+year
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lastWO } = await (supabase as any)
    .from("work_orders")
    .select("sequence_number")
    .eq("division_id", divisionId)
    .eq("year_code", yearCode)
    .order("sequence_number", { ascending: false })
    .limit(1)
    .single();

  // Optional floor set via app_settings.wo_sequence_start, keyed by "{prefix}-{yearCode}".
  // Lets us resume numbering from an imported historical counter without inserting placeholder rows.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: startSetting } = await (supabase as any)
    .from("app_settings")
    .select("value")
    .eq("key", "wo_sequence_start")
    .single();
  const floor = Number(startSetting?.value?.[`${prefix}-${yearCode}`] ?? 0) || 0;

  const nextSeq = Math.max((lastWO?.sequence_number ?? 0) + 1, floor);
  const woNumber = formatWONumber(prefix, yearCode, nextSeq);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("work_orders")
    .insert({
      wo_number: woNumber,
      region: prefix,           // legacy column kept in sync with division prefix
      year_code: yearCode,
      sequence_number: nextSeq,
      company_name,
      company_id: company_id || null,
      project_name,
      created_by,
      division_id: divisionId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
