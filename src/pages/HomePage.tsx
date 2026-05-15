import React, { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ApiResponse, VendorBreakdownEntry } from "../types";
import RevealOnScroll from "../components/RevealOnScroll";
import { getMonthOptions, getYearOptions } from "../lib/filterUtils";
import {
  ARGENTINA_APRIL_2026_RESIN_VENDOR_LABEL,
  BRAZIL_APRIL_2026_AMCOR_RESIN_VENDOR_LABEL,
  BRAZIL_APRIL_2026_CRISTALPET_VENDOR_LABEL,
  BRAZIL_APRIL_2026_ENGEPACK_VENDOR_LABEL,
  BRAZIL_APRIL_2026_VALGROUP_VENDOR_LABEL,
  getArgentinaApril2026SharedSupplierTlc,
  getBrazilApril2026AmcorSupplierTlc,
  getColombiaMarch2026SharedSupplierTlc,
  getDominicanRepublicApril2026SharedSupplierTlc,
  getEcuadorMarch2026SharedSupplierTlc,
  getPanamaApril2026SharedSupplierTlc,
  getPeruApril2026SharedSupplierTlc,
  isArgentinaApril2026View,
  isBrazilApril2026View,
  isColombiaMarch2026View,
  isDominicanRepublicApril2026View,
  isEcuadorMarch2026View,
  isPanamaApril2026View,
  isPeruApril2026View,
  parseVendorTlcAmount,
  vendorYearMatches,
} from "../lib/colombiaVendorTlc";
import { formatAmount, formatDeltaVersusMarketForCompany } from "../types";

type HomePageProps = {
  data: ApiResponse;
};

const DEFAULT_DESTINATIONS = [
  "Brazil",
  "Argentina",
  "El Salvador and Honduras",
  "Colombia",
  "Peru",
  "Dominican Republic",
  "Nigeria",
  "Bolivia",
  "Korea",
  "Panama",
  "Uruguay",
  "Ecuador",
];
const TOTAL_LANDED_COST_KEY = "total landed cost";
const DIFFERENCE_KEY = "difference";
type SortKey = "tlc" | "supplierTlc" | "delta";
type SortOrder = "desc" | "asc";
const SUPPLIER_TLC_LABEL = "total resin price abi virgin formula";
const SUPPLIER_NAME_PRESETS: Record<string, string[]> = {
  Brazil: ["Amcor", "Valgroup", "Cristalpet", "Engepack"],
};
/** When Brazil is the destination market, every source country row shows these four suppliers. */
const BRAZIL_DESTINATION = "Brazil";
const BRAZIL_DESTINATION_SUPPLIERS = [
  "Amcor",
  "Valgroup",
  "Cristalpet",
  "Engepack",
] as const;
/** These destination markets show a single supplier column: Amcor. */
const AMCOR_ONLY_DESTINATIONS = new Set([
  "Argentina",
  "El Salvador and Honduras",
  "Colombia",
  "Ecuador",
]);
const AMCOR_ONLY_SUPPLIERS = ["Amcor"] as const;

const PERU_DESTINATION = "Peru";
const PERU_DESTINATION_SUPPLIERS = ["San Miguel Industrias (SMI)"] as const;
const DOMINICAN_REPUBLIC_DESTINATION = "Dominican Republic";
const DOMINICAN_REPUBLIC_DESTINATION_SUPPLIERS = ["SMI PET"] as const;

const NIGERIA_DESTINATION = "Nigeria";
const NIGERIA_DESTINATION_SUPPLIERS = ["No contract (Resin formula unknown)"] as const;
const BOLIVIA_DESTINATION = "Bolivia";
const BOLIVIA_DESTINATION_SUPPLIERS = [
  "Gestora, Administradora e Industrializadora Preformas S.A.",
] as const;
/** No contracted supplier for this destination — empty list (not null). */
const KOREA_DESTINATION = "Korea";
const KOREA_DESTINATION_SUPPLIERS: readonly string[] = [];
const PANAMA_DESTINATION = "Panama";
const PANAMA_DESTINATION_SUPPLIERS = ["Pastiglas S.A"] as const;
const URUGUAY_DESTINATION = "Uruguay";
const URUGUAY_DESTINATION_SUPPLIERS = ["Cristalpet"] as const;

