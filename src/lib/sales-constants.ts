import type { PipelineStage, ActivityType, ActivityOutcome, LeadSource } from "@/lib/supabase/types";

// ── Pipeline stages (ordered) ────────────────────────────────────────────────

export const PIPELINE_STAGES: { value: PipelineStage; label: string }[] = [
  { value: "new",            label: "New" },
  { value: "researching",    label: "Researching" },
  { value: "contacted",      label: "Contacted" },
  { value: "responded",      label: "Responded" },
  { value: "meeting_booked", label: "Meeting Booked" },
  { value: "sample_sent",    label: "Sample Sent" },
  { value: "quoting",        label: "Quoting" },
  { value: "negotiating",    label: "Negotiating" },
  { value: "won",            label: "Won" },
  { value: "lost",           label: "Lost" },
  { value: "nurture",        label: "Nurture" },
];

export const ACTIVE_STAGES: PipelineStage[] = [
  "new", "researching", "contacted", "responded",
  "meeting_booked", "sample_sent", "quoting", "negotiating",
];

// ── Activity types ───────────────────────────────────────────────────────���───

export const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: "email_sent",       label: "Email Sent" },
  { value: "email_received",   label: "Email Received" },
  { value: "call",             label: "Call" },
  { value: "meeting",          label: "Meeting" },
  { value: "note",             label: "Note" },
  { value: "sample_sent",      label: "Sample Sent" },
  { value: "linkedin_message", label: "LinkedIn Message" },
];

export const ACTIVITY_OUTCOMES: { value: ActivityOutcome; label: string }[] = [
  { value: "positive",    label: "Positive" },
  { value: "neutral",     label: "Neutral" },
  { value: "negative",    label: "Negative" },
  { value: "no_response", label: "No Response" },
];

// ── Lead sources ─────────────────────────────────────────────────────────────

export const LEAD_SOURCES: { value: LeadSource; label: string }[] = [
  { value: "apollo",      label: "Apollo" },
  { value: "importyeti",  label: "ImportYeti" },
  { value: "referral",    label: "Referral" },
  { value: "inbound",     label: "Inbound" },
  { value: "website",     label: "Website" },
  { value: "tradeshow",   label: "Trade Show" },
  { value: "manual",      label: "Manual" },
];

// ── Email quality gate ───────────────────────────────────────────────────────

export const EMAIL_QUALITY_RULES = {
  minPersonalizationLength: 15,
  minBodyLength: 50,
  blockedConfidences: ["low"] as const,
};

// ── Seasonal calendar (6-12 month lead time) ─────────────────────────────────

export const SEASONAL_CALENDAR: Record<number, { season: string; focus: string }> = {
  1:  { season: "Summer",                   focus: "July/August shipping — BBQ, outdoor events, summer candy" },
  2:  { season: "Back-to-School / Fall",     focus: "August–September — teacher gifts, school fundraisers" },
  3:  { season: "Halloween / Thanksgiving",  focus: "September–October — seasonal candy tins, fall gifts" },
  4:  { season: "Christmas / Hanukkah",      focus: "September–October delivery — holiday tins, gift sets, advent" },
  5:  { season: "Christmas / Hanukkah",      focus: "October–November delivery — final holiday orders" },
  6:  { season: "Valentine's / Spring",      focus: "January–February — candy hearts, spring gift sets" },
  7:  { season: "Easter / Mother's Day",     focus: "February–March — spring confectionery, gift tins" },
  8:  { season: "Easter / Mother's Day",     focus: "March–April — final spring orders" },
  9:  { season: "Summer / Father's Day",     focus: "April–May — summer BBQ, beverage, grooming tins" },
  10: { season: "Summer / Back-to-School",   focus: "May–June — late summer + early fall planning" },
  11: { season: "Fall / Halloween",          focus: "June–July — fall candy, Halloween specials" },
  12: { season: "Spring / Valentine's",      focus: "July–August — early spring 2027 planning, Valentine's" },
};

export function getCurrentSeasonalFocus(): { season: string; focus: string } {
  const month = new Date().getMonth() + 1;
  return SEASONAL_CALENDAR[month];
}

// ── Stale lead thresholds ────────────────────────────────────────────────────

export const STALE_THRESHOLD_DAYS = 14;
export const STALE_STAGES: PipelineStage[] = ["contacted", "responded", "meeting_booked"];
