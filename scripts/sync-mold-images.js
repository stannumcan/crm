#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
// SOURCE_DIR is outside the repo so it stays absolute. DEST_DIR and SQL_FILE are
// project-relative so this script survives any folder/repo rename.
const SOURCE_DIR = 'C:/Users/wilfr/OneDrive/Marshallom/Resources/800 X 800';
const DEST_DIR   = path.resolve(__dirname, '..', 'public', 'molds');
const SQL_FILE   = path.resolve(__dirname, 'sync-mold-images.sql');

const EXISTING_MOLDS = new Set(`ML-0003,ML-0007,ML-0008A,ML-0008B,ML-0009,ML-0010,ML-0011,ML-0012,ML-0018,ML-0018A,ML-0018B,ML-0018C,ML-0019,ML-0019A,ML-0019B,ML-0021,ML-0022,ML-0023,ML-0026,ML-0027,ML-0028,ML-0029,ML-0030,ML-0030A,ML-0030B,ML-0032,ML-0038,ML-0038A,ML-0038B,ML-0038D,ML-0041,ML-0043,ML-0046D,ML-0048A,ML-0049,ML-0049B,ML-0050,ML-0050B,ML-0050C,ML-0053,ML-0053A,ML-0053B,ML-0054,ML-0060,ML-0060G,ML-0061,ML-0063,ML-0065,ML-0067,ML-0068,ML-0068A,ML-0073,ML-0076,ML-0078,ML-0079,ML-0086,ML-0087,ML-0089,ML-0090,ML-0091,ML-0094,ML-0095,ML-0097,ML-0097B,ML-0097C,ML-0099,ML-0101,ML-0102,ML-0103,ML-0107,ML-0112,ML-0118,ML-0118A,ML-0125,ML-0126,ML-0128,ML-0128A,ML-0133,ML-0134,ML-0143,ML-0145,ML-0146,ML-0146A,ML-0147,ML-0148,ML-0151,ML-0152B,ML-0152C,ML-0153,ML-0164,ML-0165,ML-0166,ML-0167,ML-0168B,ML-0169,ML-0172,ML-0173,ML-0177,ML-0179,ML-0181,ML-0185,ML-0185A,ML-0185B,ML-0185C,ML-0185D,ML-0186,ML-0187,ML-0190,ML-0191,ML-0201,ML-0202,ML-0203,ML-0204,ML-0205,ML-0206,ML-0207,ML-0208A,ML-0208B,ML-0208C,ML-0208D,ML-0208E,ML-0209,ML-0211,ML-0211A,ML-0213,ML-0214,ML-0215,ML-0216,ML-0219,ML-0220,ML-0228,ML-0233,ML-0236,ML-0237,ML-0239,ML-0240,ML-0241,ML-0244,ML-0246,ML-0248,ML-0249,ML-0251,ML-0253,ML-0258,ML-0260,ML-0263,ML-0264,ML-0266,ML-0272,ML-0274,ML-0276,ML-0278,ML-0287,ML-0291,ML-0293,ML-0294,ML-0297,ML-0298,ML-0300,ML-0301,ML-0302,ML-0306,ML-0311,ML-0312,ML-0314,ML-0315,ML-0317,ML-0317A,ML-0320,ML-0325,ML-0336,ML-0337,ML-0338,ML-0343,ML-0343A,ML-0346,ML-0348,ML-0350,ML-0352,ML-0357,ML-0362,ML-0365,ML-0367,ML-0369,ML-0370,ML-0371,ML-0375,ML-0378,ML-0378A,ML-0382,ML-0382A,ML-0382B,ML-0384,ML-0385,ML-0386,ML-0387,ML-0389,ML-0389A,ML-0391,ML-0393,ML-0396,ML-0400,ML-0405,ML-0406,ML-0417,ML-0420,ML-0423,ML-0430,ML-0433,ML-0435,ML-0436,ML-0437,ML-0441,ML-0445,ML-0446,ML-0451,ML-0453,ML-0453A,ML-0453C,ML-0455,ML-0455A,ML-0455B,ML-0455C,ML-0455D,ML-0456,ML-0458,ML-0463,ML-0467,ML-0468,ML-0479,ML-0486,ML-0488,ML-0490,ML-0495,ML-0496,ML-0497,ML-0499,ML-0501,ML-0502,ML-0505,ML-0508,ML-0509B,ML-0511,ML-0512,ML-0518A,ML-0527,ML-0527A,ML-0527B,ML-0528,ML-0529,ML-0529A,ML-0531,ML-0532,ML-0534,ML-0540,ML-0544,ML-0545,ML-0554,ML-0558,ML-0559,ML-0563,ML-0568,ML-0568A,ML-0572,ML-0576,ML-0577B,ML-0586,ML-0594,ML-0596,ML-0599,ML-0600,ML-0601,ML-0608,ML-0609,ML-0611,ML-0612,ML-0616,ML-0625,ML-0628,ML-0629,ML-0630,ML-0631,ML-0632,ML-0632A,ML-0634,ML-0639,ML-0640,ML-0642,ML-0643,ML-0646,ML-0647,ML-0648,ML-0652,ML-0655,ML-0656,ML-0659,ML-0661,ML-0661A,ML-0662,ML-0664,ML-0670,ML-0675,ML-06811E,ML-0686,ML-0687,ML-0688,ML-0690,ML-0693,ML-0695,ML-0696,ML-0698,ML-0701,ML-0714,ML-0719,ML-0720,ML-0722,ML-0724,ML-0730,ML-0731,ML-0731B,ML-0731C,ML-0731D,ML-0737,ML-0741,ML-0742,ML-0749,ML-0754C,ML-0756,ML-0759,ML-0761,ML-0762,ML-0769,ML-0770,ML-0771,ML-0772,ML-0785,ML-0789,ML-0790,ML-0809,ML-0810,ML-0811,ML-0811D,ML-0818,ML-0819,ML-0822,ML-0823,ML-0826,ML-0834,ML-0838,ML-0841,ML-0843,ML-0852,ML-0853,ML-0854,ML-0857,ML-0860,ML-0861,ML-0865,ML-0866,ML-0866A,ML-0870,ML-0876,ML-0882,ML-0890,ML-0892,ML-0897,ML-0901,ML-0902,ML-0917,ML-0918,ML-1002,ML-1010,ML-1011,ML-1012,ML-1014,ML-1018,ML-1019,ML-1019A,ML-1023,ML-1026,ML-1027,ML-1029,ML-1030,ML-1031,ML-1033,ML-1035,ML-1036,ML-1038,ML-1041,ML-1045,ML-1046,ML-1047,ML-1048,ML-1050,ML-1052,ML-1054,ML-1056,ML-1058,ML-1062,ML-1063,ML-1064,ML-1065,ML-1087,ML-1105,ML-1107,ML-1113,ML-1118,ML-1127,ML-1200,ML-1206,ML-1211,ML-1219,ML-1220,ML-1221,ML-1222,ML-1229,ML-1232,ML-1233,ML-1233A,ML-1237,ML-1238,ML-1241,ML-1248,ML-1251,ML-1255,ML-1255A,ML-1255B,ML-1255C,ML-1255D,ML-1255E,ML-1255F,ML-1255G,ML-1260,ML-1262,ML-1271,ML-1277,ML-1277A,ML-1299,ML-1299A,ML-1356,ML-1361,ML-1377,ML-1381,ML-1382,ML-1382A,ML-1385,ML-1388,ML-1389,ML-1390,ML-1391,ML-1397,ML-1398,ML-1399,ML-1417,ML-1417A,ML-1804,ML-2006,ML-2008,ML-2017,ML-2027,ML-2028,ML-2028A,ML-2029,ML-2033,ML-2043,ML-2050,ML-2051,ML-2054,ML-2055,ML-2056,ML-2057,ML-2057A,ML-2067,ML-2075,ML-2076,ML-2077,ML-2087,ML-2090,ML-2092,ML-2097,ML-2102,ML-2106,ML-2115,ML-2119,ML-2121,ML-2123,ML-2137,ML-2142,ML-2147,ML-2155,ML-2156,ML-2167,ML-2167A,ML-2175,ML-2176,ML-2184,ML-2185,ML-2197,ML-2198,ML-2212,ML-2225,ML-2226,ML-2227,ML-2227A,ML-2229,ML-2230,ML-2232,ML-2233,ML-2236,ML-2242,ML-2253,ML-2261,ML-2265,ML-2268,ML-2274,ML-2278,ML-2287,ML-2288,ML-2290,ML-2306,ML-2307,ML-2311,ML-2315,ML-2316,ML-2318,ML-2322,ML-2326,ML-2334,ML-2334A,ML-2341,ML-2363,ML-2363A,ML-2377,ML-2550,ML-2553,ML-2569,ML-2585,ML-2593,ML-2594,ML-2596,ML-2603,ML-2607,ML-2608,ML-2613,ML-2615,ML-2616,ML-2629,ML-2638,ML-2679,ML-2685,ML-2690,ML-2699,ML-2705,ML-2718,ML-2720`
  .split(',').map(s => s.trim()).filter(Boolean));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Zero-pad a pure-numeric string to 4 digits if it has fewer than 4 digits.
 * If it already has 4+ digits, return as-is.
 */
