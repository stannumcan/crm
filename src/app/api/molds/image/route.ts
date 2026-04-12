import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH — update a mold's image_url
export async function PATCH(request: NextRequest) {
  const { mold_id, image_url } = await request.json();
  if (!mold_id || !image_url) {
    return NextResponse.json({ error: "mold_id and image_url required" }, { status: 400 });
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("molds")
    .update({ image_url })
    .eq("id", mold_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: true });
}
