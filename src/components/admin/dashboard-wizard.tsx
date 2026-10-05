"use client";

import {
  BarChart3,
  Database,
  FileJson,
  LineChart,
  PieChart,
  Table2,
  Gauge,
  ChevronLeft,
  ChevronRight,
  Check,
  Lock,
  Upload,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createDashboardFromWizard,
  describeBigQueryTableAction,
  listBigQueryDatasetsAction,
  listBigQueryTablesAction,
  uploadMockJsonAction,
  type WidgetInput,
} from "@/lib/actions";
import {
  MONEY_METRIC,
  pickCategory,
  pickDate,
  pickMetric,
  suggestChart,
  tableColumns,
} from "@/lib/chart-suggestion";
import { slugify } from "@/lib/slug";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LabelWithHelp } from "@/components/ui/label-with-help";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";

type DataSource = "mock" | "ga" | "bigquery";

type WidgetDraft = {
  id: string;
  enabled: boolean;
  type: string;
  title: string;
  metric: string;
  dimension: string;
  format?: string;
  columns?: string[];
  hint?: string;
  pageId?: string;
  view?: string;
};

type PageDraft = {
  id: string;
  title: string;
  views: string[];
};

function blankPage(): PageDraft {
  return { id: `pagina${Date.now().toString(36)}`, title: "", views: [] };
}

const TYPE_META: Record<
  string,
  { label: string; help: string; icon: typeof Gauge }
> = {
  kpi: {
    label: "KPI",
    help: "Um número só. Use quando a coluna pode ser somada, como impressões, cliques ou gasto. Não serve para taxa (frequência, CTR, CPC).",
    icon: Gauge,
  },
  line: {
    label: "Linha",
    help: "A mesma métrica ao longo dos dias. Use quando a view tem coluna de data e você quer ver a tendência.",
    icon: LineChart,
  },
  bar: {
    label: "Barras",
    help: "Compara categorias, como tipo de ação, campanha ou termo de busca. Use quando o valor muda de um grupo para outro.",
    icon: BarChart3,
  },
  pie: {
    label: "Pizza",
    help: "Participação de poucas categorias no total. Use só quando há poucos grupos. Com muitos tipos, prefira barras.",
    icon: PieChart,
  },
  table: {
    label: "Tabela",
    help: "Lista várias colunas juntas. Use em cadastros e detalhes (campanha, anúncio, criativo), quando somar não responde a pergunta.",
    icon: Table2,
  },
};

function defaultWidgets(metrics: string[], dimensions: string[]): WidgetDraft[] {
  const m = metrics[0] || "sessions";
  const dimPage = dimensions.includes("page")
    ? "page"
    : dimensions.find((d) => d !== "date") || dimensions[0] || "page";
  const dimDate = dimensions.includes("date") ? "date" : dimensions[0] || "date";
  const dimSource = dimensions.includes("source") ? "source" : dimPage;

  return [
    {
      id: "kpi-1",
      enabled: true,
      type: "kpi",
      title: "Sessões",
      metric: metrics.includes("sessions") ? "sessions" : m,
      dimension: "",
    },
    {
      id: "kpi-2",
      enabled: true,
      type: "kpi",
      title: "Conversões",
      metric: metrics.includes("conversions") ? "conversions" : m,
      dimension: "",
    },
    {
      id: "line-1",
      enabled: true,
      type: "line",
      title: "Tendência",
      metric: metrics.includes("sessions") ? "sessions" : m,
      dimension: dimDate,
    },
    {
      id: "bar-1",
      enabled: true,
      type: "bar",
      title: "Por página",
      metric: metrics.includes("sessions") ? "sessions" : m,
      dimension: dimPage,
    },
    {
      id: "pie-1",
      enabled: true,
      type: "pie",
      title: "Por origem",
      metric: metrics.includes("sessions") ? "sessions" : m,
      dimension: dimSource,
    },
    {
      id: "table-1",
      enabled: false,
      type: "table",
      title: "Detalhamento",
      metric: "",
      dimension: "",
    },
  ];
}

type Props = {
  clientId: string;
  clientSlug: string;
  clientName: string;
  mockFiles: string[];
  fieldMap: Record<string, { metrics: string[]; dimensions: string[] }>;
  bigQueryReady: boolean;
};

