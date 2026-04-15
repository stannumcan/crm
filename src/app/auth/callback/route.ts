import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth / magic-link / invite callback.
// Supabase sends users here after they click the email link.
//
// Query params:
//   code — PKCE authorization code (exchange for a session)
//   next — optional path to return to once signed in
//   type — 'invite' | 'recovery' | 'magiclink' | 'signup' | 'email_change'
//          (used to route invitees straight to set-password)

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type"); // e.g. "invite"
  const next = url.searchParams.get("next") || "/";

  if (!code) {
    // Landing here with no code = invalid or already-consumed link.
    return NextResponse.redirect(new URL("/login?error=invalid_link", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
  }

  // Invited users need to set a password before landing in the app.
  if (type === "invite" || type === "recovery") {
    return NextResponse.redirect(new URL("/auth/set-password", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
