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
  isSelected?: boolean;
  onSelect?: () => void;
  onDeepDive?: () => void;
};

const TOTAL_LANDED_COST_KEY = "total landed cost";
const DIFFERENCE_KEY = "difference";
const SUPPLIER_TLC_LABEL = "total resin price abi virgin formula";

const SourceCountryCard: React.FC<SourceCountryCardProps> = ({
  country,
  destination,
  month,
  year,
  vendorBreakdowns,
  isSelected = false,
  onSelect,
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

  const deltaVsSupplier = useMemo(() => {
    const diff = country.breakdown.find((b) =>
      b.label.toLowerCase().includes(DIFFERENCE_KEY)
    );
    return typeof diff?.amount === "number" ? diff.amount : null;
  }, [country.breakdown]);

  const formatTlc = (value: number | string | null) => {
    if (typeof value === "number") return `$${formatAmount(value)}/MT`;
    if (value === null || value === "") return "N/A";
    return formatAmount(value);
  };

  const marketTlcDisplay = formatTlc(marketTlc);
  const supplierTlcDisplay = formatTlc(supplierTlc);
  const deltaDisplay =
    deltaVsSupplier === null
      ? "N/A"
      : `${deltaVsSupplier > 0 ? "+" : ""}$${formatAmount(deltaVsSupplier)}/MT`;
  const isSaving = deltaVsSupplier !== null && deltaVsSupplier < 0;

  return (
    <Card
      onClick={onSelect}
      className={`shadow-lg transition-transform ${
        onSelect ? "cursor-pointer hover:-translate-y-0.5" : "hover:-translate-y-0.5"
      } ${isSelected ? "ring-2 ring-primary/60 border-primary/40" : ""}`}
    >
      <CardContent className="p-4">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center gap-3 max-sm:grid-cols-[1fr_1fr]">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold text-foreground">
              {country.country}
            </h3>
          </div>

          <div>
            <p className="text-base font-bold text-primary">
              {marketTlcDisplay}
            </p>
          </div>

          <div>
            <p className="text-base font-bold text-primary">{supplierTlcDisplay}</p>
          </div>

          <div>
            <p
              className={`text-base font-semibold ${
                isSaving ? "text-green-500" : deltaVsSupplier === null ? "text-muted-foreground" : "text-red-500"
              }`}
            >
              {deltaDisplay}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SourceCountryCard;

