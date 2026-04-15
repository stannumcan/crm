import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET — list all workflow steps ordered
export async function GET() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("workflow_steps")
    .select("*")
    .order("step_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH — update a single step's assignees, send_email, task_description, DingTalk config
export async function PATCH(request: Request) {
  const body = await request.json();
  const {
    id, assignee_emails, send_email, task_description, subject_template,
    send_dingtalk, assignee_dingtalk_userids, assignee_user_ids,
  } = body;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("workflow_steps")
    .update({
      assignee_emails: assignee_emails ?? [],
      send_email: send_email ?? false,
      task_description: task_description ?? null,
      subject_template: subject_template ?? null,
      send_dingtalk: send_dingtalk ?? false,
      assignee_dingtalk_userids: assignee_dingtalk_userids ?? [],
      assignee_user_ids: assignee_user_ids ?? [],
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
