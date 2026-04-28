// Logs the test user into the CRM via the /login form, then saves the
// browser storage state to a cache file so subsequent runs reuse the session.
import { existsSync, mkdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";

const SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6h — Supabase access tokens last 1h, refresh tokens longer

export async function getAuthedContext(browser, opts) {
  const { rootDir, baseURL, email, password, log = console } = opts;
  const statePath = resolve(rootDir, ".manual-auth-state.json");

  // Reuse cached session if fresh enough
  if (existsSync(statePath)) {
    const age = Date.now() - statSync(statePath).mtimeMs;
    if (age < SESSION_TTL_MS) {
      log.log(`[auth] reusing cached session (age ${Math.round(age / 60000)}min)`);
      return await browser.newContext({ storageState: statePath, baseURL });
    }
  }

  log.log(`[auth] logging in as ${email}...`);
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 }),
    page.locator('button[type="submit"]').click(),
  ]);
  // Wait for any client-side hydration to settle
  await page.waitForLoadState("networkidle");

  mkdirSync(dirname(statePath), { recursive: true });
  await ctx.storageState({ path: statePath });
  log.log(`[auth] session cached to ${statePath}`);
  await page.close();
  return ctx;
}
