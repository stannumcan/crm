import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchImportersByHsCode } from "@/lib/importyeti-client";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.hs_code?.trim()) {
    return NextResponse.json({ error: "hs_code is required" }, { status: 400 });
  }

  try {
    const result = await searchImportersByHsCode({
      hsCode: body.hs_code,
      supplierCountry: body.supplier_country,
      productDescription: body.product_description,
      startDate: body.start_date,
      endDate: body.end_date,
      pageSize: body.page_size,
      page: body.page,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ImportYeti search failed" },
      { status: 500 }
    );
  }
}
