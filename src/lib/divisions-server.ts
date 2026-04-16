// Server-only helpers for resolving the user's active division.
//
// Use in API routes that need to set division_id on a top-level
// table (work_orders, companies). Child tables get division_id
// automatically via the BEFORE INSERT triggers in migration 015.

import { createClient } from "@/lib/supabase/server";

export interface ActiveDivisionResult {
  divisionId: string | null;
  isSuperAdmin: boolean;
  /** Number of divisions the user can access (used to detect ambiguity) */
  membershipCount: number;
}

/**
 * Look up the user's active_division_id. Falls back to the user's
 * single membership if active is null. Returns null only when:
 *   - user is super-admin in combined view (active_division_id is null)
 *   - user has multiple memberships and none is active
 *
 * In those cases the caller should require an explicit division_id
 * in the request body and reject with 400 if it's missing.
 */
export async function resolveActiveDivision(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<ActiveDivisionResult> {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("active_division_id, is_super_admin")
    .eq("user_id", userId)
    .single();

  let divisionId: string | null = profile?.active_division_id ?? null;
  const isSuperAdmin = profile?.is_super_admin === true;

  // If no active set, see if the user has only one membership we can use
  const { data: memberships } = await supabase
    .from("user_divisions")
    .select("division_id")
    .eq("user_id", userId);

  const membershipCount = (memberships ?? []).length;

  if (!divisionId && !isSuperAdmin && membershipCount === 1) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    divisionId = (memberships as any)[0].division_id;
  }

  return { divisionId, isSuperAdmin, membershipCount };
}

/**
 * Convenience: resolve the division id, preferring an explicit value
 * from the request body. Returns the id or null if it cannot be
 * unambiguously determined.
 */
export async function pickDivisionId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  explicit?: string | null
): Promise<string | null> {
  if (explicit) return explicit;
  const { divisionId } = await resolveActiveDivision(supabase, userId);
  return divisionId;
}
