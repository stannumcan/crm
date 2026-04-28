// One-off script to create the manual-bot test user.
// Idempotent: if the user already exists, regenerates a fresh password and
// re-saves to .env.local.manual.
//
// Run: node scripts/manuals/setup-test-user.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..");

// ── Load env ──────────────────────────────────────────────────────────
function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}
const env = loadEnv(resolve(ROOT, ".env.local"));
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// ── Config ────────────────────────────────────────────────────────────
const TEST_EMAIL = "manual-bot@stannumcan.ca";
const ADMIN_PROFILE_ID = "ec8b9657-def4-4af5-8f93-1d9c45162fd4"; // 'admin' permission profile
const DIVISIONS = [
  { id: "2d7830fe-917b-4f90-96d0-6d6ed92d9a13", code: "JP" }, // Winhoop (primary)
  { id: "255a0aea-ded4-4dbb-86d5-a18658aaad89", code: "CA" }, // Stannum Can
];
const PRIMARY_DIVISION_ID = DIVISIONS[0].id;

// ── Helpers ───────────────────────────────────────────────────────────
const adminAuthURL = `${SUPABASE_URL}/auth/v1/admin/users`;
const restURL = `${SUPABASE_URL}/rest/v1`;
const authHeaders = {
  "Content-Type": "application/json",
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

function genPassword() {
  // 24 url-safe chars
  return randomBytes(18).toString("base64url");
}

async function findExistingUser(email) {
  // GET /admin/users supports ?email=… on recent Supabase versions
  const r = await fetch(`${adminAuthURL}?email=${encodeURIComponent(email)}`, { headers: authHeaders });
  if (!r.ok) return null;
  const body = await r.json();
  const users = Array.isArray(body) ? body : (body.users ?? []);
  return users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function createOrUpdateUser(email, password) {
  const existing = await findExistingUser(email);
  if (existing) {
    // Reset password on the existing user
    const r = await fetch(`${adminAuthURL}/${existing.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ password, email_confirm: true }),
    });
    if (!r.ok) throw new Error(`Password reset failed: ${r.status} ${await r.text()}`);
    return { id: existing.id, created: false };
  }
  const r = await fetch(adminAuthURL, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Manual Bot (test)" },
    }),
  });
  if (!r.ok) throw new Error(`User create failed: ${r.status} ${await r.text()}`);
  const body = await r.json();
  return { id: body.id ?? body.user?.id, created: true };
}

async function upsertUserProfile(userId, email) {
  const r = await fetch(`${restURL}/user_profiles?on_conflict=user_id`, {
    method: "POST",
    headers: { ...authHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: userId,
      email,
      display_name: "Manual Bot (test)",
      profile_id: ADMIN_PROFILE_ID,
      active_division_id: PRIMARY_DIVISION_ID,
      is_super_admin: true,
      suspended: false,
    }),
  });
  if (!r.ok) throw new Error(`user_profiles upsert failed: ${r.status} ${await r.text()}`);
}

async function upsertUserDivisions(userId) {
  const rows = DIVISIONS.map((d) => ({
    user_id: userId,
    division_id: d.id,
    is_primary: d.id === PRIMARY_DIVISION_ID,
  }));
  const r = await fetch(`${restURL}/user_divisions?on_conflict=user_id,division_id`, {
    method: "POST",
    headers: { ...authHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`user_divisions upsert failed: ${r.status} ${await r.text()}`);
}

function writeManualEnv(email, password) {
  const path = resolve(ROOT, ".env.local.manual");
  const content = [
    "# ⚠️ DO NOT COMMIT — gitignored via .env* rule.",
    "# Credentials for the Playwright manual generator. Regenerate via:",
    "#   node scripts/manuals/setup-test-user.mjs",
    "",
    `MANUAL_TEST_EMAIL=${email}`,
    `MANUAL_TEST_PASSWORD=${password}`,
    "",
    "# Local dev URL the script will hit",
    "MANUAL_TARGET_URL=http://localhost:3000",
    "",
  ].join("\n");
  writeFileSync(path, content, { encoding: "utf8" });
  return path;
}

// ── Main ──────────────────────────────────────────────────────────────
const password = genPassword();
const { id, created } = await createOrUpdateUser(TEST_EMAIL, password);
await upsertUserProfile(id, TEST_EMAIL);
await upsertUserDivisions(id);
const envPath = writeManualEnv(TEST_EMAIL, password);

console.log(`${created ? "Created" : "Updated"} test user: ${TEST_EMAIL} (id=${id})`);
console.log(`Profile: super-admin, primary division JP, also has CA access`);
console.log(`Credentials written to: ${envPath}`);
