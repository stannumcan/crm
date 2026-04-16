import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { defaultPermissions } from "@/lib/permissions";
import type { Division } from "@/lib/divisions";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("user_profiles")
    .select("profile_id, display_name, suspended, active_division_id, is_super_admin, permission_profiles(id, name, permissions)")
    .eq("user_id", user.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allProfiles } = await (supabase as any)
    .from("permission_profiles")
    .select("id, name")
    .order("name");

  // Division context: which divisions can this user access, and which is active.
  // Super-admins see all divisions. Other users see only their user_divisions rows.
  const isSuperAdmin = profile?.is_super_admin === true;

  let accessibleDivisions: Division[] = [];
  if (isSuperAdmin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("divisions")
      .select("id, code, name, country, default_customer_currency, default_factory_currency, wire_currency, wo_prefix")
      .order("code");
    accessibleDivisions = (data ?? []) as Division[];
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("user_divisions")
      .select("division:divisions(id, code, name, country, default_customer_currency, default_factory_currency, wire_currency, wo_prefix)")
      .eq("user_id", user.id);
    accessibleDivisions = (data ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((row: any) => row.division)
      .filter(Boolean) as Division[];
  }

  // Active division: stored on user_profiles. Falls back to first accessible.
  // Super-admin can have null active_division_id (meaning "All Divisions" combined view).
  let activeDivision: Division | null = null;
  if (profile?.active_division_id) {
    activeDivision = accessibleDivisions.find((d) => d.id === profile.active_division_id) ?? null;
  }
  if (!activeDivision && !isSuperAdmin && accessibleDivisions.length > 0) {
    activeDivision = accessibleDivisions[0];
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
    },
    profile: profile ?? null,
    permissions: profile?.permission_profiles?.permissions ?? defaultPermissions(),
    allProfiles: allProfiles ?? [],
    division: {
      accessible_divisions: accessibleDivisions,
      active_division: activeDivision,
      is_super_admin: isSuperAdmin,
    },
  });
}
