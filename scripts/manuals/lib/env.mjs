// Tiny .env loader — reads .env.local + .env.local.manual into process.env
// at script startup. Lets the manual scripts use process.env.MANUAL_TEST_EMAIL
// etc. without depending on dotenv.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export function loadEnv(rootDir) {
  for (const file of [".env.local", ".env.local.manual"]) {
    const path = resolve(rootDir, file);
    if (!existsSync(path)) continue;
    for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim();
      if (process.env[k] == null) process.env[k] = v;
    }
  }
}