function padNum(numStr) {
  return numStr.length < 4 ? numStr.padStart(4, '0') : numStr;
}

/**
 * Given the raw filename stem (no extension), return the canonical mold number
 * or null if the file should be skipped.
 *
 * Returns: { moldNumber: string } | { skip: true, reason: string }
 */
function deriveFromStem(stem) {
  // 1. Skip - Copy
  if (stem.includes(' - Copy')) {
    return { skip: true, reason: `"- Copy" pattern: ${stem}` };
  }

  // 2. Skip files with " (" (parenthesised variant numbers)
  if (stem.includes(' (')) {
    return { skip: true, reason: `Parenthesis pattern: ${stem}` };
  }

  // 3. Handle multi-shot files (stem ends with space + 3-digit number)
  // Pattern: <base> 001 / 002 / 003 …
  const multiShotMatch = stem.match(/^(.+) (\d{3})$/);
  if (multiShotMatch) {
    const [, base, shotNum] = multiShotMatch;

    // Only keep shot 001; skip 002, 003 …
    if (shotNum !== '001') {
      return { skip: true, reason: `Multi-shot non-001: ${stem}` };
    }

    // Strip leading ML- prefix if present on base
    let cleanBase = base.startsWith('ML-') ? base.slice(3) : base;

    // Recurse to parse the base
    return deriveFromStem(cleanBase);
  }

  // 4. Skip stems that still contain spaces after the multi-shot check
  //    (e.g. "653 A B C" — unrecognised pattern)
  if (stem.includes(' ')) {
    return { skip: true, reason: `Unrecognised space pattern: ${stem}` };
  }

  // 5. Strip trailing literal "jpg" (e.g. "092jpg", "267jpg")
  let s = stem;
  if (/jpg$/i.test(s) && s.length > 3) {
    s = s.replace(/jpg$/i, '');
  }

  // 6. JK- prefix  (e.g. "JK-5082")
  if (/^JK-/i.test(s)) {
    return { moldNumber: `ML-${s.toUpperCase()}` };
  }

  // 7. Starts with a letter then digits (e.g. "A079", "B014") — no padding
  if (/^[A-Za-z][0-9]/.test(s)) {
    return { moldNumber: `ML-${s.toUpperCase()}` };
  }

  // 8. Numeric + optional dash-suffix (e.g. "731-4")
  const dashSuffixMatch = s.match(/^(\d+)-(\d+.*)$/);
  if (dashSuffixMatch) {
    const [, numPart, rest] = dashSuffixMatch;
    const padded = padNum(numPart);
    return { moldNumber: `ML-${padded}-${rest.toUpperCase()}` };
  }

  // 9. Normal: digits + optional letter suffix (e.g. "002", "008A", "1234", "2065")
  const normalMatch = s.match(/^(\d+)([A-Za-z]*)$/);
  if (normalMatch) {
    const [, numPart, suffix] = normalMatch;
    const padded = padNum(numPart);
    return { moldNumber: `ML-${padded}${suffix.toUpperCase()}` };
  }

  // 10. Nothing matched — skip
  return { skip: true, reason: `Cannot parse stem: ${stem}` };
}

