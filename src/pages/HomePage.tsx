import React, { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ApiResponse } from "../types";
import Header from "../components/Header";
import SidebarFilters from "../components/SidebarFilters";
import SourceCountryCard from "../components/SourceCountryCard";
import TopRightNavigation from "../components/TopRightNavigation";
import RevealOnScroll from "../components/RevealOnScroll";
import { getMonthOptions, getYearOptions } from "../lib/filterUtils";

type HomePageProps = {
  data: ApiResponse;
};

const DEFAULT_DESTINATIONS = ["El Salvador", "Brazil", "Honduras"];
const TOTAL_LANDED_COST_KEY = "total landed cost";
const DIFFERENCE_KEY = "difference";
type SortKey = "default" | "tlc" | "delta";
type SortOrder = "desc" | "asc";

const HomePage: React.FC<HomePageProps> = ({ data }) => {
  const navigate = useNavigate();
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
  const sortBy = (searchParams.get("sortBy") as SortKey) || "default";
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
      if (a.country === "China") return -1;
      if (b.country === "China") return 1;
      return 0;
    });
  }, [data.countries, sortBy, sortOrder]);

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
    <div className="min-h-screen grid grid-cols-[380px_1fr] max-md:grid-cols-1">
      <aside className="bg-card border-r border-border p-6 flex flex-col gap-5 overflow-hidden max-md:border-r-0 max-md:border-b">
        <Header month={data.month} supplierPrice={data.supplierPrice} />
        <SidebarFilters
          destinationOptions={destinationOptions}
          monthOptions={monthOptions}
          yearOptions={yearOptions}
          destination={selectedDestination}
          month={selectedMonth}
          year={selectedYear}
          onDestinationChange={(value) => {
            const next = new URLSearchParams(searchParams);
            next.set("destination", value);
            setSearchParams(next);
          }}
          onMonthChange={(value) => {
            const next = new URLSearchParams(searchParams);
            next.set("month", value);
            setSearchParams(next);
          }}
          onYearChange={(value) => {
            const next = new URLSearchParams(searchParams);
            next.set("year", value);

            const nextMonthOptions = getMonthOptions(value);
            const currentMonth = searchParams.get("month") ?? "";
            const nextMonth = nextMonthOptions.includes(currentMonth)
              ? currentMonth
              : nextMonthOptions[0] ?? "";
            next.set("month", nextMonth);

            setSearchParams(next);
          }}
        />
      </aside>

      <main className="p-7 flex flex-col gap-5 overflow-y-auto bg-gradient-to-b from-background to-[#0f0f0f] max-sm:p-4">
        <TopRightNavigation search={searchParams.toString()} />
        <RevealOnScroll>
          <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                Source Countries
              </p>
              <h2 className="text-xl font-extrabold text-foreground">
                {selectedMonth} {selectedYear}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                Destination
              </p>
              <p className="text-lg font-bold text-primary">{selectedDestination}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sort by
            </span>
            <select
              value={sortBy}
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                next.set("sortBy", event.target.value);
                setSearchParams(next);
              }}
              className="rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground"
            >
              <option value="default">Default</option>
              <option value="tlc">TLC</option>
              <option value="delta">Delta</option>
            </select>
            <select
              value={sortOrder}
              disabled={sortBy === "default"}
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                next.set("sortOrder", event.target.value);
                setSearchParams(next);
              }}
              className="rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="desc">High to Low</option>
              <option value="asc">Low to High</option>
            </select>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-200">
            <span aria-hidden>⚠</span>
            <span>Displayed TLC values are dummy data for simulation.</span>
          </div>

          <div className="space-y-3">
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
                  onDeepDive={
                    selectedSource === country.country
                      ? () => {
                          const next = new URLSearchParams(searchParams);
                          next.set("destination", selectedDestination);
                          next.set("month", selectedMonth);
                          next.set("year", selectedYear);
                          next.set("source", selectedSource);
                          navigate({
                            pathname: "/deep-dive",
                            search: next.toString(),
                          });
                        }
                      : undefined
                  }
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

