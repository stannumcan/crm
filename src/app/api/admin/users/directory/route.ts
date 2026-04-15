import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Lightweight user directory for pickers (Workflow Designer assignee field, etc.)
// Returns just what's needed to display + match a user:
//   { user_id, display_name, email, dingtalk_userid }

export async function GET() {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("user_profiles")
      .select("user_id, display_name, email, dingtalk_userid")
      .eq("suspended", false)
      .order("display_name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
