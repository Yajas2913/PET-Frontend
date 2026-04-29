import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import type { ApiResponse } from "./types";
import HomePage from "./pages/HomePage";
import CurrentLayoutPage from "./pages/CurrentLayoutPage";
import TrendsPage from "./pages/TrendsPage";
import Trends2Page from "./pages/Trends2Page";
import SimulationPage from "./pages/SimulationPage";

import "./index.css";

const App: React.FC = () => {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [searchParams] = useSearchParams();
  const hasLoadedVendorBreakdowns = useRef(false);

  useEffect(() => {
    const paramsString = searchParams.toString();
    const url = new URL("http://localhost:8000/countries" + (paramsString ? `?${paramsString}` : ""));

    // vendorBreakdowns are large; only fetch them once.
    const includeVendorBreakdowns = !hasLoadedVendorBreakdowns.current;
    url.searchParams.set("includeVendorBreakdowns", String(includeVendorBreakdowns));
    if (includeVendorBreakdowns) hasLoadedVendorBreakdowns.current = true;

    fetch(url.toString())
      .then((res) => res.json())
      .then((payload: ApiResponse) => {
        setData((prev) => {
          // If we intentionally skipped vendorBreakdowns, keep the existing ones.
          if (
            prev &&
            !includeVendorBreakdowns &&
            Array.isArray(payload.vendorBreakdowns) &&
            payload.vendorBreakdowns.length === 0
          ) {
            return { ...prev, ...payload, vendorBreakdowns: prev.vendorBreakdowns };
          }
          return payload;
        });
      });
  }, [searchParams.toString()]);

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-background">
        <div className="w-10 h-10 border-[3px] border-border border-t-primary rounded-full animate-spin-slow" />
        <p className="text-muted-foreground text-sm animate-pulse">
          Loading PET resin cost data…
        </p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage data={data} />} />
      <Route path="/deep-dive" element={<CurrentLayoutPage data={data} />} />
      <Route path="/trends" element={<TrendsPage data={data} />} />
      <Route path="/trends-2" element={<Trends2Page data={data} />} />
      <Route path="/simulation" element={<SimulationPage data={data} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;