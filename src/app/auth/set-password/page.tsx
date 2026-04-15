"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState<string | null>(null);

  // Confirm we have a session (must be here via invite link)
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user }, error: getUserErr }) => {
      if (getUserErr || !user) {
        router.replace("/login?error=session_expired");
        return;
      }
      setEmail(user.email ?? null);
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    if (updateErr) {
      setError(updateErr.message);
      setLoading(false);
      return;
    }

    router.push("/en");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div
        className="w-full max-w-sm rounded-xl border p-8"
        style={{ background: "var(--card)", borderColor: "var(--border)", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
      >
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-6 h-6 rounded-sm flex items-center justify-center shrink-0" style={{ background: "var(--primary)" }}>
            <span className="text-white leading-none select-none" style={{ fontSize: "11px", fontWeight: 700 }}>W</span>
          </div>
          <span className="text-sm font-semibold tracking-widest" style={{ color: "var(--foreground)", letterSpacing: "0.1em" }}>
            WINHOOP
          </span>
        </div>

        <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--foreground)" }}>
          Set your password
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {email ? <>Welcome, <strong>{email}</strong>. Choose a password to finish signing in.</> : "Choose a password to finish signing in."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              New password
            </label>
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              minLength={6}
              autoFocus
              autoComplete="new-password"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors"
              style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--primary)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Confirm password
            </label>
            <input
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your password"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors"
              style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--primary)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
            Show password
          </label>

          {error && (
            <div
              className="rounded-md px-3 py-2 text-sm"
              style={{ background: "oklch(0.97 0.01 20)", border: "1px solid oklch(0.85 0.06 20)", color: "oklch(0.45 0.15 20)" }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md py-2 text-sm font-medium text-white transition-opacity"
            style={{ background: "var(--primary)", opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Saving…" : "Set password & continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
