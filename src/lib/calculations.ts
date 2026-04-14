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
  // Container capacities (tins per container) from factory sheet — used in auto mode
  pcs20GP?: number; // tins that fit in a 20GP
  pcs40GP?: number; // tins that fit in a 40GP
  pcs40HQ?: number; // tins that fit in a 40HQ (0 or undefined = 40HQ disabled for this customer)
  // Shipping
  shippingType: "auto" | "lcl" | "fcl_20gp" | "fcl_40gp" | "fcl_40hq" | "multi_container";
  manualShippingCostJpy?: number; // override for multi_container
  // Buffer for production order (default 5%)
  bufferPct?: number;      // default 0.05
  // Configurable shipping rates (fall back to defaults if not provided)
  lclRatePerCbm?: number;  // default 23000
  lclBaseFee?: number;     // default 10000
  fcl20gpCost?: number;    // default 250000
  fcl40gpCost?: number;    // default 400000
  fcl40hqCost?: number;    // default 450000 (0 = 40HQ disabled)
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
  shippingMethod: string; // human-readable: "LCL", "20GP", "40GP+20GP", "2×40GP", etc.
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

// ─────────────────────────────────────────────────────────────
// AUTO SHIPPING METHOD SELECTOR
// Picks the cheapest valid shipping arrangement for a given pallet count
// Rules (per user):
//   - If pallets fit in one 20GP: compare LCL vs 20GP, pick cheaper
//   - If pallets > 20GP capacity: LCL is no longer considered
//   - For pallets > 20GP: find cheapest combination of {20GP, 40GP, 40HQ}
//     that fits all pallets. 40HQ is only considered if its price > 0.
//   - LCL uses a minimum of 1 CBM (so minimum LCL = baseFee + ratePerCbm)
// ─────────────────────────────────────────────────────────────
function pickShippingMethod({
  pallets,
  totalCBM,
  pcsOrdered,
  pcs20GP,
  pcs40GP,
  pcs40HQ,
  lclRatePerCbm,
  lclBaseFee,
  fcl20gpCost,
  fcl40gpCost,
  fcl40hqCost,
}: {
  pallets: number;
  totalCBM: number;
  pcsOrdered: number;
  pcs20GP: number;
  pcs40GP: number;
  pcs40HQ: number;
  lclRatePerCbm: number;
  lclBaseFee: number;
  fcl20gpCost: number;
  fcl40gpCost: number;
  fcl40hqCost: number;
}): { cost: number; method: string } {
  // Derive pallet capacity per container from tins-per-container ÷ pcs-per-pallet.
  // pcsPerPallet we can back-compute: totalCBM is based on pallets; instead we'll
  // compute capacity directly in tins. We'll express "fits" as pcsOrdered ≤ container capacity.
  // (This is equivalent to pallet-count comparisons and avoids rounding issues.)
  const hq = fcl40hqCost > 0 && pcs40HQ > 0;

  // LCL cost with minimum of 1 CBM
  const cbmForLcl = Math.max(1, totalCBM);
  const lclCost = Math.round(cbmForLcl * lclRatePerCbm + lclBaseFee);

  // Single 20GP fits?
  const fitsOne20GP = pcs20GP > 0 && pcsOrdered <= pcs20GP;
  if (fitsOne20GP) {
    // Compare LCL vs 20GP, pick cheaper
    if (lclCost <= fcl20gpCost) {
      return { cost: lclCost, method: "LCL" };
    }
    return { cost: fcl20gpCost, method: "20GP" };
  }

  // Enumerate combinations for multi-container shipments.
  // Variables: a = #20GP, b = #40GP, c = #40HQ
  // Constraint: a*pcs20GP + b*pcs40GP + c*pcs40HQ >= pcsOrdered
  // Minimize:   a*fcl20gpCost + b*fcl40gpCost + c*fcl40hqCost
  // Bounds: each container count can't exceed pallets (safe upper bound)
  const maxA = pcs20GP > 0 ? Math.ceil(pallets) + 1 : 0;
  const maxB = pcs40GP > 0 ? Math.ceil(pallets) + 1 : 0;
  const maxC = hq ? Math.ceil(pallets) + 1 : 0;

  let best: { cost: number; method: string } | null = null;
  const considerCombo = (a: number, b: number, c: number) => {
    if (a === 0 && b === 0 && c === 0) return;
    const cap = a * pcs20GP + b * pcs40GP + c * pcs40HQ;
    if (cap < pcsOrdered) return;
    const cost = a * fcl20gpCost + b * fcl40gpCost + c * fcl40hqCost;
    // Build label e.g. "40GP+20GP", "2×40GP", "40HQ+40GP+20GP"
    const parts: string[] = [];
    if (c > 0) parts.push(c === 1 ? "40HQ" : `${c}×40HQ`);
    if (b > 0) parts.push(b === 1 ? "40GP" : `${b}×40GP`);
    if (a > 0) parts.push(a === 1 ? "20GP" : `${a}×20GP`);
    const method = parts.join("+");
    if (!best || cost < best.cost) best = { cost, method };
  };

  // Bounded search — typical pallet counts are small, so 20×20×20 = 8000 iterations worst case.
  for (let c = 0; c <= maxC; c++) {
    for (let b = 0; b <= maxB; b++) {
      // Minimum a needed given b and c
      const coveredByBC = b * pcs40GP + c * pcs40HQ;
      if (coveredByBC >= pcsOrdered) {
        considerCombo(0, b, c);
        // Don't need any 20GP; but larger c/b already considered below; skip adding a's
        continue;
      }
      if (pcs20GP > 0) {
        const remaining = pcsOrdered - coveredByBC;
        const minA = Math.ceil(remaining / pcs20GP);
        // Only minA is ever optimal (more 20GP just adds cost for no benefit)
        if (minA <= maxA) considerCombo(minA, b, c);
      }
    }
  }

  if (!best) {
    // Fallback — shouldn't happen if at least one container type is configured
    return { cost: lclCost, method: "LCL" };
  }
  return best;
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
    pcs20GP = 0,
    pcs40GP = 0,
    pcs40HQ = 0,
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

  // Shipping cost (JPY) + selected method label
  let shippingCostJpy: number;
  let shippingMethod: string;
  if (shippingType === "auto") {
    const picked = pickShippingMethod({
      pallets,
      totalCBM,
      pcsOrdered: factoryProductionQty,
      pcs20GP,
      pcs40GP,
      pcs40HQ,
      lclRatePerCbm,
      lclBaseFee,
      fcl20gpCost,
      fcl40gpCost,
      fcl40hqCost,
    });
    shippingCostJpy = picked.cost;
    shippingMethod = picked.method;
  } else if (shippingType === "multi_container") {
    shippingCostJpy = manualShippingCostJpy ?? 0;
    shippingMethod = "Multi-container (manual)";
  } else if (shippingType === "lcl") {
    const cbmForLcl = Math.max(1, totalCBM);
    shippingCostJpy = Math.round(cbmForLcl * lclRatePerCbm + lclBaseFee);
    shippingMethod = "LCL";
  } else if (shippingType === "fcl_20gp") {
    shippingCostJpy = fcl20gpCost;
    shippingMethod = "20GP";
  } else if (shippingType === "fcl_40gp") {
    shippingCostJpy = fcl40gpCost;
    shippingMethod = "40GP";
  } else if (shippingType === "fcl_40hq") {
    shippingCostJpy = fcl40hqCost;
    shippingMethod = "40HQ";
  } else {
    shippingCostJpy = 0;
    shippingMethod = "—";
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
    shippingMethod,
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
