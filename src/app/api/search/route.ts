import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Global search across quotes, work orders, companies, molds.
// RLS automatically scopes every table query to what the user can see.

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ quotes: [], companies: [], molds: [] });
  }

  const supabase = await createClient();
  const pattern = `%${q}%`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Recognise a quote ref pattern: JP260001-01 or with factory-sheet suffixes
  // (JP260001-01-ML0599-A, .../CC, .../DC, .../CQ). Extract the WO + version.
  const refMatch = q.match(/^([A-Za-z]{2}\d{6})-(\d{1,2})(?:[-/].*)?$/i);
  const refWo = refMatch ? refMatch[1].toUpperCase() : null;
  const refVersion = refMatch ? parseInt(refMatch[2]) : null;

  // Quotes: match on wo_number, project_name, company_name (via join), mold_number
  const [quoteByWo, quoteByMold, quoteByRef, companies, molds] = await Promise.all([
    db
      .from("quotations")
      .select(`
        id, status, mold_number, quote_version,
        work_orders!inner(wo_number, company_name, project_name)
      `)
      .or(
        `wo_number.ilike.${pattern},company_name.ilike.${pattern},project_name.ilike.${pattern}`,
        { foreignTable: "work_orders" },
      )
      .limit(8),
    db
      .from("quotations")
      .select(`
        id, status, mold_number, quote_version,
        work_orders(wo_number, company_name, project_name)
      `)
      .ilike("mold_number", pattern)
      .limit(5),
    // Ref-number lookup: JP260001-01 → find quote with matching WO + version
    refWo && refVersion
      ? db
          .from("quotations")
          .select(`
            id, status, mold_number, quote_version,
            work_orders!inner(wo_number, company_name, project_name)
          `)
          .eq("quote_version", refVersion)
          .ilike("work_orders.wo_number", refWo)
          .limit(3)
      : Promise.resolve({ data: [] }),
    db
      .from("companies")
      .select("id, name, name_ja, country")
      .or(`name.ilike.${pattern},name_ja.ilike.${pattern}`)
      .limit(5),
    db
      .from("molds")
      .select("id, mold_number, category, variant, dimensions")
      .or(`mold_number.ilike.${pattern},category.ilike.${pattern}`)
      .limit(6),
  ]);

  // Dedupe quotes by id (same quote could appear from multiple queries)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quoteMap = new Map<string, any>();
  // Ref matches rank first — exact identifier hits
  for (const row of (quoteByRef.data ?? [])) quoteMap.set(row.id, row);
  for (const row of (quoteByWo.data ?? [])) if (!quoteMap.has(row.id)) quoteMap.set(row.id, row);
  for (const row of (quoteByMold.data ?? [])) if (!quoteMap.has(row.id)) quoteMap.set(row.id, row);

  return NextResponse.json({
    quotes: Array.from(quoteMap.values()).slice(0, 10),
    companies: companies.data ?? [],
    molds: molds.data ?? [],
  });
}
