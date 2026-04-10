"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2 } from "lucide-react";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

const CURRENCIES = ["JPY", "USD", "CAD", "CNY", "EUR"];

export default function QuoteForm({ locale }: { locale: string }) {
  const t = useTranslations("quotes");
  const tc = useTranslations("common");
  const router = useRouter();

  const [customer, setCustomer] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [currency, setCurrency] = useState("JPY");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { id: "1", description: "", quantity: 1, unitPrice: 0, discount: 0 },
  ]);

  const addItem = () => {
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        description: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0,
      },
    ]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const getItemSubtotal = (item: LineItem) => {
    const gross = item.quantity * item.unitPrice;
    return gross * (1 - item.discount / 100);
  };

  const subtotal = items.reduce((sum, item) => sum + getItemSubtotal(item), 0);
  const taxRate = currency === "JPY" ? 0.1 : 0;
  const tax = subtotal * taxRate;
  const grandTotal = subtotal + tax;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(
      locale === "ja" ? "ja-JP" : locale === "zh" ? "zh-CN" : "en-CA",
      { style: "currency", currency, minimumFractionDigits: 0 }
    ).format(amount);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: save to Supabase
    router.push(`/${locale}/quotes`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
      {/* Header info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("customer")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="customer">{t("customer")}</Label>
            <Input
              id="customer"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="validUntil">{t("validUntil")}</Label>
            <Input
              id="validUntil"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t("currency")}</Label>
            <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Line items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("items")}</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            {t("addItem")}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Column headers */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
              <div className="col-span-5">{t("description")}</div>
              <div className="col-span-2 text-center">{t("quantity")}</div>
              <div className="col-span-2 text-center">{t("unitPrice")}</div>
              <div className="col-span-2 text-center">{t("discount")}</div>
              <div className="col-span-1"></div>
            </div>

            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <Input
                    placeholder={t("description")}
                    value={item.description}
                    onChange={(e) => updateItem(item.id, "description", e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                    className="text-center"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(item.id, "unitPrice", Number(e.target.value))}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={item.discount}
                    onChange={(e) => updateItem(item.id, "discount", Number(e.target.value))}
                    className="text-center"
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Separator className="my-4" />

          {/* Totals */}
          <div className="space-y-2 max-w-xs ml-auto text-sm">
            <div className="flex justify-between text-gray-600">
              <span>{t("subtotal")}</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>{t("tax")} ({(taxRate * 100).toFixed(0)}%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold text-base">
              <span>{t("grandTotal")}</span>
              <span>{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="notes">{t("notes")}</Label>
            <textarea
              id="notes"
              className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="internalNotes">{t("internalNotes")}</Label>
            <textarea
              id="internalNotes"
              className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${locale}/quotes`)}
        >
          {tc("cancel")}
        </Button>
        <Button type="submit">{tc("save")}</Button>
      </div>
    </form>
  );
}
