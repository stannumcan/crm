import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/molds/search?q=ML-1220
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("molds")
    .select("id, mold_number, dimensions, length_mm, width_mm, height_mm, category, image_url")
    .eq("is_active", true)
    .order("mold_number")
    .limit(30);

  if (q) {
    query = query.ilike("mold_number", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
