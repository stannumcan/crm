import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/workflow/stale-check?table=factory_cost_sheets&id=xxx&based_on_version=1
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table");
  const basedOnVersion = parseInt(searchParams.get("based_on_version") ?? "0");

  if (!table || !basedOnVersion) {
    return NextResponse.json({ isStale: false, currentVersion: basedOnVersion });
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any).from(table).select("version").eq("is_current", true).limit(1);

  // Apply filters from search params (skip reserved ones)
  const reserved = ["table", "based_on_version"];
  for (const [key, val] of searchParams.entries()) {
    if (!reserved.includes(key)) {
      query = query.eq(key, val);
    }
  }

  const { data } = await query;
  const currentVersion = data?.[0]?.version ?? basedOnVersion;

  return NextResponse.json({
    isStale: basedOnVersion < currentVersion,
    currentVersion,
  });
}
