// Helpers for displaying factory-sheet printing specs in compact UI badges.

export interface PrintingLine {
  surface?: string | null; // "outside" | "inside"
  part?: string | null;    // "lid" | "body" | "lid_body_bottom" | etc.
  spec?: string | null;    // freeform — e.g. "Whitex2 + 1PMS + CMYK + Glossy"
}

/**
 * Return a short, distinctive summary of the print specs — designed for the
 * sheet-picker badges on the cost-calc / DDP-calc / customer-quote pages.
 *
 * Goal: when two factory sheets share the same mould number, this string
 * should make it obvious which is which. Showing the spec text alone is the
 * most distinctive signal.
 */
export function summarisePrintingSpec(lines: PrintingLine[] | null | undefined, opts: { maxChars?: number } = {}): string | null {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  const specs = lines.map((l) => (l?.spec ?? "").trim()).filter(Boolean);
  if (specs.length === 0) return null;
  const maxChars = opts.maxChars ?? 60;
  // Single line — show as-is, truncated if needed
  if (specs.length === 1) return truncate(specs[0], maxChars);
  // Multi-line — join with " · ", truncate the joined string
  return truncate(specs.join(" · "), maxChars);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}
