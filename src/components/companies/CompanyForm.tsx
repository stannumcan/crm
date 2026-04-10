"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const COUNTRIES = [
  { code: "JP", label: "Japan (JP)" },
  { code: "CN", label: "China (CN)" },
  { code: "CA", label: "Canada (CA)" },
  { code: "US", label: "United States (US)" },
  { code: "OTHER", label: "Other" },
];

interface CompanyData {
  id?: string;
  name?: string;
  name_ja?: string;
  name_zh?: string;
  country?: string;
  region?: string;
  industry?: string;
  postal_code?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  prefecture?: string;
  phone?: string;
  fax?: string;
  website?: string;
  email?: string;
  notes?: string;
}

export default function CompanyForm({
  locale,
  initial,
}: {
  locale: string;
  initial?: CompanyData;
}) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState(initial?.name ?? "");
  const [nameJa, setNameJa] = useState(initial?.name_ja ?? "");
  const [nameZh, setNameZh] = useState(initial?.name_zh ?? "");
  const [country, setCountry] = useState(initial?.country ?? "JP");
  const [region, setRegion] = useState(initial?.region ?? "");
  const [industry, setIndustry] = useState(initial?.industry ?? "");
  const [postalCode, setPostalCode] = useState(initial?.postal_code ?? "");
  const [addressLine1, setAddressLine1] = useState(initial?.address_line1 ?? "");
  const [addressLine2, setAddressLine2] = useState(initial?.address_line2 ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [prefecture, setPrefecture] = useState(initial?.prefecture ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [fax, setFax] = useState(initial?.fax ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Company name is required."); return; }
    setLoading(true);
    setError("");

    const payload = {
      name: name.trim(),
      name_ja: nameJa || null,
      name_zh: nameZh || null,
      country,
      region: region || null,
      industry: industry || null,
      postal_code: postalCode || null,
      address_line1: addressLine1 || null,
      address_line2: addressLine2 || null,
      city: city || null,
      prefecture: prefecture || null,
      phone: phone || null,
      fax: fax || null,
      website: website || null,
      email: email || null,
      notes: notes || null,
    };

    try {
      const url = isEdit ? `/api/companies/${initial.id}` : "/api/companies";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save company");
      }
      const company = await res.json();
      router.push(`/${locale}/companies/${company.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl" autoComplete="off">
      {/* Names */}
      <Card>
        <CardHeader><CardTitle className="text-base">Company Name</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Primary Name <span className="text-red-500">*</span></Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. USJ, Tanaka Industries"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nameJa">Japanese Name (日本語)</Label>
              <Input
                id="nameJa"
                value={nameJa}
                onChange={(e) => setNameJa(e.target.value)}
                placeholder="e.g. ユニバーサル・スタジオ・ジャパン"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nameZh">Chinese Name (中文)</Label>
              <Input
                id="nameZh"
                value={nameZh}
                onChange={(e) => setNameZh(e.target.value)}
                placeholder="e.g. 田中产业"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Classification */}
      <Card>
        <CardHeader><CardTitle className="text-base">Classification</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Country</Label>
            <Select value={country} onValueChange={(v) => v && setCountry(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">Region / Area</Label>
            <Input
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. 関西, Kansai"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. Retail, Theme Park"
            />
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader><CardTitle className="text-base">Address</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input
                id="postalCode"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="e.g. 554-0031"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prefecture">Prefecture / Province</Label>
              <Input
                id="prefecture"
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
                placeholder="e.g. 大阪府"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. 大阪市"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="addr1">Address Line 1</Label>
            <Input
              id="addr1"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="e.g. 此花区桜島2-1-33"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addr2">Address Line 2</Label>
            <Input
              id="addr2"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Building, floor, suite..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Contact Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 06-6465-4005"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fax">Fax</Label>
              <Input
                id="fax"
                value={fax}
                onChange={(e) => setFax(e.target.value)}
                placeholder="e.g. 06-6465-4006"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">General Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="info@company.co.jp"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://www.company.co.jp"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
        <CardContent>
          <textarea
            className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes about this company..."
          />
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Company"}
        </Button>
      </div>
    </form>
  );
}
