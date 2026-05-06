import React from "react";
import { useSearchParams } from "react-router-dom";
import TopRightNavigation from "./TopRightNavigation";
import abinbevLogo from "../assets/ABInbev.png";

const AppHeader: React.FC = () => {
  const [searchParams] = useSearchParams();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-[#1a1a1a]">
      <div className="mx-auto max-w-[1400px] px-6 py-3 flex items-center justify-between gap-4 max-sm:px-4">
        <div className="flex items-center gap-3">
          <img src={abinbevLogo} alt="AB InBev" className="brand-logo" />
          <h1 className="text-lg font-bold text-foreground">
            PET resin : Supplier Quotes vs Market Research
          </h1>
        </div>
        <TopRightNavigation search={searchParams.toString()} />
      </div>
    </header>
  );
};

export default AppHeader;
