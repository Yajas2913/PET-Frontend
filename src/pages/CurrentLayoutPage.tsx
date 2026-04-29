import React, { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ApiResponse } from "../types";
import Header from "../components/Header";
import BreakdownTable from "../components/BreakdownTable";
import TopRightNavigation from "../components/TopRightNavigation";
import RevealOnScroll from "../components/RevealOnScroll";
import { Card, CardContent } from "@/components/ui/card";
import type { BreakdownItem, VendorBreakdownRow } from "../types";
import { formatAmount } from "../types";
import { getMonthOptions, getYearOptions } from "../lib/filterUtils";

type CurrentLayoutPageProps = {
  data: ApiResponse;
};

const DEFAULT_DESTINATIONS = ["El Salvador", "Brazil", "Honduras"];

const TOTAL_LANDED_COST_KEY = "total landed cost";
const SUPPLIER_TLC_LABEL = "total resin price abi virgin formula";
const MONTH_TO_INDEX: Record<string, number> = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
};

function getMarketTlc(breakdown: BreakdownItem[]) {
  return (
    breakdown.find((b) => b.label.toLowerCase().includes(TOTAL_LANDED_COST_KEY))
      ?.amount ?? null
  );
}

function getDiffValue(breakdown: BreakdownItem[]) {
  return (
    breakdown.find((b) => b.label.toLowerCase().includes("difference"))?.amount ??
    null
  );
}

function getSupplierTlc(vendorBreakdown: VendorBreakdownRow[]) {
  return (
    vendorBreakdown.find(
      (row) => row.label.trim().toLowerCase() === SUPPLIER_TLC_LABEL
    )?.amount ?? null
  );
}

function formatTlc(value: number | string | null | undefined) {
  if (typeof value === "number") return `$${formatAmount(value)}/MT`;
  if (value === null || value === undefined || value === "") return "N/A";
  return formatAmount(value);
}