function isAmcorOnlyDestination(destination: string): boolean {
  return AMCOR_ONLY_DESTINATIONS.has(destination);
}

/** Destination-specific supplier columns (null = use source-country preset or defaults). */
function getDestinationFixedSuppliers(destination: string): readonly string[] | null {
  if (destination === BRAZIL_DESTINATION) return BRAZIL_DESTINATION_SUPPLIERS;
  if (isAmcorOnlyDestination(destination)) return AMCOR_ONLY_SUPPLIERS;
  if (destination === PERU_DESTINATION) return PERU_DESTINATION_SUPPLIERS;
  if (destination === DOMINICAN_REPUBLIC_DESTINATION) return DOMINICAN_REPUBLIC_DESTINATION_SUPPLIERS;
  if (destination === NIGERIA_DESTINATION) return NIGERIA_DESTINATION_SUPPLIERS;
  if (destination === BOLIVIA_DESTINATION) return BOLIVIA_DESTINATION_SUPPLIERS;
  if (destination === KOREA_DESTINATION) return KOREA_DESTINATION_SUPPLIERS;
  if (destination === PANAMA_DESTINATION) return PANAMA_DESTINATION_SUPPLIERS;
  if (destination === URUGUAY_DESTINATION) return URUGUAY_DESTINATION_SUPPLIERS;
  return null;
}

const DEFAULT_SUPPLIERS = ["Supplier A", "Supplier B"];

function extractEntrySupplierName(item: VendorBreakdownEntry): string {
  const extra = item as VendorBreakdownEntry & {
    supplierName?: string;
    supplier?: string;
    vendor?: string;
  };
  return (
    extra.supplierName?.trim() ||
    extra.supplier?.trim() ||
    extra.vendor?.trim() ||
    ""
  );
}

