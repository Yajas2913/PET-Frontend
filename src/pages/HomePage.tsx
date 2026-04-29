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
    return [...data.countries].sort((a, b) => {
      if (a.country === "China") return -1;
      if (b.country === "China") return 1;
      return 0;
    });
  }, [data.countries]);

  useEffect(() => {
    const needsDestination = !paramDestination;
    const needsMonth = !paramMonth;
    const needsYear = !paramYear;

    if (!needsDestination && !needsMonth && !needsYear) return;

    const next = new URLSearchParams(searchParams);
    next.set("destination", selectedDestination);
    next.set("month", selectedMonth);
    next.set("year", selectedYear);

    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    paramDestination,
    paramMonth,
    paramYear,
    selectedDestination,
    selectedMonth,
    selectedYear,
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
                  onDeepDive={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set("destination", selectedDestination);
                    next.set("month", selectedMonth);
                    next.set("year", selectedYear);
                    next.set("source", country.country);
                    navigate({
                      pathname: "/deep-dive",
                      search: next.toString(),
                    });
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

