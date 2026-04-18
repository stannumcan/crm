#!/usr/bin/env npx tsx
// ─────────────────────────────────────────────────────────────────────
// Sales Daily Cron Job
//
// Runs daily via Windows Task Scheduler (or manually).
// Processes pending lead enrichment using Apollo API + Haiku AI.
//
// Usage:
//   npx tsx scripts/sales-daily-cron.ts
//
// Required env vars (from .env.local):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   APOLLO_API_KEY
//   ANTHROPIC_API_KEY
// ─────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { SCORING_SYSTEM_PROMPT, EMAIL_DRAFT_SYSTEM_PROMPT } from "./sales-cron-prompts.js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(import.meta.dirname ?? ".", "../.env.local") });

const BATCH_SIZE = 10;

// ── Init clients ────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const anthropic = new Anthropic();

// ── Apollo helpers (inline to avoid import path issues) ─────────────

async function apolloEnrich(domain: string) {
  const res = await fetch("https://api.apollo.io/v1/organizations/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.APOLLO_API_KEY! },
    body: JSON.stringify({ domain }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.organization ?? null;
}

async function apolloSearchPeople(domain: string) {
  const res = await fetch("https://api.apollo.io/v1/mixed_people/api_search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.APOLLO_API_KEY! },
    body: JSON.stringify({
      q_organization_domains_list: [domain],
      person_titles: [
        "Packaging Manager", "Procurement Manager", "Purchasing Manager",
        "Brand Manager", "VP Operations", "Director of Packaging",
        "Creative Director", "Product Development",
      ],
      page: 1,
      per_page: 10,
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.people ?? [];
}

// ── Audit helper ────────────────────────────────────────────────────

async function recordAudit(tableName: string, rowId: string, action: string, before: unknown, after: unknown, divisionId: string) {
  await supabase.from("sales_audit_log").insert({
    division_id: divisionId,
    table_name: tableName,
    row_id: rowId,
    action,
    before_json: before,
    after_json: after,
    changed_by: null, // cron job — no user session
  });
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log(`[${new Date().toISOString()}] Sales daily cron starting...`);

  // Fetch pending companies
  const { data: pending, error } = await supabase
    .from("companies")
    .select("id, name, domain, industry, description, employee_count, division_id")
    .eq("enrichment_status", "pending")
    .not("domain", "is", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("Failed to fetch pending companies:", error.message);
    process.exit(1);
  }

  if (!pending?.length) {
    console.log("No companies pending enrichment. Done.");
    return;
  }

  console.log(`Processing ${pending.length} companies...`);

  let enriched = 0;
  let contactsAdded = 0;
  let scored = 0;
  let drafted = 0;

  for (const company of pending) {
    try {
      console.log(`\n--- ${company.name} (${company.domain}) ---`);

      // 1. Apollo enrichment
      if (process.env.APOLLO_API_KEY) {
        const org = await apolloEnrich(company.domain);
        if (org) {
          const updates: Record<string, unknown> = {};
          if (org.industry) updates.industry = org.industry;
          if (org.estimated_num_employees) updates.employee_count = org.estimated_num_employees;
          if (org.short_description) updates.description = org.short_description;
          if (org.country) updates.country = org.country;

          if (Object.keys(updates).length > 0) {
            const before = { ...company };
            await supabase.from("companies").update(updates).eq("id", company.id);
            Object.assign(company, updates); // merge for scoring below
            await recordAudit("companies", company.id, "update", before, { ...company, ...updates }, company.division_id);
            console.log(`  Enriched: ${Object.keys(updates).join(", ")}`);
          }
        }

        // 2. Apollo contact search
        const people = await apolloSearchPeople(company.domain);
        for (const person of people) {
          if (!person.first_name && !person.last_name) continue;
          const displayName = [person.first_name, person.last_name].filter(Boolean).join(" ");
          const phone = person.phone_numbers?.[0]?.sanitized_number ?? null;

          const { data: contact, error: contactErr } = await supabase
            .from("company_contacts")
            .insert({
              company_id: company.id,
              name: displayName,
              title: person.title || null,
              email: person.email || null,
              phone,
              linkedin_url: person.linkedin_url || null,
              contact_source: "apollo",
              apollo_id: person.id || null,
              email_confidence: person.email ? "medium" : null,
              is_primary: false,
            })
            .select()
            .single();

          if (!contactErr && contact) {
            await recordAudit("company_contacts", contact.id, "insert", null, contact, company.division_id);
            contactsAdded++;
          }
        }
        console.log(`  Contacts: ${people.length} found, added to DB`);
      }

      // 3. Haiku relevancy scoring
      const profile = [
        `Company: ${company.name}`,
        company.domain ? `Domain: ${company.domain}` : null,
        company.industry ? `Industry: ${company.industry}` : null,
        company.employee_count ? `Employees: ${company.employee_count}` : null,
        company.description ? `Description: ${company.description}` : null,
      ].filter(Boolean).join("\n");

      const scoreMsg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system: [{ type: "text", text: SCORING_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: `Score this prospect:\n\n${profile}` }],
      });

      const scoreText = scoreMsg.content[0].type === "text" ? scoreMsg.content[0].text : "";
      try {
        const parsed = JSON.parse(scoreText.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
        const score = Math.min(100, Math.max(0, Math.round(Number(parsed.score))));
        const reason = String(parsed.reason || "").slice(0, 500);

        await supabase.from("companies").update({
          relevancy_score: score,
          relevancy_reason: reason,
          relevancy_updated_at: new Date().toISOString(),
        }).eq("id", company.id);

        console.log(`  Score: ${score} — ${reason}`);
        scored++;
      } catch {
        console.log(`  Score: failed to parse response`);
      }

      // 4. Haiku email draft
      const draftMsg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: [{ type: "text", text: EMAIL_DRAFT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: `Draft a cold email for:\n\n${profile}` }],
      });

      const draftText = draftMsg.content[0].type === "text" ? draftMsg.content[0].text : "";
      try {
        const draft = JSON.parse(draftText.replace(/```json?\n?/g, "").replace(/```/g, "").trim());

        const { data: draftRow } = await supabase
          .from("sales_email_drafts")
          .insert({
            company_id: company.id,
            subject: draft.subject,
            body: draft.body,
            status: "draft",
            personalization_note: draft.personalization_note,
            ai_generated: true,
            prompt_template: "cold-email-draft",
          })
          .select()
          .single();

        if (draftRow) {
          await recordAudit("sales_email_drafts", draftRow.id, "insert", null, draftRow, company.division_id);
          console.log(`  Draft: "${draft.subject}"`);
          drafted++;
        }
      } catch {
        console.log(`  Draft: failed to parse response`);
      }

      // 5. Mark enriched
      await supabase.from("companies").update({ enrichment_status: "enriched" }).eq("id", company.id);
      enriched++;

    } catch (err) {
      console.error(`  Error processing ${company.name}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\n✅ Done. Enriched: ${enriched}, Contacts: ${contactsAdded}, Scored: ${scored}, Drafted: ${drafted}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
