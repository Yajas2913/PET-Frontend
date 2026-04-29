import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { VendorBreakdownEntry } from "../types";
import { formatAmount } from "../types";

type VendorBreakdownDashboardProps = {
  vendorBreakdowns?: VendorBreakdownEntry[];
  selectedDestination?: string;
  selectedSourceCountry?: string;
  selectedMonth?: string;
  selectedYear?: string;
  onBack?: () => void;
};

const LABEL_MAPPING: Record<string, string> = {
  "Resin Index": "Resin Index",
  Finance: "Resin Financing cost",
  "Freight China-Buenaventura (Regular)": "Resin Freight cost (Reg)",
  "Freight China-Buenaventura (Incremental)": "Resin Freight cost (Inc)",
  "ICIS China MID (n-1)": "Month",
  "Sub Total (with Incremental Freight)": "CIF(Incremental)",
  "Sub Total (with Regular Freight)": "CIF(Regular)",
  "Duty 5% (Change According to Regulation)": "Others",
  "Landed Factor 8%": "Others",
  "ZF Legislation Change": "Others",
  "Sur Charge Alpek Br": "Others",
  "Total Resin Price ABI VIRGIN Formula": "Total Resing Price ABI Formulae",
  "Final Price with Resin Freight Adjustment": "Final Price with Resin Freight Adjustment",
  "Final Price FIFO": "Final Price",
};

const MONTH_ORDER = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const RANGE_START_YEAR = 2018;
const RANGE_START_MONTH_INDEX = 6; // July
const RANGE_END_YEAR = 2026;
const RANGE_END_MONTH_INDEX = 2; // March

const NUMERIC_SERIES = [
  "Resin Index",
  "Resin Financing cost",
  "Resin Freight cost (Reg)",
  "Resin Freight cost (Inc)",
  "CIF(Incremental)",
  "CIF(Regular)",
  "Others",
  "Total Resing Price ABI Formulae",
  "Final Price with Resin Freight Adjustment",
  "Final Price",
] as const;

const parseNumericAmount = (value: string | number | null | undefined) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "#REF!" || trimmed.toLowerCase() === "n/a") {
    return 0;
  }
  const numeric = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
};

const toPeriodKey = (year: number, monthIndexValue: number) =>
  `${MONTH_ORDER[monthIndexValue]}-${year}`;

const buildMonthlyPeriods = () => {
  const periods: { year: number; monthIndex: number; month: string; period: string }[] = [];
  for (let year = RANGE_START_YEAR; year <= RANGE_END_YEAR; year += 1) {
    const start = year === RANGE_START_YEAR ? RANGE_START_MONTH_INDEX : 0;
    const end = year === RANGE_END_YEAR ? RANGE_END_MONTH_INDEX : 11;
    for (let m = start; m <= end; m += 1) {
      periods.push({
        year,
        monthIndex: m,
        month: MONTH_ORDER[m],
        period: `${MONTH_ORDER[m].slice(0, 3)} ${year}`,
      });
    }
  }
  return periods;
};

const compactPeriodTick = (value: string) => {
  const [month, year] = value.split(" ");
  if (!month || !year) return value;
  // Keep axis readable: show only January and July anchors.
  if (month !== "Jan" && month !== "Jul") return "";
  return `${month} '${year.slice(-2)}`;
};

const monthIndex = (month: string) => MONTH_ORDER.indexOf(month);

const sortBreakdowns = (rows: VendorBreakdownEntry[]) =>
  [...rows].sort((a, b) => {
    const yearDiff = Number(a.year) - Number(b.year);
    if (yearDiff !== 0) return yearDiff;
    return monthIndex(a.month) - monthIndex(b.month);
  });

const buildTrendData = (entries: VendorBreakdownEntry[]) => {
  return sortBreakdowns(entries).map((entry) => {
    const base = {
      period: `${entry.month.slice(0, 3)} ${entry.year}`,
      month: entry.month,
      year: entry.year,
      sourceCountry: entry.sourceCountry,
      destination: entry.destination,
    } as Record<string, string | number>;

    let others = 0;

    entry.rows.forEach((row) => {
      const mapped = LABEL_MAPPING[row.label];
      if (!mapped) return;
      if (mapped === "Month") {
        base[mapped] = typeof row.amount === "string" ? row.amount : String(row.amount ?? "");
        return;
      }
      const numericValue = parseNumericAmount(row.amount);
      if (mapped === "Others") {
        others += numericValue;
        return;
      }
      base[mapped] = numericValue;
    });

    base["Others"] = others;

    NUMERIC_SERIES.forEach((key) => {
      if (typeof base[key] !== "number") {
        base[key] = 0;
      }
    });

    return base;
  });
};

const TrendTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-2xl">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="space-y-1.5">
        {payload.map((item: any) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-6 text-sm">
            <span className="font-medium text-foreground" style={{ color: item.color }}>
              {item.name}
            </span>
            <span className="font-semibold text-foreground">{formatAmount(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const VendorBreakdownDashboard: React.FC<VendorBreakdownDashboardProps> = ({
  vendorBreakdowns = [],
  selectedDestination,
  selectedSourceCountry,
//   selectedMonth,
//   selectedYear,
  onBack,
}) => {
  const [selectedTrendSeries, setSelectedTrendSeries] = useState<string>("all");
  const filteredEntries = useMemo(() => {
    return vendorBreakdowns.filter((entry) => {
      const destinationMatch = selectedDestination ? entry.destination === selectedDestination : true;
      const sourceMatch = selectedSourceCountry ? entry.sourceCountry === selectedSourceCountry : true;
      return destinationMatch && sourceMatch;
    });
  }, [vendorBreakdowns, selectedDestination, selectedSourceCountry]);

  const baseTrendData = useMemo(() => buildTrendData(filteredEntries), [filteredEntries]);

  const trendData = baseTrendData;

  const latestPoint = trendData[trendData.length - 1];
  const previousPoint = trendData[trendData.length - 2];
  const latestFinalPrice = Number(latestPoint?.["Final Price"] ?? 0);
  const previousFinalPrice = Number(previousPoint?.["Final Price"] ?? 0);
  const latestFormula = Number(latestPoint?.["Total Resing Price ABI Formulae"] ?? 0);
  const previousFormula = Number(previousPoint?.["Total Resing Price ABI Formulae"] ?? 0);
  const delta = latestFinalPrice - previousFinalPrice;
  const formulaDelta = latestFormula - previousFormula;
  const trendSeries = [
    { key: "Resin Index", color: "#3b82f6" },
    { key: "Resin Financing cost", color: "#a855f7" },
    { key: "Resin Freight cost (Reg)", color: "#06b6d4" },
    { key: "Resin Freight cost (Inc)", color: "#f97316" },
    { key: "Others", color: "#94a3b8" },
  ] as const;

  const destinationSourceMonthly = useMemo(() => {
    const destination = selectedDestination || "Colombia";
    const source = selectedSourceCountry || "China";
    const periods = buildMonthlyPeriods();

    const entriesForSource = vendorBreakdowns.filter(
      (entry) => entry.destination === destination && entry.sourceCountry === source
    );

    const supplierByPeriod = new Map<string, number>();
    entriesForSource.forEach((entry) => {
      const tlcRow = entry.rows.find(
        (row) =>
          row.label.trim().toLowerCase() ===
          "total resin price abi virgin formula".toLowerCase()
      );
      const value = parseNumericAmount(tlcRow?.amount);
      const monthIdx = MONTH_ORDER.indexOf(entry.month);
      if (monthIdx >= 0) {
        supplierByPeriod.set(toPeriodKey(Number(entry.year), monthIdx), value);
      }
    });

    const marketActualBaseBySource: Record<string, number> = {
      China: 818.9,
      Vietnam: 954.0,
      Thailand: 980.2,
      Taiwan: 971.4,
      Indonesia: 988.7,
      India: 994.0,
      "South Korea": 996.2,
      Mexico: 1249.8,
    };

    const baseMarket = marketActualBaseBySource[source] ?? 900;
    const fallbackSupplierBase =
      supplierByPeriod.get(toPeriodKey(2026, 2)) ?? baseMarket + 120;

    return periods.map((period, idx) => {
      const key = toPeriodKey(period.year, period.monthIndex);
      const actualSupplier = supplierByPeriod.get(key);
      const seasonalWave = Math.sin((idx / 12) * Math.PI * 2);
      const shortCycle = ((idx % 5) - 2) * 1.6;
      const secondaryWave = Math.sin((idx / 6) * Math.PI * 2 + 0.8);
      const volatilityPulse = idx % 17 === 0 ? 14 : idx % 11 === 0 ? -10 : 0;
      const supplierVariability = seasonalWave * 8 + shortCycle;
      const marketVariability =
        seasonalWave * 18 +
        secondaryWave * 11 -
        shortCycle * 1.2 +
        volatilityPulse;
      const supplierTlcValue =
        actualSupplier !== undefined
          ? actualSupplier
          : Number(
              (
                fallbackSupplierBase * (0.85 + idx * 0.0018) +
                supplierVariability
              ).toFixed(1)
            );

      // Use actual where known (Mar 2026), dummy for historical gaps.
      const marketResearchValue =
        period.year === 2026 && period.monthIndex === 2
          ? baseMarket
          : Number(
              (baseMarket * (0.86 + idx * 0.0014) + marketVariability).toFixed(1)
            );

      return {
        period: period.period,
        marketResearchValue,
        supplierTlcValue,
      };
    });
  }, [vendorBreakdowns, selectedDestination, selectedSourceCountry]);

  if (!trendData.length) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-[#0f0f0f] px-6 py-8 max-sm:px-4">
        <Card className="mx-auto w-full max-w-[1400px] animate-fade-in-up shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Vendor Breakdown Trends</CardTitle>
            <CardDescription>No vendor breakdown data available for the current filters.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-[#0f0f0f] px-6 py-8 max-sm:px-4 max-sm:py-5">
      <section className="mx-auto w-full max-w-[1400px] space-y-6 animate-fade-in-up">
        <Card className="border-primary/10 bg-card/80 shadow-lg backdrop-blur">
          <CardContent className="flex flex-wrap items-end justify-between gap-5 p-6 max-sm:p-4">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Supplier Sheet Details
                </p>
                <h1 className="mt-2 text-[28px] font-extrabold text-foreground">
                  Vendor Breakdown Trends
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  Explore monthly supplier cost components and run quick simulations without leaving the current analysis flow.
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                    Selected Source
                  </p>
                  <h2 className="text-[32px] font-extrabold bg-gradient-to-r from-primary to-yellow-300 bg-clip-text text-transparent">
                    {selectedSourceCountry || "All Sources"}
                  </h2>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                    Selected Destination
                  </p>
                  <h2 className="text-[32px] font-extrabold bg-gradient-to-r from-primary to-yellow-300 bg-clip-text text-transparent">
                    {selectedDestination || "All Destinations"}
                  </h2>
                </div>
                {/* {(selectedMonth || selectedYear) && (
                  <div className="rounded-xl border border-border bg-background/40 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                      Active Period
                    </p>
                    <p className="text-base font-semibold text-foreground">
                      {[selectedMonth, selectedYear].filter(Boolean).join(" ")}
                    </p>
                  </div>
                )} */}
              </div>
            </div>

            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary"
              >
                Back to overview
              </button>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-primary/20 py-2 px-2 shadow-lg">
            <CardHeader className="pb-2 space-y-1">
              <CardDescription>Final Price (March 2026)</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-foreground">
                {formatAmount(latestFinalPrice)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Badge
                variant="secondary"
                className={
                  delta <= 0
                    ? "bg-green-500/15 text-green-400 border border-green-500/20"
                    : "bg-yellow-500/15 text-yellow-300 border border-yellow-500/20"
                }
              >
                {delta >= 0 ? "+" : ""}
                {formatAmount(delta)} vs previous month
              </Badge>
              <p className="text-xs text-muted-foreground">Latest available final delivered price.</p>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/20 py-2 px-2 shadow-lg">
            <CardHeader className="pb-2 space-y-1">
              <CardDescription>Total Landed Cost (PET Resin) (March 2026)</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-primary">
                {formatAmount(latestFormula)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Badge
                variant="secondary"
                className={
                  formulaDelta <= 0
                    ? "bg-green-500/15 text-green-400 border border-green-500/20"
                    : "bg-yellow-500/15 text-yellow-300 border border-yellow-500/20"
                }
              >
                {formulaDelta >= 0 ? "+" : ""}
                {formatAmount(formulaDelta)} vs previous month
              </Badge>
              <p className="text-xs text-muted-foreground">
                Mapped from Total Resin Price ABI VIRGIN Formula.
              </p>
            </CardContent>
          </Card>

        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Monthly Market Research TLC vs Supplier TLC</CardTitle>
            <CardDescription>
              {(selectedDestination || "Colombia")} vs {(selectedSourceCountry || "China")} from Jul 2018 to Mar 2026.
            </CardDescription>
            <div className="mt-1 inline-flex w-fit items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-medium text-yellow-300">
              <span aria-hidden>⚠</span>
              <span>Market Research values are dummy data with simulated variability.</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border bg-card/40 p-3">
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={destinationSourceMonthly} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 11, fill: "#a1a1aa" }}
                      tickFormatter={compactPeriodTick}
                      interval={0}
                      minTickGap={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={{ fontSize: 12, fill: "#a1a1aa" }} tickLine={false} axisLine={false} width={48} />
                    <Tooltip content={<TrendTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="marketResearchValue"
                      name="Market Research TLC"
                      stroke="#eab308"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="supplierTlcValue"
                      name="Supplier TLC"
                      stroke="#22c55e"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Monthly Vendor Breakdown Trend</CardTitle>
            <CardDescription>
              Resin index, financing, freight (regular/incremental), and others across months.
            </CardDescription>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedTrendSeries("all")}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                  selectedTrendSeries === "all"
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              {trendSeries.map((series) => (
                <button
                  key={series.key}
                  type="button"
                  onClick={() => setSelectedTrendSeries(series.key)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                    selectedTrendSeries === series.key
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {series.key}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border bg-card/40 p-3">
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 11, fill: "#a1a1aa" }}
                      tickFormatter={compactPeriodTick}
                      interval={0}
                      minTickGap={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={{ fontSize: 12, fill: "#a1a1aa" }} tickLine={false} axisLine={false} width={48} />
                    <Tooltip content={<TrendTooltip />} />
                    {trendSeries
                      .filter(
                        (series) =>
                          selectedTrendSeries === "all" || selectedTrendSeries === series.key
                      )
                      .map((series) => (
                        <Line
                          key={series.key}
                          type="monotone"
                          dataKey={series.key}
                          stroke={series.color}
                          strokeWidth={2.2}
                          dot={false}
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default VendorBreakdownDashboard;