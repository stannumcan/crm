import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditedUpdate } from "@/lib/sales-audit";

const VALID_STATUSES = ["pending", "enriched", "skipped"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: companyId } = await params;
  const body = await request.json();

  if (!(VALID_STATUSES as readonly string[]).includes(body.enrichment_status)) {
    return NextResponse.json(
      { error: "enrichment_status must be one of: " + VALID_STATUSES.join(", ") },
      { status: 400 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: company, error: fetchErr } = await sb
    .from("companies")
    .select("id, division_id")
    .eq("id", companyId)
    .single();
  if (fetchErr || !company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const { data, error } = await auditedUpdate(
    sb,
    "companies",
    companyId,
    { enrichment_status: body.enrichment_status },
    user.id,
    company.division_id
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
