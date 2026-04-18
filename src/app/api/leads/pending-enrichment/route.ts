import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const divisionId = searchParams.get("division_id");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("companies")
    .select("id, name, domain, industry, lead_source, enrichment_status, created_at, division_id")
    .eq("enrichment_status", "pending")
    .not("domain", "is", null)
    .order("created_at", { ascending: true });

  if (divisionId) query = query.eq("division_id", divisionId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
