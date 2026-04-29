import React from "react";
import { Link, useLocation } from "react-router-dom";

type TopRightNavigationProps = {
  search: string;
};

const ITEMS = [
  { label: "Home", path: "/" },
  { label: "Trends", path: "/trends" },
  { label: "Trends 2", path: "/trends-2" },
  { label: "Simulation", path: "/simulation" },
];

const TopRightNavigation: React.FC<TopRightNavigationProps> = ({ search }) => {
  const location = useLocation();
  const activePath = location.pathname;

  const actionTarget =
    activePath === "/"
      ? "/trends"
      : activePath === "/trends"
      ? "/trends-2"
      : activePath === "/trends-2"
      ? "/simulation"
      : "/";
  const actionLabel =
    activePath === "/"
      ? "Go to Trends"
      : activePath === "/trends"
      ? "Go to Trends 2"
      : activePath === "/trends-2"
      ? "Go to Simulation"
      : "Go to Home";

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <nav aria-label="Universal navigation" className="text-sm text-muted-foreground">
        {ITEMS.map((item, index) => {
          const isActive = item.path === activePath;
          return (
            <React.Fragment key={item.path}>
              <Link
                to={{ pathname: item.path, search }}
                className={isActive ? "font-semibold text-foreground" : "hover:text-foreground transition"}
              >
                {item.label}
              </Link>
              {index < ITEMS.length - 1 ? <span className="mx-1.5">/</span> : null}
            </React.Fragment>
          );
        })}
      </nav>

      <Link
        to={{ pathname: actionTarget, search }}
        className="inline-flex items-center justify-center rounded-lg border border-primary/25 bg-gradient-to-r from-primary to-yellow-300 px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow"
      >
        {actionLabel}
      </Link>
    </div>
  );
};

export default TopRightNavigation;
