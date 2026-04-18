import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditedUpdate } from "@/lib/sales-audit";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: draft, error: fetchErr } = await sb
    .from("sales_email_drafts")
    .select("id, division_id, status")
    .eq("id", id)
    .single();
  if (fetchErr || !draft) {
    return NextResponse.json({ error: "Email draft not found" }, { status: 404 });
  }
  if (draft.status !== "draft") {
    return NextResponse.json(
      { error: `Cannot approve a draft with status '${draft.status}'` },
      { status: 400 }
    );
  }

  const { data, error } = await auditedUpdate(
    sb,
    "sales_email_drafts",
    id,
    { status: "approved", approved_by: user.id },
    user.id,
    draft.division_id
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
