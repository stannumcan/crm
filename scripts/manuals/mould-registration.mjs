// Generates docs/manuals/mould-registration.docx
//
// Run: node scripts/manuals/mould-registration.mjs
import { chromium } from "playwright";
import { resolve } from "node:path";
import { loadEnv } from "./lib/env.mjs";
import { ensureDevServer } from "./lib/dev-server.mjs";
import { getAuthedContext } from "./lib/auth.mjs";
import { ManualBuilder } from "./lib/docx-builder.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
loadEnv(ROOT);

const TARGET = process.env.MANUAL_TARGET_URL || "http://localhost:3000";
const EMAIL = process.env.MANUAL_TEST_EMAIL;
const PASSWORD = process.env.MANUAL_TEST_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error("Missing MANUAL_TEST_EMAIL/MANUAL_TEST_PASSWORD — run setup-test-user.mjs first.");
  process.exit(1);
}

// A real quote in pending_factory state — used to screenshot the factory-sheet form
const DEMO_QUOTE_ID = "546555ff-4682-4387-9699-3f4287c96c6f";
const DEMO_MOULD = "ML-9999"; // unlikely to exist in catalog → triggers the "Add new" pill

// ── Boot ──────────────────────────────────────────────────────────────
const stopServer = await ensureDevServer(TARGET);
const browser = await chromium.launch({ headless: true });

