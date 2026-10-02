import fs from "fs/promises";
import path from "path";

export async function listMockFiles(): Promise<string[]> {
  const dir = path.join(process.cwd(), "data", "mocks");
  const files = await fs.readdir(dir);
  return files.filter((f) => f.endsWith(".json")).sort();
}

export async function peekMockFields(mockPath: string): Promise<{
  metrics: string[];
  dimensions: string[];
}> {
  const safe = path.basename(mockPath);
  const full = path.join(process.cwd(), "data", "mocks", safe);
  const raw = await fs.readFile(full, "utf8");
  const rows = JSON.parse(raw) as Record<string, string | number>[];
  const sample = rows[0] || {};
  const metrics: string[] = [];
  const dimensions: string[] = [];
  for (const [key, value] of Object.entries(sample)) {
    if (typeof value === "number") metrics.push(key);
    else dimensions.push(key);
  }
  return { metrics, dimensions };
}
