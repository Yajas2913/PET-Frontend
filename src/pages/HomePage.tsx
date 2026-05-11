import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ApiResponse } from "../types";
import SourceCountryCard from "../components/SourceCountryCard";
import RevealOnScroll from "../components/RevealOnScroll";
import { getMonthOptions, getYearOptions } from "../lib/filterUtils";
import { formatAmount } from "../types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type HomePageProps = {
  data: ApiResponse;
};

const DEFAULT_DESTINATIONS = ["Colombia", "El Salvador", "Brazil", "Honduras"];
const TOTAL_LANDED_COST_KEY = "total landed cost";
const DIFFERENCE_KEY = "difference";
type SortKey = "tlc" | "supplierTlc" | "delta";
type SortOrder = "desc" | "asc";
type HomeViewMode = "cards" | "table" | "chart";
const SUPPLIER_TLC_LABEL = "total resin price abi virgin formula";
const SUPPLIER_NAME_PRESETS: Record<string, string[]> = {
  Brazil: ["Amcor", "Valgroup", "Cristalpet", "Engepack"],
};
const DEFAULT_SUPPLIERS = ["Supplier A", "Supplier B"];
const DUMMY_VARIANCE = [0, 0.018, -0.012, 0.027, -0.02];
const VIEW_SHELL_CLASS = "rounded-2xl border border-primary/15 bg-card/50 shadow-lg";
const ABI_DARK_NAVY = "#001F3F";
const ABI_PRIMARY_BLUE = "#003A70";
const ABI_LIGHT_BLUE = "#00A3E0";
const ABI_GOLD = "#FFB81C";
const ABI_SLATE = "#94A3B8";
const ABI_MID_BLUE = "#2E5EAA";
const ABI_SKY = "#5E9BD4";

