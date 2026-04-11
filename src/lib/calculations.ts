// ─────────────────────────────────────────────────────────────
// WILFRED'S COST FORMULA
// Estimated Cost = (总成本合计 + 人工 + 配件 + 人工×overhead) × (1 + margin)
// Default: overhead = 1.0 (1:1 with labor), margin = 0.20 (20%)
// ─────────────────────────────────────────────────────────────
export function calculateWilfredCost({
  totalSubtotal,
  laborCost,
  accessoriesCost,
  overheadMultiplier = 1.0,
  marginRate = 0.2,
}: {
  totalSubtotal: number;
  laborCost: number;
  accessoriesCost: number;
  overheadMultiplier?: number;
  marginRate?: number;
}): number {
  const overhead = laborCost * overheadMultiplier;
  const base = totalSubtotal + laborCost + accessoriesCost + overhead;
  return base * (1 + marginRate);
}

// ─────────────────────────────────────────────────────────────
// NATSUKI DDP CALCULATION
// All costs in JPY, result is unit price in JPY
// ─────────────────────────────────────────────────────────────

export interface DDPInputs {
  // Product
  customerOrderQty: number;
  rmbUnitPrice: number;
  fxRate: number; // 1 RMB = X JPY
  // Packaging
  pcsPerCarton: number;
  boxLmm: number;
  boxWmm: number;
  boxHmm: number;
  palletLmm: number;
  palletWmm: number;
  palletHmm: number;
  boxesPerPallet: number;
  // Shipping
  shippingType: "lcl" | "fcl_20gp" | "fcl_40gp" | "fcl_40hq" | "multi_container";
  manualShippingCostJpy?: number; // override for multi_container
  // Buffer for production order (default 5%)
  bufferPct?: number;      // default 0.05
  // Configurable shipping rates (fall back to defaults if not provided)
  lclRatePerCbm?: number;  // default 23000
  lclBaseFee?: number;     // default 10000
  fcl20gpCost?: number;    // default 250000
  fcl40gpCost?: number;    // default 400000
  fcl40hqCost?: number;    // default 450000
  // Margin options to compute (default [0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25])
  margins?: number[];
  // Costs
  importDutyRate: number; // default 0.04
  consumptionTaxRate: number; // default 0.0
  selectedMargin: number; // e.g. 0.40
}

export interface DDPResult {
  // Logistics
  cartonsOrdered: number;
  factoryProductionQty: number;
  pallets: number;
  totalCBM: number;
  // Costs (JPY)
  shippingCostJpy: number;
  manufacturingCostJpy: number;
  importDutyJpy: number;
  consumptionTaxJpy: number;
  totalCostJpy: number;
  // Pricing
  totalRevenueJpy: number;
  unitPriceJpy: number;
  // All margin options (25%–60%)
  marginOptions: { margin: number; total: number; unitPrice: number }[];
}

export function calculateDDP(inputs: DDPInputs): DDPResult {
  const {
    customerOrderQty,
    rmbUnitPrice,
    fxRate,
    pcsPerCarton,
    boxLmm,
    boxWmm,
    boxHmm,
    palletLmm,
    palletWmm,
    palletHmm,
    boxesPerPallet,
    shippingType,
    manualShippingCostJpy,
    bufferPct = 0.05,
    lclRatePerCbm = 23000,
    lclBaseFee = 10000,
    fcl20gpCost = 250000,
    fcl40gpCost = 400000,
    fcl40hqCost = 450000,
    margins = [0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25],
    importDutyRate,
    consumptionTaxRate,
    selectedMargin,
  } = inputs;

  // Box and pallet volumes (m³)
  const boxCBM = (boxLmm * boxWmm * boxHmm) / 1_000_000_000;
  const palletBaseCBM = (palletLmm * palletWmm * palletHmm) / 1_000_000_000;
  const palletCBM = boxCBM * boxesPerPallet + palletBaseCBM;

  // Production qty (customer qty + buffer%, rounded DOWN to full cartons)
  const cartonsOrdered = Math.floor((customerOrderQty * (1 + bufferPct)) / pcsPerCarton);
  const factoryProductionQty = cartonsOrdered * pcsPerCarton;

  // Pallets and total CBM
  const pallets = Math.ceil(cartonsOrdered / boxesPerPallet);
  const totalCBM = Math.ceil(palletCBM * pallets);

  // Manufacturing cost (JPY)
  const manufacturingCostJpy = Math.round(factoryProductionQty * rmbUnitPrice * fxRate);

  // Shipping cost (JPY)
  let shippingCostJpy: number;
  if (shippingType === "multi_container") {
    shippingCostJpy = manualShippingCostJpy ?? 0;
  } else if (shippingType === "lcl") {
    shippingCostJpy = Math.round(totalCBM * lclRatePerCbm + lclBaseFee);
  } else if (shippingType === "fcl_20gp") {
    shippingCostJpy = fcl20gpCost;
  } else if (shippingType === "fcl_40gp") {
    shippingCostJpy = fcl40gpCost;
  } else if (shippingType === "fcl_40hq") {
    shippingCostJpy = fcl40hqCost;
  } else {
    shippingCostJpy = 0;
  }

  // Duty and tax
  const importDutyJpy = Math.round((manufacturingCostJpy + shippingCostJpy) * importDutyRate);
  const consumptionTaxJpy = Math.round(
    (manufacturingCostJpy + shippingCostJpy + importDutyJpy) * consumptionTaxRate
  );
  const totalCostJpy = manufacturingCostJpy + shippingCostJpy + importDutyJpy + consumptionTaxJpy;

  // Pricing at selected margin
  const totalRevenueJpy = Math.round(totalCostJpy * (1 + selectedMargin));
  const unitPriceJpy = Math.round(totalRevenueJpy / customerOrderQty);

  // All margin options (using provided or default margins array)
  const marginOptions = margins.map((margin) => {
    const total = Math.round(totalCostJpy * (1 + margin));
    return {
      margin,
      total,
      unitPrice: Math.round(total / customerOrderQty),
    };
  });

  return {
    cartonsOrdered,
    factoryProductionQty,
    pallets,
    totalCBM,
    shippingCostJpy,
    manufacturingCostJpy,
    importDutyJpy,
    consumptionTaxJpy,
    totalCostJpy,
    totalRevenueJpy,
    unitPriceJpy,
    marginOptions,
  };
}

// ─────────────────────────────────────────────────────────────
// WO NUMBER GENERATOR
// ─────────────────────────────────────────────────────────────
export function formatWONumber(region: string, yearCode: string, sequence: number): string {
  return `${region}${yearCode}${String(sequence).padStart(4, "0")}`;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
export function formatRMB(amount: number): string {
  return `¥${amount.toFixed(2)} RMB`;
}

export function formatJPY(amount: number): string {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(amount);
}
