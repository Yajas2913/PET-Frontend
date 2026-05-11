import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ApiResponse, VendorBreakdownEntry } from "../types";
import TopRightNavigation from "../components/TopRightNavigation";
import RevealOnScroll from "../components/RevealOnScroll";
import { formatAmount } from "../types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CartesianGrid,
  Legend,
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

const ABI_PRIMARY_BLUE = "#003A70";
const ABI_LIGHT_BLUE = "#00A3E0";
const ABI_GOLD = "#FFB81C";

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
const RANGE_START_YEAR = 2026;
const RANGE_START_MONTH_INDEX = 0; // January
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

const shortMonthTick = (value: string) => {
  const [month, year] = value.split(" ");
  if (!month || !year) return value;
  return `${month}-${year.slice(-2)}`;
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
  const [simulationMetric] = useState<string>("Supplier TLC");
  const [simulationPercent, setSimulationPercent] = useState<number>(0);

  const selectedDestination = searchParams.get("destination") ?? "";
  const selectedSourceCountry = searchParams.get("source") ?? "";

  const filteredEntries = useMemo(
    () =>
      data.vendorBreakdowns.filter(
        (entry) =>
          (!selectedDestination || entry.destination === selectedDestination) &&
          (!selectedSourceCountry || entry.sourceCountry === selectedSourceCountry) &&
          Number(entry.year) === 2026
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

  const combinedMonthlyTlcData = useMemo(
    () =>
      destinationSourceMonthly.map((row, idx) => ({
        period: row.period,
        marketResearchValue: row.marketResearchValue,
        originalSupplierTlcValue: row.supplierTlcValue,
        simulatedSupplierTlcValue:
          destinationSourceMonthlySimulated[idx]?.supplierTlcValue ?? row.supplierTlcValue,
      })),
    [destinationSourceMonthly, destinationSourceMonthlySimulated]
  );

  const SimulationTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-primary/20 bg-[#020817]/95 px-4 py-3 shadow-2xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">{label}</p>
        <div className="space-y-1.5">
          {payload.map((item: any) => (
            <div key={item.dataKey} className="flex items-center justify-between gap-6 text-sm">
              <span className="font-medium" style={{ color: item.color }}>
                {item.name}
              </span>
              <span className="font-semibold text-slate-100">
                {formatAmount(item.value as number | string | null | undefined)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-[#0f0f0f] px-6 py-6 max-sm:px-4">
      <section className="mx-auto w-full max-w-[1400px] space-y-4">
        <RevealOnScroll>
        <Card className="border-primary/10 bg-card/80 shadow-lg backdrop-blur">
          <CardContent className="p-6 max-sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Scenario Planning
            </p>
            <h1 className="mt-2 text-xl font-extrabold text-foreground">
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
                <div className="flex h-11 w-full items-center rounded-xl border border-border bg-secondary px-3 text-sm text-foreground">
                  {simulationMetric}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card/40 p-4">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Percentage change</label>
                  <Badge variant="secondary">{simulationPercent > 0 ? "+" : ""}{simulationPercent}%</Badge>
                </div>
                <input
                  type="range"
                  min={-5}
                  max={5}
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
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Monthly Market Research TLC vs Supplier TLC</CardTitle>
            <CardDescription>
              {(selectedDestination || "Colombia")} vs {(selectedSourceCountry || "China")} from Jan 2026 to Mar 2026.
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
                  <LineChart data={combinedMonthlyTlcData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 11, fill: "#a1a1aa" }}
                      tickFormatter={shortMonthTick}
                      interval={0}
                      minTickGap={10}
                      tickMargin={8}
                      padding={{ left: 8, right: 24 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={{ fontSize: 12, fill: "#a1a1aa" }} tickLine={false} axisLine={false} width={48} />
                    <Tooltip content={<SimulationTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "12px", color: "#cbd5e1" }} />
                    <Line
                      type="monotone"
                      dataKey="marketResearchValue"
                      name="Market Research TLC"
                      stroke={ABI_GOLD}
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="originalSupplierTlcValue"
                      name="Original Supplier TLC"
                      stroke={ABI_PRIMARY_BLUE}
                      strokeWidth={2.2}
                      strokeDasharray="6 4"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="simulatedSupplierTlcValue"
                      name="Simulated Supplier TLC"
                      stroke={ABI_LIGHT_BLUE}
                      strokeWidth={2.6}
                      dot={false}
                    />
                  </LineChart>
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
