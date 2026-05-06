import React, { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ApiResponse } from "../types";
import SourceCountryCard from "../components/SourceCountryCard";
import RevealOnScroll from "../components/RevealOnScroll";
import { getMonthOptions, getYearOptions } from "../lib/filterUtils";

type HomePageProps = {
  data: ApiResponse;
};

const DEFAULT_DESTINATIONS = ["Colombia", "El Salvador", "Brazil", "Honduras"];
const TOTAL_LANDED_COST_KEY = "total landed cost";
const DIFFERENCE_KEY = "difference";
type SortKey = "tlc" | "supplierTlc" | "delta";
type SortOrder = "desc" | "asc";

const HomePage: React.FC<HomePageProps> = ({ data }) => {
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
  const sortBy = (searchParams.get("sortBy") as SortKey) || "tlc";
  const sortOrder = (searchParams.get("sortOrder") as SortOrder) || "desc";

  const computedDefaultDestination = useMemo(() => {
    return data.destination && destinationOptions.includes(data.destination)
      ? data.destination
      : destinationOptions[0] ?? "";
  }, [data.destination, destinationOptions]);

  const computedDefaultMonth = useMemo(() => {
    return paramMonth || data.month || "";
  }, [paramMonth, data.month]);

  const computedDefaultYear = useMemo(() => {
    const month = paramMonth || data.month || "";
    const destination = paramDestination || computedDefaultDestination;

    const years = data.vendorBreakdowns
      .filter((v) => v.destination === destination && v.month === month)
      .map((v) => Number(v.year))
      .filter((n) => Number.isFinite(n));

    if (!years.length) return yearOptions[0] ?? "";
    return String(Math.max(...years));
  }, [
    data.vendorBreakdowns,
    data.month,
    paramMonth,
    paramDestination,
    computedDefaultDestination,
    yearOptions,
  ]);

  const selectedDestination = paramDestination || computedDefaultDestination;
  const selectedYear = paramYear || computedDefaultYear;
  const monthOptions = useMemo(() => getMonthOptions(selectedYear), [selectedYear]);
  const selectedMonthRaw = paramMonth || computedDefaultMonth;
  const selectedMonth =
    selectedMonthRaw && monthOptions.includes(selectedMonthRaw)
      ? selectedMonthRaw
      : monthOptions[0] ?? "";

  const orderedCountries = useMemo(() => {
    const getNumericMetric = (
      country: ApiResponse["countries"][number],
      labelKey: string
    ) => {
      const metric = country.breakdown.find((b) =>
        b.label.toLowerCase().includes(labelKey)
      )?.amount;
      return typeof metric === "number" ? metric : null;
    };

    const compareWithNullsLast = (aValue: number | null, bValue: number | null) => {
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      if (aValue === bValue) return 0;
      const direction = sortOrder === "asc" ? 1 : -1;
      return (aValue - bValue) * direction;
    };

    if (sortBy === "tlc") {
      return [...data.countries].sort((a, b) => {
        const byTlc = compareWithNullsLast(
          getNumericMetric(a, TOTAL_LANDED_COST_KEY),
          getNumericMetric(b, TOTAL_LANDED_COST_KEY)
        );
        return byTlc !== 0 ? byTlc : a.country.localeCompare(b.country);
      });
    }

    if (sortBy === "supplierTlc") {
      return [...data.countries].sort((a, b) => {
        const getSupplierTlcValue = (country: ApiResponse["countries"][number]) => {
          const match = data.vendorBreakdowns.find(
            (item) =>
              item.destination === selectedDestination &&
              item.sourceCountry === country.country &&
              item.month === selectedMonth &&
              item.year === selectedYear
          );
          const row = match?.rows.find(
            (r) => r.label.trim().toLowerCase() === "total resin price abi virgin formula"
          );
          const amt = row?.amount;
          return typeof amt === "number" ? amt : null;
        };
        const bySupplier = compareWithNullsLast(
          getSupplierTlcValue(a),
          getSupplierTlcValue(b)
        );
        return bySupplier !== 0 ? bySupplier : a.country.localeCompare(b.country);
      });
    }

    if (sortBy === "delta") {
      return [...data.countries].sort((a, b) => {
        const byDelta = compareWithNullsLast(
          getNumericMetric(a, DIFFERENCE_KEY),
          getNumericMetric(b, DIFFERENCE_KEY)
        );
        return byDelta !== 0 ? byDelta : a.country.localeCompare(b.country);
      });
    }

    return [...data.countries].sort((a, b) => {
      const byTlc = compareWithNullsLast(
        getNumericMetric(a, TOTAL_LANDED_COST_KEY),
        getNumericMetric(b, TOTAL_LANDED_COST_KEY)
      );
      return byTlc !== 0 ? byTlc : a.country.localeCompare(b.country);
    });
  }, [data.countries, data.vendorBreakdowns, sortBy, sortOrder, selectedDestination, selectedMonth, selectedYear]);

  const sourceOptions = useMemo(
    () => orderedCountries.map((country) => country.country),
    [orderedCountries]
  );
  const selectedSource =
    paramSource && sourceOptions.includes(paramSource)
      ? paramSource
      : "";

  useEffect(() => {
    const needsDestination = !paramDestination;
    const needsMonth = !paramMonth;
    const needsYear = !paramYear;
    const hasInvalidSource = paramSource && !sourceOptions.includes(paramSource);

    if (!needsDestination && !needsMonth && !needsYear && !hasInvalidSource) return;

    const next = new URLSearchParams(searchParams);
    next.set("destination", selectedDestination);
    next.set("month", selectedMonth);
    next.set("year", selectedYear);
    if (hasInvalidSource) {
      next.delete("source");
    }

    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    paramDestination,
    paramMonth,
    paramYear,
    paramSource,
    selectedDestination,
    selectedMonth,
    selectedYear,
    sourceOptions,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!paramYear) return;
    if (!selectedMonth || !monthOptions.includes(selectedMonth)) return;
    if (paramMonth === selectedMonth) return;

    const next = new URLSearchParams(searchParams);
    next.set("month", selectedMonth);
    setSearchParams(next, { replace: true });
  }, [paramYear, paramMonth, selectedMonth, monthOptions, searchParams, setSearchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-[#0f0f0f]">
      <main className="p-7 flex flex-col gap-5 overflow-y-auto max-sm:p-4 mx-auto max-w-[1400px]">
        <RevealOnScroll>
          <section className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Destination</label>
              <select
                value={selectedDestination}
                onChange={(e) => {
                  const next = new URLSearchParams(searchParams);
                  next.set("destination", e.target.value);
                  setSearchParams(next);
                }}
                className="h-9 rounded-md bg-secondary border border-border px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              >
                {destinationOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  const next = new URLSearchParams(searchParams);
                  next.set("month", e.target.value);
                  setSearchParams(next);
                }}
                className="h-9 rounded-md bg-secondary border border-border px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              >
                {monthOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  const next = new URLSearchParams(searchParams);
                  next.set("year", e.target.value);
                  const nextMonthOptions = getMonthOptions(e.target.value);
                  const currentMonth = searchParams.get("month") ?? "";
                  const nextMonth = nextMonthOptions.includes(currentMonth)
                    ? currentMonth
                    : nextMonthOptions[0] ?? "";
                  next.set("month", nextMonth);
                  setSearchParams(next);
                }}
                className="h-9 rounded-md bg-secondary border border-border px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              >
                {yearOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="ml-auto flex items-end gap-2">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(event) => {
                    const next = new URLSearchParams(searchParams);
                    next.set("sortBy", event.target.value);
                    setSearchParams(next);
                  }}
                  className="h-9 rounded-md border border-border bg-card px-2.5 text-sm text-foreground"
                >
                  <option value="tlc">Market Research TLC</option>
                  <option value="supplierTlc">Supplier TLC</option>
                  <option value="delta">Delta</option>
                </select>
              </div>
              <select
                value={sortOrder}
                onChange={(event) => {
                  const next = new URLSearchParams(searchParams);
                  next.set("sortOrder", event.target.value);
                  setSearchParams(next);
                }}
                className="h-9 rounded-md border border-border bg-card px-2.5 text-sm text-foreground"
              >
                <option value="desc">High to Low</option>
                <option value="asc">Low to High</option>
              </select>
            </div>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-200">
            <span aria-hidden>⚠</span>
            <span>Displayed TLC values are dummy data for simulation.</span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center gap-3 px-4 max-sm:hidden">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Source Country</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Market Research TLC</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Supplier TLC</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Delta</p>
            </div>
            {orderedCountries.map((country) => (
              <RevealOnScroll key={country.country} y={14}>
                <SourceCountryCard
                  country={country}
                  destination={selectedDestination}
                  month={selectedMonth}
                  year={selectedYear}
                  vendorBreakdowns={data.vendorBreakdowns ?? []}
                  isSelected={selectedSource === country.country}
                  onSelect={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set("source", country.country);
                    setSearchParams(next);
                  }}
                />
              </RevealOnScroll>
            ))}
          </div>
          </section>
        </RevealOnScroll>
      </main>
    </div>
  );
};

export default HomePage;

