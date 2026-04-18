#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// Sales Pipeline MCP Server v3.0 — Supabase Edition
//
// Rewired from Turso/Drizzle to Supabase (service role key).
// Provides 22 tools for managing the sales pipeline via Claude Code.
// ─────────────────────────────────────────────────────────────────────

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../../.env.local") });

// ── Supabase client (service role — bypasses RLS) ───────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Default division for Stannum Can (CA). Override with division_id param.
const DEFAULT_DIVISION_CODE = "CA";
let cachedCaDivisionId = null;

async function getDefaultDivisionId() {
  if (cachedCaDivisionId) return cachedCaDivisionId;
  const { data } = await supabase
    .from("divisions")
    .select("id")
    .eq("code", DEFAULT_DIVISION_CODE)
    .single();
  cachedCaDivisionId = data?.id;
  return cachedCaDivisionId;
}

async function resolveDivisionId(explicit) {
  return explicit || (await getDefaultDivisionId());
}

// User attribution — resolve from USER_EMAIL env or fall back to null
const USER_EMAIL = process.env.USER_EMAIL || "system";
let cachedUserId = null;

async function getUserId() {
  if (cachedUserId) return cachedUserId;
  const { data } = await supabase
    .from("user_profiles")
    .select("user_id")
    .eq("email", USER_EMAIL)
    .single();
  cachedUserId = data?.user_id ?? null;
  return cachedUserId;
}

// ── Audit helper ────────────────────────────────────────────────────

async function recordAudit(tableName, rowId, action, before, after, divisionId, txId) {
  const userId = await getUserId();
  await supabase.from("sales_audit_log").insert({
    division_id: divisionId,
    table_name: tableName,
    row_id: rowId,
    action,
    before_json: before,
    after_json: after,
    changed_by: userId,
    transaction_id: txId || null,
  });
}

// ── Company helpers ─────────────────────────────────────────────────

async function findCompanyByName(name, divisionId) {
  const did = await resolveDivisionId(divisionId);
  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("division_id", did)
    .ilike("name", name)
    .limit(1)
    .single();
  return data;
}

async function findContactByName(companyId, contactName) {
  const { data } = await supabase
    .from("company_contacts")
    .select("*")
    .eq("company_id", companyId)
    .ilike("name", `%${contactName}%`)
    .limit(1)
    .single();
  return data;
}

// ── Pipeline stages & types ─────────────────────────────────────────

const PIPELINE_STAGES = [
  "new", "researching", "contacted", "responded",
  "meeting_booked", "sample_sent", "quoting", "negotiating",
  "won", "lost", "nurture",
];

const ACTIVITY_TYPES = [
  "email_sent", "email_received", "call", "meeting",
  "note", "sample_sent", "linkedin_message",
];

// ── Seasonal calendar ───────────────────────────────────────────────

const SEASONAL_REC = {
  1: "Summer (Jul–Aug shipping) — BBQ, outdoor events, summer candy",
  2: "Back-to-School / Fall (Aug–Sep) — teacher gifts, school fundraisers",
  3: "Halloween / Thanksgiving (Sep–Oct) — seasonal candy tins, fall gifts",
  4: "Christmas / Hanukkah (Sep–Oct delivery) — holiday tins, gift sets, advent",
  5: "Christmas / Hanukkah (Oct–Nov) — final holiday orders",
  6: "Valentine's / Spring (Jan–Feb) — candy hearts, spring gift sets",
  7: "Easter / Mother's Day (Feb–Mar) — spring confectionery, gift tins",
  8: "Easter / Mother's Day (Mar–Apr) — final spring orders",
  9: "Summer / Father's Day (Apr–May) — summer BBQ, grooming tins",
  10: "Summer / Back-to-School (May–Jun) — late summer + early fall planning",
  11: "Fall / Halloween (Jun–Jul) — fall candy, Halloween specials",
  12: "Spring / Valentine's (Jul–Aug) — early spring 2027 planning",
};

// ── Tool definitions ────────────────────────────────────────────────

