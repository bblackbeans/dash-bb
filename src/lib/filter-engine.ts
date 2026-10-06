import type { DataRow } from "./mock-loader";

export type DatePreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "month"
  | "lastMonth"
  | "year"
  | "all"
  | "custom";

export type DashboardFilters = {
  preset: DatePreset;
  startDate?: string;
  endDate?: string;
  facets: Record<string, string[]>;
  compare: boolean;
};

export const defaultFilters = (): DashboardFilters => ({
  preset: "all",
  facets: {},
  compare: false,
});

function parseDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function resolveDateRange(
  filters: DashboardFilters,
  today = new Date()
): { start: string; end: string } | null {
  if (filters.preset === "all") return null;

  const end = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );

  if (filters.preset === "custom" && filters.startDate && filters.endDate) {
    const start = filters.startDate <= filters.endDate ? filters.startDate : filters.endDate;
    const finish = filters.startDate <= filters.endDate ? filters.endDate : filters.startDate;
    return { start, end: finish };
  }

  if (filters.preset === "today") {
    return { start: toIso(end), end: toIso(end) };
  }

  if (filters.preset === "yesterday") {
    const day = new Date(end);
    day.setUTCDate(day.getUTCDate() - 1);
    return { start: toIso(day), end: toIso(day) };
  }

  if (filters.preset === "month") {
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    return { start: toIso(start), end: toIso(end) };
  }

  if (filters.preset === "lastMonth") {
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
    const finish = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0));
    return { start: toIso(start), end: toIso(finish) };
  }

  if (filters.preset === "year") {
    const start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
    return { start: toIso(start), end: toIso(end) };
  }

  const start = new Date(end);
  const days = filters.preset === "7d" ? 6 : filters.preset === "90d" ? 89 : 29;
  start.setUTCDate(start.getUTCDate() - days);
  return { start: toIso(start), end: toIso(end) };
}

export function previousRange(start: string, end: string): {
  start: string;
  end: string;
} {
  const s = parseDate(start);
  const e = parseDate(end);
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  const prevEnd = new Date(s);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - (days - 1));
  return { start: toIso(prevStart), end: toIso(prevEnd) };
}

function rowDate(row: DataRow): string | null {
  for (const key of ["date", "metric_date", "segments_date"] as const) {
    const value = row[key];
    if (value == null || value === "") continue;
    return String(value).slice(0, 10);
  }
  return null;
}

function inDateRange(row: DataRow, start: string, end: string): boolean {
  const d = rowDate(row);
  if (!d) return true;
  return d >= start && d <= end;
}

function matchesMulti(
  value: string | number | undefined,
  selected: string[]
): boolean {
  if (!selected.length) return true;
  return selected.includes(String(value ?? ""));
}

export function originLabel(row: DataRow): string {
  const source = String(row.source ?? "");
  const medium = String(row.medium ?? "");
  if (source === "(direct)" || medium === "(none)") return "Direct";
  if (medium === "organic") return "Organic";
  if (medium === "cpc" || medium === "paid") return "Paid";
  if (medium === "social") return "Social";
  if (medium === "referral") return "Referral";
  return `${source}/${medium}`;
}

export function filterDataset(
  rows: DataRow[],
  filters: DashboardFilters,
  today = new Date()
): DataRow[] {
  const range = resolveDateRange(filters, today);
  return rows.filter((row) => {
    if (range && !inDateRange(row, range.start, range.end)) return false;
    for (const [key, selected] of Object.entries(filters.facets)) {
      if (!(key in row)) continue;
      if (!matchesMulti(row[key], selected)) return false;
    }
    return true;
  });
}

export function filterComparison(
  rows: DataRow[],
  filters: DashboardFilters,
  today = new Date()
): DataRow[] {
  if (!filters.compare) return [];
  const current = resolveDateRange(filters, today);
  if (!current) return [];
  const prev = previousRange(current.start, current.end);
  return filterDataset(
    rows,
    {
      ...filters,
      preset: "custom",
      startDate: prev.start,
      endDate: prev.end,
      compare: false,
    },
    today
  );
}

const RATE_FORMULAS: Record<string, { numerator: string; denominator: string; scale: number }> = {
  cpm: { numerator: "spend", denominator: "impressions", scale: 1000 },
  cpp: { numerator: "spend", denominator: "reach", scale: 1000 },
  cpc: { numerator: "spend", denominator: "clicks", scale: 1 },
  ctr: { numerator: "clicks", denominator: "impressions", scale: 100 },
  frequency: { numerator: "impressions", denominator: "reach", scale: 1 },
};

export function sumMetric(rows: DataRow[], metric: string): number {
  return rows.reduce((acc, row) => acc + Number(row[metric] ?? 0), 0);
}

export function aggregateMetric(rows: DataRow[], metric: string): number {
  const formula = RATE_FORMULAS[metric];
  if (formula && rows.some((row) => formula.numerator in row && formula.denominator in row)) {
    const denominator = sumMetric(rows, formula.denominator);
    if (!denominator) return 0;
    return (sumMetric(rows, formula.numerator) / denominator) * formula.scale;
  }
  return sumMetric(rows, metric);
}

export function groupByDimension(
  rows: DataRow[],
  dimension: string,
  metric: string
): { name: string; value: number }[] {
  const groups = new Map<string, DataRow[]>();
  for (const row of rows) {
    const key = dimension === "source" ? originLabel(row) : String(row[dimension] ?? "");
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }
  return Array.from(groups.entries())
    .map(([name, group]) => ({ name, value: aggregateMetric(group, metric) }))
    .sort((a, b) =>
      dimension === "date" || /date/i.test(dimension) ? a.name.localeCompare(b.name) : b.value - a.value
    );
}

export function uniqueValues(rows: DataRow[], field: string): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    if (field === "source") set.add(originLabel(row));
    else set.add(String(row[field] ?? ""));
  }
  return Array.from(set).filter(Boolean).sort();
}

const FACET_PRIORITY = [
  "campaign_name",
  "campaign",
  "adset_name",
  "adset",
  "ad_name",
  "adgroup_name",
  "creative_name",
  "campaign_group_name",
  "campaign_detail_name",
  "campaign_group_detail_name",
  "searchtermview_searchterm",
  "ad_id",
  "adset_id",
  "campaign_id",
  "utmSource",
  "utmMedium",
  "ageRange",
  "page",
  "device",
  "source",
];

function extraFacetKey(key: string): boolean {
  if (FACET_PRIORITY.includes(key) || key === "date" || /date/i.test(key)) return false;
  if (key.startsWith("a_") || /_id$/i.test(key)) return false;
  if (/account|status|objective|currency|url|preview/i.test(key)) return false;
  return /name|term|keyword|device|source|medium|campaign|adset|adgroup/i.test(key);
}

export function filterFacets(rows: DataRow[]): { key: string; values: string[] }[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (FACET_PRIORITY.includes(key) || extraFacetKey(key)) keys.add(key);
    }
  }
  if (keys.has("campaign")) keys.delete("utmCampaign");
  if (keys.has("ad_name")) keys.delete("name");
  const ordered = [
    ...FACET_PRIORITY.filter((key) => keys.has(key)),
    ...Array.from(keys).filter((key) => !FACET_PRIORITY.includes(key)).sort(),
  ];
  return ordered
    .map((key) => ({ key, values: uniqueValues(rows, key) }))
    .filter((facet) => facet.values.length > 1)
    .slice(0, 8);
}
