import { loadBigQueryTable, parseBigQuerySource } from "./bigquery";
import { loadMockDataset, type DataRow } from "./mock-loader";

export async function loadDashboardRows(dashboard: {
  dataSource: string;
  mockPath: string;
  sourceJson?: string | null;
}): Promise<DataRow[]> {
  if (dashboard.dataSource === "bigquery") {
    const source = parseBigQuerySource(dashboard.sourceJson);
    if (!source) {
      throw new Error("Este dashboard ainda não tem dataset e view do BigQuery.");
    }
    return loadBigQueryTable(source);
  }
  return loadMockDataset(dashboard.mockPath);
}
