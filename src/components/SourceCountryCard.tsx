import React, { useMemo } from "react";
import type { CountryCost, VendorBreakdownEntry } from "../types";
import { formatAmount } from "../types";
import { Card, CardContent } from "@/components/ui/card";

type SourceCountryCardProps = {
  country: CountryCost;
  destination: string;
  month: string;
  year: string;
  vendorBreakdowns: VendorBreakdownEntry[];
  onDeepDive: () => void;
};

const TOTAL_LANDED_COST_KEY = "total landed cost";
const SUPPLIER_TLC_LABEL = "total resin price abi virgin formula";

const SourceCountryCard: React.FC<SourceCountryCardProps> = ({
  country,
  destination,
  month,
  year,
  vendorBreakdowns,
  onDeepDive,
}) => {
  const marketTlc = useMemo(() => {
    return (
      country.breakdown.find((b) =>
        b.label.toLowerCase().includes(TOTAL_LANDED_COST_KEY)
      )?.amount ?? null
    );
  }, [country.breakdown]);

  const supplierTlc = useMemo(() => {
    const match = vendorBreakdowns.find(
      (item) =>
        item.destination === destination &&
        item.sourceCountry === country.country &&
        item.month === month &&
        item.year === year
    );

    const vendorTlc = match?.rows.find(
      (row) => row.label.trim().toLowerCase() === SUPPLIER_TLC_LABEL
    );

    return vendorTlc?.amount ?? null;
  }, [vendorBreakdowns, destination, month, year, country.country]);

  const formatTlc = (value: number | string | null) => {
    if (typeof value === "number") return `$${formatAmount(value)}/MT`;
    if (value === null || value === "") return "N/A";
    return formatAmount(value);
  };

  const marketTlcDisplay = formatTlc(marketTlc);
  const supplierTlcDisplay = formatTlc(supplierTlc);

  return (
    <Card className="shadow-lg hover:-translate-y-0.5 transition-transform">
      <CardContent className="p-4">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_auto] items-center gap-3 max-sm:grid-cols-[1fr_1fr]">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Source Country
            </p>
            <h3 className="mt-1 truncate text-lg font-extrabold text-foreground">
              {country.country}
            </h3>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Market Research TLC
            </p>
            <p className="mt-1 text-base font-bold text-primary">
              {marketTlcDisplay}
            </p>
          </div>

          <div className="max-sm:col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Supplier TLC
            </p>
            <p className="mt-1 text-base font-bold text-primary">
              {supplierTlcDisplay}
            </p>
          </div>

          <div className="max-sm:col-span-2 flex justify-end">
            <button
              type="button"
              onClick={onDeepDive}
              className="inline-flex items-center justify-center rounded-xl border border-primary/25 bg-gradient-to-r from-primary to-yellow-300 px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Deep Dive
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SourceCountryCard;

