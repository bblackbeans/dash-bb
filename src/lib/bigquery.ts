import fs from "fs";
import path from "path";
import { BigQuery } from "@google-cloud/bigquery";
import type { DataRow } from "./mock-loader";

export type BigQuerySource = {
  dataset: string;
  table: string;
  location?: string;
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

export function parseBigQuerySource(raw: string | null | undefined): BigQuerySource | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BigQuerySource>;
    if (!parsed.dataset || !parsed.table) return null;
    return {
      dataset: parsed.dataset,
      table: parsed.table,
      location: parsed.location,
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
  return listed.filter((item) => item.id).sort((a, b) => a.id.localeCompare(b.id));
}

export async function loadBigQueryTable(source: BigQuerySource): Promise<DataRow[]> {
  const projectId = bigQueryProjectId();
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new Error("ID do projeto BigQuery inválido.");
  }
  const dataset = assertIdentifier(source.dataset, "Dataset");
  const table = assertIdentifier(source.table, "View");
  const location = source.location || bigQueryLocation();
  const [rows] = await client().query({
    query: `SELECT * FROM \`${projectId}.${dataset}.${table}\` LIMIT 20000`,
    location,
  });
  return rows.map((row) => {
    const next: DataRow = {};
    for (const [key, value] of Object.entries(row)) {
      if (!IDENTIFIER.test(key)) continue;
      const normalized = cell(value);
      if (normalized == null || normalized === "") continue;
      next[key] = normalized;
    }
    return next;
  });
}