function namesMatchSupplier(entryName: string, supplierName: string): boolean {
  const a = entryName.trim().toLowerCase();
  const b = supplierName.trim().toLowerCase();
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function findTlcForSupplierName(
  matches: VendorBreakdownEntry[],
  supplierName: string,
  parseNum: (v: number | string | null | undefined) => number | null
): number | null {
  for (const item of matches) {
    const entryName = extractEntrySupplierName(item);
    if (!namesMatchSupplier(entryName, supplierName)) continue;
    const row = item.rows.find(
      (r) => r.label.trim().toLowerCase() === SUPPLIER_TLC_LABEL
    );
    const amt = parseNum(row?.amount ?? null);
    if (amt !== null) return amt;
  }
  return null;
}
const DUMMY_VARIANCE = [0, 0.018, -0.012, 0.027, -0.02];
const VIEW_SHELL_CLASS =
  "rounded-[14px] border border-border bg-card shadow-[0_4px_24px_rgba(0,0,0,0.5)] transition-[border-color,box-shadow] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-primary/50 hover:shadow-[0_0_0_1px_rgba(230,168,23,0.2),0_4px_24px_rgba(0,0,0,0.5)]";

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
  const monthOptions = useMemo(
    () => getMonthOptions(selectedYear, selectedDestination),
    [selectedYear, selectedDestination]
  );
  const selectedMonthRaw = paramMonth || computedDefaultMonth;
  const selectedMonth =
    selectedMonthRaw && monthOptions.includes(selectedMonthRaw)
      ? selectedMonthRaw
      : monthOptions[0] ?? "";

  const orderedCountries = useMemo(() => {
    const baseCountries = [...data.countries];

    const getNumericMetric = (country: ApiResponse["countries"][number], labelKey: string) => {
      const metric = country.breakdown.find((b) => b.label.toLowerCase().includes(labelKey))?.amount;
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
      return [...baseCountries].sort((a, b) => {
        const byTlc = compareWithNullsLast(
          getNumericMetric(a, TOTAL_LANDED_COST_KEY),
          getNumericMetric(b, TOTAL_LANDED_COST_KEY)
        );
        return byTlc !== 0 ? byTlc : a.country.localeCompare(b.country);
      });
    }

    if (sortBy === "supplierTlc") {
      const colombiaShared = isColombiaMarch2026View(
        selectedDestination,
        selectedMonth,
        selectedYear
      )
        ? getColombiaMarch2026SharedSupplierTlc(data.vendorBreakdowns)
        : null;
      const ecuadorShared = isEcuadorMarch2026View(
        selectedDestination,
        selectedMonth,
        selectedYear
      )
        ? getEcuadorMarch2026SharedSupplierTlc(data.vendorBreakdowns)
        : null;
      const panamaShared = isPanamaApril2026View(
        selectedDestination,
        selectedMonth,
        selectedYear
      )
        ? getPanamaApril2026SharedSupplierTlc(data.vendorBreakdowns)
        : null;
      const peruShared = isPeruApril2026View(
        selectedDestination,
        selectedMonth,
        selectedYear
      )
        ? getPeruApril2026SharedSupplierTlc(data.vendorBreakdowns)
        : null;
      const dominicanShared = isDominicanRepublicApril2026View(
        selectedDestination,
        selectedMonth,
        selectedYear
      )
        ? getDominicanRepublicApril2026SharedSupplierTlc(data.vendorBreakdowns)
        : null;
      const argentinaShared = isArgentinaApril2026View(
        selectedDestination,
        selectedMonth,
        selectedYear
      )
        ? getArgentinaApril2026SharedSupplierTlc(data.vendorBreakdowns)
        : null;
      const brazilShared = isBrazilApril2026View(
        selectedDestination,
        selectedMonth,
        selectedYear
      )
        ? getBrazilApril2026AmcorSupplierTlc(data.vendorBreakdowns)
        : null;

      return [...baseCountries].sort((a, b) => {
        const getSupplierTlcValue = (country: ApiResponse["countries"][number]) => {
          if (colombiaShared !== null) return colombiaShared;
          if (ecuadorShared !== null) return ecuadorShared;
          if (panamaShared !== null) return panamaShared;
          if (peruShared !== null) return peruShared;
          if (dominicanShared !== null) return dominicanShared;
          if (argentinaShared !== null) return argentinaShared;
          if (brazilShared !== null) return brazilShared;
          const match = data.vendorBreakdowns.find(
            (item) =>
              item.destination === selectedDestination &&
              item.sourceCountry === country.country &&
              item.month === selectedMonth &&
              vendorYearMatches(item.year, selectedYear)
          );
          const row = match?.rows.find(
            (r) => r.label.trim().toLowerCase() === "total resin price abi virgin formula"
          );
          return parseVendorTlcAmount(row?.amount ?? null);
        };
        const bySupplier = compareWithNullsLast(
          getSupplierTlcValue(a),
          getSupplierTlcValue(b)
        );
        return bySupplier !== 0 ? bySupplier : a.country.localeCompare(b.country);
      });
    }

    if (sortBy === "delta") {
      return [...baseCountries].sort((a, b) => {
        const byDelta = compareWithNullsLast(
          getNumericMetric(a, DIFFERENCE_KEY),
          getNumericMetric(b, DIFFERENCE_KEY)
        );
        return byDelta !== 0 ? byDelta : a.country.localeCompare(b.country);
      });
    }

    return [...baseCountries].sort((a, b) => {
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
    const colombiaSharedTlc = isColombiaMarch2026View(
      selectedDestination,
      selectedMonth,
      selectedYear
    )
      ? getColombiaMarch2026SharedSupplierTlc(data.vendorBreakdowns)
      : null;
    const ecuadorSharedTlc = isEcuadorMarch2026View(
      selectedDestination,
      selectedMonth,
      selectedYear
    )
      ? getEcuadorMarch2026SharedSupplierTlc(data.vendorBreakdowns)
      : null;
    const panamaSharedTlc = isPanamaApril2026View(
      selectedDestination,
      selectedMonth,
      selectedYear
    )
      ? getPanamaApril2026SharedSupplierTlc(data.vendorBreakdowns)
      : null;
    const peruSharedTlc = isPeruApril2026View(
      selectedDestination,
      selectedMonth,
      selectedYear
    )
      ? getPeruApril2026SharedSupplierTlc(data.vendorBreakdowns)
      : null;
    const dominicanSharedTlc = isDominicanRepublicApril2026View(
      selectedDestination,
      selectedMonth,
      selectedYear
    )
      ? getDominicanRepublicApril2026SharedSupplierTlc(data.vendorBreakdowns)
      : null;
    const argentinaSharedTlc = isArgentinaApril2026View(
      selectedDestination,
      selectedMonth,
      selectedYear
    )
      ? getArgentinaApril2026SharedSupplierTlc(data.vendorBreakdowns)
      : null;

    return orderedCountries.map((country) => {
      const marketTlc = findBreakdownNumeric(country, TOTAL_LANDED_COST_KEY);
      const matches = data.vendorBreakdowns.filter(
        (item) =>
          item.destination === selectedDestination &&
          item.sourceCountry === country.country &&
          item.month === selectedMonth &&
          vendorYearMatches(item.year, selectedYear)
      );
      const firstEntry = matches[0];
      const baseSupplierTlc =
        dominicanSharedTlc ??
        argentinaSharedTlc ??
        peruSharedTlc ??
        panamaSharedTlc ??
        ecuadorSharedTlc ??
        colombiaSharedTlc ??
        parseNumeric(
          firstEntry?.rows.find(
            (row) => row.label.trim().toLowerCase() === SUPPLIER_TLC_LABEL
          )?.amount ?? null
        );

      const fallbackBase = baseSupplierTlc ?? marketTlc ?? 900 + (country.country.length % 7) * 24;
      const fixedSuppliers = getDestinationFixedSuppliers(selectedDestination);
      const supplierNames =
        fixedSuppliers !== null
          ? [...fixedSuppliers]
          : (SUPPLIER_NAME_PRESETS[country.country] ?? DEFAULT_SUPPLIERS);
      const suppliers = supplierNames.map((name, index) => {
        const fromApi =
          fixedSuppliers !== null
            ? findTlcForSupplierName(matches, name, parseNumeric)
            : null;
        let value: number | null;
        if (fromApi !== null) {
          value = Number(fromApi.toFixed(1));
        } else if (selectedDestination === NIGERIA_DESTINATION) {
          value = null;
        } else if (
          fixedSuppliers !== null &&
          baseSupplierTlc !== null &&
          selectedDestination !== BRAZIL_DESTINATION
        ) {
          // One vendor TLC applied to every named supplier (e.g. Colombia / single Amcor column).
          // Brazil lists multiple suppliers with separate vendor rows — never broadcast `matches[0]`.
          value = Number(baseSupplierTlc.toFixed(1));
        } else {
          value = Number(
            (fallbackBase * (1 + DUMMY_VARIANCE[index % DUMMY_VARIANCE.length])).toFixed(1)
          );
        }
        const delta =
          value === null || marketTlc === null
            ? null
            : Number((value - marketTlc).toFixed(1));
        return {
          name,
          supplierTlc: value,
          delta,
        };
      });

      return {
        marketCountry: country.country,
        marketTlc,
        suppliers,
      };
    }).filter((row) => row.marketTlc !== null);
  }, [orderedCountries, data.vendorBreakdowns, selectedDestination, selectedMonth, selectedYear]);

  const totalSupplierRows = useMemo(
    () => tableRows.reduce((acc, row) => acc + row.suppliers.length, 0),
    [tableRows]
  );

  const formatTlcDisplay = (value: number | null) =>
    value === null ? "N/A" : `$${formatAmount(value)}/MT`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-card">
      <main className="mx-auto flex max-w-[1400px] flex-col gap-5 p-7 max-sm:p-4">
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
                  const nextMonthOptions = getMonthOptions(
                    e.target.value,
                    selectedDestination
                  );
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
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/40 bg-[rgba(230,168,23,0.1)] px-3 py-1.5 text-xs font-semibold text-primary">
              <span aria-hidden>⚠</span>
              <span>Displayed TLC values are dummy data for simulation.</span>
            </div>
          </div>

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
                <table className="pet-data-table w-full min-w-[920px] border-collapse text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-secondary/80 backdrop-blur">
                      <th className="border-b border-border px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Market Research Country
                      </th>
                      <th className="border-b border-border px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Market Research TLC
                      </th>
                      <th className="border-b border-border px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <span className="block">Supplier</span>
                        {isArgentinaApril2026View(
                          selectedDestination,
                          selectedMonth,
                          selectedYear
                        ) ? (
                          <span className="mt-0.5 block normal-case font-normal text-[10px] text-muted-foreground/90">
                            Resin (Excel): {ARGENTINA_APRIL_2026_RESIN_VENDOR_LABEL}
                          </span>
                        ) : isBrazilApril2026View(
                          selectedDestination,
                          selectedMonth,
                          selectedYear
                        ) ? (
                          <span className="mt-0.5 block normal-case font-normal text-[10px] text-muted-foreground/90">
                            Amcor resin (Excel): {BRAZIL_APRIL_2026_AMCOR_RESIN_VENDOR_LABEL}
                          </span>
                        ) : null}
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
                    {tableRows.map((row, rowIndex) => {
                      const isSelectedMarket = selectedSource === row.marketCountry;
                      if (!row.suppliers.length) {
                        return (
                          <tr
                            key={`${row.marketCountry}-no-supplier`}
                            className={`cursor-pointer border-b-2 border-border/75 transition ${
                              isSelectedMarket
                                ? "bg-primary/10"
                                : rowIndex % 2 === 0
                                  ? "bg-background/10 hover:bg-secondary/25"
                                  : "hover:bg-secondary/25"
                            }`}
                            onClick={() => {
                              const next = new URLSearchParams(searchParams);
                              next.set("source", row.marketCountry);
                              setSearchParams(next);
                            }}
                          >
                            <td className="border-r-2 border-border/70 px-4 py-3 font-semibold text-foreground">
                              <div className="flex items-center gap-2">
                                <span>{row.marketCountry}</span>
                                {isSelectedMarket ? (
                                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                    Selected
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="border-r-2 border-border/70 px-4 py-3 font-semibold text-primary">
                              {formatTlcDisplay(row.marketTlc)}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">—</td>
                            <td className="px-4 py-2.5 text-muted-foreground">N/A</td>
                            <td className="px-4 py-2.5 text-muted-foreground">N/A</td>
                          </tr>
                        );
                      }
                      return row.suppliers.map((supplier, supplierIndex) => (
                        <tr
                          key={`${row.marketCountry}-${supplier.name || "supplier"}-${supplierIndex}`}
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
                                className="border-r-2 border-border/70 px-4 py-3 font-semibold text-primary"
                              >
                                {formatTlcDisplay(row.marketTlc)}
                              </td>
                            </>
                          ) : null}
                          <td className="px-4 py-2.5">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-foreground">{supplier.name}</span>
                              {isArgentinaApril2026View(
                                selectedDestination,
                                selectedMonth,
                                selectedYear
                              ) ? (
                                <span className="text-[10px] text-muted-foreground">
                                  {ARGENTINA_APRIL_2026_RESIN_VENDOR_LABEL}
                                </span>
                              ) : isBrazilApril2026View(
                                selectedDestination,
                                selectedMonth,
                                selectedYear
                              ) &&
                              supplier.name.trim().toLowerCase() === "amcor" ? (
                                <span className="text-[10px] text-muted-foreground">
                                  {BRAZIL_APRIL_2026_AMCOR_RESIN_VENDOR_LABEL}
                                </span>
                              ) : isBrazilApril2026View(
                                selectedDestination,
                                selectedMonth,
                                selectedYear
                              ) &&
                              supplier.name.trim().toLowerCase() === "valgroup" ? (
                                <span className="text-[10px] text-muted-foreground">
                                  {BRAZIL_APRIL_2026_VALGROUP_VENDOR_LABEL}
                                </span>
                              ) : isBrazilApril2026View(
                                selectedDestination,
                                selectedMonth,
                                selectedYear
                              ) &&
                              supplier.name.trim().toLowerCase() === "cristalpet" ? (
                                <span className="text-[10px] text-muted-foreground">
                                  {BRAZIL_APRIL_2026_CRISTALPET_VENDOR_LABEL}
                                </span>
                              ) : isBrazilApril2026View(
                                selectedDestination,
                                selectedMonth,
                                selectedYear
                              ) &&
                              supplier.name.trim().toLowerCase() === "engepack" ? (
                                <span className="text-[10px] text-muted-foreground">
                                  {BRAZIL_APRIL_2026_ENGEPACK_VENDOR_LABEL}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-primary">
                            {formatTlcDisplay(supplier.supplierTlc)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`font-semibold ${
                                supplier.delta === null
                                  ? "text-muted-foreground"
                                  : supplier.delta < 0
                                    ? "text-success"
                                    : "text-destructive"
                              }`}
                            >
                              {supplier.delta === null
                                ? "N/A"
                                : formatDeltaVersusMarketForCompany(supplier.delta)}
                            </span>
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </RevealOnScroll>
      </main>
    </div>
  );
};

export default HomePage;

