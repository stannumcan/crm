import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickDivisionId } from "@/lib/divisions-server";
import { auditedInsert } from "@/lib/sales-audit";
import { ACTIVITY_TYPES, EMAIL_QUALITY_RULES } from "@/lib/sales-constants";

const VALID_TYPES = ACTIVITY_TYPES.map((t) => t.value);
const VALID_OUTCOMES = ["positive", "neutral", "negative", "no_response"];

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company_id");
  const divisionId = searchParams.get("division_id");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("sales_activities")
    .select("*, contact:company_contacts(id, name, title)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (companyId) query = query.eq("company_id", companyId);
  if (divisionId) query = query.eq("division_id", divisionId);

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
  if (!VALID_TYPES.includes(body.type)) {
    return NextResponse.json({ error: "type must be one of: " + VALID_TYPES.join(", ") }, { status: 400 });
  }

  // Email quality gate
  if (body.type === "email_sent" && !body.quality_override) {
    if (!body.personalization_note || body.personalization_note.trim().length < EMAIL_QUALITY_RULES.minPersonalizationLength) {
      return NextResponse.json(
        { error: `email_sent requires personalization_note (min ${EMAIL_QUALITY_RULES.minPersonalizationLength} chars). Set quality_override=true to bypass.` },
        { status: 400 }
      );
    }
    if (body.body && body.body.trim().length < EMAIL_QUALITY_RULES.minBodyLength) {
      return NextResponse.json(
        { error: `Email body too short (min ${EMAIL_QUALITY_RULES.minBodyLength} chars)` },
        { status: 400 }
      );
    }
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
    deal_id: body.deal_id || null,
    type: body.type,
    subject: body.subject?.trim() || null,
    body: body.body?.trim() || null,
    outcome: VALID_OUTCOMES.includes(body.outcome) ? body.outcome : null,
    follow_up_date: body.follow_up_date || null,
    created_by: user.id,
  };

  const { data, error } = await auditedInsert(sb, "sales_activities", row, user.id, divisionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
