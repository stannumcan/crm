import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Get the next version number for a given entity filter.
 */
export async function getNextVersion(
  supabase: SupabaseClient,
  table: string,
  filters: Record<string, string | number | boolean>,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any).from(table).select("version").order("version", { ascending: false }).limit(1);
  for (const [col, val] of Object.entries(filters)) {
    query = query.eq(col, val);
  }
  const { data } = await query;
  const maxVersion = data?.[0]?.version ?? 0;
  return maxVersion + 1;
}

/**
 * Mark all current rows matching the filter as superseded.
 */
export async function supersedeCurrent(
  supabase: SupabaseClient,
  table: string,
  filters: Record<string, string | number | boolean>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any).from(table).update({
    is_current: false,
    superseded_at: new Date().toISOString(),
  });
  for (const [col, val] of Object.entries(filters)) {
    query = query.eq(col, val);
  }
  query = query.eq("is_current", true);
  await query;
}

/**
 * Log a change to the workflow_change_log table.
 */
export async function logChange(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
  version: number,
  action: "created" | "edited" | "approved" | "superseded",
  changedBy: string | null,
  snapshot: Record<string, unknown> | null,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("workflow_change_log").insert({
    entity_type: entityType,
    entity_id: entityId,
    version,
    action,
    changed_by: changedBy,
    snapshot,
  });
}

/**
 * Check if a downstream entity is stale relative to its upstream.
 * Returns { isStale, currentUpstreamVersion }.
 */
export async function checkStale(
  supabase: SupabaseClient,
  upstreamTable: string,
  upstreamFilters: Record<string, string | number | boolean>,
  basedOnVersion: number | null,
): Promise<{ isStale: boolean; currentUpstreamVersion: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any).from(upstreamTable).select("version").eq("is_current", true).limit(1);
  for (const [col, val] of Object.entries(upstreamFilters)) {
    query = query.eq(col, val);
  }
  const { data } = await query;
  const currentVersion = data?.[0]?.version ?? 1;
  return {
    isStale: basedOnVersion != null && basedOnVersion < currentVersion,
    currentUpstreamVersion: currentVersion,
  };
}
