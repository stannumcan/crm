import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const all = searchParams.get("all") === "true";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("molds")
    .select("id, mold_number, category, variant, length_mm, width_mm, height_mm, dimensions, feature, image_url, is_active")
    .order("mold_number");

  if (!all) query = query.eq("is_active", true);

  if (q) {
    query = query.ilike("mold_number", `%${q}%`);
  }

  const { data, error } = await query.limit(all ? 1000 : 30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { mold_number, category, variant, length_mm, width_mm, height_mm, feature } = body;

  if (!mold_number?.trim()) {
    return NextResponse.json({ error: "mold_number is required" }, { status: 400 });
  }

  const dimensions = [length_mm, width_mm, height_mm].filter(Boolean).join("x") + "mm";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("molds")
    .insert({
      mold_number: mold_number.trim().toUpperCase(),
      category: category?.trim() || null,
      variant: variant?.trim() || null,
      length_mm: length_mm || null,
      width_mm: width_mm || null,
      height_mm: height_mm || null,
      feature: feature?.trim() || null,
      dimensions,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
