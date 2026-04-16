// ─────────────────────────────────────────────────────────────
// Workorder milestone definitions
//
// Each workorder follows one of three flows (new / existing / modification).
// The milestone list is the same superset — milestones not applicable to a
// flow are marked 'not_applicable' when seeded, and hidden in the UI.
//
// Some milestones are conditional within a flow (e.g., pre-prod sample PO
// is only needed if it wasn't bundled in the initial sample PO). Those start
// as 'pending' and can be manually marked 'skipped' by the user.
// ─────────────────────────────────────────────────────────────

export type MouldFlow = "new" | "existing" | "modification";

export type MilestoneStatus = "pending" | "in_progress" | "completed" | "skipped" | "not_applicable";

export interface MilestoneField {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "currency";
  placeholder?: string;
}

export interface MilestoneDef {
  key: string;
  label: string;
  labelJa?: string;
  group: "quoting" | "sampling" | "tooling" | "production" | "shipping" | "financial" | "close";
  flows: MouldFlow[];
  auto?: boolean;
  conditional?: boolean;
  fields?: MilestoneField[];
  sortOrder: number;
}

export const MILESTONE_DEFS: MilestoneDef[] = [
  // ── Quoting ────────────────────────────────────────────────
  {
    key: "customer_contacted",
    label: "Customer Contacted",
    labelJa: "顧客連絡済",
    group: "quoting",
    flows: ["new", "existing", "modification"],
    sortOrder: 5,
  },
  {
    key: "quote_requested",
    label: "Quote Requested",
    labelJa: "見積依頼",
    group: "quoting",
    flows: ["new", "existing", "modification"],
    auto: true,
    sortOrder: 10,
  },
  {
    key: "quote_sent",
    label: "Customer Quote Sent",
    labelJa: "御見積書送付",
    group: "quoting",
    flows: ["new", "existing", "modification"],
    auto: true,
    sortOrder: 15,
  },
  {
    key: "price_accepted",
    label: "Price Accepted",
    labelJa: "価格承認",
    group: "quoting",
    flows: ["new", "existing", "modification"],
    auto: true,
    sortOrder: 20,
  },

  // ── Sampling — plastic (new mould only) ───────────────────
  {
    key: "sample_po",
    label: "Sample PO Received",
    labelJa: "サンプルPO受領",
    group: "sampling",
    flows: ["new", "existing", "modification"],
    fields: [
      { key: "po_number", label: "PO Number", type: "text", placeholder: "TS-2026-0042" },
      { key: "amount", label: "Amount", type: "currency" },
    ],
    sortOrder: 30,
  },
  {
    key: "plastic_sample_made",
    label: "Plastic Sample Made",
    labelJa: "プラスチックサンプル完成",
    group: "sampling",
    flows: ["new"],
    sortOrder: 40,
  },
  {
    key: "plastic_sample_shipped",
    label: "Plastic Sample Shipped",
    labelJa: "プラスチックサンプル発送",
    group: "sampling",
    flows: ["new"],
    fields: [
      { key: "tracking_number", label: "Tracking #", type: "text" },
      { key: "carrier", label: "Carrier", type: "text", placeholder: "DHL / FedEx" },
    ],
    sortOrder: 50,
  },
  {
    key: "plastic_sample_approved",
    label: "Plastic Sample Approved",
    labelJa: "プラスチックサンプル承認",
    group: "sampling",
    flows: ["new"],
    sortOrder: 60,
  },

  // ── Tooling (new / modification) ──────────────────────────
  {
    key: "tooling_po",
    label: "Tooling PO Received",
    labelJa: "金型PO受領",
    group: "tooling",
    flows: ["new", "modification"],
    fields: [
      { key: "po_number", label: "PO Number", type: "text" },
      { key: "amount", label: "Amount", type: "currency" },
    ],
    sortOrder: 70,
  },
  {
    key: "mould_fabrication_start",
    label: "Mould Fabrication Started",
    labelJa: "金型製作開始",
    group: "tooling",
    flows: ["new", "modification"],
    sortOrder: 80,
  },
  {
    key: "mould_fabrication_complete",
    label: "Mould Fabrication Complete",
    labelJa: "金型製作完了",
    group: "tooling",
    flows: ["new", "modification"],
    sortOrder: 90,
  },

  // ── Pre-production sample ─────────────────────────────────
  {
    key: "preprod_sample_po",
    label: "Pre-prod Sample PO Received",
    labelJa: "量産前サンプルPO受領",
    group: "sampling",
    flows: ["new", "existing", "modification"],
    conditional: true,
    fields: [
      { key: "po_number", label: "PO Number", type: "text" },
      { key: "amount", label: "Amount", type: "currency" },
    ],
    sortOrder: 100,
  },
  {
    key: "artwork_received",
    label: "Artwork Received",
    labelJa: "アートワーク受領",
    group: "sampling",
    flows: ["new", "existing", "modification"],
    sortOrder: 110,
  },
  {
    key: "preprod_sample_made",
    label: "Pre-prod Sample Made",
    labelJa: "量産前サンプル完成",
    group: "sampling",
    flows: ["new", "existing", "modification"],
    sortOrder: 120,
  },
  {
    key: "preprod_sample_shipped",
    label: "Pre-prod Sample Shipped",
    labelJa: "量産前サンプル発送",
    group: "sampling",
    flows: ["new", "existing", "modification"],
    fields: [
      { key: "tracking_number", label: "Tracking #", type: "text" },
      { key: "carrier", label: "Carrier", type: "text", placeholder: "DHL / FedEx" },
    ],
    sortOrder: 130,
  },
  {
    key: "preprod_sample_approved",
    label: "Pre-prod Sample Approved",
    labelJa: "量産前サンプル承認",
    group: "sampling",
    flows: ["new", "existing", "modification"],
    sortOrder: 140,
  },

  // ── Mass production ───────────────────────────────────────
  {
    key: "production_po",
    label: "Mass Production PO Received",
    labelJa: "量産PO受領",
    group: "production",
    flows: ["new", "existing", "modification"],
    fields: [
      { key: "po_number", label: "PO Number", type: "text" },
      { key: "amount", label: "Amount", type: "currency" },
    ],
    sortOrder: 150,
  },
  {
    key: "production_start",
    label: "Production Started",
    labelJa: "量産開始",
    group: "production",
    flows: ["new", "existing", "modification"],
    sortOrder: 160,
  },
  {
    key: "production_complete",
    label: "Production Complete",
    labelJa: "量産完了",
    group: "production",
    flows: ["new", "existing", "modification"],
    sortOrder: 170,
  },

  // ── Shipping ──────────────────────────────────────────────
  {
    key: "shipped",
    label: "Shipped (Ocean)",
    labelJa: "出荷（海上輸送）",
    group: "shipping",
    flows: ["new", "existing", "modification"],
    fields: [
      { key: "bl_number", label: "B/L Number", type: "text" },
      { key: "container_number", label: "Container #", type: "text" },
      { key: "vessel", label: "Vessel Name", type: "text" },
      { key: "etd", label: "ETD", type: "date" },
      { key: "eta", label: "ETA", type: "date" },
    ],
    sortOrder: 180,
  },
  {
    key: "delivered",
    label: "Delivered",
    labelJa: "納品完了",
    group: "shipping",
    flows: ["new", "existing", "modification"],
    fields: [
      { key: "delivery_date", label: "Delivery Date", type: "date" },
    ],
    sortOrder: 190,
  },

  // ── Financial ─────────────────────────────────────────────
  {
    key: "invoice_sent",
    label: "Invoice Sent",
    labelJa: "請求書送付",
    group: "financial",
    flows: ["new", "existing", "modification"],
    fields: [
      { key: "invoice_number", label: "Invoice #", type: "text" },
      { key: "amount", label: "Amount", type: "currency" },
      { key: "due_date", label: "Due Date", type: "date" },
    ],
    sortOrder: 200,
  },
  {
    key: "payment_received",
    label: "Payment Received",
    labelJa: "入金確認",
    group: "financial",
    flows: ["new", "existing", "modification"],
    fields: [
      { key: "amount", label: "Amount", type: "currency" },
      { key: "payment_date", label: "Payment Date", type: "date" },
      { key: "reference", label: "Reference / Bank Ref", type: "text" },
    ],
    sortOrder: 210,
  },

  // ── Close ─────────────────────────────────────────────────
  {
    key: "closed",
    label: "Closed",
    labelJa: "完了",
    group: "close",
    flows: ["new", "existing", "modification"],
    sortOrder: 220,
  },
];

// Helper: get the milestones applicable to a given flow
export function milestonesForFlow(flow: MouldFlow): MilestoneDef[] {
  return MILESTONE_DEFS.filter((m) => m.flows.includes(flow));
}

// Group labels
export const GROUP_LABELS: Record<string, string> = {
  quoting: "Quoting",
  sampling: "Sampling",
  tooling: "Tooling",
  production: "Production",
  shipping: "Shipping & Delivery",
  financial: "Financial",
  close: "Close",
};
