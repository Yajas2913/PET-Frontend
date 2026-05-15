import React from "react";
import { useSearchParams } from "react-router-dom";
import type { ApiResponse } from "../types";
import VendorBreakdownDashboard from "../components/VendorBreakdownDashboard";
import RevealOnScroll from "../components/RevealOnScroll";

type TrendsPageProps = {
  data: ApiResponse;
};

const TrendsPage: React.FC<TrendsPageProps> = ({ data }) => {
  const [searchParams] = useSearchParams();

  const selectedDestination = searchParams.get("destination") ?? "";
  const selectedSourceCountry = searchParams.get("source") ?? "";
  const selectedMonth = searchParams.get("month") ?? "";
  const selectedYear = searchParams.get("year") ?? "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-card px-6 py-6 max-sm:px-4">
      <RevealOnScroll>
        <VendorBreakdownDashboard
          vendorBreakdowns={data.vendorBreakdowns ?? []}
          countries={data.countries}
          selectedDestination={selectedDestination}
          selectedSourceCountry={selectedSourceCountry}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
        />
      </RevealOnScroll>
    </div>
  );
};

export default TrendsPage;

