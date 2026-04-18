import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const divisionId = searchParams.get("division_id");
  const tableName = searchParams.get("table_name");
  const rowId = searchParams.get("row_id");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const offset = Number(searchParams.get("offset")) || 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("sales_audit_log")
    .select("*")
    .order("changed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (divisionId) query = query.eq("division_id", divisionId);
  if (tableName) query = query.eq("table_name", tableName);
  if (rowId) query = query.eq("row_id", rowId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