export function DashboardWizard({
  clientId,
  clientSlug,
  clientName,
  mockFiles: initialMockFiles,
  fieldMap: initialFieldMap,
  bigQueryReady,
}: Props) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [dataSource, setDataSource] = useState<DataSource>("mock");
  const [mockFiles, setMockFiles] = useState(initialMockFiles);
  const [fieldMap, setFieldMap] = useState(initialFieldMap);
  const [mockPath, setMockPath] = useState(
    initialMockFiles[0] || "johnson-traffic.json"
  );
  const [datasets, setDatasets] = useState<string[]>([]);
  const [tables, setTables] = useState<{ id: string; type: string }[]>([]);
  const [datasetId, setDatasetId] = useState("");
  const [tableId, setTableId] = useState("");
  const [pages, setPages] = useState<PageDraft[]>([]);
  const [viewFields, setViewFields] = useState<
    Record<string, { metrics: string[]; dimensions: string[] }>
  >({});
  const [bqFields, setBqFields] = useState<{ metrics: string[]; dimensions: string[] }>({
    metrics: [],
    dimensions: [],
  });
  const [bqLoading, setBqLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const fields =
    dataSource === "bigquery"
      ? bqFields
      : fieldMap[mockPath] || { metrics: [], dimensions: [] };
  const [widgets, setWidgets] = useState<WidgetDraft[]>(() =>
    defaultWidgets(fields.metrics, fields.dimensions)
  );
  const [error, setError] = useState("");
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const steps = [
    { n: 1, label: "Dados" },
    { n: 2, label: "Widgets" },
    { n: 3, label: "Revisar" },
  ];

  const enabledWidgets = useMemo(
    () => widgets.filter((w) => w.enabled),
    [widgets]
  );

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function chooseBigQuery() {
    setDataSource("bigquery");
    setError("");
    if (!bigQueryReady || datasets.length) return;
    setBqLoading(true);
    const result = await listBigQueryDatasetsAction();
    setBqLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDatasets(result.datasets);
  }

  async function onDatasetChange(nextDataset: string) {
    setDatasetId(nextDataset);
    setTableId("");
    setTables([]);
    setBqFields({ metrics: [], dimensions: [] });
    if (!nextDataset) return;
    setBqLoading(true);
    setError("");
    const result = await listBigQueryTablesAction(nextDataset);
    setBqLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTables(result.tables);
    setPages([blankPage()]);
  }

  async function onTableChange(nextTable: string) {
    setTableId(nextTable);
    if (!datasetId || !nextTable) return;
    setBqLoading(true);
    setError("");
    const result = await describeBigQueryTableAction(datasetId, nextTable);
    setBqLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBqFields({ metrics: result.metrics, dimensions: result.dimensions });
    setWidgets(defaultWidgets(result.metrics, result.dimensions));
  }

  function onMockChange(path: string) {
    setMockPath(path);
    const next = fieldMap[path] || { metrics: [], dimensions: [] };
    setWidgets(defaultWidgets(next.metrics, next.dimensions));
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setUploadMsg("");
    setError("");
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadMockJsonAction(fd);
    setUploading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMockFiles((prev) =>
      prev.includes(res.filename) ? prev : [res.filename, ...prev]
    );
    setFieldMap((prev) => ({
      ...prev,
      [res.filename]: { metrics: res.metrics, dimensions: res.dimensions },
    }));
    setMockPath(res.filename);
    setWidgets(defaultWidgets(res.metrics, res.dimensions));
    setUploadMsg(`Arquivo ${res.filename} enviado com sucesso.`);
  }

  function updateWidget(id: string, patch: Partial<WidgetDraft>) {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...patch } : w))
    );
  }

  function changeWidgetType(widget: WidgetDraft, type: string) {
    const source =
      dataSource === "bigquery" && widget.view
        ? viewFields[widget.view] || { metrics: [], dimensions: [] }
        : fields;
    const metric = widget.metric || pickMetric(source.metrics);
    const date = pickDate(source.dimensions);
    const category = pickCategory(source.dimensions);
    if (type === "table") {
      updateWidget(widget.id, {
        type,
        metric: "",
        dimension: "",
        columns: tableColumns(source.metrics, source.dimensions),
        hint: TYPE_META.table.help,
      });
      return;
    }
    if (type === "kpi") {
      updateWidget(widget.id, {
        type,
        metric,
        dimension: "",
        columns: undefined,
        hint: TYPE_META.kpi.help,
      });
      return;
    }
    updateWidget(widget.id, {
      type,
      metric,
      dimension:
        type === "line"
          ? date || category || source.dimensions[0] || ""
          : category || date || source.dimensions[0] || "",
      columns: undefined,
      hint: TYPE_META[type]?.help,
    });
  }

  function goNext() {
    setError("");
    if (step === 1) {
      if (!title.trim()) {
        setError("Informe o título do dashboard.");
        return;
      }
      if (dataSource === "ga") {
        setError("Google Analytics ainda não está disponível.");
        return;
      }
      if (dataSource === "bigquery") {
        const selected = pages.filter((page) => page.title.trim() && page.views.length);
        if (!datasetId || !selected.length) {
          setError("Dê um nome à página e marque ao menos uma view.");
          return;
        }
        if (pages.some((page) => page.views.length > 0 && !page.title.trim())) {
          setError("Dê um nome para cada página que tiver views marcadas.");
          return;
        }
        void prepareBigQueryWidgets(selected);
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!enabledWidgets.length) {
        setError("Ative pelo menos um widget.");
        return;
      }
      setStep(3);
    }
  }

  async function prepareBigQueryWidgets(selected: PageDraft[]) {
    const unique = [...new Set(selected.flatMap((page) => page.views))];
    setPreparing(true);
    try {
      const described = await Promise.all(
        unique.map(async (view) => {
          const result = await describeBigQueryTableAction(datasetId, view);
          return [
            view,
            result.ok
              ? { metrics: result.metrics, dimensions: result.dimensions }
              : { metrics: [] as string[], dimensions: [] as string[] },
          ] as const;
        })
      );
      const map = Object.fromEntries(described);
      setViewFields(map);
      const drafts: WidgetDraft[] = [];
      for (const page of selected) {
        for (const view of page.views) {
          const fieldsForView = map[view] || { metrics: [], dimensions: [] };
          if (!fieldsForView.metrics.length && !fieldsForView.dimensions.length) continue;
          const suggestion = suggestChart(view, fieldsForView.metrics, fieldsForView.dimensions);
          drafts.push({
            id: `${page.id}-${view}`,
            enabled: true,
            title: view.replaceAll("_", " "),
            pageId: page.id,
            view,
            ...suggestion,
          });
        }
      }
      if (!drafts.length) {
        setError("Nenhuma view marcada tem colunas legíveis.");
        return;
      }
      setWidgets(drafts);
      setStep(2);
    } finally {
      setPreparing(false);
    }
  }

  function togglePageView(pageId: string, view: string) {
    setPages((current) =>
      current.map((page) => {
        if (page.id === pageId) {
          const has = page.views.includes(view);
          return {
            ...page,
            views: has ? page.views.filter((item) => item !== view) : [...page.views, view],
          };
        }
        return { ...page, views: page.views.filter((item) => item !== view) };
      })
    );
  }

  function submit() {
    setError("");
    const payload: WidgetInput[] = enabledWidgets.map((w) => ({
      type: w.type,
      title: w.title,
      metric: w.metric || undefined,
      dimension: w.dimension || undefined,
      format: w.metric && MONEY_METRIC.test(w.metric) ? "currency" : undefined,
      columns: w.type === "table" ? w.columns : undefined,
      pageId: w.pageId,
      view: w.view,
    }));

    startTransition(async () => {
      const res = await createDashboardFromWizard({
        clientId,
        clientSlug,
        title,
        slug: slug || title,
        description,
        dataSource,
        mockPath,
        dataset: datasetId,
        table: pages.find((page) => page.views[0])?.views[0] || tableId,
        pages: pages.filter((page) => page.views.length),
        widgets: payload,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/admin/clients/${clientSlug}/dashboards/${res.slug}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {steps.map((s) => (
          <div
            key={s.n}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
              step === s.n
                ? "border-[var(--bb-accent)] text-[var(--bb-accent)]"
                : step > s.n
                  ? "border-emerald-500/40 text-emerald-300"
                  : "border-[var(--bb-border)] text-[var(--bb-gray)]"
            }`}
          >
            {step > s.n ? <Check className="h-3.5 w-3.5" /> : <span>{s.n}</span>}
            {s.label}
          </div>
        ))}
      </div>

      {step === 1 ? (
        <Card className="space-y-5 p-6">
          <div>
            <LabelWithHelp
              htmlFor="title"
              help="Nome visível no admin e na URL pública do cliente."
            >
              Título
            </LabelWithHelp>
            <Input
              id="title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Ex.: Tráfego & Conversões"
            />
          </div>
          <div>
            <LabelWithHelp
              htmlFor="slug"
              help="Identificador na URL. Use letras minúsculas e hífens."
            >
              Slug
            </LabelWithHelp>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="trafego"
            />
            <p className="mt-1 text-xs text-[var(--bb-gray)]">
              /p/{clientSlug}/{slug || "…"}
            </p>
          </div>
          <div>
            <LabelWithHelp
              htmlFor="description"
              help="Contexto interno para o time (não aparece no viewer público por padrão)."
            >
              Descrição (opcional)
            </LabelWithHelp>
            <Textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief do dashboard, objetivos, público…"
            />
          </div>

          <div className="space-y-3">
            <LabelWithHelp help="JSON local para prototipar, ou uma view do BigQuery.">
              Fonte de dados
            </LabelWithHelp>
            <div className="grid gap-3 md:grid-cols-3">
              <button
                type="button"
                onClick={() => setDataSource("mock")}
                className={`cursor-pointer rounded-[var(--bb-radius-xl)] border p-4 text-left transition ${
                  dataSource === "mock"
                    ? "border-[var(--bb-accent)] bg-[var(--bb-accent)]/10"
                    : "border-[var(--bb-border)] hover:border-[var(--bb-gray)]"
                }`}
              >
                <div className="mb-2 flex items-center gap-2 text-[var(--bb-cream)]">
                  <FileJson className="h-5 w-5 text-[var(--bb-accent)]" />
                  <span className="font-medium">Dataset JSON</span>
                </div>
                <p className="text-xs text-[var(--bb-gray)]">
                  Arquivo mock local em data/mocks — ideal para prototipar.
                </p>
              </button>

              <Tooltip content="Em breve: conexão GA4 → BigQuery. Sem OAuth nesta fase.">
                <div className="cursor-not-allowed rounded-[var(--bb-radius-xl)] border border-[var(--bb-border)] bg-black/20 p-4 opacity-70">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[var(--bb-cream)]">
                      <BarChart3 className="h-5 w-5" />
                      <span className="font-medium">Google Analytics</span>
                    </div>
                    <Badge tone="warning">Em breve</Badge>
                  </div>
                  <p className="text-xs text-[var(--bb-gray)]">
                    Conexão GA4 → BigQuery na próxima fase.
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--bb-gray)]">
                    <Lock className="h-3 w-3" /> Indisponível no MVP
                  </p>
                </div>
              </Tooltip>

              <button
                type="button"
                onClick={() => void chooseBigQuery()}
                disabled={!bigQueryReady}
                className={`rounded-[var(--bb-radius-xl)] border p-4 text-left transition ${
                  !bigQueryReady ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                } ${
                  dataSource === "bigquery"
                    ? "border-[var(--bb-accent)] bg-[var(--bb-accent)]/10"
                    : "border-[var(--bb-border)] hover:border-[var(--bb-gray)]"
                }`}
              >
                <div className="mb-2 flex items-center gap-2 text-[var(--bb-cream)]">
                  <Database className="h-5 w-5 text-[var(--bb-accent)]" />
                  <span className="font-medium">BigQuery</span>
                </div>
                <p className="text-xs text-[var(--bb-gray)]">
                  {bigQueryReady
                    ? "Escolha o dataset e a view do projeto black-beans-dados."
                    : "Falta a chave da conta de serviço neste servidor."}
                </p>
              </button>
            </div>
          </div>

          {dataSource === "mock" ? (
            <div className="space-y-4">
              <div>
                <LabelWithHelp
                  htmlFor="mockPath"
                  help="Escolha um JSON já salvo ou envie um novo arquivo."
                >
                  Arquivo mock
                </LabelWithHelp>
                <Select
                  id="mockPath"
                  value={mockPath}
                  onChange={(e) => onMockChange(e.target.value)}
                >
                  {mockFiles.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <LabelWithHelp
                  htmlFor="uploadJson"
                  help="Envie um .json com array de objetos. Campos numéricos viram métricas; textos viram dimensões."
                >
                  Ou enviar JSON
                </LabelWithHelp>
                <label
                  htmlFor="uploadJson"
                  className="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-[var(--bb-radius)] border border-dashed border-[var(--bb-border)] bg-black/20 px-4 py-3 text-sm text-[var(--bb-cream)] hover:border-[var(--bb-accent)] hover:text-[var(--bb-accent)]"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? "Enviando..." : "Selecionar arquivo .json"}
                </label>
                <input
                  id="uploadJson"
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => onUpload(e.target.files?.[0] || null)}
                />
                {uploadMsg ? (
                  <p className="mt-2 text-xs text-emerald-300">{uploadMsg}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {dataSource === "bigquery" ? (
            <div className="space-y-4">
              <div>
                <LabelWithHelp htmlFor="bqDataset" help="Todas as páginas deste dashboard usam views deste dataset.">
                  Dataset
                </LabelWithHelp>
                <Select
                  id="bqDataset"
                  value={datasetId}
                  disabled={bqLoading || !datasets.length}
                  onChange={(event) => void onDatasetChange(event.target.value)}
                >
                  <option value="">{bqLoading && !datasets.length ? "Carregando..." : "Escolher"}</option>
                  {datasets.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </div>
              {pages.length ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-[var(--bb-cream)]">Páginas</p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setPages((current) => [...current, blankPage()])
                      }
                    >
                      Adicionar página
                    </Button>
                  </div>
                  {pages.map((page) => (
                    <div key={page.id} className="rounded-[var(--bb-radius)] border border-[var(--bb-border)] p-4">
                      <div className="mb-3 flex items-center gap-3">
                        <Input
                          value={page.title}
                          placeholder="Nome da página"
                          onChange={(event) =>
                            setPages((current) =>
                              current.map((item) =>
                                item.id === page.id ? { ...item, title: event.target.value } : item
                              )
                            )
                          }
                        />
                        {pages.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPages((current) => current.filter((item) => item.id !== page.id))}
                          >
                            Remover
                          </Button>
                        ) : null}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {tables.map((table) => (
                          <label key={table.id} className="flex items-center gap-2 text-sm text-[var(--bb-cream)]">
                            <input
                              type="checkbox"
                              checked={page.views.includes(table.id)}
                              onChange={() => togglePageView(page.id, table.id)}
                            />
                            {table.id}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {Object.entries(TYPE_META).map(([type, meta]) => {
              const Icon = meta.icon;
              return (
                <div key={type} className="rounded-[var(--bb-radius)] border border-[var(--bb-border)] bg-[#141312] p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-[var(--bb-cream)]">
                    <Icon className="h-4 w-4 text-[var(--bb-accent)]" />
                    {meta.label}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--bb-gray)]">{meta.help}</p>
                </div>
              );
            })}
          </div>
          <p className="text-sm text-[var(--bb-gray)]">
            Cada view entrou no tipo que combina com as colunas dela. Dá para trocar. Cliente: {clientName}.
          </p>
          {widgets.map((w) => {
            const meta = TYPE_META[w.type];
            const Icon = meta.icon;
            const widgetFields =
              dataSource === "bigquery" && w.view
                ? viewFields[w.view] || { metrics: [], dimensions: [] }
                : fields;
            return (
              <Card key={w.id} className="p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <label className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      checked={w.enabled}
                      onChange={(e) =>
                        updateWidget(w.id, { enabled: e.target.checked })
                      }
                    />
                    <Tooltip content={meta.help}>
                      <span className="inline-flex items-center gap-2 text-sm font-medium">
                        <Icon className="h-4 w-4 text-[var(--bb-accent)]" />
                        {meta.label}
                      </span>
                    </Tooltip>
                  </label>
                  <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <LabelWithHelp help="Troque se quiser outro jeito de ver a mesma view.">
                        Tipo
                      </LabelWithHelp>
                      <Select
                        value={w.type}
                        disabled={!w.enabled}
                        onChange={(event) => changeWidgetType(w, event.target.value)}
                      >
                        {Object.entries(TYPE_META).map(([type, item]) => (
                          <option key={type} value={type}>
                            {item.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <LabelWithHelp help="Título exibido acima do gráfico ou KPI.">
                        Título
                      </LabelWithHelp>
                      <Input
                        value={w.title}
                        disabled={!w.enabled}
                        onChange={(e) =>
                          updateWidget(w.id, { title: e.target.value })
                        }
                      />
                    </div>
                    {w.type !== "table" ? (
                      <div>
                        <LabelWithHelp help="Campo numérico do dataset (ex.: sessions).">
                          Métrica
                        </LabelWithHelp>
                        <Select
                          value={w.metric}
                          disabled={!w.enabled}
                          onChange={(e) =>
                            updateWidget(w.id, { metric: e.target.value })
                          }
                        >
                          {widgetFields.metrics.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </Select>
                      </div>
                    ) : null}
                    {w.type !== "kpi" && w.type !== "table" ? (
                      <div>
                        <LabelWithHelp help="Campo categórico ou data para agrupar.">
                          Dimensão
                        </LabelWithHelp>
                        <Select
                          value={w.dimension}
                          disabled={!w.enabled}
                          onChange={(e) =>
                            updateWidget(w.id, { dimension: e.target.value })
                          }
                        >
                          {widgetFields.dimensions.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </Select>
                      </div>
                    ) : null}
                  </div>
                  {w.hint ? <p className="mt-3 w-full text-xs text-[var(--bb-gray)]">{w.hint}</p> : null}
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      {step === 3 ? (
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-medium">Revisão</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--bb-gray)]">Título</dt>
              <dd>{title}</dd>
            </div>
            <div>
              <dt className="text-[var(--bb-gray)]">URL</dt>
              <dd className="font-mono text-xs">
                /p/{clientSlug}/{slug || slugify(title)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--bb-gray)]">Fonte</dt>
              <dd>
                {dataSource === "bigquery"
                  ? pages
                      .filter((page) => page.views.length)
                      .map((page) => `${page.title}: ${page.views.join(", ")}`)
                      .join(" · ")
                  : `Dataset JSON · ${mockPath}`}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--bb-gray)]">Widgets</dt>
              <dd>{enabledWidgets.length} selecionados</dd>
            </div>
            {description ? (
              <div className="sm:col-span-2">
                <dt className="text-[var(--bb-gray)]">Descrição</dt>
                <dd>{description}</dd>
              </div>
            ) : null}
          </dl>
          <ul className="space-y-1 text-sm text-[var(--bb-gray)]">
            {enabledWidgets.map((w) => (
              <li key={w.id}>
                • {TYPE_META[w.type].label}: {w.title}
                {w.metric ? ` (${w.metric}` : ""}
                {w.dimension ? ` / ${w.dimension}` : ""}
                {w.metric ? ")" : ""}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {preparing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 rounded-[var(--bb-radius-xl)] border border-[var(--bb-border)] bg-[#141312] px-5 py-4 text-sm text-[var(--bb-cream)] shadow-2xl">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--bb-accent)]" />
            Lendo as colunas das views…
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-[var(--bb-radius)] border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-between gap-3">
        <Button
          variant="ghost"
          disabled={step === 1 || pending}
          onClick={() => {
            setError("");
            setStep((s) => Math.max(1, s - 1));
          }}
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Button>
        {step < 3 ? (
          <Button onClick={goNext} disabled={preparing || bqLoading}>
            {preparing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Lendo views…
              </>
            ) : (
              <>
                Continuar
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        ) : (
          <Button onClick={submit} disabled={pending}>
            {pending ? "Criando..." : "Criar dashboard"}
          </Button>
        )}
      </div>
    </div>
  );
}
