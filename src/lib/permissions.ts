// ── Page-level permission definitions ─────────────────────────────────────────
export const PAGE_PERMISSIONS = {
  workorders:             { label: "Work Orders",              group: "Work Orders", actions: ["view", "create", "edit", "delete"] as const },
  quotes_requests:        { label: "Quote Requests",           group: "Quotes",      actions: ["view", "create", "edit", "delete"] as const },
  quotes_factory_sheet:   { label: "Factory Cost Sheet",       group: "Quotes",      actions: ["view", "edit"] as const },
  quotes_wilfred_calc:    { label: "Cost Calc",                group: "Quotes",      actions: ["view", "edit"] as const },
  quotes_ddp_calc:        { label: "DDP Calculation",          group: "Quotes",      actions: ["view", "edit"] as const },
  quotes_customer_quote:  { label: "Customer Quote",           group: "Quotes",      actions: ["view", "edit"] as const },
  products:               { label: "Products / Molds",         group: "Catalog",     actions: ["view", "create", "edit", "delete"] as const },
  customers:              { label: "Customers & Companies",    group: "Catalog",     actions: ["view", "create", "edit", "delete"] as const },
  subscriptions:          { label: "Subscriptions",            group: "Admin",       actions: ["view", "create", "edit", "delete"] as const },
  settings:               { label: "Settings",                 group: "Admin",       actions: ["view"] as const },
} as const;

// ── Field-level permission definitions ────────────────────────────────────────
export const FIELD_PERMISSIONS = {
  quote_request: {
    label: "Quote Request Form",
    fields: {
      urgency:                "Urgency flag",
      deadline:               "Deadline",
      shipping_info_required: "Shipping info required",
      molds:                  "Mold entries (number, size, thickness)",
      printing:               "Printing specifications",
      embossment:             "Embossment",
      quantity_tiers:         "Quantity tiers",
      internal_notes:         "Internal notes",
      attachments:            "Attachments",
    },
  },
  factory_sheet: {
    label: "Factory Cost Sheet",
    fields: {
      mold_info:    "Mold & steel info",
      unit_costs:   "Unit costs per tier",
      packaging:    "Packaging details",
      shipping:     "Shipping terms",
      mold_costs:   "Mold costs (new / modify)",
      attachments:  "Attachments",
    },
  },
  wilfred_calc: {
    label: "Cost Calc",
    fields: {
      labor_cost:          "Labour cost",
      accessories_cost:    "Accessories cost",
      overhead_multiplier: "Overhead multiplier",
      margin_rate:         "Margin rate",
      wilfred_notes:       "Internal notes",
    },
  },
  ddp_calc: {
    label: "DDP Calculation",
    fields: {
      fx_rate:         "FX rate (RMB → JPY)",
      shipping_cost:   "Shipping cost",
      import_duty:     "Import duty rate",
      consumption_tax: "Consumption tax rate",
      margin:          "Selling margin",
    },
  },
  customer_quote: {
    label: "Customer Quote (御見積書)",
    fields: {
      customer_info:  "Customer contact info",
      pricing_tiers:  "Pricing tiers",
      lead_times:     "Lead times",
      payment_terms:  "Payment terms",
      mold_costs:     "Mold / sample costs",
      notes:          "Notes",
    },
  },
} as const;

// ── Default permissions (full access) ─────────────────────────────────────────
export function defaultPermissions(): Record<string, unknown> {
  const pages: Record<string, Record<string, boolean>> = {};
  for (const [key, def] of Object.entries(PAGE_PERMISSIONS)) {
    pages[key] = Object.fromEntries(def.actions.map((a) => [a, true]));
  }
  const fields: Record<string, Record<string, boolean>> = {};
  for (const [formKey, formDef] of Object.entries(FIELD_PERMISSIONS)) {
    fields[formKey] = Object.fromEntries(Object.keys(formDef.fields).map((f) => [f, true]));
  }
  return { pages, fields };
}

export type PageKey = keyof typeof PAGE_PERMISSIONS;
export type FieldFormKey = keyof typeof FIELD_PERMISSIONS;
