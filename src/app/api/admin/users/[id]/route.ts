import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const admin = createAdminClient();
    const supabase = await createClient();

    // Handle suspend / unsuspend via ban
    if (typeof body.suspended === "boolean") {
      const { error } = await admin.auth.admin.updateUserById(id, {
        ban_duration: body.suspended ? "876600h" : "none", // 100 years = suspended
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("user_profiles").upsert({ user_id: id, suspended: body.suspended });
    }

    // Handle profile assignment + display name
    const profileUpdate: Record<string, unknown> = { user_id: id };
    if ("profile_id" in body) profileUpdate.profile_id = body.profile_id;
    if ("display_name" in body) profileUpdate.display_name = body.display_name;

    if (Object.keys(profileUpdate).length > 1) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("user_profiles").upsert(profileUpdate);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("user_profiles").delete().eq("user_id", id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
