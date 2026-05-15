export type BreakdownItem = {
    label: string;
    amount: number | string | null;
    formulaReference: string;
};

export type CountryCost = {
    country: string;
    amount: number | string | null;
    rank: number | string | null;
    breakdown: BreakdownItem[];
};

export type VendorBreakdownRow = {
    label: string;
    amount: string | number | null;
    formulaReference?: string;
  };

export type VendorBreakdownEntry = {
  destination: string;
  sourceCountry: string;
  month: string;
  year: string | number;
  rows: VendorBreakdownRow[];
  supplierName?: string;
  supplier?: string;
  vendor?: string;
};

  
export type VendorBreakdown = {
  destination: string;
  sourceCountry: string;
  month: string;
  year: string | number;
  rows: VendorBreakdownRow[];
  vendorBreakdowns: VendorBreakdownEntry[];
};
  

export type ApiResponse = {
    destination: string;
    supplierPrice: number;
    month: string;
    countries: CountryCost[];
    vendorBreakdowns: VendorBreakdown[];
};

export const formatAmount = (value: number | string | null | undefined) => {
    if (value === null || value === undefined || value === "") return "N/A";
    if (typeof value === "number") {
        return new Intl.NumberFormat("en-US", {
            maximumFractionDigits: 1,
        }).format(value);
    }
    return String(value);
};

/** Raw = supplier TLC − market research TLC. Shown negated so above-market (company loss) is −$/MT, below-market is +$/MT. */
export const formatDeltaVersusMarketForCompany = (supplierMinusMarket: number): string => {
    const shown = -supplierMinusMarket;
    return `${shown > 0 ? "+" : ""}$${formatAmount(shown)}/MT`;
};
