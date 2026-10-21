import fs from "fs";
import path from "path";
import { BigQuery } from "@google-cloud/bigquery";
import type { DataRow } from "./mock-loader";
import {
  buildPlatformSql,
  actionsTableName,
  planPlatform,
  platformDimensions,
  withActions,
  platformMetrics,
  type PlatformPlan,
} from "./bigquery-platforms";

export type DashboardDataPage = {
  id: string;
  title: string;
  views: string[];
};

export type BigQuerySource = {
  dataset: string;
  table: string;
  location?: string;
  pages: DashboardDataPage[];
};

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,200}$/;

export function bigQueryProjectId(): string {
  return process.env.BIGQUERY_PROJECT_ID?.trim() || "black-beans-dados";
}

export function bigQueryLocation(): string {
  return process.env.BIGQUERY_LOCATION?.trim() || "US";
}

export function credentialsPath(): string {
  const configured = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!configured) return path.join(process.cwd(), "secrets", "bigquery-service-account.json");
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

export function bigQueryConfigured(): boolean {
  return fs.existsSync(credentialsPath());
}

function cleanPages(value: unknown): DashboardDataPage[] {
  if (!Array.isArray(value)) return [];
  const pages: DashboardDataPage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const page = item as { id?: unknown; title?: unknown; views?: unknown };
    const id = typeof page.id === "string" ? page.id.trim() : "";
    const title = typeof page.title === "string" ? page.title.trim() : "";
    const views = Array.isArray(page.views)
      ? page.views.filter((view): view is string => typeof view === "string" && IDENTIFIER.test(view))
      : [];
    if (!id || !title || !views.length) continue;
    pages.push({ id, title, views });
  }
  return pages;
}

export function parseBigQuerySource(raw: string | null | undefined): BigQuerySource | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      dataset?: string;
      table?: string;
      location?: string;
      pages?: unknown;
    };
    if (!parsed.dataset) return null;
    const pages = cleanPages(parsed.pages);
    const table = parsed.table || pages[0]?.views[0] || "";
    if (!table) return null;
    return {
      dataset: parsed.dataset,
      table,
      location: parsed.location,
      pages: pages.length ? pages : [{ id: "principal", title: "Principal", views: [table] }],
    };
  } catch {
    return null;
  }
}

function assertIdentifier(value: string, label: string): string {
  const name = value.trim();
  if (!IDENTIFIER.test(name)) {
    throw new Error(`${label} inválido. Use só letras, números e _.`);
  }
  return name;
}

function client(): BigQuery {
  if (!bigQueryConfigured()) {
    throw new Error(
      "Falta a chave da conta de serviço em secrets/bigquery-service-account.json."
    );
  }
  return new BigQuery({
    projectId: bigQueryProjectId(),
    keyFilename: credentialsPath(),
    location: bigQueryLocation(),
  });
}

function cell(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "sim" : "não";
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "value" in value) {
    return cell((value as { value: unknown }).value);
  }
  return String(value);
}

export async function testBigQueryConnection(): Promise<
  { ok: true; projectId: string } | { ok: false; error: string; projectId: string }
