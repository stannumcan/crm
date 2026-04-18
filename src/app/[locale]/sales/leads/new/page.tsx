"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LEAD_SOURCES } from "@/lib/sales-constants";
import Link from "next/link";

export default function NewLeadPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [source, setSource] = useState("manual");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Company name is required"); return; }
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          domain: domain.trim() || null,
          lead_source: source,
          enrichment_status: domain.trim() ? "pending" : "none",
          country: "CA",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create lead");
        setSaving(false);
        return;
      }
      const data = await res.json();
      router.push(`/${locale}/sales/leads/${data.id}`);
    } catch {
      setError("Network error");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Link href={`/${locale}/sales/leads`} className="text-xs text-muted-foreground hover:underline">
        &larr; Back to Leads
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Add Sales Lead</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>

            <div>
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="acmecorp.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Adding a domain enables automatic enrichment via Apollo
              </p>
            </div>

            <div>
              <Label htmlFor="source">Lead Source</Label>
              <select
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm bg-background"
              >
                {LEAD_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create Lead"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