const TOOLS = [
  {
    name: "add_prospect",
    description: "Add a new company to the sales pipeline",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", description: "Company name" },
        domain: { type: "string", description: "Company website domain" },
        industry: { type: "string" },
        location: { type: "string" },
        employee_count: { type: "number" },
        description: { type: "string" },
        import_data_notes: { type: "string" },
        current_packaging: { type: "string" },
        opportunity_notes: { type: "string" },
        source: { type: "string", enum: ["apollo", "importyeti", "referral", "inbound", "website", "tradeshow", "manual"] },
        division_id: { type: "string", description: "Division UUID (defaults to CA)" },
      },
    },
  },
  {
    name: "update_company",
    description: "Update enrichment fields on an existing company",
    inputSchema: {
      type: "object",
      required: ["company_name"],
      properties: {
        company_name: { type: "string" },
        industry: { type: "string" },
        employee_count: { type: "number" },
        description: { type: "string" },
        import_data_notes: { type: "string" },
        current_packaging: { type: "string" },
        opportunity_notes: { type: "string" },
        location: { type: "string" },
        domain: { type: "string" },
        relevancy_score: { type: "number", description: "0-100" },
        relevancy_reason: { type: "string" },
      },
    },
  },
  {
    name: "add_contact",
    description: "Add a contact person at a company",
    inputSchema: {
      type: "object",
      required: ["company_name", "first_name", "last_name"],
      properties: {
        company_name: { type: "string" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        title: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        linkedin_url: { type: "string" },
        is_primary: { type: "boolean" },
        source: { type: "string", enum: ["apollo", "linkedin", "referral", "inbound", "manual"] },
        apollo_id: { type: "string" },
        email_confidence: { type: "string", enum: ["high", "medium", "low"] },
      },
    },
  },
  {
    name: "update_contact",
    description: "Update a contact's details",
    inputSchema: {
      type: "object",
      required: ["company_name", "contact_name"],
      properties: {
        company_name: { type: "string" },
        contact_name: { type: "string", description: "Partial name match" },
        title: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        linkedin_url: { type: "string" },
        is_primary: { type: "boolean" },
        email_confidence: { type: "string", enum: ["high", "medium", "low"] },
      },
    },
  },
  {
    name: "create_deal",
    description: "Create a deal/opportunity for a company",
    inputSchema: {
      type: "object",
      required: ["company_name"],
      properties: {
        company_name: { type: "string" },
        stage: { type: "string", enum: PIPELINE_STAGES },
        product_interest: { type: "string" },
        estimated_volume: { type: "string" },
        estimated_value: { type: "number" },
        next_action: { type: "string" },
        next_action_date: { type: "string", description: "YYYY-MM-DD" },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "update_deal",
    description: "Update deal stage or details",
    inputSchema: {
      type: "object",
      required: ["company_name"],
      properties: {
        company_name: { type: "string" },
        stage: { type: "string", enum: PIPELINE_STAGES },
        product_interest: { type: "string" },
        estimated_volume: { type: "string" },
        estimated_value: { type: "number" },
        next_action: { type: "string" },
        next_action_date: { type: "string" },
        close_date: { type: "string" },
        loss_reason: { type: "string" },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "log_activity",
    description: "Log a sales activity (email, call, meeting, note, etc.)",
    inputSchema: {
      type: "object",
      required: ["company_name", "type"],
      properties: {
        company_name: { type: "string" },
        contact_name: { type: "string" },
        type: { type: "string", enum: ACTIVITY_TYPES },
        subject: { type: "string" },
        body: { type: "string" },
        outcome: { type: "string", enum: ["positive", "neutral", "negative", "no_response"] },
        follow_up_date: { type: "string", description: "YYYY-MM-DD" },
        personalization_note: { type: "string" },
        recipient_email_confidence: { type: "string", enum: ["high", "medium", "low"] },
        quality_override: { type: "boolean" },
      },
    },
  },
  {
    name: "save_email_draft",
    description: "Save an email draft for human review",
    inputSchema: {
      type: "object",
      required: ["company_name", "subject", "body"],
      properties: {
        company_name: { type: "string" },
        contact_name: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
        personalization_note: { type: "string" },
        prompt_template: { type: "string" },
      },
    },
  },
  {
    name: "add_company_news",
    description: "Record a research finding (news, press release)",
    inputSchema: {
      type: "object",
      required: ["company_name", "headline"],
      properties: {
        company_name: { type: "string" },
        headline: { type: "string" },
        url: { type: "string" },
        source: { type: "string" },
        published_date: { type: "string", description: "YYYY-MM-DD" },
        summary: { type: "string" },
      },
    },
  },
  { name: "daily_briefing", description: "Get your daily sales briefing", inputSchema: { type: "object", properties: {} } },
  {
    name: "search_pipeline",
    description: "Search companies by keyword",
    inputSchema: { type: "object", required: ["query"], properties: { query: { type: "string" } } },
  },
  {
    name: "view_pipeline",
    description: "View all deals at a specific stage",
    inputSchema: { type: "object", required: ["stage"], properties: { stage: { type: "string", enum: PIPELINE_STAGES } } },
  },
  { name: "pipeline_stats", description: "Get pipeline statistics", inputSchema: { type: "object", properties: {} } },
  {
    name: "get_company_contacts",
    description: "List all contacts at a company",
    inputSchema: { type: "object", required: ["company_name"], properties: { company_name: { type: "string" } } },
  },
  {
    name: "log_competitor",
    description: "Log an overseas competitor sighting",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
        country: { type: "string" },
        prospect_name: { type: "string" },
        notes: { type: "string" },
      },
    },
  },
  { name: "list_top_competitors", description: "List top competitors by mentions", inputSchema: { type: "object", properties: {} } },
  {
    name: "list_pending_enrichment",
    description: "List companies awaiting research",
    inputSchema: { type: "object", properties: { limit: { type: "number" } } },
  },
  {
    name: "mark_company_enriched",
    description: "Mark a company's enrichment as complete",
    inputSchema: { type: "object", required: ["company_id"], properties: { company_id: { type: "string" } } },
  },
  {
    name: "mark_company_skipped",
    description: "Mark a company as not worth pursuing",
    inputSchema: { type: "object", required: ["company_id"], properties: { company_id: { type: "string" }, reason: { type: "string" } } },
  },
];

// ── Tool handlers ───────────────────────────────────────────────────

async function handleAddProspect(args) {
  const divisionId = await resolveDivisionId(args.division_id);
  const existing = await findCompanyByName(args.name, divisionId);
  if (existing) return `⚠️ Company "${args.name}" already exists (id: ${existing.id})`;

  const row = {
    division_id: divisionId,
    name: args.name,
    domain: args.domain || null,
    industry: args.industry || null,
    region: args.location || null,
    employee_count: args.employee_count || null,
    description: args.description || null,
    import_data_notes: args.import_data_notes || null,
    current_packaging: args.current_packaging || null,
    opportunity_notes: args.opportunity_notes || null,
    lead_source: args.source || "manual",
    enrichment_status: args.domain ? "pending" : "none",
    country: "CA",
  };

  const { data, error } = await supabase.from("companies").insert(row).select().single();
  if (error) return `Error: ${error.message}`;
  await recordAudit("companies", data.id, "insert", null, data, divisionId);
  return `✅ Added "${args.name}" (id: ${data.id}, status: ${data.enrichment_status})`;
}

async function handleUpdateCompany(args) {
  const company = await findCompanyByName(args.company_name);
  if (!company) return `❌ Company "${args.company_name}" not found`;

  const before = { ...company };
  const changes = {};
  if (args.industry) changes.industry = args.industry;
  if (args.employee_count) changes.employee_count = args.employee_count;
  if (args.description) changes.description = args.description;
  if (args.import_data_notes) changes.import_data_notes = args.import_data_notes;
  if (args.current_packaging) changes.current_packaging = args.current_packaging;
  if (args.opportunity_notes) changes.opportunity_notes = args.opportunity_notes;
  if (args.location) changes.region = args.location;
  if (args.domain) changes.domain = args.domain;
  if (args.relevancy_score != null) {
    changes.relevancy_score = args.relevancy_score;
    changes.relevancy_reason = args.relevancy_reason || null;
    changes.relevancy_updated_at = new Date().toISOString();
  }

  const { data, error } = await supabase.from("companies").update(changes).eq("id", company.id).select().single();
  if (error) return `Error: ${error.message}`;
  await recordAudit("companies", company.id, "update", before, data, company.division_id);
  return `✅ Updated "${args.company_name}" — ${Object.keys(changes).join(", ")}`;
}

async function handleAddContact(args) {
  const company = await findCompanyByName(args.company_name);
  if (!company) return `❌ Company "${args.company_name}" not found`;

  const displayName = `${args.first_name} ${args.last_name}`;
  const row = {
    company_id: company.id,
    name: displayName,
    title: args.title || null,
    email: args.email || null,
    phone: args.phone || null,
    linkedin_url: args.linkedin_url || null,
    is_primary: args.is_primary || false,
    contact_source: args.source || "manual",
    apollo_id: args.apollo_id || null,
    email_confidence: args.email_confidence || null,
  };

  const { data, error } = await supabase.from("company_contacts").insert(row).select().single();
  if (error) return `Error: ${error.message}`;
  await recordAudit("company_contacts", data.id, "insert", null, data, company.division_id);
  return `✅ Added contact ${displayName} at ${args.company_name} (id: ${data.id})`;
}

async function handleUpdateContact(args) {
  const company = await findCompanyByName(args.company_name);
  if (!company) return `❌ Company "${args.company_name}" not found`;
  const contact = await findContactByName(company.id, args.contact_name);
  if (!contact) return `❌ Contact matching "${args.contact_name}" not found at ${args.company_name}`;

  const before = { ...contact };
  const changes = {};
  if (args.title) changes.title = args.title;
  if (args.email) changes.email = args.email;
  if (args.phone) changes.phone = args.phone;
  if (args.linkedin_url) changes.linkedin_url = args.linkedin_url;
  if (args.is_primary != null) changes.is_primary = args.is_primary;
  if (args.email_confidence) changes.email_confidence = args.email_confidence;

  const { data, error } = await supabase.from("company_contacts").update(changes).eq("id", contact.id).select().single();
  if (error) return `Error: ${error.message}`;
  await recordAudit("company_contacts", contact.id, "update", before, data, company.division_id);
  return `✅ Updated ${contact.name} — ${Object.keys(changes).join(", ")}`;
}

async function handleCreateDeal(args) {
  const company = await findCompanyByName(args.company_name);
  if (!company) return `❌ Company "${args.company_name}" not found`;

  const userId = await getUserId();
  const row = {
    company_id: company.id,
    stage: args.stage || "new",
    product_interest: args.product_interest || null,
    estimated_volume: args.estimated_volume || null,
    estimated_value: args.estimated_value || null,
    next_action: args.next_action || null,
    next_action_date: args.next_action_date || null,
    notes: args.notes || null,
    owner_id: userId,
  };

  const { data, error } = await supabase.from("sales_deals").insert(row).select().single();
  if (error) return `Error: ${error.message}`;
  await recordAudit("sales_deals", data.id, "insert", null, data, company.division_id);
  return `✅ Created deal at ${args.company_name} (stage: ${data.stage}, id: ${data.id})`;
}

async function handleUpdateDeal(args) {
  const company = await findCompanyByName(args.company_name);
  if (!company) return `❌ Company "${args.company_name}" not found`;

  const { data: deal } = await supabase
    .from("sales_deals")
    .select("*")
    .eq("company_id", company.id)
    .not("stage", "in", "(won,lost)")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();
  if (!deal) return `❌ No active deal found for ${args.company_name}`;

  const before = { ...deal };
  const changes = {};
  if (args.stage && PIPELINE_STAGES.includes(args.stage)) changes.stage = args.stage;
  if (args.product_interest) changes.product_interest = args.product_interest;
  if (args.estimated_volume) changes.estimated_volume = args.estimated_volume;
  if (args.estimated_value != null) changes.estimated_value = args.estimated_value;
  if (args.next_action) changes.next_action = args.next_action;
  if (args.next_action_date) changes.next_action_date = args.next_action_date;
  if (args.close_date) changes.close_date = args.close_date;
  if (args.loss_reason) changes.loss_reason = args.loss_reason;
  if (args.notes) changes.notes = args.notes;

  const { data, error } = await supabase.from("sales_deals").update(changes).eq("id", deal.id).select().single();
  if (error) return `Error: ${error.message}`;
  await recordAudit("sales_deals", deal.id, "update", before, data, company.division_id);
  return `✅ Updated deal at ${args.company_name} — ${Object.keys(changes).join(", ")}`;
}

async function handleLogActivity(args) {
  const company = await findCompanyByName(args.company_name);
  if (!company) return `❌ Company "${args.company_name}" not found`;

  // Email quality gate
  if (args.type === "email_sent" && !args.quality_override) {
    if (!args.personalization_note || args.personalization_note.length < 15)
      return "❌ email_sent requires personalization_note (≥15 chars). Set quality_override=true to bypass.";
    if (args.body && args.body.length < 50)
      return "❌ Email body too short (min 50 chars)";
  }

  let contactId = null;
  if (args.contact_name) {
    const contact = await findContactByName(company.id, args.contact_name);
    contactId = contact?.id || null;
  }

  const userId = await getUserId();
  const row = {
    company_id: company.id,
    contact_id: contactId,
    type: args.type,
    subject: args.subject || null,
    body: args.body || null,
    outcome: args.outcome || null,
    follow_up_date: args.follow_up_date || null,
    created_by: userId,
  };

  const { data, error } = await supabase.from("sales_activities").insert(row).select().single();
  if (error) return `Error: ${error.message}`;
  await recordAudit("sales_activities", data.id, "insert", null, data, company.division_id);
  return `✅ Logged ${args.type} at ${args.company_name}${args.subject ? `: ${args.subject}` : ""}`;
}

async function handleSaveEmailDraft(args) {
  const company = await findCompanyByName(args.company_name);
  if (!company) return `❌ Company "${args.company_name}" not found`;

  let contactId = null;
  if (args.contact_name) {
    const contact = await findContactByName(company.id, args.contact_name);
    contactId = contact?.id || null;
  }

  const userId = await getUserId();
  const row = {
    company_id: company.id,
    contact_id: contactId,
    subject: args.subject,
    body: args.body,
    status: "draft",
    personalization_note: args.personalization_note || null,
    ai_generated: true,
    prompt_template: args.prompt_template || null,
    created_by: userId,
  };

  const { data, error } = await supabase.from("sales_email_drafts").insert(row).select().single();
  if (error) return `Error: ${error.message}`;
  await recordAudit("sales_email_drafts", data.id, "insert", null, data, company.division_id);
  return `✅ Draft saved for ${args.company_name}: "${args.subject}" (id: ${data.id})`;
}

async function handleAddCompanyNews(args) {
  const company = await findCompanyByName(args.company_name);
  if (!company) return `❌ Company "${args.company_name}" not found`;

  const userId = await getUserId();
  const row = {
    company_id: company.id,
    headline: args.headline,
    url: args.url || null,
    news_source: args.source || null,
    published_date: args.published_date || null,
    summary: args.summary || null,
    added_by: userId,
  };

  const { data, error } = await supabase.from("sales_company_news").insert(row).select().single();
  if (error) return `Error: ${error.message}`;
  await recordAudit("sales_company_news", data.id, "insert", null, data, company.division_id);
  return `✅ News added for ${args.company_name}: "${args.headline}"`;
}

async function handleDailyBriefing() {
  const divisionId = await getDefaultDivisionId();
  const today = new Date().toISOString().split("T")[0];
  const month = new Date().getMonth() + 1;

  // Overdue follow-ups
  const { data: overdue } = await supabase
    .from("sales_activities")
    .select("id, type, subject, follow_up_date, company:companies(name)")
    .eq("division_id", divisionId)
    .lt("follow_up_date", today)
    .not("follow_up_date", "is", null)
    .order("follow_up_date")
    .limit(10);

  // Actions due today
  const { data: dueToday } = await supabase
    .from("sales_deals")
    .select("id, stage, next_action, next_action_date, company:companies(name)")
    .eq("division_id", divisionId)
    .eq("next_action_date", today)
    .limit(10);

  // Pipeline summary
  const { data: deals } = await supabase
    .from("sales_deals")
    .select("stage, estimated_value")
    .eq("division_id", divisionId)
    .not("stage", "in", "(won,lost)");

  const stages = {};
  for (const d of deals || []) {
    if (!stages[d.stage]) stages[d.stage] = { count: 0, value: 0 };
    stages[d.stage].count++;
    stages[d.stage].value += Number(d.estimated_value || 0);
  }

  // Recent activity
  const { data: recent } = await supabase
    .from("sales_activities")
    .select("type, subject, outcome, created_at, company:companies(name)")
    .eq("division_id", divisionId)
    .order("created_at", { ascending: false })
    .limit(5);

  // Pending enrichment
  const { count: pendingCount } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("division_id", divisionId)
    .eq("enrichment_status", "pending");

  let output = `📅 Daily Briefing — ${today}\n\n`;
  output += `🎯 Seasonal Focus: ${SEASONAL_REC[month] || "General prospecting"}\n\n`;

  if (overdue?.length) {
    output += `⏰ Overdue Follow-ups (${overdue.length}):\n`;
    for (const a of overdue) output += `  • ${a.company?.name}: ${a.type} "${a.subject || "—"}" due ${a.follow_up_date}\n`;
    output += "\n";
  }

  if (dueToday?.length) {
    output += `📋 Actions Due Today (${dueToday.length}):\n`;
    for (const d of dueToday) output += `  • ${d.company?.name} [${d.stage}]: ${d.next_action || "—"}\n`;
    output += "\n";
  }

  output += `📊 Pipeline:\n`;
  for (const [stage, info] of Object.entries(stages)) {
    output += `  • ${stage}: ${info.count} deals ($${info.value.toLocaleString()})\n`;
  }
  output += "\n";

  if (recent?.length) {
    output += `🕐 Recent Activity:\n`;
    for (const a of recent) output += `  • ${a.company?.name}: ${a.type} ${a.outcome ? `(${a.outcome})` : ""}\n`;
    output += "\n";
  }

  if (pendingCount > 0) output += `🔬 ${pendingCount} companies pending enrichment\n`;

  return output;
}

async function handleSearchPipeline(args) {
  const divisionId = await getDefaultDivisionId();
  const { data } = await supabase
    .from("companies")
    .select("id, name, domain, industry, relevancy_score, enrichment_status, lead_source")
    .eq("division_id", divisionId)
    .or(`name.ilike.%${args.query}%,domain.ilike.%${args.query}%,industry.ilike.%${args.query}%`)
    .limit(15);

  if (!data?.length) return `No results for "${args.query}"`;
  return data.map((c) => `${c.name} (${c.industry || "?"}) — score: ${c.relevancy_score ?? "?"}, status: ${c.enrichment_status}`).join("\n");
}

async function handleViewPipeline(args) {
  const divisionId = await getDefaultDivisionId();
  const { data } = await supabase
    .from("sales_deals")
    .select("id, stage, estimated_value, next_action, next_action_date, updated_at, company:companies(name)")
    .eq("division_id", divisionId)
    .eq("stage", args.stage)
    .order("updated_at", { ascending: false });

  if (!data?.length) return `No deals in "${args.stage}" stage`;
  return data.map((d) => `${d.company?.name} — $${d.estimated_value || 0} | next: ${d.next_action || "—"} (${d.next_action_date || "no date"})`).join("\n");
}

async function handlePipelineStats() {
  const divisionId = await getDefaultDivisionId();
  const { data: deals } = await supabase
    .from("sales_deals")
    .select("stage, estimated_value")
    .eq("division_id", divisionId);

  const stats = { total: 0, active: 0, won: 0, lost: 0, totalValue: 0, wonValue: 0 };
  for (const d of deals || []) {
    stats.total++;
    const val = Number(d.estimated_value || 0);
    stats.totalValue += val;
    if (d.stage === "won") { stats.won++; stats.wonValue += val; }
    else if (d.stage === "lost") stats.lost++;
    else stats.active++;
  }
  const winRate = stats.won + stats.lost > 0 ? ((stats.won / (stats.won + stats.lost)) * 100).toFixed(1) : "N/A";
  return `Pipeline: ${stats.total} deals | Active: ${stats.active} | Won: ${stats.won} | Lost: ${stats.lost} | Win Rate: ${winRate}% | Total Value: $${stats.totalValue.toLocaleString()} | Won Value: $${stats.wonValue.toLocaleString()}`;
}

async function handleGetCompanyContacts(args) {
  const company = await findCompanyByName(args.company_name);
  if (!company) return `❌ Company "${args.company_name}" not found`;

  const { data } = await supabase
    .from("company_contacts")
    .select("*")
    .eq("company_id", company.id)
    .order("is_primary", { ascending: false });

  if (!data?.length) return `No contacts found at ${args.company_name}`;
  return data.map((c) => {
    const parts = [c.name];
    if (c.title) parts.push(`(${c.title})`);
    if (c.email) parts.push(`<${c.email}>`);
    if (c.email_confidence) parts.push(`[${c.email_confidence}]`);
    if (c.linkedin_url) parts.push(`LinkedIn: ${c.linkedin_url}`);
    if (c.is_primary) parts.push("⭐ PRIMARY");
    return parts.join(" ");
  }).join("\n");
}

async function handleLogCompetitor(args) {
  const divisionId = await getDefaultDivisionId();
  const { data: existing } = await supabase
    .from("sales_competitors")
    .select("id, mention_count, prospect_names")
    .eq("division_id", divisionId)
    .eq("name", args.name)
    .single();

  if (existing) {
    const names = existing.prospect_names ? existing.prospect_names.split("|").map((s) => s.trim()) : [];
    if (args.prospect_name && !names.includes(args.prospect_name)) names.push(args.prospect_name);
    await supabase.from("sales_competitors").update({
      mention_count: (existing.mention_count || 0) + 1,
      last_seen: new Date().toISOString(),
      prospect_names: names.join(" | ") || null,
      country: args.country || undefined,
      notes: args.notes || undefined,
    }).eq("id", existing.id);
    return `✅ Competitor "${args.name}" updated (mentions: ${existing.mention_count + 1})`;
  }

  const { error } = await supabase.from("sales_competitors").insert({
    division_id: divisionId,
    name: args.name,
    country: args.country || null,
    mention_count: 1,
    prospect_names: args.prospect_name || null,
    notes: args.notes || null,
  });
  if (error) return `Error: ${error.message}`;
  return `✅ New competitor logged: "${args.name}"`;
}

async function handleListTopCompetitors() {
  const divisionId = await getDefaultDivisionId();
  const { data } = await supabase
    .from("sales_competitors")
    .select("*")
    .eq("division_id", divisionId)
    .order("mention_count", { ascending: false })
    .limit(20);

  if (!data?.length) return "No competitors tracked yet";
  return data.map((c, i) => `${i + 1}. ${c.name} (${c.country || "?"}) — ${c.mention_count} mentions | Prospects: ${c.prospect_names || "—"}`).join("\n");
}

async function handleListPendingEnrichment(args) {
  const divisionId = await getDefaultDivisionId();
  const { data } = await supabase
    .from("companies")
    .select("id, name, domain, lead_source, created_at")
    .eq("division_id", divisionId)
    .eq("enrichment_status", "pending")
    .not("domain", "is", null)
    .order("created_at")
    .limit(args.limit || 10);

  if (!data?.length) return "No companies pending enrichment";
  return data.map((c) => `• ${c.name} (${c.domain}) — source: ${c.lead_source || "manual"}, id: ${c.id}`).join("\n");
}

async function handleMarkCompanyEnriched(args) {
  const { data, error } = await supabase
    .from("companies")
    .update({ enrichment_status: "enriched" })
    .eq("id", args.company_id)
    .select("name")
    .single();
  if (error) return `Error: ${error.message}`;
  return `✅ ${data.name} marked as enriched`;
}

async function handleMarkCompanySkipped(args) {
  const notes = args.reason ? `Skipped: ${args.reason}` : null;
  const updates = { enrichment_status: "skipped" };
  if (notes) updates.opportunity_notes = notes;
  const { data, error } = await supabase
    .from("companies")
    .update(updates)
    .eq("id", args.company_id)
    .select("name")
    .single();
  if (error) return `Error: ${error.message}`;
  return `✅ ${data.name} marked as skipped${args.reason ? `: ${args.reason}` : ""}`;
}

// ── Prompt loading ──────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const promptsDir = join(__dirname, "../../prompts");
const prompts = [];

try {
  const files = readdirSync(promptsDir).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const text = readFileSync(join(promptsDir, file), "utf-8");
    const argsMatch = [...text.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)];
    const uniqueArgs = [...new Set(argsMatch.map((m) => m[1]))];
    const lines = text.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
    prompts.push({
      name: file.replace(".md", ""),
      text,
      args: uniqueArgs,
      description: (lines[0] || "").slice(0, 200),
    });
  }
} catch {
  // No prompts directory — that's fine
}

