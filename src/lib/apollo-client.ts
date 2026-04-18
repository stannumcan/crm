// Server-side Apollo.io API wrapper for lead enrichment.
// Used by API routes and the daily cron job.

const APOLLO_BASE = "https://api.apollo.io";

function getApiKey(): string {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error("APOLLO_API_KEY is not set");
  return key;
}

async function apolloPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${APOLLO_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apollo ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApolloOrganization {
  name: string;
  website_url: string | null;
  industry: string | null;
  estimated_num_employees: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  founded_year: number | null;
  linkedin_url: string | null;
  short_description: string | null;
  total_funding: number | null;
  technologies: string[];
}

export interface ApolloPerson {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone_numbers: { sanitized_number: string }[];
  organization: { name: string } | null;
}

// ── API functions ────────────────────────────────────────────────────────────

export async function enrichCompany(
  domain?: string,
  name?: string
): Promise<ApolloOrganization | null> {
  if (!domain && !name) return null;
  const body: Record<string, unknown> = {};
  if (domain) body.domain = domain;
  if (name) body.name = name;

  const data = await apolloPost<{ organization: ApolloOrganization | null }>(
    "/v1/organizations/enrich",
    body
  );
  return data.organization ?? null;
}

export async function searchPeople(opts: {
  companyDomain?: string;
  companyName?: string;
  titles?: string[];
  locations?: string[];
  limit?: number;
}): Promise<ApolloPerson[]> {
  const body: Record<string, unknown> = {
    page: 1,
    per_page: Math.min(opts.limit ?? 10, 25),
  };
  if (opts.titles?.length) body.person_titles = opts.titles;
  if (opts.companyDomain) body.q_organization_domains_list = [opts.companyDomain];
  if (opts.companyName) body.q_organization_name = opts.companyName;
  if (opts.locations?.length) body.person_locations = opts.locations;

  const data = await apolloPost<{ people: ApolloPerson[] }>(
    "/v1/mixed_people/api_search",
    body
  );
  return data.people ?? [];
}

export async function searchCompanies(opts: {
  keywords?: string[];
  industries?: string[];
  locations?: string[];
  employeeRange?: string;
  limit?: number;
}): Promise<ApolloOrganization[]> {
  const body: Record<string, unknown> = {
    page: 1,
    per_page: Math.min(opts.limit ?? 15, 25),
  };
  if (opts.keywords?.length) body.q_organization_keyword_tags = opts.keywords;
  if (opts.industries?.length) body.organization_industry_tag_ids = opts.industries;
  if (opts.locations?.length) body.organization_locations = opts.locations;
  if (opts.employeeRange) body.organization_num_employees_ranges = [opts.employeeRange];

  const data = await apolloPost<{ organizations: ApolloOrganization[] }>(
    "/v1/mixed_companies/search",
    body
  );
  return data.organizations ?? [];
}

export async function enrichPerson(opts: {
  apolloId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  organizationDomain?: string;
  linkedinUrl?: string;
}): Promise<ApolloPerson | null> {
  const body: Record<string, unknown> = { reveal_personal_emails: true };
  if (opts.apolloId) body.id = opts.apolloId;
  if (opts.email) body.email = opts.email;
  if (opts.firstName) body.first_name = opts.firstName;
  if (opts.lastName) body.last_name = opts.lastName;
  if (opts.organizationDomain) body.organization_domain = opts.organizationDomain;
  if (opts.linkedinUrl) body.linkedin_url = opts.linkedinUrl;

  const data = await apolloPost<{ person: ApolloPerson | null }>(
    "/v1/people/match",
    body
  );
  return data.person ?? null;
}
