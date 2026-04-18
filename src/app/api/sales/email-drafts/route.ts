import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickDivisionId } from "@/lib/divisions-server";
import { auditedInsert } from "@/lib/sales-audit";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company_id");
  const divisionId = searchParams.get("division_id");
  const status = searchParams.get("status");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("sales_email_drafts")
    .select("*, contact:company_contacts(id, name, title, email)")
    .order("created_at", { ascending: false });

  if (companyId) query = query.eq("company_id", companyId);
  if (divisionId) query = query.eq("division_id", divisionId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.company_id) {
    return NextResponse.json({ error: "company_id is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const divisionId = await pickDivisionId(sb, user.id, body.division_id);
  if (!divisionId) {
    return NextResponse.json(
      { error: "Active division not set." },
      { status: 400 }
    );
  }

  const row = {
    division_id: divisionId,
    company_id: body.company_id,
    contact_id: body.contact_id || null,
    subject: body.subject?.trim() || null,
    body: body.body?.trim() || null,
    status: "draft",
    personalization_note: body.personalization_note?.trim() || null,
    ai_generated: body.ai_generated === true,
    prompt_template: body.prompt_template?.trim() || null,
    created_by: user.id,
  };

  const { data, error } = await auditedInsert(sb, "sales_email_drafts", row, user.id, divisionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
