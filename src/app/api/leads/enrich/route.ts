import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enrichCompany, searchPeople } from "@/lib/apollo-client";
import { auditedUpdate, auditedInsert } from "@/lib/sales-audit";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const companyId = body.company_id;
  if (!companyId) {
    return NextResponse.json({ error: "company_id is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Fetch company
  const { data: company, error: fetchErr } = await sb
    .from("companies")
    .select("id, name, domain, division_id")
    .eq("id", companyId)
    .single();
  if (fetchErr || !company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  if (!company.domain) {
    return NextResponse.json({ error: "Company has no domain set — cannot enrich" }, { status: 400 });
  }

  try {
    // Enrich company via Apollo
    const org = await enrichCompany(company.domain, company.name);
    if (!org) {
      return NextResponse.json({ error: "Apollo returned no data for this domain" }, { status: 404 });
    }

    // Write enriched fields back to companies
    const updates: Record<string, unknown> = {};
    if (org.industry) updates.industry = org.industry;
    if (org.estimated_num_employees) updates.employee_count = org.estimated_num_employees;
    if (org.short_description) updates.description = org.short_description;
    if (org.country) updates.country = org.country;
    if (org.website_url && !company.website) updates.website = org.website_url;
    updates.enrichment_status = "enriched";

    const { data: updated, error: updateErr } = await auditedUpdate(
      sb, "companies", companyId, updates, user.id, company.division_id
    );
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Search for contacts at this company
    const people = await searchPeople({ companyDomain: company.domain, limit: 10 });

    // Insert new contacts
    let contactsAdded = 0;
    for (const person of people) {
      if (!person.first_name && !person.last_name) continue;
      const displayName = [person.first_name, person.last_name].filter(Boolean).join(" ");
      const phone = person.phone_numbers?.[0]?.sanitized_number ?? null;

      const { error: contactErr } = await auditedInsert(
        sb,
        "company_contacts",
        {
          company_id: companyId,
          name: displayName,
          title: person.title,
          email: person.email,
          phone: phone,
          linkedin_url: person.linkedin_url,
          contact_source: "apollo",
          apollo_id: person.id,
          email_confidence: person.email ? "medium" : null,
          is_primary: false,
        },
        user.id,
        company.division_id
      );
      if (!contactErr) contactsAdded++;
    }

    return NextResponse.json({
      company: updated,
      contacts_added: contactsAdded,
      apollo_org: org,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Apollo enrichment failed" },
      { status: 500 }
    );
  }
}
