import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickDivisionId } from "@/lib/divisions-server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const country = searchParams.get("country");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("companies")
    .select("id, name, name_ja, name_zh, country, region, city, is_active, division_id")
    .eq("is_active", true)
    .order("name");

  if (country) query = query.eq("country", country);

  // Simple ilike fuzzy across name, name_ja, name_zh
  if (q) {
    query = query.or(
      `name.ilike.%${q}%,name_ja.ilike.%${q}%,name_zh.ilike.%${q}%`
    );
  }

  const { data, error } = await query.limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Companies belong to a division. Use explicit division_id from the body
  // (super-admin combined view) or fall back to the user's active division.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const divisionId = await pickDivisionId(supabase as any, user.id, body.division_id);
  if (!divisionId) {
    return NextResponse.json(
      { error: "Active division not set. Pick a division before creating a company." },
      { status: 400 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("companies")
    .insert({ ...body, division_id: divisionId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
