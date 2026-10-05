import { loadBigQueryTable, parseBigQuerySource } from "./bigquery";
import { loadMockDataset, type DataRow } from "./mock-loader";

export async function loadDashboardRows(dashboard: {
  dataSource: string;
  mockPath: string;
  sourceJson?: string | null;
}): Promise<DataRow[]> {
  const views = await loadDashboardViewRows(dashboard);
  return Object.values(views)[0] || [];
}

export async function loadDashboardViewRows(dashboard: {
  dataSource: string;
  mockPath: string;
  sourceJson?: string | null;
}): Promise<Record<string, DataRow[]>> {
  if (dashboard.dataSource === "bigquery") {
    const source = parseBigQuerySource(dashboard.sourceJson);
    if (!source) {
      throw new Error("Este dashboard ainda não tem dataset e view do BigQuery.");
    }
    const names = [...new Set(source.pages.flatMap((page) => page.views))];
    const entries = await Promise.all(
      names.map(async (table) => {
        const rows = await loadBigQueryTable({
          dataset: source.dataset,
          table,
          location: source.location,
        });
        return [table, rows] as const;
      })
    );
    return Object.fromEntries(entries);
  }
  return { mock: await loadMockDataset(dashboard.mockPath) };
}
