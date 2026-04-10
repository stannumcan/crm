import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("molds")
    .select("id, mold_number, hm_number, category, variant, dimensions, feature")
    .eq("is_active", true)
    .order("mold_number");

  if (q) {
    query = query.ilike("mold_number", `%${q}%`);
  }

  const { data, error } = await query.limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
