import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyWorkflowStep } from "@/lib/workflow-notify";

// POST { quotation_id } — mark DDP step as complete, update status, send email
export async function POST(request: NextRequest) {
  const { quotation_id } = await request.json();
  if (!quotation_id) return NextResponse.json({ error: "quotation_id required" }, { status: 400 });

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("quotations")
    .update({ status: "sent" })
    .eq("id", quotation_id);

  // Notify the step that JUST COMPLETED: "DDP Calculation" (pending_natsuki's work)
  await notifyWorkflowStep(quotation_id, "pending_natsuki");

  return NextResponse.json({ completed: true });
}