const HomePage: React.FC<HomePageProps> = ({ data }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<HomeViewMode>("table");

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

  const parseNumeric = (value: number | string | null | undefined) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") return null;
    const numeric = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(numeric) ? numeric : null;
  };

  const findBreakdownNumeric = (country: ApiResponse["countries"][number], labelKey: string) => {
    const entry = country.breakdown.find((b) => b.label.toLowerCase().includes(labelKey))?.amount;
    return parseNumeric(entry);
  };

  const tableRows = useMemo(() => {
    return orderedCountries.map((country) => {
      const marketTlc = findBreakdownNumeric(country, TOTAL_LANDED_COST_KEY);
      const baseSupplierEntry = data.vendorBreakdowns.find(
        (item) =>
          item.destination === selectedDestination &&
          item.sourceCountry === country.country &&
          item.month === selectedMonth &&
          item.year === selectedYear
      );
      const baseSupplierTlc = parseNumeric(
        baseSupplierEntry?.rows.find(
          (row) => row.label.trim().toLowerCase() === SUPPLIER_TLC_LABEL
        )?.amount ?? null
      );

      const fallbackBase = baseSupplierTlc ?? marketTlc ?? 900 + (country.country.length % 7) * 24;
      const supplierNames = SUPPLIER_NAME_PRESETS[country.country] ?? DEFAULT_SUPPLIERS;
      const suppliers = supplierNames.map((name, index) => {
        const value = Number((fallbackBase * (1 + DUMMY_VARIANCE[index % DUMMY_VARIANCE.length])).toFixed(1));
        const delta = marketTlc !== null ? Number((marketTlc - value).toFixed(1)) : null;
        return {
          name,
          supplierCountry: "Unknown",
          supplierTlc: value,
          delta,
        };
      });

      return {
        marketCountry: country.country,
        marketTlc,
        suppliers,
      };
    });
  }, [orderedCountries, data.vendorBreakdowns, selectedDestination, selectedMonth, selectedYear]);

  const totalSupplierRows = useMemo(
    () => tableRows.reduce((acc, row) => acc + row.suppliers.length, 0),
    [tableRows]
  );

  const formatTlcDisplay = (value: number | null) =>
    value === null ? "N/A" : `$${formatAmount(value)}/MT`;

  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-primary/20 bg-[#020817]/98 px-3 py-2 shadow-2xl backdrop-blur">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
          {label}
        </p>
        <div className="space-y-1.5">
          {payload.map((item: any) => (
            <div key={item.dataKey} className="flex items-center justify-between gap-5 text-xs">
              <span className="font-medium" style={{ color: item.color }}>
                {item.name}
              </span>
              <span className="font-semibold text-slate-100">
                {formatTlcDisplay(parseNumeric(item.value))}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const chartSeriesMeta = useMemo(() => {
    const maxSuppliers = Math.max(
      1,
      ...tableRows.map((row) => row.suppliers.length)
    );
    return Array.from({ length: maxSuppliers }, (_, index) => ({
      key: `supplier${index + 1}Tlc`,
      label: `Supplier ${index + 1}`,
      color: [ABI_PRIMARY_BLUE, ABI_GOLD, ABI_MID_BLUE, ABI_SKY, ABI_SLATE][index % 5],
    }));
  }, [tableRows]);

  const chartData = useMemo(() => {
    return tableRows.map((row) => {
      const base: Record<string, string | number | null> = {
        marketCountry: row.marketCountry,
        marketResearchTlc: row.marketTlc,
      };
      chartSeriesMeta.forEach((series, index) => {
        base[series.key] = row.suppliers[index]?.supplierTlc ?? null;
      });
      return base;
    });
  }, [tableRows, chartSeriesMeta]);

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

          <div className="flex flex-col items-start gap-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-200">
              <span aria-hidden>⚠</span>
              <span>Displayed TLC values are dummy data for simulation.</span>
            </div>

            <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card/40 p-1">
              {[
                { id: "cards", label: "Cards View" },
                { id: "table", label: "Table View" },
                { id: "chart", label: "Chart View" },
              ].map((view) => (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => setViewMode(view.id as HomeViewMode)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    viewMode === view.id
                      ? "border-primary/30 bg-primary text-primary-foreground shadow-sm"
                      : "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-card/60 hover:text-foreground"
                  }`}
                >
                  {view.label}
                </button>
              ))}
            </div>
          </div>

          {viewMode === "cards" ? (
            <div className={`${VIEW_SHELL_CLASS} p-3`}>
              <div className="mb-3 flex items-center justify-between rounded-xl border border-border/70 bg-background/40 px-3 py-2">
                <p className="text-xs font-semibold text-foreground">Cards Overview</p>
                <p className="text-[11px] text-muted-foreground">Click a card to focus source country</p>
              </div>
              <div className="space-y-3">
              <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center gap-3 px-4 max-sm:hidden">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Source Country</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Market Research TLC</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Supplier TLC(s)</p>
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
            </div>
          ) : null}

          {viewMode === "table" ? (
            <div className={`${VIEW_SHELL_CLASS} overflow-hidden border-2 border-border/80`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border/80 bg-background/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">Table Overview</span>
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {selectedDestination || "Destination"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="rounded-full border border-border px-2 py-0.5">{tableRows.length} markets</span>
                  <span className="rounded-full border border-border px-2 py-0.5">{totalSupplierRows} suppliers</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] border-collapse text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-secondary/80 backdrop-blur">
                      <th className="border-b border-border px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Market Research Country
                      </th>
                      <th className="border-b border-border px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Market Research TLC
                      </th>
                      <th className="border-b border-border px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Supplier
                      </th>
                      <th className="border-b border-border px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Supplier TLC
                      </th>
                      <th className="border-b border-border px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Delta
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, rowIndex) =>
                      row.suppliers.map((supplier, supplierIndex) => {
                        const isSelectedMarket = selectedSource === row.marketCountry;
                        return (
                          <tr
                            key={`${row.marketCountry}-${supplier.name}`}
                            className={`cursor-pointer border-b-2 border-border/75 transition ${
                              isSelectedMarket
                                ? "bg-primary/10"
                                : supplierIndex % 2 === 0
                                  ? "bg-background/10 hover:bg-secondary/25"
                                  : "hover:bg-secondary/25"
                            }`}
                            onClick={() => {
                              const next = new URLSearchParams(searchParams);
                              next.set("source", row.marketCountry);
                              setSearchParams(next);
                            }}
                          >
                            {supplierIndex === 0 ? (
                              <>
                                <td
                                  rowSpan={row.suppliers.length}
                                  className="border-r-2 border-border/70 px-4 py-3 font-semibold text-foreground"
                                >
                                  <div className="flex items-center gap-2">
                                    <span>{row.marketCountry}</span>
                                    {isSelectedMarket ? (
                                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                        Selected
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td
                                  rowSpan={row.suppliers.length}
                                  className="border-r-2 border-border/70 px-4 py-3 text-primary font-semibold"
                                >
                                  {formatTlcDisplay(row.marketTlc)}
                                </td>
                              </>
                            ) : null}
                            <td className="px-4 py-2.5">
                            <span className="font-medium text-foreground">{supplier.name}</span>
                            </td>
                            <td className="px-4 py-2.5 text-primary font-semibold">
                              {formatTlcDisplay(supplier.supplierTlc)}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`font-semibold ${
                                  supplier.delta === null
                                    ? "text-muted-foreground"
                                    : supplier.delta < 0
                                      ? "text-green-500"
                                      : "text-red-500"
                                }`}
                              >
                                {supplier.delta === null
                                  ? "N/A"
                                  : `${supplier.delta > 0 ? "+" : ""}$${formatAmount(supplier.delta)}/MT`}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {viewMode === "chart" ? (
            <div className={`${VIEW_SHELL_CLASS} p-3`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/40 px-3 py-2">
                <div className="text-xs text-foreground font-semibold">Chart Overview</div>
                <div className="text-[11px] text-muted-foreground">
                  Grouped comparison by market country (market TLC vs supplier TLCs).
                </div>
              </div>
              <div className="h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="marketCountry" tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#a1a1aa" }} width={52} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0, 163, 224, 0.08)" }} />
                    <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: "12px" }} />
                    <Bar dataKey="marketResearchTlc" name="Market Research TLC" fill={ABI_DARK_NAVY} radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="marketResearchTlc"
                        position="top"
                        formatter={(value: number | string) => formatAmount(value)}
                        fill={ABI_GOLD}
                        fontSize={11}
                        angle={-90}
                        offset={16}
                      />
                    </Bar>
                    {chartSeriesMeta.map((series) => (
                      <Bar
                        key={series.key}
                        dataKey={series.key}
                        name={series.label}
                        fill={series.color}
                        radius={[4, 4, 0, 0]}
                      >
                        <LabelList
                          dataKey={series.key}
                          position="top"
                          formatter={(value: number | string | null) =>
                            value === null || value === undefined ? "" : formatAmount(value)
                          }
                          fill={ABI_GOLD}
                          fontSize={11}
                          angle={-90}
                          offset={16}
                        />
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
          </section>
        </RevealOnScroll>
      </main>
    </div>
  );
};

export default HomePage;