function fillPromptTemplate(text, args = {}) {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => args[k] ?? `{{${k}}}`);
}

// ── MCP Server ──────────────────────────────────────────────────────

const server = new Server(
  { name: "pipeline", version: "3.0.0" },
  { capabilities: { tools: {}, prompts: {} } }
);

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: prompts.map((p) => ({
    name: p.name,
    description: p.description,
    arguments: p.args.map((a) => ({ name: a, description: a, required: false })),
  })),
}));

server.setRequestHandler(GetPromptRequestSchema, async (req) => {
  const p = prompts.find((pr) => pr.name === req.params.name);
  if (!p) throw new Error(`Prompt "${req.params.name}" not found`);
  return {
    messages: [{ role: "user", content: { type: "text", text: fillPromptTemplate(p.text, req.params.arguments) } }],
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  let result;

  switch (name) {
    case "add_prospect": result = await handleAddProspect(args); break;
    case "update_company": result = await handleUpdateCompany(args); break;
    case "add_contact": result = await handleAddContact(args); break;
    case "update_contact": result = await handleUpdateContact(args); break;
    case "create_deal": result = await handleCreateDeal(args); break;
    case "update_deal": result = await handleUpdateDeal(args); break;
    case "log_activity": result = await handleLogActivity(args); break;
    case "save_email_draft": result = await handleSaveEmailDraft(args); break;
    case "add_company_news": result = await handleAddCompanyNews(args); break;
    case "daily_briefing": result = await handleDailyBriefing(); break;
    case "search_pipeline": result = await handleSearchPipeline(args); break;
    case "view_pipeline": result = await handleViewPipeline(args); break;
    case "pipeline_stats": result = await handlePipelineStats(); break;
    case "get_company_contacts": result = await handleGetCompanyContacts(args); break;
    case "log_competitor": result = await handleLogCompetitor(args); break;
    case "list_top_competitors": result = await handleListTopCompetitors(); break;
    case "list_pending_enrichment": result = await handleListPendingEnrichment(args); break;
    case "mark_company_enriched": result = await handleMarkCompanyEnriched(args); break;
    case "mark_company_skipped": result = await handleMarkCompanySkipped(args); break;
    default: result = `Unknown tool: ${name}`;
  }

  return { content: [{ type: "text", text: result }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