// ── Main ──────────────────────────────────────────────────────────────────────

// Ensure destination directory exists
fs.mkdirSync(DEST_DIR, { recursive: true });

const files = fs.readdirSync(SOURCE_DIR).sort();

const stats = {
  total: files.length,
  copied: 0,
  skippedRule: 0,
  skippedDuplicate: 0,
  skippedUnparseable: 0,
  matchedExisting: 0,
  newMolds: 0,
};

const skippedLog = [];
const copiedMolds = new Map(); // moldNumber -> source filename
const sqlInserts = [];

for (const filename of files) {
  // Only process image files
  const extMatch = filename.match(/\.(jpg|jpeg|png)$/i);
  if (!extMatch) {
    skippedLog.push(`  [non-image] ${filename}`);
    stats.skippedRule++;
    continue;
  }

  // Strip extension to get stem
  const stem = filename.slice(0, filename.length - extMatch[0].length);

  const result = deriveFromStem(stem);

  if (result.skip) {
    skippedLog.push(`  [skip] ${filename}  →  ${result.reason}`);
    if (result.reason.startsWith('Cannot parse')) {
      stats.skippedUnparseable++;
    } else {
      stats.skippedRule++;
    }
    continue;
  }

  const { moldNumber } = result;

  // Handle duplicates — first one wins
  if (copiedMolds.has(moldNumber)) {
    skippedLog.push(`  [dup]  ${filename}  →  ${moldNumber}  (already from: ${copiedMolds.get(moldNumber)})`);
    stats.skippedDuplicate++;
    continue;
  }

  // Copy the file — retry up to 5 times; fall back to read+write to avoid
  // EBUSY when OneDrive is syncing the source file.
  const srcPath  = path.join(SOURCE_DIR, filename);
  const destPath = path.join(DEST_DIR, `${moldNumber}.jpg`);

  let copied = false;
  for (let attempt = 1; attempt <= 5 && !copied; attempt++) {
    try {
      const buf = fs.readFileSync(srcPath);
      fs.writeFileSync(destPath, buf);
      copied = true;
    } catch (err) {
      if (attempt === 5) {
        skippedLog.push(`  [error] ${filename}  →  ${moldNumber}  (${err.code}: ${err.message})`);
        stats.skippedRule++;
        copied = null; // sentinel: signal the outer loop to continue
        break;
      }
      // brief pause before retry
      const wait = attempt * 200;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);
    }
  }
  if (copied === null) continue;
  copiedMolds.set(moldNumber, filename);
  stats.copied++;

  const isExisting = EXISTING_MOLDS.has(moldNumber);
  if (isExisting) {
    stats.matchedExisting++;
  } else {
    stats.newMolds++;
  }

  sqlInserts.push(
    `INSERT INTO molds (mold_number, image_url, is_active) VALUES ('${moldNumber}', '/molds/${moldNumber}.jpg', true) ON CONFLICT (mold_number) DO UPDATE SET image_url = EXCLUDED.image_url;`
  );
}

