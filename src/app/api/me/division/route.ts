// Switch the current user's active division.
//
// - Single-division users: this should never be called (UI hides the switcher)
// - Multi-division users: must pick one of their accessible divisions
// - Super-admins: may pass null to enter "All Divisions" combined view
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const divisionId: string | null = body.division_id ?? null;

  // Look up the user's profile + super-admin status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("user_profiles")
    .select("is_super_admin")
    .eq("user_id", user.id)
    .single();

  const isSuperAdmin = profile?.is_super_admin === true;

  // Validate the division id (if non-null) is one the user can access.
  if (divisionId) {
    if (isSuperAdmin) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: division } = await (supabase as any)
        .from("divisions")
        .select("id")
        .eq("id", divisionId)
        .single();
      if (!division) {
        return NextResponse.json({ error: "Division not found" }, { status: 404 });
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: membership } = await (supabase as any)
        .from("user_divisions")
        .select("division_id")
        .eq("user_id", user.id)
        .eq("division_id", divisionId)
        .maybeSingle();
      if (!membership) {
        return NextResponse.json({ error: "Not a member of this division" }, { status: 403 });
      }
    }
  } else {
    // Null is only allowed for super-admins (combined view)
    if (!isSuperAdmin) {
      return NextResponse.json({ error: "Cannot clear active division" }, { status: 403 });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("user_profiles")
    .update({ active_division_id: divisionId })
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, active_division_id: divisionId });
}
