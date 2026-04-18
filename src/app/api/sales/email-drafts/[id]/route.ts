import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditedUpdate, auditedDelete } from "@/lib/sales-audit";

const VALID_STATUSES = ["draft", "approved", "sent", "rejected"];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("sales_email_drafts")
    .select("*, contact:company_contacts(id, name, title, email), company:companies(id, name)")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: existing, error: fetchErr } = await sb
    .from("sales_email_drafts")
    .select("id, division_id")
    .eq("id", id)
    .single();
  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Email draft not found" }, { status: 404 });
  }

  const changes: Record<string, unknown> = {};
  if (body.subject !== undefined) changes.subject = body.subject?.trim() || null;
  if (body.body !== undefined) changes.body = body.body?.trim() || null;
  if (body.status !== undefined && VALID_STATUSES.includes(body.status)) changes.status = body.status;
  if (body.personalization_note !== undefined) changes.personalization_note = body.personalization_note?.trim() || null;
  if (body.contact_id !== undefined) changes.contact_id = body.contact_id || null;

  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await auditedUpdate(sb, "sales_email_drafts", id, changes, user.id, existing.division_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: existing, error: fetchErr } = await sb
    .from("sales_email_drafts")
    .select("id, division_id")
    .eq("id", id)
    .single();
  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Email draft not found" }, { status: 404 });
  }

  const { error } = await auditedDelete(sb, "sales_email_drafts", id, user.id, existing.division_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
