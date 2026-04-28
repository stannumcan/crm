// Spawns `npm run dev`, waits until the server responds, returns a stop fn.
// If a dev server is already listening at the URL, reuses it.
import { spawn } from "node:child_process";

export async function ensureDevServer(url, { timeoutMs = 90_000, log = console } = {}) {
  // Already running?
  if (await ping(url)) {
    log.log(`[dev-server] reusing existing server at ${url}`);
    return () => {}; // noop stop
  }

  log.log(`[dev-server] starting npm run dev...`);
  // shell: true so Windows can resolve npm.cmd through PATH; on macOS/Linux this
  // is harmless and just adds a cmd.exe-equivalent layer.
  const proc = spawn("npm run dev", {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
  let killed = false;
  proc.stdout.on("data", (d) => process.stdout.write(`[dev] ${d}`));
  proc.stderr.on("data", (d) => process.stderr.write(`[dev:err] ${d}`));
  proc.on("exit", (code) => {
    if (!killed) log.log(`[dev-server] exited with code ${code}`);
  });

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await ping(url)) {
      log.log(`[dev-server] ready at ${url}`);
      return () => {
        killed = true;
        try { proc.kill(); } catch {}
      };
    }
    await sleep(1000);
  }
  try { proc.kill(); } catch {}
  throw new Error(`Dev server did not become ready at ${url} within ${timeoutMs}ms`);
}

async function ping(url) {
  try {
    const r = await fetch(url, { redirect: "manual" });
    // Any HTTP response (including redirects) means the server is up
    return r.status > 0;
  } catch {
    return false;
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
