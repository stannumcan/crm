import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickDivisionId } from "@/lib/divisions-server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const divisionId = searchParams.get("division_id");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("sales_competitors")
    .select("*")
    .order("mention_count", { ascending: false });

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
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const divisionId = await pickDivisionId(sb, user.id, body.division_id);
  if (!divisionId) {
    return NextResponse.json({ error: "Active division not set." }, { status: 400 });
  }

  const name = body.name.trim();

  // Upsert: increment mention_count if exists, insert if not
  const { data: existing } = await sb
    .from("sales_competitors")
    .select("id, mention_count, prospect_names")
    .eq("division_id", divisionId)
    .eq("name", name)
    .single();

  if (existing) {
    // Update existing competitor
    const prospectNames = existing.prospect_names
      ? existing.prospect_names.split("|").map((s: string) => s.trim())
      : [];
    if (body.prospect_name && !prospectNames.includes(body.prospect_name.trim())) {
      prospectNames.push(body.prospect_name.trim());
    }

    const { data, error } = await sb
      .from("sales_competitors")
      .update({
        mention_count: (existing.mention_count || 0) + 1,
        last_seen: new Date().toISOString(),
        prospect_names: prospectNames.join(" | ") || null,
        country: body.country?.trim() || existing.country,
        notes: body.notes?.trim() || existing.notes,
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Insert new competitor
  const { data, error } = await sb
    .from("sales_competitors")
    .insert({
      division_id: divisionId,
      name,
      country: body.country?.trim() || null,
      mention_count: 1,
      prospect_names: body.prospect_name?.trim() || null,
      notes: body.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
