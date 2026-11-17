"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Database } from "lucide-react";
import {
  listBigQueryDatasetsAction,
  listBigQueryTablesAction,
  saveBigQuerySourceAction,
} from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

type Props = {
  dashboardId: string;
  clientSlug: string;
  dashSlug: string;
  projectId: string;
  configured: boolean;
  connectionError?: string;
  dataset: string;
  table: string;
  pages?: { id: string; title: string; views: string[] }[];
};

export function BigQuerySource({
  dashboardId,
  clientSlug,
  dashSlug,
  projectId,
  configured,
  connectionError,
  dataset,
  table,
  pages = [],
}: Props) {
  const router = useRouter();
  const [datasets, setDatasets] = useState<string[]>([]);
  const [tables, setTables] = useState<{ id: string; type: string }[]>([]);
  const [datasetId, setDatasetId] = useState(dataset);
  const [tableId, setTableId] = useState(table);
  const [error, setError] = useState(connectionError || "");
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  async function loadDatasets() {
    setPending(true);
    setError("");
    const result = await listBigQueryDatasetsAction();
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDatasets(result.datasets);
    setLoaded(true);
    if (datasetId) await loadTables(datasetId);
  }

  async function loadTables(nextDataset: string) {
    setDatasetId(nextDataset);
    setTableId("");
    setTables([]);
    if (!nextDataset) return;
    setPending(true);
    setError("");
    const result = await listBigQueryTablesAction(nextDataset);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTables(result.tables);
  }

  async function save() {
    setPending(true);
    setError("");
    const result = await saveBigQuerySourceAction({
      dashboardId,
      clientSlug,
      dashSlug,
      dataset: datasetId,
      table: tableId,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const pageCount = pages.length;
  const viewCount = pages.reduce((total, page) => total + page.views.length, 0);

  return (
    <Card className="bb-dash-source px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm text-[var(--bb-cream)]">
          <Database className="h-4 w-4 shrink-0 text-[var(--bb-accent)]" />
          <p className="truncate">
            BigQuery · {dataset || projectId}
            {pageCount > 1 ? ` · ${pageCount} páginas · ${viewCount} views` : table ? ` · ${table}` : ""}
          </p>
        </div>
        {pageCount > 1 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setDetailsOpen((open) => !open)}>
            {detailsOpen ? "Ocultar views" : "Ver views"}
          </Button>
        ) : null}
      </div>
      {detailsOpen && pageCount > 1 ? (
        <ul className="mt-3 space-y-2 text-sm text-[var(--bb-cream)]">
          {pages.map((page) => (
            <li key={page.id}>
              <span className="font-medium">{page.title}:</span>{" "}
              <span className="text-[var(--bb-gray)]">{page.views.join(", ")}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {pages.length > 1 ? null : dataset && table ? (
        <p className="mb-4 text-sm text-[var(--bb-cream)]">
          Fonte atual: {dataset}.{table}
        </p>
      ) : (
        <p className="mb-4 text-sm text-[var(--bb-gray)]">Este dashboard ainda usa o JSON local.</p>
      )}
      {pages.length > 1 ? null : configured ? (
        <div className="flex flex-wrap items-end gap-3">
          {!loaded ? (
            <Button type="button" variant="secondary" onClick={loadDatasets} disabled={pending}>
              {pending ? "Conectando..." : "Listar datasets"}
            </Button>
          ) : (
            <>
              <label className="min-w-56 space-y-1 text-xs text-[var(--bb-gray)]">
                Dataset
                <Select value={datasetId} onChange={(event) => loadTables(event.target.value)}>
                  <option value="">Escolher</option>
                  {datasets.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="min-w-56 space-y-1 text-xs text-[var(--bb-gray)]">
                View
                <Select value={tableId} onChange={(event) => setTableId(event.target.value)} disabled={!tables.length}>
                  <option value="">Escolher</option>
                  {tables.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id} · {item.type === "VIEW" ? "view" : "tabela"}
                    </option>
                  ))}
                </Select>
              </label>
              <Button type="button" onClick={save} disabled={pending || !datasetId || !tableId}>
                {pending ? "Salvando..." : "Usar esta view"}
              </Button>
            </>
          )}
        </div>
      ) : (
        <p className="text-sm text-amber-200">
          Falta a chave da conta de serviço. Salve o JSON em secrets/bigquery-service-account.json e reinicie o servidor.
        </p>
      )}
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
    </Card>
  );
}
