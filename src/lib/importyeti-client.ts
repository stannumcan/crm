// Server-side ImportYeti API wrapper for US customs/trade data lookups.
// Used by API routes and the daily cron job.

const IMPORTYETI_BASE = "https://data.importyeti.com/v1.0";

function getApiKey(): string {
  const key = process.env.IMPORTYETI_API_KEY;
  if (!key) throw new Error("IMPORTYETI_API_KEY is not set");
  return key;
}

function normalizeHsCode(hs: string): string {
  return hs.replace(/\./g, "");
}

async function importyetiGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${IMPORTYETI_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      IYApiKey: getApiKey(),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ImportYeti ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Junk name filter ─────────────────────────────────────────────────────────

const JUNK_PATTERNS = [
  /^missing in source$/i,
  /^unknown$/i,
  /^n\/a$/i,
  /^various$/i,
  /^not available$/i,
  /^see attached$/i,
  /^none$/i,
  /^\s*$/,
];

function isJunkName(name: string): boolean {
  return JUNK_PATTERNS.some((p) => p.test(name));
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ImporterCompany {
  name: string;
  shipmentCount: number;
  address: string | null;
  website: string | null;
  phones: string[];
  emails: string[];
  ports: { name: string; count: number }[];
}

export interface CompanySearchResult {
  name: string;
  id: string;
  address: string | null;
  website: string | null;
  totalShipments: number;
}

export interface SupplierResult {
  name: string;
  country: string | null;
  address: string | null;
  shipmentCount: number;
}

// ── API functions ────────────────────────────────────────────────────────────

export async function searchImportersByHsCode(opts: {
  hsCode: string;
  supplierCountry?: string;
  productDescription?: string;
  startDate?: string;
  endDate?: string;
  pageSize?: number;
  page?: number;
}): Promise<{ companies: ImporterCompany[]; total: number; creditsRemaining?: number }> {
  const params: Record<string, string> = {
    hs_code: normalizeHsCode(opts.hsCode),
    page_size: String(opts.pageSize ?? 10),
    page: String(opts.page ?? 1),
  };
  if (opts.supplierCountry) params.supplier_country = opts.supplierCountry;
  if (opts.productDescription) params.product_description = opts.productDescription;
  if (opts.startDate) params.start_date = opts.startDate;
  if (opts.endDate) params.end_date = opts.endDate;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await importyetiGet<any>("/powerquery/us-import/companies", params);
  const items = raw?.data?.data ?? [];
  const total = raw?.data?.totalCompanies ?? 0;

  const companies: ImporterCompany[] = items
    .filter((item: { key?: string }) => item.key && !isJunkName(item.key))
    .map((item: Record<string, unknown>) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: (item as any).key as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      shipmentCount: ((item as any).doc_count ?? 0) as number,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      address: ((item as any).company_address?.[0]?.key as string) ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      website: ((item as any).company_website?.[0]?.key as string) ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      phones: ((item as any).company_contact_info?.phone_numbers ?? []).slice(0, 2).map((p: { key: string }) => p.key),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      emails: ((item as any).company_contact_info?.emails ?? []).slice(0, 2).map((e: { key: string }) => e.key),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ports: ((item as any).shipping_port ?? []).slice(0, 3).map((p: { key: string; doc_count: number }) => ({
        name: p.key,
        count: p.doc_count,
      })),
    }));

  return { companies, total, creditsRemaining: raw?.creditsRemaining };
}

export async function searchCompanyImports(opts: {
  name: string;
  pageSize?: number;
}): Promise<{ results: CompanySearchResult[]; creditsRemaining?: number }> {
  const params: Record<string, string> = {
    name: opts.name,
    page_size: String(opts.pageSize ?? 10),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await importyetiGet<any>("/company/search", params);
  const items = Array.isArray(raw?.data?.data) ? raw.data.data : Array.isArray(raw?.data) ? raw.data : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: CompanySearchResult[] = items.map((item: any) => ({
    name: item.name ?? item.title ?? item.key ?? "Unknown",
    id: item.id ?? item.key ?? "",
    address: item.address ?? null,
    website: item.website ?? null,
    totalShipments: item.total_shipments ?? 0,
  }));

  return { results, creditsRemaining: raw?.creditsRemaining };
}

export async function getCompanySuppliers(opts: {
  companyId: string;
  hsCode?: string;
  pageSize?: number;
  page?: number;
}): Promise<{ suppliers: SupplierResult[]; creditsRemaining?: number }> {
  const params: Record<string, string> = {
    company: opts.companyId,
    page_size: String(opts.pageSize ?? 10),
    page: String(opts.page ?? 1),
  };
  if (opts.hsCode) params.hs_code = normalizeHsCode(opts.hsCode);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await importyetiGet<any>("/powerquery/us-import/suppliers", params);
  const items = raw?.data?.data ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const suppliers: SupplierResult[] = items.map((item: any) => ({
    name: item.key ?? item.name_variations?.[0] ?? "Unknown",
    country: item.supplier_country_code ?? item.supplier_country ?? null,
    address: item.supplier_address?.[0]?.key ?? null,
    shipmentCount: item.doc_count ?? 0,
  }));

  return { suppliers, creditsRemaining: raw?.creditsRemaining };
}
