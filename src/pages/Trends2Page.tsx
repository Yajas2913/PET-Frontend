import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ApiResponse, VendorBreakdownEntry } from "../types";
import TopRightNavigation from "../components/TopRightNavigation";
import RevealOnScroll from "../components/RevealOnScroll";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "../types";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Trends2PageProps = {
  data: ApiResponse;
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

const LINE_COLORS = [
  "#22c55e",
  "#eab308",
  "#38bdf8",
  "#a855f7",
  "#f97316",
  "#94a3b8",
  "#f43f5e",
  "#10b981",
  "#60a5fa",
  "#fb7185",
];

const parseNumericAmount = (value: string | number | null | undefined) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed.toLowerCase() === "n/a") return null;
  const numeric = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
};

const getSupplierTlc = (entry: VendorBreakdownEntry) => {
  const row = entry.rows.find(
    (item) =>
      item.label.trim().toLowerCase() ===
      "total resin price abi virgin formula".toLowerCase()
  );
  return parseNumericAmount(row?.amount);
};

const compactPeriodTick = (value: string) => {
  const [month, year] = value.split(" ");
  if (!month || !year) return value;
  if (month !== "Jan" && month !== "Jul") return "";
  return `${month} '${year.slice(-2)}`;
};

const buildMonthlyPeriods = () => {
  const periods: { year: number; monthIndex: number; period: string }[] = [];
  for (let year = RANGE_START_YEAR; year <= RANGE_END_YEAR; year += 1) {
    const start = year === RANGE_START_YEAR ? RANGE_START_MONTH_INDEX : 0;
    const end = year === RANGE_END_YEAR ? RANGE_END_MONTH_INDEX : 11;
    for (let monthIndex = start; monthIndex <= end; monthIndex += 1) {
      periods.push({
        year,
        monthIndex,
        period: `${MONTH_ORDER[monthIndex].slice(0, 3)} ${year}`,
      });
    }
  }
  return periods;
};

const Trends2Page: React.FC<Trends2PageProps> = ({ data }) => {
  const [searchParams] = useSearchParams();
  const fixedDestination = "Colombia";
  const [selectedSupplier, setSelectedSupplier] = useState<string>("China");

  const destinationEntries = useMemo(
    () =>
      data.vendorBreakdowns.filter((entry) => entry.destination === fixedDestination),
    [data.vendorBreakdowns]
  );

  const allSources = useMemo(
    () =>
      Array.from(
        new Set(data.countries.map((country) => country.country).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [data.countries]
  );

  const chartData = useMemo(() => {
    const periods = buildMonthlyPeriods();
    const actualBySourceAndPeriod = new Map<string, number>();
    destinationEntries.forEach((entry) => {
      const monthIndex = MONTH_ORDER.indexOf(entry.month);
      if (monthIndex < 0) return;
      const period = `${entry.month.slice(0, 3)} ${entry.year}`;
      const value = getSupplierTlc(entry);
      if (value === null) return;
      actualBySourceAndPeriod.set(`${entry.sourceCountry}|${period}`, value);
    });

    const marketBaseBySource = new Map<string, number>();
    data.countries.forEach((country, index) => {
      const tlc = country.breakdown.find((row) =>
        row.label.toLowerCase().includes("total landed cost")
      );
      const baseFromCountry = parseNumericAmount(tlc?.amount);
      marketBaseBySource.set(
        country.country,
        baseFromCountry ?? 900 + index * 35
      );
    });

    return periods.map((periodItem, idx) => {
      const row: Record<string, string | number | null> = { period: periodItem.period };
      const seasonalWave = Math.sin((idx / 12) * Math.PI * 2);
      const secondaryWave = Math.sin((idx / 6) * Math.PI * 2 + 0.8);
      const pulse = idx % 17 === 0 ? 14 : idx % 11 === 0 ? -10 : 0;

      allSources.forEach((source, sourceIndex) => {
        const actual = actualBySourceAndPeriod.get(`${source}|${periodItem.period}`);
        if (actual !== undefined) {
          row[source] = actual;
          return;
        }
        const base = marketBaseBySource.get(source) ?? 900 + sourceIndex * 35;
        const slope = base * (0.84 + idx * 0.00145);
        const sourceOffset = (sourceIndex % 4) * 5 - 7;
        const dummy =
          slope + seasonalWave * 18 + secondaryWave * 10 - sourceOffset + pulse;
        row[source] = Number(dummy.toFixed(1));
      });

      return row;
    });
  }, [allSources, data.countries, destinationEntries]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-[#0f0f0f] px-6 py-6 max-sm:px-4">
      <RevealOnScroll>
        <section className="mx-auto w-full max-w-[1400px] space-y-4">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">Historical Supplier Comparison</CardTitle>
              <CardDescription>
                {fixedDestination} vs all available source countries from Jul 2018 to Mar 2026.
              </CardDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSupplier("all")}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                    selectedSupplier === "all"
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All Suppliers
                </button>
                {allSources.map((source) => (
                  <button
                    key={source}
                    type="button"
                    onClick={() => setSelectedSupplier(source)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                      selectedSupplier === source
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {source}
                  </button>
                ))}
              </div>
              <div className="mt-1 inline-flex w-fit items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-medium text-yellow-300">
                <span aria-hidden>⚠</span>
                <span>Historical values are dummy/simulated for trends view.</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border bg-card/40 p-3">
                <div className="h-[420px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
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
                      <YAxis
                        tick={{ fontSize: 12, fill: "#a1a1aa" }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                      />
                      <Tooltip
                        formatter={(value) =>
                          formatAmount(value as number | string | null | undefined)
                        }
                      />
                      {allSources
                        .filter(
                          (source) => selectedSupplier === "all" || selectedSupplier === source
                        )
                        .map((source, index) => (
                          <Line
                            key={source}
                            type="monotone"
                            dataKey={source}
                            name={source}
                            stroke={LINE_COLORS[index % LINE_COLORS.length]}
                            strokeWidth={2.4}
                            dot={false}
                            connectNulls
                          />
                        ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </RevealOnScroll>
    </div>
  );
};

export default Trends2Page;
