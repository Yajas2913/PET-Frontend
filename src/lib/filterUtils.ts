export const MONTHS = [
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

export function getYearOptions(startYear = 2018, endYear = 2026) {
  const years: string[] = [];
  for (let year = startYear; year <= endYear; year += 1) {
    years.push(String(year));
  }
  return years;
}

/** Destinations that only use data through March 2026 (no April in the month dropdown for that year). */
const EXCLUDE_APRIL_2026_FOR_DESTINATIONS = new Set(["Colombia", "Ecuador"]);

export function getMonthOptions(selectedYear: string, destination?: string) {
  if (!selectedYear) return MONTHS;
  const year = Number(selectedYear);

  if (year === 2018) {
    return MONTHS.slice(6);
  }
  if (year === 2026) {
    const cap = EXCLUDE_APRIL_2026_FOR_DESTINATIONS.has(destination ?? "")
      ? 3
      : 4;
    return MONTHS.slice(0, cap);
  }
  return MONTHS;
}