try {
  const ctx = await getAuthedContext(browser, {
    rootDir: ROOT, baseURL: TARGET, email: EMAIL, password: PASSWORD,
  });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // ── Build doc ──────────────────────────────────────────────────────
  const doc = new ManualBuilder({
    title: "Registering an Existing Mould (ML-XXXX)",
    subtitle: "How to record a mould that exists physically but isn't in the catalog yet",
  });

  // Overview
  doc.h1("Why this exists");
  doc.p(
    "Sometimes a customer asks for a quote on a mould that exists in real life but " +
    "hasn't been added to the CRM's mould catalog yet — for example, an older mould " +
    "from before the catalog was set up, or one that's been sitting in inventory.",
  );
  doc.p(
    "Previously, the system would treat any unfamiliar mould number as a brand-new " +
    "mould (requiring fresh tooling). The fix below lets sales correctly mark these " +
    "as Existing, and registers them in the catalog when Annie attaches the photo on " +
    "the factory cost sheet.",
  );
  doc.callout(
    "This flow only applies to mould numbers in the format ML- followed by digits " +
    "(e.g. ML-1234, ML-9876B). Free-form names like \"STAR2024\" still create a new mould.",
    "info",
  );

  // Step 1 — Sales team
  doc.h1("Step 1 — On the quote request (Sales team)");
  doc.p(
    "Open the quote request page and fill in Company and Workorder as usual. " +
    "When you reach the line item's Mould Number field, leave the type set to Existing.",
  );

  await page.goto(`${TARGET}/en/quotes/new`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  // Wait for the form to render
  await page.locator("text=Line Items").first().waitFor({ timeout: 30_000 });
  const shot1 = await page.screenshot({ fullPage: false });
  doc.screenshot(shot1, "The quote request page. The Line Items section is where the mould number is entered.");

  doc.h2("Type the mould number");
  doc.p([
    "In the ",
    { text: "Mould Number ", bold: true },
    "field, type the catalog number — for example ",
    { text: DEMO_MOULD, font: "Consolas", color: "1e40af" },
    ". The combobox will show a search dropdown.",
  ]);

  // Trigger the combobox dropdown
  // Find the mould combobox — it's the input with placeholder ML-1004B
  const moldInput = page.locator('input[placeholder="ML-1004B"]').first();
  await moldInput.click();
  await moldInput.fill(DEMO_MOULD);
  // Wait for the search dropdown to render
  await page.waitForTimeout(800);
  const shot2 = await page.screenshot({ fullPage: false });
  doc.screenshot(
    shot2,
    `Typing "${DEMO_MOULD}". If the mould isn't in the catalog, a "+ New mold (not in catalog)" pill appears at the bottom of the dropdown.`,
  );

  doc.h2("Click \"+ New mold (not in catalog)\"");
  doc.p(
    "Despite the label, this button now does the right thing for ML-numbered mould " +
    "numbers: it keeps the type as Existing and saves the number you typed. The button " +
    "is only labelled \"new mold\" because it's the same control used for genuinely new " +
    "designs (in those cases the type does switch to New).",
  );

  // Click the "+ New mold (not in catalog)" option. The Combobox renders it
  // as a <div>, not a <button>, so role-based selectors fail. Use text match.
  const addNewOption = page.getByText(/new mold \(not in catalog\)/i).first();
  await addNewOption.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  await addNewOption.click({ timeout: 5000 }).catch((err) => console.error("[shot3] add-new click failed:", err.message));
  // Wait for dropdown to close + form state to update
  await page.waitForTimeout(800);
  // Click somewhere neutral to make sure dropdown is fully closed
  await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.waitForTimeout(300);
  const shot3 = await page.screenshot({ fullPage: false });
  doc.screenshot(
    shot3,
    `After clicking. The line item now shows ${DEMO_MOULD} and the type stays as "Existing" — exactly what we want.`,
  );

  doc.callout(
    "Behind the scenes the system checks the format. ML- followed by digits = stays as " +
    "Existing. Anything else = switches to New. You don't need to do anything different.",
    "success",
  );

  // Step 2 — Factory team
  doc.pageBreak();
  doc.h1("Step 2 — On the factory cost sheet (Factory / Annie)");
  doc.p(
    "Once the quote reaches Annie, she opens the factory cost sheet for the mould and " +
    "uploads the mould photo as part of her normal workflow. The CRM now does an extra " +
    "step automatically: if the mould isn't in the catalog yet, it registers it and " +
    "attaches the photo to the new catalog entry.",
  );

  await page.goto(`${TARGET}/en/quotes/${DEMO_QUOTE_ID}/factory-sheet/new`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000); // give the form components time to mount
  const shot4 = await page.screenshot({ fullPage: false });
  doc.screenshot(
    shot4,
    "The factory cost sheet form. Annie fills in the usual fields (dimensions, packaging, costs) and uploads the mould reference photo.",
  );

  // Scroll to the mould image area for a closer screenshot
  // Look for the helper text that indicates an unregistered mould
  const helperText = page.locator("text=/isn.t in the catalog yet/i").first();
  let shot5 = null;
  if (await helperText.isVisible().catch(() => false)) {
    await helperText.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    shot5 = await page.screenshot({ fullPage: false, clip: undefined });
  }
  if (shot5) {
    doc.screenshot(
      shot5,
      "When the mould isn't in the catalog yet, this hint appears above the upload area. The photo Annie uploads will be saved both to the cost sheet and to a new catalog entry.",
    );
  }

  doc.h2("What happens when Annie hits Save");
  doc.numberedList([
    "The factory cost sheet is saved (with the photo attached) — same as before.",
    `If the mould number (e.g. ${DEMO_MOULD}) isn't in the catalog, a new mould record is created automatically with that number and the uploaded photo.`,
    "If the mould number is already in the catalog but had no photo, the photo is added to the existing record.",
    "If the mould number starts with ML-NM (a placeholder for a brand-new design without a real number yet), no catalog record is created — those are temporary.",
  ]);

  // Step 3 — Verification
  doc.h1("Step 3 — Verifying the mould was registered");
  doc.p(
    "After Annie saves, the mould is searchable by its number on any future quote. " +
    "Sales can pick it from the dropdown rather than re-typing it.",
  );
  doc.p("To check the catalog directly, the admin can open the Settings → Moulds page (or the molds API).");

  // Closing notes
  doc.h1("FAQ");
  doc.h2("What if the user types lowercase, like 'ml-1234'?");
  doc.p(
    "The system normalises to uppercase on save. The catalog entry is always stored as ML-1234.",
  );
  doc.h2("What if two different sheets register the same mould number?");
  doc.p(
    "Whichever runs first creates the catalog row. The second sheet's photo updates the " +
    "existing row's image_url only if it differs from what's already there.",
  );
  doc.h2("What if Annie uploads the wrong photo?");
  doc.p(
    "She can upload a corrected photo on a later version of the factory sheet — the " +
    "catalog entry's image_url updates to match.",
  );

  // Save
  const outPath = resolve(ROOT, "docs", "manuals", "mould-registration.docx");
  await doc.save(outPath);
  console.log(`\nManual written to: ${outPath}`);

  await page.close();
  await ctx.close();
} finally {
  await browser.close();
  stopServer();
}
