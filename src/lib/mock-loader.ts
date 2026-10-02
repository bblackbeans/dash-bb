import fs from "fs/promises";
import path from "path";

export type DataRow = Record<string, string | number>;

export async function loadMockDataset(mockPath: string): Promise<DataRow[]> {
  const safe = path.basename(mockPath);
  const full = path.join(process.cwd(), "data", "mocks", safe);
  const raw = await fs.readFile(full, "utf8");
  return JSON.parse(raw) as DataRow[];
}
