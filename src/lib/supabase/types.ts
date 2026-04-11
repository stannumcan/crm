export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type QuoteStatus =
  | "draft"
  | "pending_factory"
  | "pending_wilfred"
  | "pending_natsuki"
  | "sent"
  | "approved"
  | "rejected";

export type MoldType = "existing" | "new";
export type QuantityType = "units" | "fcl_20ft" | "fcl_40ft";
export type ShippingType = "lcl" | "fcl_20gp" | "fcl_40gp" | "fcl_40hq" | "multi_container";
export type Component = "lid" | "body" | "bottom" | "inner_lid";
export type WOStatus = "active" | "completed" | "cancelled";

export interface Database {
  public: {
    Tables: {
      work_orders: {
        Row: WorkOrder;
        Insert: Omit<WorkOrder, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<WorkOrder, "id">>;
        Relationships: [];
      };
      quotations: {
        Row: Quotation;
        Insert: Omit<Quotation, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Quotation, "id">>;
        Relationships: [];
      };
      quotation_quantity_tiers: {
        Row: QuotationQuantityTier;
        Insert: Omit<QuotationQuantityTier, "id">;
        Update: Partial<Omit<QuotationQuantityTier, "id">>;
        Relationships: [];
      };
      quotation_attachments: {
        Row: QuotationAttachment;
        Insert: Omit<QuotationAttachment, "id" | "uploaded_at">;
        Update: Partial<Omit<QuotationAttachment, "id">>;
        Relationships: [];
      };
      factory_cost_sheets: {
        Row: FactoryCostSheet;
        Insert: Omit<FactoryCostSheet, "id" | "created_at">;
        Update: Partial<Omit<FactoryCostSheet, "id">>;
        Relationships: [];
      };
      factory_cost_components: {
        Row: FactoryCostComponent;
        Insert: Omit<FactoryCostComponent, "id">;
        Update: Partial<Omit<FactoryCostComponent, "id">>;
        Relationships: [];
      };
      factory_cost_tiers: {
        Row: FactoryCostTier;
        Insert: Omit<FactoryCostTier, "id">;
        Update: Partial<Omit<FactoryCostTier, "id">>;
        Relationships: [];
      };
      wilfred_calculations: {
        Row: WilfredCalculation;
        Insert: Omit<WilfredCalculation, "id" | "created_at">;
        Update: Partial<Omit<WilfredCalculation, "id">>;
        Relationships: [];
      };
      annie_quotations: {
        Row: AnnieQuotation;
        Insert: Omit<AnnieQuotation, "id" | "date_generated">;
        Update: Partial<Omit<AnnieQuotation, "id">>;
        Relationships: [];
      };
      natsuki_ddp_calculations: {
        Row: NatsukiDDPCalculation;
        Insert: Omit<NatsukiDDPCalculation, "id" | "created_at">;
        Update: Partial<Omit<NatsukiDDPCalculation, "id">>;
        Relationships: [];
      };
      customer_quotes: {
        Row: CustomerQuote;
        Insert: Omit<CustomerQuote, "id" | "created_at">;
        Update: Partial<Omit<CustomerQuote, "id">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export interface WorkOrder {
  id: string;
  wo_number: string;
  region: string;
  year_code: string;
  sequence_number: number;
  company_name: string;
  project_name: string;
  status: WOStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Quotation {
  id: string;
  wo_id: string;
  quote_version: number;
  status: QuoteStatus;
  urgency: boolean;
  deadline: string | null;
  mold_type: MoldType;
  mold_number: string | null;
  size_dimensions: string | null;
  printing_lid: string | null;
  printing_body: string | null;
  printing_bottom: string | null;
  printing_inner: string | null;
  embossment: boolean;
  embossment_components: string | null;
  design_count: number | null;
  shipping_info_required: boolean;
  internal_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationQuantityTier {
  id: string;
  quotation_id: string;
  tier_label: string;
  quantity_type: QuantityType;
  quantity: number | null;
  sort_order: number;
}

export interface QuotationAttachment {
  id: string;
  quotation_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  uploaded_at: string;
}

export interface FactoryCostSheet {
  id: string;
  quotation_id: string;
  factory_ref_no: string | null;
  sheet_date: string | null;
  mold_number: string | null;
  product_dimensions: string | null;
  steel_type: string | null;
  steel_thickness: number | null;
  steel_price_per_ton: number | null;
  process: string | null;
  shipping_terms: string | null;
  accessories_name: string | null;
  accessories_description: string | null;
  outer_carton_qty: number | null;
  outer_carton_config: string | null;
  outer_carton_l: number | null;
  outer_carton_w: number | null;
  outer_carton_h: number | null;
  outer_carton_cbm: number | null;
  inner_carton_qty: number | null;
  pallet_type: string | null;
  pallet_l: number | null;
  pallet_w: number | null;
  pallet_h: number | null;
  pallet_config: string | null;
  cans_per_pallet: number | null;
  mold_cost_new: number | null;
  mold_cost_modify: number | null;
  mold_lead_time_days: number | null;
  created_at: string;
}

export interface FactoryCostComponent {
  id: string;
  cost_sheet_id: string;
  component: Component;
  cut_size: string | null;
  layout: string | null;
  steel_unit_price: number | null;
  printing_requirements: string | null;
  printing_cost_per_sheet: number | null;
  printing_unit_price: number | null;
}

export interface FactoryCostTier {
  id: string;
  cost_sheet_id: string;
  tier_label: string;
  quantity: number;
  steel_cost: number | null;
  printing_cost: number | null;
  packaging_cost: number | null;
  shipping_cost: number | null;
  total_subtotal: number | null;
  labor_cost: number | null;
  accessories_cost: number | null;
  container_info: string | null;
}

export interface WilfredCalculation {
  id: string;
  cost_sheet_id: string;
  tier_label: string;
  quantity: number;
  total_subtotal: number;
  labor_cost: number;
  accessories_cost: number;
  overhead_multiplier: number;
  margin_rate: number;
  estimated_cost_rmb: number | null;
  approved: boolean;
  approved_at: string | null;
  wilfred_notes: string | null;
  created_at: string;
}

export interface AnnieQuotation {
  id: string;
  quotation_id: string;
  date_generated: string;
  date_sent: string | null;
  notes: string | null;
  file_url: string | null;
}

export interface NatsukiDDPCalculation {
  id: string;
  quotation_id: string;
  annie_quotation_id: string | null;
  tier_label: string;
  quantity: number;
  rmb_unit_price: number;
  fx_rate_rmb_to_jpy: number;
  shipping_type: ShippingType;
  shipping_cost_jpy: number | null;
  import_duty_rate: number;
  consumption_tax_rate: number;
  cartons_ordered: number | null;
  factory_production_qty: number | null;
  pallets: number | null;
  total_cbm: number | null;
  manufacturing_cost_jpy: number | null;
  total_cost_jpy: number | null;
  selected_margin: number | null;
  unit_price_jpy: number | null;
  total_revenue_jpy: number | null;
  created_at: string;
}

export interface CustomerQuote {
  id: string;
  quotation_id: string;
  ddp_calculation_id: string | null;
  winhoop_quote_number: string | null;
  customer_name: string;
  customer_contact: string | null;
  date_sent: string | null;
  mold_cost_jpy: number | null;
  emboss_cost_jpy: number | null;
  sample_cost_jpy: number | null;
  lead_time_mold: string | null;
  lead_time_sample: string | null;
  lead_time_production: string | null;
  payment_terms_tooling: string | null;
  payment_terms_production: string | null;
  validity_days: number | null;
  fx_rate_note: number | null;
  notes: string | null;
  file_url: string | null;
  created_at: string;
}

// Extended types with joins
export interface QuotationWithWO extends Quotation {
  work_order: WorkOrder;
  quantity_tiers: QuotationQuantityTier[];
}

export interface WorkOrderWithQuotations extends WorkOrder {
  quotations: Quotation[];
}
