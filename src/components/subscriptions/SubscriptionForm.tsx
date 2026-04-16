"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

export type SubscriptionInitial = {
  id?: string;
  service_name?: string;
  vendor?: string | null;
  category?: string | null;
  cost_amount?: number;
  cost_currency?: string;
  billing_cycle?: string;
  started_on?: string | null;
  next_renewal_on?: string | null;
  auto_renew?: boolean;
  payment_method?: string | null;
  status?: string;
  cancel_url?: string | null;
  notes?: string | null;
};

const CYCLES = ["monthly", "quarterly", "annual", "one_time"] as const;
const STATUSES = ["active", "trial", "canceled"] as const;
const CURRENCIES = ["JPY", "CAD", "USD", "CNY", "EUR", "GBP", "HKD"];
const CATEGORIES = ["software", "hosting", "domain", "insurance", "other"];

export default function SubscriptionForm({
  locale,
  initial,
}: {
  locale: string;
  initial?: SubscriptionInitial;
}) {
  const t = useTranslations("subscriptions");
  const tc = useTranslations("common");
  const router = useRouter();
  const editing = !!initial?.id;

  const [form, setForm] = useState({
    service_name: initial?.service_name ?? "",
    vendor: initial?.vendor ?? "",
    category: initial?.category ?? "software",
    cost_amount: initial?.cost_amount?.toString() ?? "",
    cost_currency: initial?.cost_currency ?? "USD",
    billing_cycle: initial?.billing_cycle ?? "monthly",
    started_on: initial?.started_on ?? "",
    next_renewal_on: initial?.next_renewal_on ?? "",
    auto_renew: initial?.auto_renew ?? true,
    payment_method: initial?.payment_method ?? "",
    status: initial?.status ?? "active",
    cancel_url: initial?.cancel_url ?? "",
    notes: initial?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        ...form,
        cost_amount: Number(form.cost_amount),
        started_on: form.started_on || null,
        next_renewal_on: form.next_renewal_on || null,
        vendor: form.vendor || null,
        category: form.category || null,
        payment_method: form.payment_method || null,
        cancel_url: form.cancel_url || null,
        notes: form.notes || null,
      };
      const res = await fetch(
        editing ? `/api/subscriptions/${initial!.id}` : "/api/subscriptions",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(j.error || "Request failed");
      }
      router.push(`/${locale}/subscriptions`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editing || !initial?.id) return;
    if (!confirm(t("confirmDelete"))) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/subscriptions/${initial.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.push(`/${locale}/subscriptions`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setSaving(false);
    }
  }

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="service_name">{t("service")} *</Label>
          <Input
            id="service_name"
            required
            value={form.service_name}
            onChange={(e) => update("service_name", e.target.value)}
            placeholder="GitHub, Vercel, Claude Pro..."
          />
        </div>

        <div>
          <Label htmlFor="vendor">{t("vendor")}</Label>
          <Input
            id="vendor"
            value={form.vendor}
            onChange={(e) => update("vendor", e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="category">{t("category")}</Label>
          <select
            id="category"
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{t(`cat_${c}`)}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="cost_amount">{t("cost")} *</Label>
          <Input
            id="cost_amount"
            type="number"
            step="0.01"
            required
            value={form.cost_amount}
            onChange={(e) => update("cost_amount", e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="cost_currency">{t("currency")} *</Label>
          <select
            id="cost_currency"
            value={form.cost_currency}
            onChange={(e) => update("cost_currency", e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="billing_cycle">{t("cycle")} *</Label>
          <select
            id="billing_cycle"
            value={form.billing_cycle}
            onChange={(e) => update("billing_cycle", e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {CYCLES.map((c) => (
              <option key={c} value={c}>{t(`cycle_${c}`)}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="status">{tc("status")}</Label>
          <select
            id="status"
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{t(`status_${s}`)}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="started_on">{t("startedOn")}</Label>
          <Input
            id="started_on"
            type="date"
            value={form.started_on}
            onChange={(e) => update("started_on", e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="next_renewal_on">{t("nextRenewal")}</Label>
          <Input
            id="next_renewal_on"
            type="date"
            value={form.next_renewal_on}
            onChange={(e) => update("next_renewal_on", e.target.value)}
          />
        </div>

        <div className="col-span-2 flex items-center gap-2">
          <input
            id="auto_renew"
            type="checkbox"
            checked={form.auto_renew}
            onChange={(e) => update("auto_renew", e.target.checked)}
            className="h-4 w-4"
          />
          <Label htmlFor="auto_renew" className="cursor-pointer">{t("autoRenew")}</Label>
        </div>

        <div className="col-span-2">
          <Label htmlFor="payment_method">{t("paymentMethod")}</Label>
          <Input
            id="payment_method"
            value={form.payment_method}
            onChange={(e) => update("payment_method", e.target.value)}
            placeholder="Visa ••1234, company card..."
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="cancel_url">{t("cancelUrl")}</Label>
          <Input
            id="cancel_url"
            type="url"
            value={form.cancel_url}
            onChange={(e) => update("cancel_url", e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="notes">{t("notes")}</Label>
          <textarea
            id="notes"
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between pt-2">
        {editing ? (
          <Button
            type="button"
            variant="ghost"
            onClick={handleDelete}
            disabled={saving}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {tc("delete")}
          </Button>
        ) : <span />}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={saving}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? tc("loading") : tc("save")}
          </Button>
        </div>
      </div>
    </form>
  );
}
