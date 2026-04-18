// Server-side helper for recording mutations to the sales_audit_log.
// Wraps Supabase inserts with before/after snapshots.

import type { Json } from "@/lib/supabase/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

interface AuditEntry {
  table_name: string;
  row_id: string;
  action: "insert" | "update" | "delete" | "revert";
  before_json?: Json | null;
  after_json?: Json | null;
  changed_by: string | null;
  division_id: string;
  transaction_id?: string;
}

export async function recordSalesAudit(
  supabase: SupabaseClient,
  entry: AuditEntry
): Promise<void> {
  const { error } = await supabase.from("sales_audit_log").insert({
    table_name: entry.table_name,
    row_id: entry.row_id,
    action: entry.action,
    before_json: entry.before_json ?? null,
    after_json: entry.after_json ?? null,
    changed_by: entry.changed_by,
    division_id: entry.division_id,
    transaction_id: entry.transaction_id ?? null,
  });
  if (error) {
    console.error("Failed to record sales audit:", error.message);
  }
}

export async function snapshotRow(
  supabase: SupabaseClient,
  table: string,
  rowId: string
): Promise<Json | null> {
  const { data } = await supabase.from(table).select("*").eq("id", rowId).single();
  return (data as Json) ?? null;
}

export async function auditedInsert(
  supabase: SupabaseClient,
  table: string,
  row: Record<string, unknown>,
  userId: string | null,
  divisionId: string,
  transactionId?: string
): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (!error && data) {
    await recordSalesAudit(supabase, {
      table_name: table,
      row_id: (data as Record<string, unknown>).id as string,
      action: "insert",
      before_json: null,
      after_json: data as Json,
      changed_by: userId,
      division_id: divisionId,
      transaction_id: transactionId,
    });
  }
  return { data, error };
}

export async function auditedUpdate(
  supabase: SupabaseClient,
  table: string,
  rowId: string,
  changes: Record<string, unknown>,
  userId: string | null,
  divisionId: string,
  transactionId?: string
): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
  const before = await snapshotRow(supabase, table, rowId);
  const { data, error } = await supabase
    .from(table)
    .update(changes)
    .eq("id", rowId)
    .select()
    .single();
  if (!error && data) {
    await recordSalesAudit(supabase, {
      table_name: table,
      row_id: rowId,
      action: "update",
      before_json: before,
      after_json: data as Json,
      changed_by: userId,
      division_id: divisionId,
      transaction_id: transactionId,
    });
  }
  return { data, error };
}

export async function auditedDelete(
  supabase: SupabaseClient,
  table: string,
  rowId: string,
  userId: string | null,
  divisionId: string,
  transactionId?: string
): Promise<{ error: { message: string } | null }> {
  const before = await snapshotRow(supabase, table, rowId);
  const { error } = await supabase.from(table).delete().eq("id", rowId);
  if (!error) {
    await recordSalesAudit(supabase, {
      table_name: table,
      row_id: rowId,
      action: "delete",
      before_json: before,
      after_json: null,
      changed_by: userId,
      division_id: divisionId,
      transaction_id: transactionId,
    });
  }
  return { error };
}
