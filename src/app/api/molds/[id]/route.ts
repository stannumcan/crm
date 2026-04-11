import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;
  const body = await request.json();

  const allowed = ["mold_number", "category", "variant", "length_mm", "width_mm", "height_mm", "feature", "is_active", "image_url"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Recompute dimensions if any dimension changed
  if ("length_mm" in updates || "width_mm" in updates || "height_mm" in updates) {
    // fetch current to fill gaps
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: current } = await (supabase as any).from("molds").select("length_mm, width_mm, height_mm").eq("id", id).single();
    const l = updates.length_mm ?? current?.length_mm;
    const w = updates.width_mm ?? current?.width_mm;
    const h = updates.height_mm ?? current?.height_mm;
    updates.dimensions = [l, w, h].filter(Boolean).join("x") + "mm";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("molds")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