// ── Write SQL file ────────────────────────────────────────────────────────────
const sqlLines = [
  '-- Auto-generated by scripts/sync-mold-images.js',
  `-- Generated: ${new Date().toISOString()}`,
  `-- ${stats.copied} images processed`,
  '',
  ...sqlInserts,
];
fs.writeFileSync(SQL_FILE, sqlLines.join('\n') + '\n', 'utf8');

// ── Print summary ─────────────────────────────────────────────────────────────
console.log('');
console.log('════════════════════════════════════════════════');
console.log('  Mold Image Sync — Summary');
console.log('════════════════════════════════════════════════');
console.log(`  Source files found     : ${stats.total}`);
console.log(`  Copied to public/molds : ${stats.copied}`);
console.log(`    ↳ matched existing DB : ${stats.matchedExisting}`);
console.log(`    ↳ new (not in DB)     : ${stats.newMolds}`);
console.log(`  Skipped — rule         : ${stats.skippedRule}`);
console.log(`  Skipped — duplicate    : ${stats.skippedDuplicate}`);
console.log(`  Skipped — unparseable  : ${stats.skippedUnparseable}`);
console.log('────────────────────────────────────────────────');
console.log(`  SQL file written to    : scripts/sync-mold-images.sql`);
console.log(`  SQL statements         : ${sqlInserts.length}`);
console.log('════════════════════════════════════════════════');
console.log('');
console.log('Skip / Duplicate details:');
skippedLog.forEach(l => console.log(l));
console.log('');