const CurrentLayoutPage: React.FC<CurrentLayoutPageProps> = ({ data }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const destinationOptions = useMemo(() => {
    const apiDestination = data.destination;
    return Array.from(new Set([apiDestination, ...DEFAULT_DESTINATIONS])).filter(
      Boolean
    );
  }, [data.destination]);

  const yearOptions = useMemo(() => getYearOptions(), []);

  const paramDestination = searchParams.get("destination") ?? "";
  const paramMonth = searchParams.get("month") ?? "";
  const paramYear = searchParams.get("year") ?? "";
  const paramSource = searchParams.get("source") ?? "";

  const defaultDestination = useMemo(() => {
    return data.destination && destinationOptions.includes(data.destination)
      ? data.destination
      : destinationOptions[0] ?? "";
  }, [data.destination, destinationOptions]);

  const selectedDestination = paramDestination || defaultDestination;

  const derivedDefaultYear = useMemo(() => {
    const month = paramMonth || data.month || "";
    const years = data.vendorBreakdowns
      .filter((v) => v.destination === selectedDestination && v.month === month)
      .map((v) => Number(v.year))
      .filter((n) => Number.isFinite(n));

    if (!years.length) return yearOptions[0] ?? "";
    return String(Math.max(...years));
  }, [data.vendorBreakdowns, data.month, paramMonth, selectedDestination, yearOptions]);

  const selectedYear = paramYear || derivedDefaultYear;
  const monthOptions = useMemo(
    () => getMonthOptions(selectedYear),
    [selectedYear]
  );

  const selectedMonthRaw = paramMonth || data.month || "";
  const selectedMonth =
    selectedMonthRaw && monthOptions.includes(selectedMonthRaw)
      ? selectedMonthRaw
      : monthOptions[0] ?? "";

  const selectedSource =
    data.countries.find((c) => c.country === paramSource)?.country ??
    data.countries[0]?.country ??
    "";

  useEffect(() => {
    const sourceValid = !paramSource || data.countries.some((c) => c.country === paramSource);
    const needs =
      !paramDestination ||
      !paramMonth ||
      !paramYear ||
      !paramSource ||
      !sourceValid ||
      !monthOptions.includes(paramMonth || "");

    if (!needs) return;

    const next = new URLSearchParams(searchParams);
    next.set("destination", selectedDestination);
    next.set("month", selectedMonth);
    next.set("year", selectedYear);
    next.set("source", selectedSource);
    setSearchParams(next, { replace: true });
  }, [
    paramDestination,
    paramMonth,
    paramYear,
    paramSource,
    monthOptions,
    selectedDestination,
    selectedMonth,
    selectedYear,
    selectedSource,
    data.countries,
    searchParams,
    setSearchParams,
  ]);

  const activeCountry = data.countries.find((c) => c.country === selectedSource) ?? data.countries[0];

  const vendorBreakdown = useMemo(() => {
    const match = data.vendorBreakdowns.find(
      (item) =>
        item.destination === selectedDestination &&
        item.sourceCountry === activeCountry?.country &&
        item.month === selectedMonth &&
        item.year === selectedYear
    );

    return match?.rows ?? [];
  }, [
    data.vendorBreakdowns,
    selectedDestination,
    activeCountry?.country,
    selectedMonth,
    selectedYear,
  ]);

  const marketTlc = activeCountry ? getMarketTlc(activeCountry.breakdown) : null;
  const diffValue = activeCountry ? getDiffValue(activeCountry.breakdown) : null;
  const supplierTlc = getSupplierTlc(vendorBreakdown);

  const isSaving = typeof diffValue === "number" && diffValue < 0;
  const diffDisplay =
    typeof diffValue === "number"
      ? `${diffValue > 0 ? "+" : ""}$${formatAmount(diffValue)}/MT`
      : "N/A";

  const isDummyMarketResearchData = useMemo(() => {
    const start = 2018 * 12 + MONTH_TO_INDEX.July;
    const end = 2026 * 12 + MONTH_TO_INDEX.February;
    const year = Number(selectedYear);
    const monthIndex = MONTH_TO_INDEX[selectedMonth];
    if (!Number.isFinite(year) || monthIndex === undefined) return false;
    const current = year * 12 + monthIndex;
    return current >= start && current <= end;
  }, [selectedMonth, selectedYear]);

  return (
    <div className="min-h-screen">
      <main className="p-7 flex flex-col gap-5 overflow-y-auto bg-gradient-to-b from-background to-[#0f0f0f] max-sm:p-4">
        <Header month={data.month} supplierPrice={data.supplierPrice} />
        <TopRightNavigation search={searchParams.toString()} />

        <RevealOnScroll>
          <section className="grid grid-cols-[minmax(0,1fr)_320px] items-stretch gap-4 max-md:grid-cols-1">
          <Card className="shadow-lg h-full">
            <CardContent className="p-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                  Selected Source
                </p>
                <h2 className="text-[32px] font-extrabold bg-gradient-to-r from-primary to-yellow-300 bg-clip-text text-transparent">
                  {activeCountry?.country ?? "—"}
                </h2>
              </div>

              <div className="mt-5 grid grid-cols-4 gap-3 max-lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-card/30 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Market Research (Delloite) TLC
                  </p>
                  <p className="mt-1 text-base font-extrabold text-primary">
                    {formatTlc(marketTlc)}
                  </p>
                </div>

                <div
                  className={`rounded-xl border p-3 ${
                    isSaving
                      ? "border-green-500/20 bg-green-500/10"
                      : "border-red-500/20 bg-red-500/10"
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    vs. Supplier (${formatAmount(data.supplierPrice)})
                  </p>
                  <p
                    className={`mt-1 text-base font-extrabold ${
                      isSaving ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {diffDisplay}
                  </p>
                </div>

                <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/3 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Supplier TLC
                  </p>
                  <p className="mt-1 text-base font-extrabold text-primary">
                    {formatTlc(supplierTlc)}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-card/30 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Cost Components
                  </p>
                  <p className="mt-1 text-base font-extrabold text-foreground">
                    {activeCountry?.breakdown.length ?? 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg h-full">
            <CardContent className="p-5 h-full">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Selected Destination
              </p>
              <h3 className="text-[28px] font-extrabold bg-gradient-to-r from-primary to-yellow-300 bg-clip-text text-transparent">
                {selectedDestination}
              </h3>
              <p className="mt-3 text-sm text-muted-foreground">
                Period: {selectedMonth} {selectedYear}
              </p>
            </CardContent>
          </Card>
          </section>
        </RevealOnScroll>

        <RevealOnScroll delay={0.05}>
          <BreakdownTable
            breakdown={activeCountry?.breakdown ?? []}
            vendorBreakdown={vendorBreakdown}
            isDummyMarketResearchData={isDummyMarketResearchData}
          />
        </RevealOnScroll>
      </main>
    </div>
  );
};

export default CurrentLayoutPage;

