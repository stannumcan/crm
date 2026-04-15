// ─────────────────────────────────────────────────────────────
// DingTalk work-notification client (工作通知)
//
// Sends 1:1 DMs to specific employees by their DingTalk userId via an
// internal corporate app. The app credentials live in env vars (see
// .env.local.example). Access tokens are cached in app_settings so
// we don't re-fetch on every notification (tokens live 2 hours).
// ─────────────────────────────────────────────────────────────

import { createAdminClient } from "@/lib/supabase/admin";

const TOKEN_URL = "https://oapi.dingtalk.com/gettoken";
const SEND_URL = "https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2";
const TOKEN_CACHE_KEY = "dingtalk_access_token";

// ── Credentials ──────────────────────────────────────────────
function getCreds() {
  const appKey = process.env.DINGTALK_APP_KEY;
  const appSecret = process.env.DINGTALK_APP_SECRET;
  const agentId = process.env.DINGTALK_AGENT_ID;
  if (!appKey || !appSecret || !agentId) {
    throw new Error("DingTalk env vars missing (DINGTALK_APP_KEY, DINGTALK_APP_SECRET, DINGTALK_AGENT_ID)");
  }
  return { appKey, appSecret, agentId };
}

// ── Access token cache (app_settings.dingtalk_access_token) ──
interface CachedToken { token: string; expires_at: number }

async function getAccessToken(): Promise<string> {
  const { appKey, appSecret } = getCreds();
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (supabase as any)
    .from("app_settings")
    .select("value")
    .eq("key", TOKEN_CACHE_KEY)
    .maybeSingle();

  const cached = row?.value as CachedToken | undefined;
  const nowSec = Math.floor(Date.now() / 1000);
  // Use the cached token if it's still valid for at least 60s
  if (cached?.token && cached.expires_at - 60 > nowSec) {
    return cached.token;
  }

  // Fetch a fresh one
  const url = `${TOKEN_URL}?appkey=${encodeURIComponent(appKey)}&appsecret=${encodeURIComponent(appSecret)}`;
  const res = await fetch(url);
  const json = (await res.json()) as { errcode: number; errmsg: string; access_token?: string; expires_in?: number };
  if (json.errcode !== 0 || !json.access_token) {
    throw new Error(`DingTalk token fetch failed: ${json.errmsg} (code ${json.errcode})`);
  }

  const newCache: CachedToken = {
    token: json.access_token,
    expires_at: nowSec + (json.expires_in ?? 7200),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("app_settings")
    .upsert({ key: TOKEN_CACHE_KEY, value: newCache }, { onConflict: "key" });

  return newCache.token;
}

// ── Send work notification (markdown) ────────────────────────

export interface DingTalkMarkdownMessage {
  title: string;
  text: string; // Markdown supported: ### headings, **bold**, [link](url), lists
}

export async function sendWorkNotification(
  userIds: string[],
  message: DingTalkMarkdownMessage,
): Promise<{ success: boolean; errmsg?: string }> {
  if (!userIds || userIds.length === 0) {
    return { success: true };
  }

  const { agentId } = getCreds();
  const token = await getAccessToken();

  const body = {
    agent_id: agentId,
    userid_list: userIds.join(","),
    msg: {
      msgtype: "markdown",
      markdown: {
        title: message.title,
        text: message.text,
      },
    },
  };

  const res = await fetch(`${SEND_URL}?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { errcode: number; errmsg: string; task_id?: number };

  if (json.errcode !== 0) {
    console.error("[dingtalk] Send failed:", JSON.stringify(json));
    return { success: false, errmsg: json.errmsg };
  }

  console.log(`[dingtalk] Notification sent to ${userIds.length} user(s), task_id ${json.task_id}`);
  return { success: true };
}

// Returns true if the DingTalk env is wired up (lets callers skip silently
// in environments where DingTalk hasn't been configured yet).
export function isDingTalkConfigured(): boolean {
  return (
    !!process.env.DINGTALK_APP_KEY &&
    !!process.env.DINGTALK_APP_SECRET &&
    !!process.env.DINGTALK_AGENT_ID
  );
}
