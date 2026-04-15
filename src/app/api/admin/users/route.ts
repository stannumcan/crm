import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data: { users }, error } = await admin.auth.admin.listUsers();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Fetch user_profiles for extra metadata
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profiles } = await (supabase as any)
      .from("user_profiles")
      .select("*, permission_profiles(id, name)");

    const profileMap = Object.fromEntries(
      (profiles ?? []).map((p: Record<string, unknown>) => [p.user_id, p])
    );

    const result = users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      banned_until: u.banned_until,
      profile: profileMap[u.id] ?? null,
    }));

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, display_name, profile_id, password } = await request.json();
    if (!email?.trim()) return NextResponse.json({ error: "Email is required" }, { status: 400 });

    const trimmedPassword = typeof password === "string" ? password : "";
    if (trimmedPassword && trimmedPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const admin = createAdminClient();

    // If a password is supplied → create the user directly with email_confirmed=true.
    // Otherwise → send an invite email (magic link, user sets their own password on first sign-in).
    let user;
    if (trimmedPassword) {
      const { data, error } = await admin.auth.admin.createUser({
        email: email.trim(),
        password: trimmedPassword,
        email_confirm: true,
        user_metadata: { display_name: display_name?.trim() || null },
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      user = data.user;
    } else {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
        data: { display_name: display_name?.trim() || null },
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      user = data.user;
    }
    if (!user) return NextResponse.json({ error: "Failed to create user" }, { status: 500 });

    // Create user_profiles entry
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("user_profiles").upsert({
      user_id: user.id,
      email: email.trim(),
      display_name: display_name?.trim() || null,
      profile_id: profile_id || null,
    });

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
