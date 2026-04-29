import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ApiResponse, VendorBreakdownEntry } from "../types";
import TopRightNavigation from "../components/TopRightNavigation";
import RevealOnScroll from "../components/RevealOnScroll";
import { formatAmount } from "../types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type SimulationPageProps = {
  data: ApiResponse;
};

const LABEL_MAPPING: Record<string, string> = {
  "Resin Index": "Resin Index",
  Finance: "Resin Financing cost",
  "Freight China-Buenaventura (Regular)": "Resin Freight cost (Reg)",
  "Freight China-Buenaventura (Incremental)": "Resin Freight cost (Inc)",
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
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const RANGE_START_YEAR = 2018;
const RANGE_START_MONTH_INDEX = 6; // July
const RANGE_END_YEAR = 2026;
const RANGE_END_MONTH_INDEX = 2; // March

const SIMULATION_TARGETS = [
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
  const n = Number(value.trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
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
  if (month !== "Jan" && month !== "Jul") return "";
  return `${month} '${year.slice(-2)}`;
};

const buildTrendData = (entries: VendorBreakdownEntry[]) =>
  [...entries]
    .sort((a, b) => Number(a.year) - Number(b.year) || MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month))
    .map((entry) => {
      const row: Record<string, string | number> = {
        period: `${entry.month.slice(0, 3)} ${entry.year}`,
      };
      let others = 0;
      entry.rows.forEach((r) => {
        const mapped = LABEL_MAPPING[r.label];
        if (!mapped) return;
        const v = parseNumericAmount(r.amount);
        if (mapped === "Others") others += v;
        else row[mapped] = v;
      });
      row["Others"] = others;
      return row;
    });

const applySimulation = (trendData: Record<string, string | number>[], metric: string, percentage: number) => {
  const multiplier = 1 + percentage / 100;
  return trendData.map((row) => {
    const next = { ...row };
    if (metric === "All Metrics") {
      SIMULATION_TARGETS.forEach((k) => {
        next[k] = Number(next[k] ?? 0) * multiplier;
      });
    } else {
      next[metric] = Number(next[metric] ?? 0) * multiplier;
    }
    return next;
  });
};

const SimulationPage: React.FC<SimulationPageProps> = ({ data }) => {
  const [searchParams] = useSearchParams();
  const [simulationMetric, setSimulationMetric] = useState<string>("Total Resing Price ABI Formulae");
  const [simulationPercent, setSimulationPercent] = useState<number>(0);

  const selectedDestination = searchParams.get("destination") ?? "";
  const selectedSourceCountry = searchParams.get("source") ?? "";

  const filteredEntries = useMemo(
    () =>
      data.vendorBreakdowns.filter(
        (entry) =>
          (!selectedDestination || entry.destination === selectedDestination) &&
          (!selectedSourceCountry || entry.sourceCountry === selectedSourceCountry)
      ),
    [data.vendorBreakdowns, selectedDestination, selectedSourceCountry]
  );

  const baseTrendData = useMemo(() => buildTrendData(filteredEntries), [filteredEntries]);
  const trendBase = baseTrendData;
  const trendData = useMemo(
    () => applySimulation(baseTrendData, simulationMetric, simulationPercent),
    [baseTrendData, simulationMetric, simulationPercent]
  );

  const focusMetric = "Total Resing Price ABI Formulae";
  const latestPoint = trendBase[trendBase.length - 1];
  const previousPoint = trendBase[trendBase.length - 2];
  const latestFinalPrice = Number(latestPoint?.["Final Price"] ?? 0);
  const previousFinalPrice = Number(previousPoint?.["Final Price"] ?? 0);
  const latestFormula = Number(latestPoint?.["Total Resing Price ABI Formulae"] ?? 0);
  const latestOthers = Number(latestPoint?.["Others"] ?? 0);
  const focusMetricValue = Number(latestPoint?.[focusMetric] ?? 0);
  const delta = latestFinalPrice - previousFinalPrice;

  const destinationSourceMonthly = useMemo(() => {
    const destination = selectedDestination || "Colombia";
    const source = selectedSourceCountry || "China";
    const periods = buildMonthlyPeriods();

    const entriesForSource = data.vendorBreakdowns.filter(
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
      const supplierTlcValue =
        actualSupplier !== undefined
          ? actualSupplier
          : Number((fallbackSupplierBase * (0.85 + idx * 0.0018)).toFixed(1));

      const marketResearchValue =
        period.year === 2026 && period.monthIndex === 2
          ? baseMarket
          : Number((baseMarket * (0.86 + idx * 0.0016)).toFixed(1));

      return {
        period: period.period,
        marketResearchValue,
        supplierTlcValue,
      };
    });
  }, [data.vendorBreakdowns, selectedDestination, selectedSourceCountry]);

  const destinationSourceMonthlySimulated = useMemo(() => {
    const multiplier = 1 + simulationPercent / 100;
    return destinationSourceMonthly.map((row) => {
      const next = { ...row };

      if (simulationMetric === "All Metrics") {
        next.marketResearchValue = Number((next.marketResearchValue * multiplier).toFixed(1));
        next.supplierTlcValue = Number((next.supplierTlcValue * multiplier).toFixed(1));
        return next;
      }

      if (simulationMetric === "Market Research TLC") {
        next.marketResearchValue = Number((next.marketResearchValue * multiplier).toFixed(1));
      }
      if (simulationMetric === "Supplier TLC") {
        next.supplierTlcValue = Number((next.supplierTlcValue * multiplier).toFixed(1));
      }

      return next;
    });
  }, [destinationSourceMonthly, simulationMetric, simulationPercent]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-[#0f0f0f] px-6 py-6 max-sm:px-4">
      <div className="mx-auto w-full max-w-[1400px] mb-4">
        <TopRightNavigation search={searchParams.toString()} />
      </div>
      <section className="mx-auto w-full max-w-[1400px] space-y-4">
        <RevealOnScroll>
        <Card className="border-primary/10 bg-card/80 shadow-lg backdrop-blur">
          <CardContent className="p-6 max-sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Scenario Planning
            </p>
            <h1 className="mt-2 text-[28px] font-extrabold text-foreground">
              Simulation Workspace
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Experiment with percentage-based adjustments on selected cost metrics and instantly compare
              how trends shift across Market Research TLC, Supplier TLC, focused metric trends, and composition views.
            </p>
          </CardContent>
        </Card>
        </RevealOnScroll>

        <RevealOnScroll delay={0.03}>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Simulation</CardTitle>
            <CardDescription>Adjust one series or all series and view impact on trend.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_160px] xl:items-end">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Simulation target</label>
                <select
                  value={simulationMetric}
                  onChange={(e) => setSimulationMetric(e.target.value)}
                  className="h-11 w-full rounded-xl bg-secondary border border-border px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Final Price">Final Price</option>
                  <option value="Final Price with Resin Freight Adjustment">Final Price with Resin Freight Adjustment</option>
                  <option value="Total Resing Price ABI Formulae">Total Resing Price ABI Formulae</option>
                  <option value="Resin Index">Resin Index</option>
                  <option value="Resin Financing cost">Resin Financing cost</option>
                  <option value="Resin Freight cost (Reg)">Resin Freight cost (Reg)</option>
                  <option value="Resin Freight cost (Inc)">Resin Freight cost (Inc)</option>
                  <option value="CIF(Incremental)">CIF(Incremental)</option>
                  <option value="CIF(Regular)">CIF(Regular)</option>
                  <option value="Others">Others</option>
                  <option value="Market Research TLC">Market Research TLC</option>
                  <option value="Supplier TLC">Supplier TLC</option>
                  <option value="All Metrics">All Metrics</option>
                </select>
              </div>
              <div className="rounded-xl border border-border bg-card/40 p-4">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Percentage change</label>
                  <Badge variant="secondary">{simulationPercent > 0 ? "+" : ""}{simulationPercent}%</Badge>
                </div>
                <input
                  type="range"
                  min={-30}
                  max={30}
                  step={1}
                  value={simulationPercent}
                  onChange={(e) => setSimulationPercent(Number(e.target.value))}
                  className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
                />
              </div>
              <button
                type="button"
                onClick={() => setSimulationPercent(0)}
                className="h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-secondary"
              >
                Reset
              </button>
            </div>
          </CardContent>
        </Card>
        </RevealOnScroll>

        <RevealOnScroll delay={0.05}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">Monthly Market Research TLC</CardTitle>
              <CardDescription>
                {(selectedDestination || "Colombia")} vs {(selectedSourceCountry || "China")} from Jul 2018 to Mar 2026.
              </CardDescription>
              <div className="mt-1 inline-flex w-fit items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-medium text-yellow-300">
                <span aria-hidden>⚠</span>
                <span>Market Research values are dummy data.</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border bg-card/40 p-3">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={destinationSourceMonthlySimulated} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#a1a1aa" }} tickFormatter={compactPeriodTick} interval={0} minTickGap={10} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "#a1a1aa" }} tickLine={false} axisLine={false} width={48} />
                      <Tooltip formatter={(value) => formatAmount(value as number | string | null | undefined)} />
                      <Line type="monotone" dataKey="marketResearchValue" name="Market Research TLC" stroke="#eab308" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">Monthly Supplier TLC</CardTitle>
              <CardDescription>
                {(selectedDestination || "Colombia")} vs {(selectedSourceCountry || "China")} from Jul 2018 to Mar 2026.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border bg-card/40 p-3">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={destinationSourceMonthlySimulated} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#a1a1aa" }} tickFormatter={compactPeriodTick} interval={0} minTickGap={10} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "#a1a1aa" }} tickLine={false} axisLine={false} width={48} />
                      <Tooltip formatter={(value) => formatAmount(value as number | string | null | undefined)} />
                      <Line type="monotone" dataKey="supplierTlcValue" name="Supplier TLC" stroke="#22c55e" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </RevealOnScroll>

        <RevealOnScroll delay={0.07}>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Focused Metric Trend</CardTitle>
            <CardDescription>{focusMetric} shown month by month.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border bg-card/40 p-3">
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendBase} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <defs>
                      <linearGradient id="focusFillSimulationPage" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#eab308" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#eab308" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="period" tick={{ fontSize: 12, fill: "#a1a1aa" }} interval={Math.max(Math.floor(trendBase.length / 8), 0)} minTickGap={20} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#a1a1aa" }} tickLine={false} axisLine={false} width={48} />
                    <Tooltip formatter={(value) => formatAmount(value as number | string | null | undefined)} />
                    <Area type="monotone" dataKey={focusMetric} stroke="#eab308" fill="url(#focusFillSimulationPage)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
        </RevealOnScroll>

        <RevealOnScroll delay={0.09}>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Latest Month Composition</CardTitle>
            <CardDescription>{latestPoint?.period}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border bg-card/40 p-3">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Resin Index", value: Number(latestPoint?.["Resin Index"] ?? 0) },
                      { name: "Financing", value: Number(latestPoint?.["Resin Financing cost"] ?? 0) },
                      { name: "Freight Reg", value: Number(latestPoint?.["Resin Freight cost (Reg)"] ?? 0) },
                      { name: "Freight Inc", value: Number(latestPoint?.["Resin Freight cost (Inc)"] ?? 0) },
                      { name: "CIF Inc", value: Number(latestPoint?.["CIF(Incremental)"] ?? 0) },
                      { name: "CIF Reg", value: Number(latestPoint?.["CIF(Regular)"] ?? 0) },
                      { name: "Others", value: Number(latestPoint?.["Others"] ?? 0) },
                      { name: "Final Price", value: Number(latestPoint?.["Final Price"] ?? 0) },
                    ]}
                    layout="vertical"
                    margin={{ top: 8, right: 16, bottom: 8, left: 12 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: "#a1a1aa" }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#d4d4d8" }} width={90} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value) => formatAmount(value as number | string | null | undefined)} />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#eab308">
                      <LabelList
                        dataKey="value"
                        position="right"
                        formatter={(value) => formatAmount(value as number | string | null | undefined)}
                        className="fill-foreground text-[10px] font-semibold"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
        </RevealOnScroll>
      </section>
    </div>
  );
};

export default SimulationPage;
