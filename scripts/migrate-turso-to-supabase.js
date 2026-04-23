#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// One-time data migration: Turso (sales-assistant) → Supabase (CRM)
//
// Reads companies, contacts, deals, activities, email_drafts,
// company_news, and competitors from Turso and inserts into Supabase.
//
// Usage:
//   node scripts/migrate-turso-to-supabase.js
//
// Requires env vars from both projects:
//   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN (from sales-assistant/.env)
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env.local)
// ─────────────────────────────────────────────────────────────────────

import { createClient as createTurso } from "@libsql/client";
import { createClient as createSupabase } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load both env files
dotenv.config({ path: resolve(__dirname, "../.env.local") });
dotenv.config({ path: resolve(__dirname, "../../sales-assistant/.env") });

// ── Clients ─────────────────────────────────────────────────────────

const turso = createTurso({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const supabase = createSupabase(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Resolve CA division ID ──────────────────────────────────────────

async function getCaDivisionId() {
  const { data } = await supabase
    .from("divisions")
    .select("id")
    .eq("code", "CA")
    .single();
  if (!data) throw new Error("CA division not found in Supabase");
  return data.id;
}

// ── Helpers ─────────────────────────────────────────────────────────

async function tursoQuery(sql) {
  const result = await turso.execute(sql);
  return result.rows;
}

// Map old integer IDs to new UUIDs
const companyIdMap = new Map(); // old int → new uuid
const contactIdMap = new Map();
const dealIdMap = new Map();

let inserted = { companies: 0, contacts: 0, deals: 0, activities: 0, drafts: 0, news: 0, competitors: 0 };

// ── Migrate companies ───────────────────────────────────────────────

async function migrateCompanies(divisionId) {
  const rows = await tursoQuery("SELECT * FROM companies ORDER BY id");
  console.log(`\nCompanies: ${rows.length} to migrate`);

  for (const row of rows) {
    // Check if company already exists by name in this division
    const { data: existing } = await supabase
      .from("companies")
      .select("id")
      .eq("division_id", divisionId)
      .ilike("name", row.name)
      .limit(1)
      .single();

    if (existing) {
      // Update existing company with enrichment fields
      companyIdMap.set(row.id, existing.id);
      const updates = {};
      if (row.domain) updates.domain = row.domain;
      if (row.industry) updates.industry = row.industry;
      if (row.employee_count) updates.employee_count = row.employee_count;
      if (row.description) updates.description = row.description;
      if (row.import_data_notes) updates.import_data_notes = row.import_data_notes;
      if (row.current_packaging) updates.current_packaging = row.current_packaging;
      if (row.opportunity_notes) updates.opportunity_notes = row.opportunity_notes;
      if (row.source) updates.lead_source = row.source;
      if (row.relevancy_score != null) updates.relevancy_score = row.relevancy_score;
      if (row.relevancy_reason) updates.relevancy_reason = row.relevancy_reason;
      if (row.relevancy_updated_at) updates.relevancy_updated_at = row.relevancy_updated_at;
      updates.enrichment_status = row.enrichment_status || "enriched";

      if (Object.keys(updates).length > 0) {
        await supabase.from("companies").update(updates).eq("id", existing.id);
      }
      console.log(`  ↻ Updated existing: ${row.name}`);
      inserted.companies++;
      continue;
    }

    // Insert new company
    const { data, error } = await supabase
      .from("companies")
      .insert({
        division_id: divisionId,
        name: row.name,
        domain: row.domain || null,
        industry: row.industry || null,
        region: row.location || null,
        employee_count: row.employee_count || null,
        description: row.description || null,
        import_data_notes: row.import_data_notes || null,
        current_packaging: row.current_packaging || null,
        opportunity_notes: row.opportunity_notes || null,
        lead_source: row.source || "manual",
        relevancy_score: row.relevancy_score || null,
        relevancy_reason: row.relevancy_reason || null,
        relevancy_updated_at: row.relevancy_updated_at || null,
        enrichment_status: row.enrichment_status || "enriched",
        country: "CA",
        is_active: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error(`  ✗ ${row.name}: ${error.message}`);
      continue;
    }
    companyIdMap.set(row.id, data.id);
    console.log(`  ✓ ${row.name} (${row.id} → ${data.id})`);
    inserted.companies++;
  }
}

// ── Migrate contacts ────────────────────────────────────────────────

async function migrateContacts() {
  const rows = await tursoQuery("SELECT * FROM contacts ORDER BY id");
  console.log(`\nContacts: ${rows.length} to migrate`);

  for (const row of rows) {
    const companyId = companyIdMap.get(row.company_id);
    if (!companyId) {
      console.log(`  ⊘ Skipped (no company mapping): ${row.first_name} ${row.last_name}`);
      continue;
    }

    const displayName = [row.first_name, row.last_name].filter(Boolean).join(" ") || "Unknown";

    const { data, error } = await supabase
      .from("company_contacts")
      .insert({
        company_id: companyId,
        name: displayName,
        title: row.title || null,
        email: row.email || null,
        phone: row.phone || null,
        linkedin_url: row.linkedin_url || null,
        is_primary: row.is_primary === 1 || row.is_primary === true,
        contact_source: row.source || "manual",
        apollo_id: row.apollo_id || null,
        email_confidence: row.email_confidence || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error(`  ✗ ${displayName}: ${error.message}`);
      continue;
    }
    contactIdMap.set(row.id, data.id);
    console.log(`  ✓ ${displayName} (${row.id} → ${data.id})`);
    inserted.contacts++;
  }
}

// ── Migrate deals ───────────────────────────────────────────────────

async function migrateDeals() {
  const rows = await tursoQuery("SELECT * FROM deals ORDER BY id");
  console.log(`\nDeals: ${rows.length} to migrate`);

  for (const row of rows) {
    const companyId = companyIdMap.get(row.company_id);
    if (!companyId) {
      console.log(`  ⊘ Skipped (no company mapping): deal #${row.id}`);
      continue;
    }

    const contactId = row.contact_id ? contactIdMap.get(row.contact_id) : null;

    const { data, error } = await supabase
      .from("sales_deals")
      .insert({
        company_id: companyId,
        contact_id: contactId || null,
        stage: row.stage || "new",
        product_interest: row.product_interest || null,
        estimated_volume: row.estimated_volume || null,
        estimated_value: row.estimated_value || null,
        next_action: row.next_action || null,
        next_action_date: row.next_action_date || null,
        close_date: row.close_date || null,
        loss_reason: row.loss_reason || null,
        notes: row.notes || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error(`  ✗ deal #${row.id}: ${error.message}`);
      continue;
    }
    dealIdMap.set(row.id, data.id);
    console.log(`  ✓ deal #${row.id} [${row.stage}] (→ ${data.id})`);
    inserted.deals++;
  }
}

// ── Migrate activities ──────────────────────────────────────────────

async function migrateActivities() {
  const rows = await tursoQuery("SELECT * FROM activities ORDER BY id");
  console.log(`\nActivities: ${rows.length} to migrate`);

  for (const row of rows) {
    const companyId = companyIdMap.get(row.company_id);
    if (!companyId) continue;

    const contactId = row.contact_id ? contactIdMap.get(row.contact_id) : null;
    const dealId = row.deal_id ? dealIdMap.get(row.deal_id) : null;

    const { error } = await supabase
      .from("sales_activities")
      .insert({
        company_id: companyId,
        contact_id: contactId || null,
        deal_id: dealId || null,
        type: row.type,
        subject: row.subject || null,
        body: row.body || null,
        outcome: row.outcome || null,
        follow_up_date: row.follow_up_date || null,
      });

    if (error) {
      console.error(`  ✗ activity #${row.id}: ${error.message}`);
      continue;
    }
    console.log(`  ✓ ${row.type} at company ${row.company_id}`);
    inserted.activities++;
  }
}

// ── Migrate email drafts ────────────────────────────────────────────

async function migrateEmailDrafts() {
  const rows = await tursoQuery("SELECT * FROM email_drafts ORDER BY id");
  console.log(`\nEmail Drafts: ${rows.length} to migrate`);

  for (const row of rows) {
    const companyId = companyIdMap.get(row.company_id);
    if (!companyId) continue;

    const contactId = row.contact_id ? contactIdMap.get(row.contact_id) : null;

    const { error } = await supabase
      .from("sales_email_drafts")
      .insert({
        company_id: companyId,
        contact_id: contactId || null,
        subject: row.subject || null,
        body: row.body || null,
        status: row.status || "draft",
        personalization_note: row.personalization_note || null,
        ai_generated: row.ai_generated === 1 || row.ai_generated === true,
        prompt_template: row.prompt_template || null,
      });

    if (error) {
      console.error(`  ✗ draft #${row.id}: ${error.message}`);
      continue;
    }
    console.log(`  ✓ "${row.subject}"`);
    inserted.drafts++;
  }
}

// ── Migrate company news ────────────────────────────────────────────

async function migrateCompanyNews() {
  const rows = await tursoQuery("SELECT * FROM company_news ORDER BY id");
  console.log(`\nCompany News: ${rows.length} to migrate`);

  for (const row of rows) {
    const companyId = companyIdMap.get(row.company_id);
    if (!companyId) continue;

    const { error } = await supabase
      .from("sales_company_news")
      .insert({
        company_id: companyId,
        headline: row.headline,
        url: row.url || null,
        news_source: row.source || null,
        published_date: row.published_date || null,
        summary: row.summary || null,
      });

    if (error) {
      console.error(`  ✗ news #${row.id}: ${error.message}`);
      continue;
    }
    console.log(`  ✓ "${row.headline}"`);
    inserted.news++;
  }
}

// ── Migrate competitors ─────────────────────────────────────────────

async function migrateCompetitors(divisionId) {
  const rows = await tursoQuery("SELECT * FROM competitors ORDER BY id");
  console.log(`\nCompetitors: ${rows.length} to migrate`);

  for (const row of rows) {
    const { error } = await supabase
      .from("sales_competitors")
      .insert({
        division_id: divisionId,
        name: row.name,
        country: row.country || null,
        mention_count: row.mention_count || 0,
        prospect_names: row.prospect_names || null,
        notes: row.notes || null,
      });

    if (error) {
      console.error(`  ✗ ${row.name}: ${error.message}`);
      continue;
    }
    console.log(`  ✓ ${row.name} (${row.mention_count} mentions)`);
    inserted.competitors++;
  }
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Turso → Supabase Data Migration");
  console.log("═══════════════════════════════════════════════════");

  const divisionId = await getCaDivisionId();
  console.log(`CA division ID: ${divisionId}`);

  await migrateCompanies(divisionId);
  await migrateContacts();
  await migrateDeals();
  await migrateActivities();
  await migrateEmailDrafts();
  await migrateCompanyNews();
  await migrateCompetitors(divisionId);

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Migration Summary");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Companies:   ${inserted.companies}`);
  console.log(`  Contacts:    ${inserted.contacts}`);
  console.log(`  Deals:       ${inserted.deals}`);
  console.log(`  Activities:  ${inserted.activities}`);
  console.log(`  Drafts:      ${inserted.drafts}`);
  console.log(`  News:        ${inserted.news}`);
  console.log(`  Competitors: ${inserted.competitors}`);
  console.log("═══════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
