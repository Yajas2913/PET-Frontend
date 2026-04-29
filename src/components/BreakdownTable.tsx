import React, { useMemo } from "react";
import type { BreakdownItem } from "../types";
import { formatAmount } from "../types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type VendorBreakdownItem = {
  label: string;
  amount: string | number | null | undefined;
  formulaReference?: string;
};

type BreakdownTableProps = {
  breakdown: BreakdownItem[];
  vendorBreakdown?: VendorBreakdownItem[];
  isDummyMarketResearchData?: boolean;
};

const COMMON_COMPONENT_ORDER = [
  "Resin Index",
  "Freight",
  "Insurance",
  "Duty & Import Taxes",
  "Local Taxes & Fees",
  "Logistics & Other Costs",
  "Total Landed Cost (PET Resin)",
  "Final Price",
];

const SUPPLIER_MAPPING: Record<string, string> = {
  "icis china mid (n-1)": "Resin Index",
  "finance": "Insurance",
  "freight china-buenaventura (regular)": "Freight",
  "freight china-buenaventura (incremental)": "Freight",
  "duty 5% (change according to regulation)": "Duty & Import Taxes",
  "landed factor 8%": "Local Taxes & Fees",
  "zf legislation change": "Local Taxes & Fees",
  "sur charge alpek br": "Logistics & Other Costs",
  "total resin price abi virgin formula": "Total Landed Cost (PET Resin)",
  "final price fifo": "Final Price",
};

const MARKET_MAPPING: Record<string, string> = {
  "pet resin cost (fob):": "Resin Index",
  "freight cost:": "Freight",
  "insurance": "Insurance",
  "import duty:": "Duty & Import Taxes",
  "anti-dumping duty:": "Duty & Import Taxes",
  "ipi": "Duty & Import Taxes",
  "pis": "Local Taxes & Fees",
  "confins": "Local Taxes & Fees",
  "statistical fee": "Local Taxes & Fees",
  "additional vat": "Local Taxes & Fees",
  "income tax perception": "Local Taxes & Fees",
  "ibb": "Local Taxes & Fees",
  "tasa consular": "Local Taxes & Fees",
  "customs service fee": "Local Taxes & Fees",
  "irae": "Local Taxes & Fees",
  "customs insurance": "Insurance",
  "impuesto general a las ventas (igv & ipm)": "Local Taxes & Fees",
  "percepción igv": "Local Taxes & Fees",
  "fodinfa": "Duty & Import Taxes",
  "taxes (vat/import):": "Duty & Import Taxes",
  "destination port to supplier location transportation": "Logistics & Other Costs",
  "total landed cost (pet resin)": "Total Landed Cost (PET Resin)",
};

const BreakdownTable: React.FC<BreakdownTableProps> = ({
  breakdown,
  vendorBreakdown = [],
  isDummyMarketResearchData = false,
}) => {
  const toNumber = (value: string | number | null | undefined) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") return null;
    const normalized = value.trim().replace(/,/g, "");
    if (!normalized || normalized.toLowerCase() === "n/a" || normalized === "-") return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const normalize = (label: string) => label.trim().toLowerCase();

  const comparisonRows = useMemo(() => {
    const marketSums = new Map<string, number>();
    const supplierSums = new Map<string, number>();

    breakdown.forEach((item) => {
      const mapped = MARKET_MAPPING[normalize(item.label)];
      const amount = toNumber(item.amount);
      if (!mapped || amount === null) return;
      marketSums.set(mapped, (marketSums.get(mapped) ?? 0) + amount);
    });

    vendorBreakdown.forEach((item) => {
      const mapped = SUPPLIER_MAPPING[normalize(item.label)];
      const amount = toNumber(item.amount);
      if (!mapped || amount === null) return;
      supplierSums.set(mapped, (supplierSums.get(mapped) ?? 0) + amount);
    });

    return COMMON_COMPONENT_ORDER
      .map((component) => ({
        component,
        marketValue: marketSums.get(component),
        supplierValue: supplierSums.get(component),
      }))
      .filter((row) => row.marketValue !== undefined || row.supplierValue !== undefined);
  }, [breakdown, vendorBreakdown]);

  return (
    <Card className="animate-fade-in-up shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Unified Cost Component Comparison</CardTitle>
        <CardDescription>
          Market Research and Supplier values mapped to common components ($/MT).
        </CardDescription>
        {isDummyMarketResearchData ? (
          <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-medium text-yellow-300">
            <span aria-hidden>⚠</span>
            <span>Market Research values include dummy data in selected period</span>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border overflow-hidden">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-primary to-primary/70 hover:bg-primary border-b-2 border-primary/80">
                <TableHead className="text-primary-foreground font-bold text-[10px] uppercase tracking-widest w-[40px] text-center">
                  #
                </TableHead>
                <TableHead className="text-primary-foreground font-bold text-[10px] uppercase tracking-widest">
                  Common Component
                </TableHead>
                <TableHead className="text-primary-foreground font-bold text-[10px] uppercase tracking-widest text-right w-[140px]">
                  Market Research
                </TableHead>
                <TableHead className="text-primary-foreground font-bold text-[10px] uppercase tracking-widest text-right w-[140px]">
                  Supplier
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisonRows.map((row, idx) => (
                <TableRow key={row.component}>
                  <TableCell className="text-center text-muted-foreground text-[11px]">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="font-medium">{row.component}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.marketValue === undefined ? "—" : formatAmount(row.marketValue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.supplierValue === undefined ? "—" : formatAmount(row.supplierValue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default BreakdownTable;