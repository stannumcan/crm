import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Get the next available chain letter for a given (quotation_id, mold_number).
 * Skips letters used by cancelled chains too — letters never repeat.
 * Returns "A", "B", "C", ... up to "Z".
 */
export async function getNextChainLetter(
  supabase: SupabaseClient,
  quotationId: string,
  moldNumber: string,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("factory_cost_sheets")
    .select("chain_letter")
    .eq("quotation_id", quotationId)
    .eq("mold_number", moldNumber);

  const used = new Set<string>((data ?? []).map((r: { chain_letter: string | null }) => r.chain_letter).filter(Boolean));

  for (let code = 65; code <= 90; code++) {
    const letter = String.fromCharCode(code);
    if (!used.has(letter)) return letter;
  }
  return "A"; // fallback
}

/**
 * Build a factory sheet ref number: {wo_number}-{mold_number}-{chain_letter}
 */
export function buildFactorySheetRef(woNumber: string, moldNumber: string | null, chainLetter: string): string {
  return `${woNumber}-${moldNumber ?? "UNKNOWN"}-${chainLetter}`;
}

/**
 * Generate the next NM (new mould placeholder) number.
 * Format: ML-NM0001, ML-NM0002, etc.
 */
export async function generateNewMoldNumber(supabase: SupabaseClient): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_next_nm_mold_number");
  if (error || !data) {
    // Fallback: timestamp-based
    return `ML-NM${Date.now().toString().slice(-4)}`;
  }
  return data as string;
}
