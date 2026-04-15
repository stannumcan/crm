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

    // Handle password reset (admin-set)
    if (typeof body.password === "string" && body.password.length > 0) {
      if (body.password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }
      const { error } = await admin.auth.admin.updateUserById(id, { password: body.password });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Handle profile assignment + display name + notification prefs + dingtalk id
    const profileUpdate: Record<string, unknown> = { user_id: id };
    if ("profile_id" in body) profileUpdate.profile_id = body.profile_id;
    if ("display_name" in body) profileUpdate.display_name = body.display_name;
    if ("dingtalk_userid" in body) profileUpdate.dingtalk_userid = body.dingtalk_userid || null;
    if ("notification_prefs" in body && body.notification_prefs && typeof body.notification_prefs === "object") {
      profileUpdate.notification_prefs = body.notification_prefs;
    }

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
