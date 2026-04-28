"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Building2, Package, Loader2, X } from "lucide-react";

interface QuoteHit {
  id: string;
  status: string;
  mold_number: string | null;
  quote_version: number | null;
  work_orders: { wo_number: string | null; company_name: string | null; project_name: string | null } | null;
}
interface CompanyHit { id: string; name: string; name_ja: string | null; country: string | null }
interface MoldHit { id: string; mold_number: string; category: string | null; variant: string | null; dimensions: string | null }

interface Results {
  quotes: QuoteHit[];
  companies: CompanyHit[];
  molds: MoldHit[];
}

export default function GlobalSearch({ locale }: { locale: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results>({ quotes: [], companies: [], molds: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Open with Ctrl/Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else {
      setQ("");
      setResults({ quotes: [], companies: [], molds: [] });
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 2) {
      setResults({ quotes: [], companies: [], molds: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error("Search failed");
        setResults(await res.json());
      } catch {
        setResults({ quotes: [], companies: [], molds: [] });
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [q, open]);

  const go = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-6 bottom-6 z-40 flex items-center justify-center rounded-full bg-primary text-white shadow-lg hover:shadow-xl h-10 w-10 transition-shadow"
        title="Search (Ctrl+K)"
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }

  const hasResults = results.quotes.length + results.companies.length + results.molds.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div
        className="relative w-full max-w-xl mx-4 rounded-xl bg-card border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by WO #, mold #, company, project..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {q.trim().length < 2 && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Type at least 2 characters to search. <kbd className="font-mono border rounded px-1 ml-1">Esc</kbd> to close.
            </div>
          )}

          {q.trim().length >= 2 && !loading && !hasResults && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No matches for <strong>&ldquo;{q}&rdquo;</strong>
            </div>
          )}

          {results.quotes.length > 0 && (
            <Section title="Quotes">
              {results.quotes.map((r) => {
                const wo = r.work_orders?.wo_number ?? "—";
                const vv = r.quote_version ? `-${String(r.quote_version).padStart(2, "0")}` : "";
                const ref = `${wo}${vv}`;
                return (
                  <Hit
                    key={r.id}
                    icon={FileText}
                    primary={`${ref} · ${r.work_orders?.project_name ?? "—"}`}
                    secondary={`${r.work_orders?.company_name ?? "—"}${r.mold_number ? ` · ${r.mold_number}` : ""} · ${r.status}`}
                    onClick={() => go(`/${locale}/quotes/${r.id}`)}
                  />
                );
              })}
            </Section>
          )}

          {results.companies.length > 0 && (
            <Section title="Companies">
              {results.companies.map((c) => (
                <Hit
                  key={c.id}
                  icon={Building2}
                  primary={c.name}
                  secondary={[c.name_ja, c.country].filter(Boolean).join(" · ") || undefined}
                  onClick={() => go(`/${locale}/companies/${c.id}`)}
                />
              ))}
            </Section>
          )}

          {results.molds.length > 0 && (
            <Section title="Molds">
              {results.molds.map((m) => (
                <Hit
                  key={m.id}
                  icon={Package}
                  primary={m.mold_number}
                  secondary={[m.category, m.variant, m.dimensions].filter(Boolean).join(" · ") || undefined}
                  onClick={() => go(`/${locale}/products/${m.id}`)}
                />
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{title}</p>
      <div>{children}</div>
    </div>
  );
}

function Hit({
  icon: Icon, primary, secondary, onClick,
}: {
  icon: React.ElementType; primary: string; secondary?: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-muted/60 transition-colors"
    >
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground truncate">{primary}</p>
        {secondary && <p className="text-[11px] text-muted-foreground truncate">{secondary}</p>}
      </div>
    </button>
  );
}
