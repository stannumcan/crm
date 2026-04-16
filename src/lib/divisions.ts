// ─────────────────────────────────────────────────────────────
// Multi-division types and helpers
//
// Two divisions share the CRM:
//   - Winhoop (JP) — Japan
//   - Stannum Can (CA) — Canada
//
// Most users belong to one division. Cross-division users (accounting,
// admin) belong to multiple. Super-admins bypass the division check
// and see combined data across all divisions.
// ─────────────────────────────────────────────────────────────

export type DivisionCode = "JP" | "CA";

export interface Division {
  id: string;
  code: DivisionCode;
  name: string;
  country: string;
  default_customer_currency: string;
  default_factory_currency: string;
  wire_currency: string;
  wo_prefix: string;
}

export interface UserDivisionContext {
  /** Divisions this user is a member of */
  accessible_divisions: Division[];
  /** Currently selected division — null means "All Divisions" combined view (super-admin only) */
  active_division: Division | null;
  /** Combined dashboard available */
  is_super_admin: boolean;
}

/**
 * Resolve the division a UI action should run against.
 * - Single-division users: their only division
 * - Multi-division users: their selected active division
 * - Super-admin in "All" mode: returns null — caller must handle
 *   (e.g. ask which division to create a WO under)
 */
export function effectiveDivision(ctx: UserDivisionContext | null): Division | null {
  if (!ctx) return null;
  if (ctx.active_division) return ctx.active_division;
  if (ctx.accessible_divisions.length === 1) return ctx.accessible_divisions[0];
  return null;
}

/** Stannum Can pricing modules differ from Winhoop — used to gate the placeholder UI */
export function divisionUsesWinhoopPricing(division: Division | null): boolean {
  return division?.code === "JP";
}
