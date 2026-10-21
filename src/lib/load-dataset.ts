import { loadBigQueryTableDetailed, parseBigQuerySource } from "./bigquery";
import { loadMockDataset, type DataRow } from "./mock-loader";

export async function loadDashboardRows(dashboard: {
  dataSource: string;
  mockPath: string;
  sourceJson?: string | null;
}): Promise<DataRow[]> {
  const views = await loadDashboardViewRows(dashboard);
  return Object.values(views)[0] || [];
}

type WidgetLike = { configJson: string };

// Colunas que os widgets de cada tabela usam. Só essas métricas extras são pedidas ao BigQuery.
function fieldsByView(widgets: WidgetLike[] | undefined): Map<string, Set<string>> {
  const used = new Map<string, Set<string>>();
  for (const widget of widgets || []) {
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(widget.configJson) as Record<string, unknown>;
    } catch {
      continue;
    }
    const view = typeof config.view === "string" ? config.view : "";
    const set = used.get(view) || new Set<string>();
    for (const key of ["metric", "dimension", "numerator", "denominator"]) {
      if (typeof config[key] === "string") set.add(config[key] as string);
    }
    for (const key of ["columns", "stages"]) {
      const list = config[key];
      if (Array.isArray(list)) for (const item of list) if (typeof item === "string") set.add(item);
    }
    used.set(view, set);
  }
  return used;
}

export async function loadDashboardData(dashboard: {
  dataSource: string;
  mockPath: string;
  sourceJson?: string | null;
  widgets?: WidgetLike[];
}): Promise<{ views: Record<string, DataRow[]>; truncated: string[] }> {
  if (dashboard.dataSource === "bigquery") {
    const source = parseBigQuerySource(dashboard.sourceJson);
    if (!source) {
      throw new Error("Este dashboard ainda não tem dataset e view do BigQuery.");
    }
    const names = [...new Set(source.pages.flatMap((page) => page.views))];
    const used = fieldsByView(dashboard.widgets);
    const entries = await Promise.all(
      names.map(async (table) => {
        const loaded = await loadBigQueryTableDetailed({
          dataset: source.dataset,
          table,
          location: source.location,
          fields: [...(used.get(table) || used.get("") || [])],
        });
        return [table, loaded] as const;
      })
    );
    return {
      views: Object.fromEntries(entries.map(([table, loaded]) => [table, loaded.rows])),
      truncated: entries.filter(([, loaded]) => loaded.truncated).map(([table]) => table),
    };
  }
  return { views: { mock: await loadMockDataset(dashboard.mockPath) }, truncated: [] };
}

export async function loadDashboardViewRows(dashboard: {
  dataSource: string;
  mockPath: string;
  sourceJson?: string | null;
  widgets?: WidgetLike[];
}): Promise<Record<string, DataRow[]>> {
  return (await loadDashboardData(dashboard)).views;
}