> {
  const projectId = bigQueryProjectId();
  try {
    const [rows] = await client().query({ query: "SELECT 1 AS ok", location: bigQueryLocation() });
    if (!rows?.length) return { ok: false, error: "O BigQuery não respondeu.", projectId };
    return { ok: true, projectId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao conectar no BigQuery.";
    return { ok: false, error: message, projectId };
  }
}

export async function listBigQueryDatasets(): Promise<string[]> {
  const [datasets] = await client().getDatasets();
  return datasets
    .map((dataset) => dataset.id)
    .filter((id): id is string => Boolean(id))
    .sort((a, b) => a.localeCompare(b));
}

export async function listBigQueryTables(datasetId: string): Promise<
  { id: string; type: string }[]
> {
  const dataset = assertIdentifier(datasetId, "Dataset");
  const [tables] = await client().dataset(dataset).getTables();
  const listed = await Promise.all(
    tables.map(async (table) => {
      const [metadata] = await table.getMetadata();
      const id = table.id || "";
      const type = String(metadata.type || "TABLE");
      return { id, type };
    })
  );
  // Tabelas de ações do Meta são lidas por dentro do sistema; não aparecem para escolher.
  const helper = /^facebook_(campaign|ad)_insights_action(s|_values)(_\d+)?$/;
  return listed
    .filter((item) => item.id && !helper.test(item.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

const NUMERIC_TYPES = new Set([
  "INTEGER",
  "INT64",
  "FLOAT",
  "FLOAT64",
  "NUMERIC",
  "BIGNUMERIC",
  "DECIMAL",
]);

const ROW_LIMIT = 20000;
const extrasCache = new Map<string, { at: number; names: string[] }>();
const EXTRAS_TTL_MS = 10 * 60 * 1000;

async function loadPlan(
  bq: BigQuery,
  dataset: string,
  table: string
): Promise<{ plan: PlatformPlan | null; fields: { name?: string; type?: string }[] }> {
  const [metadata] = await bq.dataset(dataset).table(table).getMetadata();
  const fields = (metadata.schema?.fields || []) as { name?: string; type?: string }[];
  // Só tabelas de conectores são normalizadas; views feitas à mão continuam como estão.
  const isTable = String(metadata.type || "TABLE") === "TABLE";
  let plan = isTable ? planPlatform(fields) : null;
  // Meta sem colunas de conversão: procura a tabela de ações do mesmo dataset.
  const sibling = plan && !plan.metrics.some((m) => m.key === "leads") ? actionsTableName(table) : null;
  if (plan && sibling) {
    try {
      const [actions] = await bq.dataset(dataset).table(sibling).getMetadata();
      plan = withActions(plan, sibling, (actions.schema?.fields || []) as { name?: string }[]);
    } catch {
      // sem tabela de ações: segue só com custo, impressões e cliques
    }
  }
  return { plan, fields };
}

async function usedExtras(
  bq: BigQuery,
  dataset: string,
  table: string,
  plan: PlatformPlan
): Promise<string[]> {
  if (!plan.extras.length) return [];
  const key = `${dataset}.${table}`;
  const cached = extrasCache.get(key);
  if (cached && Date.now() - cached.at < EXTRAS_TTL_MS) return cached.names;
  const counts = plan.extras.map((extra, index) => `COUNTIF(\`${extra.name}\` IS NOT NULL AND \`${extra.name}\` != 0) AS c${index}`);
  const location = await datasetLocation(bq, dataset);
  const [rows] = await bq.query({
    query: `SELECT ${counts.join(", ")} FROM \`${bigQueryProjectId()}.${dataset}.${table}\``,
    location,
  });
  const row = (rows[0] || {}) as Record<string, unknown>;
  const names = plan.extras
    .filter((_, index) => Number(row[`c${index}`] || 0) > 0)
    .map((extra) => extra.name);
  extrasCache.set(key, { at: Date.now(), names });
  return names;
}

export async function describeBigQueryTable(
  datasetId: string,
  tableId: string
): Promise<{ metrics: string[]; dimensions: string[]; platform?: string }> {
  const dataset = assertIdentifier(datasetId, "Dataset");
  const table = assertIdentifier(tableId, "View");
  const bq = client();
  const { plan, fields } = await loadPlan(bq, dataset, table);
  if (plan) {
    const extras = await usedExtras(bq, dataset, table, plan);
    return {
      metrics: platformMetrics(plan, extras),
      dimensions: platformDimensions(plan),
      platform: plan.platform,
    };
  }
  const metrics: string[] = [];
  const dimensions: string[] = [];
  for (const field of fields) {
    const name = field.name || "";
    if (!IDENTIFIER.test(name)) continue;
    if (NUMERIC_TYPES.has(String(field.type || "").toUpperCase())) metrics.push(name);
    else dimensions.push(name);
  }
  return { metrics, dimensions };
}

async function datasetLocation(bq: BigQuery, dataset: string): Promise<string> {
  try {
    const [metadata] = await bq.dataset(dataset).getMetadata();
    return String(metadata.location || bigQueryLocation());
  } catch {
    return bigQueryLocation();
  }
}

export type LoadedTable = { rows: DataRow[]; truncated: boolean };

// Cache curto: o mesmo dashboard aberto várias vezes não consulta o BigQuery de novo.
const QUERY_CACHE_TTL_MS = 5 * 60 * 1000;
const queryCache = new Map<string, { at: number; value: Promise<LoadedTable> }>();

export function clearBigQueryCache(): void {
  queryCache.clear();
  extrasCache.clear();
}

export async function loadBigQueryTable(source: {
  dataset: string;
  table: string;
  location?: string;
  fields?: string[];
}): Promise<DataRow[]> {
  return (await loadBigQueryTableDetailed(source)).rows;
}

export async function loadBigQueryTableDetailed(source: {
  dataset: string;
  table: string;
  location?: string;
  fields?: string[];
}): Promise<LoadedTable> {
  const projectId = bigQueryProjectId();
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new Error("ID do projeto BigQuery inválido.");
  }
  const dataset = assertIdentifier(source.dataset, "Dataset");
  const table = assertIdentifier(source.table, "View");
  const fields = [...new Set(source.fields || [])].sort();
  const key = `${projectId}.${dataset}.${table}|${fields.join(",")}`;
  const hit = queryCache.get(key);
  if (hit && Date.now() - hit.at < QUERY_CACHE_TTL_MS) return hit.value;

  const value = runLoad(projectId, dataset, table, fields);
  queryCache.set(key, { at: Date.now(), value });
  value.catch(() => queryCache.delete(key));
  return value;
}

async function runLoad(
  projectId: string,
  dataset: string,
  table: string,
  fields: string[]
): Promise<LoadedTable> {
  const bq = client();
  const location = await datasetLocation(bq, dataset);
  const { plan } = await loadPlan(bq, dataset, table);
  // Pede uma linha a mais para saber se o limite cortou dados.
  const query = plan
    ? buildPlatformSql(plan, `${projectId}.${dataset}.${table}`, fields, ROW_LIMIT + 1)
    : `SELECT * FROM \`${projectId}.${dataset}.${table}\` LIMIT ${ROW_LIMIT + 1}`;
  const [all] = await bq.query({ query, location });
  const truncated = all.length > ROW_LIMIT;
  const rows = all.slice(0, ROW_LIMIT).map((row) => {
    const next: DataRow = {};
    for (const [key, value] of Object.entries(row)) {
      if (!IDENTIFIER.test(key)) continue;
      const normalized = cell(value);
      if (normalized == null || normalized === "") continue;
      next[key] = normalized;
    }
    return next;
  });
  return { rows, truncated };
}
