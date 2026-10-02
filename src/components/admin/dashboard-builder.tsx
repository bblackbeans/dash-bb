"use client";

import {
  BarChart3,
  Filter,
  Gauge,
  ImageIcon,
  LineChart,
  Percent,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Redo2,
  Table2,
  Type,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveDashboardLayoutAction,
  saveDashboardTemplateAction,
  uploadDashboardImageAction,
} from "@/lib/actions";
import { ensureFrames, sizeFor, snap } from "@/lib/canvas-layout";
import type { DashboardTheme } from "@/lib/dashboard-theme";
import type { DashboardTemplateDTO } from "@/lib/dashboard-templates";
import type { DataRow } from "@/lib/mock-loader";
import {
  defaultColSpan,
  fieldLabel,
  parseWidgetConfig,
  type ColSpan,
  type WidgetConfig,
  type WidgetFrame,
  type WidgetType,
} from "@/lib/widget-config";
import { BrandMark } from "@/components/admin/brand-mark";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DashboardViewer,
  type WidgetDTO,
  type WidgetEditApi,
} from "@/components/dashboard/dashboard-viewer";

const PALETTE: { type: WidgetType; label: string; help: string; icon: typeof Gauge }[] = [
  { type: "kpi", label: "KPI", help: "Um número em destaque", icon: Gauge },
  { type: "rate", label: "Taxa", help: "Percentual entre duas métricas", icon: Percent },
  { type: "line", label: "Linha", help: "Evolução ao longo do tempo", icon: LineChart },
  { type: "bar", label: "Barras", help: "Comparar categorias", icon: BarChart3 },
  { type: "pie", label: "Pizza", help: "Participação de cada categoria", icon: PieChart },
  { type: "funnel", label: "Funil", help: "Etapas em sequência", icon: Filter },
  { type: "table", label: "Tabela", help: "Detalhe linha a linha", icon: Table2 },
  { type: "text", label: "Texto", help: "Título ou comentário", icon: Type },
  { type: "image", label: "Imagem", help: "Logo ou foto", icon: ImageIcon },
];

type Snapshot = { widgets: WidgetDTO[]; theme: DashboardTheme };

function inferFields(rows: DataRow[]) {
  const metrics = new Set<string>();
  const dimensions = new Set<string>();
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "number") metrics.add(key);
      else dimensions.add(key);
    }
  }
  return { metrics: Array.from(metrics), dimensions: Array.from(dimensions) };
}

function cloneTheme(theme: DashboardTheme): DashboardTheme {
  return { ...theme, palette: [...theme.palette] };
}

function snapshotOf(widgets: WidgetDTO[], theme: DashboardTheme): Snapshot {
  return {
    widgets: widgets.map((widget) => ({ ...widget })),
    theme: cloneTheme(theme),
  };
}

export function DashboardBuilder({
  dashboardId,
  clientSlug,
  dashSlug,
  title,
  subtitle,
  rows,
  initialWidgets,
  initialTheme,
  initialTemplates,
}: {
  dashboardId: string;
  clientSlug: string;
  dashSlug: string;
  title: string;
  subtitle?: string;
  rows: DataRow[];
  initialWidgets: WidgetDTO[];
  initialTheme: DashboardTheme;
  initialTemplates: DashboardTemplateDTO[];
}) {
  const router = useRouter();
  const fields = useMemo(() => inferFields(rows), [rows]);
  const [editing, setEditing] = useState(false);
  const [studioOpen, setStudioOpen] = useState(true);
  const [widgets, setWidgets] = useState(() => ensureFrames(initialWidgets));
  const [theme, setTheme] = useState(initialTheme);
  const [baseline, setBaseline] = useState<Snapshot>({
    widgets: ensureFrames(initialWidgets),
    theme: initialTheme,
  });
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"dados" | "estilo">("dados");
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateId, setTemplateId] = useState(initialTemplates[0]?.id || "");
  const [templateToApply, setTemplateToApply] = useState<DashboardTemplateDTO | null>(null);
  const gesturePushed = useRef(false);

  const selected = widgets.find((widget) => widget.id === selectedId) || null;
  const selectedConfig = selected ? parseWidgetConfig(selected.configJson) : null;

  function remember() {
    setPast((current) => [...current, snapshotOf(widgets, theme)].slice(-20));
    setFuture([]);
  }

  function commit(nextWidgets: WidgetDTO[], nextTheme = theme) {
    remember();
    setWidgets(nextWidgets);
    setTheme(nextTheme);
    setSaved(false);
  }

  function undo() {
    setPast((current) => {
      const previous = current[current.length - 1];
      if (!previous) return current;
      setFuture((queue) => [...queue, snapshotOf(widgets, theme)]);
      setWidgets(previous.widgets);
      setTheme(previous.theme);
      setSaved(false);
      return current.slice(0, -1);
    });
  }

  function redo() {
    setFuture((current) => {
      const next = current[current.length - 1];
      if (!next) return current;
      setPast((queue) => [...queue, snapshotOf(widgets, theme)].slice(-20));
      setWidgets(next.widgets);
      setTheme(next.theme);
      setSaved(false);
      return current.slice(0, -1);
    });
  }

  useEffect(() => {
    function onUp() {
      gesturePushed.current = false;
    }
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, []);

  useEffect(() => {
    if (editing) {
      document.body.dataset.editor = "open";
    } else {
      delete document.body.dataset.editor;
    }
    if (editing && studioOpen) {
      document.body.dataset.studio = "open";
    } else {
      delete document.body.dataset.studio;
    }
    return () => {
      delete document.body.dataset.editor;
      delete document.body.dataset.studio;
    };
  }, [editing, studioOpen]);

  useEffect(() => {
    if (!editing) return;
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function patchWidget(id: string, recipe: (widget: WidgetDTO, config: WidgetConfig) => WidgetDTO) {
    commit(
      widgets.map((widget) =>
        widget.id === id ? recipe(widget, parseWidgetConfig(widget.configJson)) : widget
      )
    );
  }

  function updateConfig(patch: Partial<WidgetConfig>) {
    if (!selected) return;
    patchWidget(selected.id, (widget, config) => ({
      ...widget,
      title: patch.content !== undefined && widget.type === "text" ? widget.title : widget.title,
      configJson: JSON.stringify({ ...config, ...patch }),
    }));
  }

  const edit: WidgetEditApi | undefined = editing
    ? {
        selectedId,
        onSelect: setSelectedId,
        onGestureStart: () => {
          if (gesturePushed.current) return;
          gesturePushed.current = true;
          remember();
        },
        onFrame: (id, frame: WidgetFrame) => {
          setSaved(false);
          setWidgets((current) =>
            current.map((widget) => {
              if (widget.id !== id) return widget;
              const config = parseWidgetConfig(widget.configJson);
              return { ...widget, configJson: JSON.stringify({ ...config, frame }) };
            })
          );
        },
      }
    : undefined;

  function addWidget(type: WidgetType) {
    const metric = fields.metrics.includes("leads") ? "leads" : fields.metrics[0] || "leads";
    const date = fields.dimensions.includes("date") ? "date" : fields.dimensions[0] || "date";
    const category = fields.dimensions.find((field) => field !== "date") || "campaign";
    const config: WidgetConfig = { colSpan: defaultColSpan(type) };
    const meta = PALETTE.find((item) => item.type === type);
    if (type === "kpi") {
      config.metric = metric;
      if (metric === "spend" || metric === "revenue") config.format = "currency";
    }
    if (type === "line") {
      config.metric = metric;
      config.dimension = date;
    }
    if (type === "bar" || type === "pie") {
      config.metric = metric;
      config.dimension = category;
    }
    if (type === "rate") {
      config.numerator = fields.metrics.includes("qualified") ? "qualified" : metric;
      config.denominator = fields.metrics.includes("leads") ? "leads" : metric;
    }
    if (type === "funnel") {
      const preferred = ["clicks", "leads", "qualified", "opportunities", "won"];
      config.stages = preferred.filter((field) => fields.metrics.includes(field));
      if (!config.stages.length) config.stages = fields.metrics.slice(0, 4);
    }
    if (type === "table") config.columns = [...fields.dimensions, ...fields.metrics].slice(0, 8);
    if (type === "text") {
      config.content = "Escreva aqui";
      config.fontSize = 28;
      config.bold = true;
    }
    const size = sizeFor(type, defaultColSpan(type));
    const y = widgets.reduce((max, widget) => {
      const frame = parseWidgetConfig(widget.configJson).frame;
      return frame ? Math.max(max, frame.y + frame.h + 16) : max;
    }, 24);
    config.frame = { x: 24, y: snap(y), w: size.w, h: size.h };
    const next: WidgetDTO = {
      id: `tmp-${crypto.randomUUID()}`,
      type,
      title: meta?.label || "Bloco",
      sortOrder: widgets.reduce((max, widget) => Math.max(max, widget.sortOrder), 0) + 1,
      configJson: JSON.stringify(config),
    };
    commit([...widgets, next]);
    setSelectedId(next.id);
    setTab(type === "image" ? "estilo" : "dados");
  }

  async function save() {
    setSaving(true);
    setError("");
    const result = await saveDashboardLayoutAction({
      dashboardId,
      clientSlug,
      dashSlug,
      theme,
      widgets: widgets.map((widget) => ({
        type: widget.type,
        title: widget.title,
        config: parseWidgetConfig(widget.configJson),
      })),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const next = ensureFrames(result.widgets);
    setWidgets(next);
    setBaseline({ widgets: next, theme: cloneTheme(theme) });
    setSelectedId(next[0]?.id ?? null);
    setSaved(true);
    router.refresh();
  }

  async function saveTemplate() {
    setError("");
    const result = await saveDashboardTemplateAction({
      name: templateName,
      theme,
      widgets: widgets.map((widget) => ({
        type: widget.type,
        title: widget.title,
        config: parseWidgetConfig(widget.configJson),
      })),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTemplates((current) => [
      {
        id: result.id,
        name: result.name,
        description: "Modelo salvo por você",
        builtin: false,
        theme: cloneTheme(theme),
        widgets: widgets.map((widget) => ({
          type: widget.type as WidgetType,
          title: widget.title,
          config: parseWidgetConfig(widget.configJson),
        })),
      },
      ...current,
    ]);
    setTemplateId(result.id);
    setTemplateName("");
    setSaved(true);
  }

  function requestApplyTemplate() {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setTemplateToApply(template);
  }

  function confirmApplyTemplate() {
    const template = templateToApply;
    if (!template) return;
    const next = template.widgets.map((widget, index) => ({
      id: `tmp-${crypto.randomUUID()}`,
      type: widget.type,
      title: widget.title,
      sortOrder: index,
      configJson: JSON.stringify(widget.config),
    }));
    commit(ensureFrames(next), cloneTheme(template.theme));
    setSelectedId(next[0]?.id ?? null);
    setTemplateToApply(null);
  }

  const chartLike = selected && ["line", "bar", "pie", "funnel", "kpi", "rate"].includes(selected.type);

  return (
    <div className="bb-dash-builder space-y-4">
      {!editing ? (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => {
              setEditing(true);
              setStudioOpen(true);
            }}
          >
            Montar dashboard
          </Button>
        </div>
      ) : null}

      {editing && !studioOpen ? (
        <button
          type="button"
          onClick={() => setStudioOpen(true)}
          className="fixed left-3 top-20 z-30 inline-flex items-center gap-2 rounded-[var(--bb-radius)] border border-[var(--bb-accent)] bg-[#141312] px-3 py-2 text-sm text-[var(--bb-accent)] shadow-lg"
        >
          <PanelLeftOpen className="h-4 w-4" />
          Estúdio
        </button>
      ) : null}

      <div>
        {editing ? (
          <aside
            className={`fixed inset-y-0 left-0 z-50 flex w-80 flex-col border-r border-[var(--bb-border)] bg-[#121110] shadow-2xl transition-transform duration-200 ${
              studioOpen ? "" : "pointer-events-none"
            }`}
            style={{ transform: studioOpen ? "translateX(0)" : "translateX(-100%)" }}
            aria-hidden={!studioOpen}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-5">
              <BrandMark />
              <button
                type="button"
                onClick={() => setStudioOpen(false)}
                className="inline-flex shrink-0 items-center rounded-[var(--bb-radius)] p-1.5 text-[var(--bb-gray)] hover:bg-white/5 hover:text-[var(--bb-cream)]"
                aria-label="Ocultar estúdio"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--bb-gray)]">
                Estúdio
              </p>
              <div className="flex items-center gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={undo} disabled={!past.length} aria-label="Desfazer">
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={redo} disabled={!future.length} aria-label="Refazer">
                  <Redo2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-[var(--bb-gray)]">
              Arraste os blocos, puxe as alças e solte onde quiser. A URL pública usa esta mesma prancheta.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PALETTE.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    title={item.help}
                    className="flex flex-col items-center gap-1 rounded-[var(--bb-radius)] border border-[var(--bb-border)] px-1 py-2 text-xs text-[var(--bb-cream)] hover:border-[var(--bb-accent)]"
                    onClick={() => addWidget(item.type)}
                  >
                    <Icon className="h-4 w-4 text-[var(--bb-accent)]" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" size="sm" variant={tab === "dados" ? "primary" : "secondary"} onClick={() => setTab("dados")}>
                Dados
              </Button>
              <Button type="button" size="sm" variant={tab === "estilo" ? "primary" : "secondary"} onClick={() => setTab("estilo")}>
                Estilo
              </Button>
            </div>

            {tab === "estilo" ? (
              <PageStyle theme={theme} onChange={(next) => commit(widgets, next)} />
            ) : null}

            {selected && selectedConfig ? (
              <div className="space-y-3 border-t border-[var(--bb-gray)]/20 pt-4">
                <p className="text-xs uppercase tracking-wide text-[var(--bb-gray)]">Bloco selecionado</p>
                <label className="block space-y-1 text-xs text-[var(--bb-gray)]">
                  Título
                  <Input
                    value={selected.title}
                    onChange={(event) =>
                      patchWidget(selected.id, (widget, config) => ({
                        ...widget,
                        title: event.target.value,
                        configJson: JSON.stringify(config),
                      }))
                    }
                  />
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const max = widgets.reduce((acc, widget) => Math.max(acc, widget.sortOrder), 0);
                      patchWidget(selected.id, (widget, config) => ({
                        ...widget,
                        sortOrder: max + 1,
                        configJson: JSON.stringify(config),
                      }));
                    }}
                  >
                    Frente
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const min = widgets.reduce((acc, widget) => Math.min(acc, widget.sortOrder), 0);
                      patchWidget(selected.id, (widget, config) => ({
                        ...widget,
                        sortOrder: min - 1,
                        configJson: JSON.stringify(config),
                      }));
                    }}
                  >
                    Trás
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      commit(widgets.filter((widget) => widget.id !== selected.id));
                      setSelectedId(null);
                    }}
                  >
                    Remover
                  </Button>
                </div>

                {tab === "dados" && selected.type === "text" ? (
                  <>
                    <label className="block space-y-1 text-xs text-[var(--bb-gray)]">
                      Texto
                      <Textarea
                        value={selectedConfig.content || ""}
                        onChange={(event) => updateConfig({ content: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-1 text-xs text-[var(--bb-gray)]">
                      Tamanho
                      <Input
                        type="number"
                        min={12}
                        max={96}
                        value={selectedConfig.fontSize || 28}
                        onChange={(event) => updateConfig({ fontSize: Number(event.target.value) })}
                      />
                    </label>
                    <FieldSelect
                      label="Alinhamento"
                      value={selectedConfig.align || "left"}
                      options={[
                        ["left", "Esquerda"],
                        ["center", "Centro"],
                        ["right", "Direita"],
                      ]}
                      onChange={(align) =>
                        updateConfig({
                          align: align === "center" || align === "right" ? align : "left",
                        })
                      }
                    />
                  </>
                ) : null}

                {tab === "dados" &&
                (selected.type === "kpi" || selected.type === "line" || selected.type === "bar" || selected.type === "pie") ? (
                  <FieldSelect
                    label="Métrica"
                    value={selectedConfig.metric || fields.metrics[0] || ""}
                    options={fields.metrics.map((metric) => [metric, fieldLabel(metric)])}
                    onChange={(metric) =>
                      updateConfig({
                        metric,
                        format: metric === "spend" || metric === "revenue" ? "currency" : undefined,
                      })
                    }
                  />
                ) : null}

                {tab === "dados" && (selected.type === "line" || selected.type === "bar" || selected.type === "pie") ? (
                  <FieldSelect
                    label="Agrupar por"
                    value={selectedConfig.dimension || fields.dimensions[0] || ""}
                    options={fields.dimensions.map((field) => [field, fieldLabel(field)])}
                    onChange={(dimension) => updateConfig({ dimension })}
                  />
                ) : null}

                {tab === "dados" && selected.type === "rate" ? (
                  <>
                    <FieldSelect
                      label="Numerador"
                      value={selectedConfig.numerator || fields.metrics[0] || ""}
                      options={fields.metrics.map((metric) => [metric, fieldLabel(metric)])}
                      onChange={(numerator) => updateConfig({ numerator })}
                    />
                    <FieldSelect
                      label="Denominador"
                      value={selectedConfig.denominator || fields.metrics[0] || ""}
                      options={fields.metrics.map((metric) => [metric, fieldLabel(metric)])}
                      onChange={(denominator) => updateConfig({ denominator })}
                    />
                  </>
                ) : null}

                {tab === "dados" && selected.type === "funnel" ? (
                  <StageList
                    stages={selectedConfig.stages || []}
                    metrics={fields.metrics}
                    onChange={(stages) => updateConfig({ stages })}
                  />
                ) : null}

                {tab === "estilo" && chartLike ? (
                  <PaletteEditor
                    palette={selectedConfig.style?.palette || theme.palette}
                    onChange={(palette) =>
                      updateConfig({ style: { ...selectedConfig.style, palette } })
                    }
                    onReset={() => {
                      const next = { ...selectedConfig };
                      if (next.style) {
                        delete next.style.palette;
                        if (!next.style.card && !next.style.titleColor) delete next.style;
                      }
                      patchWidget(selected.id, (widget) => ({
                        ...widget,
                        configJson: JSON.stringify(next),
                      }));
                    }}
                  />
                ) : null}

                {tab === "estilo" && selected.type !== "image" ? (
                  <ColorField
                    label="Fundo do bloco"
                    value={selectedConfig.style?.card || theme.card}
                    onChange={(card) => updateConfig({ style: { ...selectedConfig.style, card } })}
                  />
                ) : null}

                {tab === "estilo" && selected.type !== "image" ? (
                  <ColorField
                    label="Cor do título"
                    value={selectedConfig.style?.titleColor || theme.text}
                    onChange={(titleColor) =>
                      updateConfig({ style: { ...selectedConfig.style, titleColor } })
                    }
                  />
                ) : null}

                {tab === "estilo" && selected.type === "image" ? (
                  <ImageField
                    src={selectedConfig.src}
                    onSrc={(src) => updateConfig({ src })}
                    onError={setError}
                  />
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-[var(--bb-gray)]">
                Clique num bloco da prancheta para editar dados e cores.
              </p>
            )}

            <div className="space-y-2 border-t border-[var(--bb-gray)]/20 pt-4">
              <p className="text-xs uppercase tracking-wide text-[var(--bb-gray)]">Modelos</p>
              <Select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.builtin ? template.name : `${template.name} (salvo)`}
                  </option>
                ))}
              </Select>
              <Button type="button" variant="secondary" className="w-full" onClick={requestApplyTemplate}>
                Aplicar modelo
              </Button>
              <Input
                value={templateName}
                placeholder="Nome para salvar este modelo"
                onChange={(event) => setTemplateName(event.target.value)}
              />
              <Button type="button" variant="secondary" className="w-full" onClick={saveTemplate} disabled={!templateName.trim()}>
                Salvar como modelo
              </Button>
            </div>

            {error ? (
              <p className="rounded-[var(--bb-radius)] border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            ) : null}
            {saved ? <p className="text-sm text-emerald-400">Salvo.</p> : null}
            <div className="flex gap-2">
              <Button type="button" onClick={save} disabled={saving || !widgets.length}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setWidgets(baseline.widgets);
                  setTheme(baseline.theme);
                  setEditing(false);
                  setError("");
                  setSaved(false);
                  setSelectedId(null);
                }}
              >
                Fechar
              </Button>
            </div>
            </div>
          </aside>
        ) : null}

        <div className="bb-dash-canvas">
          <DashboardViewer
            title={title}
            subtitle={subtitle}
            rows={rows}
            widgets={widgets}
            theme={theme}
            edit={edit}
          />
        </div>
      </div>
      <Modal
        open={Boolean(templateToApply)}
        title="Aplicar modelo?"
        description={
          templateToApply
            ? `"${templateToApply.name}" substitui a montagem atual. A fonte de dados deste dashboard continua a mesma.`
            : undefined
        }
        onClose={() => setTemplateToApply(null)}
        onConfirm={confirmApplyTemplate}
        confirmLabel="Aplicar"
      />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1 text-xs text-[var(--bb-gray)]">
      {label}
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </Select>
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs text-[var(--bb-gray)]">
      {label}
      <input
        type="color"
        value={value.toLowerCase()}
        aria-label={label}
        className="h-8 w-12 cursor-pointer rounded border border-[var(--bb-border)] bg-transparent"
        onChange={(event) => onChange(event.target.value.toUpperCase())}
      />
    </label>
  );
}

function PageStyle({
  theme,
  onChange,
}: {
  theme: DashboardTheme;
  onChange: (theme: DashboardTheme) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-[var(--bb-gray)]">Página</p>
      <ColorField label="Fundo" value={theme.background} onChange={(background) => onChange({ ...theme, background })} />
      <ColorField label="Cards" value={theme.card} onChange={(card) => onChange({ ...theme, card })} />
      <ColorField label="Texto" value={theme.text} onChange={(text) => onChange({ ...theme, text })} />
      <PaletteEditor
        palette={theme.palette}
        onChange={(palette) => onChange({ ...theme, palette })}
      />
    </div>
  );
}

function PaletteEditor({
  palette,
  onChange,
  onReset,
}: {
  palette: string[];
  onChange: (palette: string[]) => void;
  onReset?: () => void;
}) {
  const colors = [...palette];
  while (colors.length < 6) colors.push("#DA9330");
  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--bb-gray)]">Cores dos gráficos</p>
      <div className="flex flex-wrap gap-2">
        {colors.slice(0, 6).map((color, index) => (
          <input
            key={index}
            type="color"
            value={color.toLowerCase()}
            aria-label={`Cor ${index + 1}`}
            className="h-8 w-8 cursor-pointer rounded border border-[var(--bb-border)] bg-transparent"
            onChange={(event) => {
              const next = [...colors];
              next[index] = event.target.value.toUpperCase();
              onChange(next.slice(0, 6));
            }}
          />
        ))}
      </div>
      {onReset ? (
        <button type="button" className="text-xs text-[var(--bb-accent)]" onClick={onReset}>
          Usar cores da página
        </button>
      ) : null}
    </div>
  );
}

function ImageField({
  src,
  onSrc,
  onError,
}: {
  src?: string;
  onSrc: (src: string) => void;
  onError: (message: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  return (
    <label className="block space-y-1 text-xs text-[var(--bb-gray)]">
      Imagem
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="block w-full text-sm text-[var(--bb-cream)]"
        disabled={uploading}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const body = new FormData();
          body.set("file", file);
          setUploading(true);
          const result = await uploadDashboardImageAction(body);
          setUploading(false);
          if (!result.ok) {
            onError(result.error);
            return;
          }
          onSrc(result.src);
        }}
      />
      {src ? <p className="truncate text-[var(--bb-cream)]">{src}</p> : null}
      {uploading ? <p>Enviando...</p> : null}
    </label>
  );
}

function StageList({
  stages,
  metrics,
  onChange,
}: {
  stages: string[];
  metrics: string[];
  onChange: (stages: string[]) => void;
}) {
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    const next = [...stages];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--bb-gray)]">Etapas, de cima para baixo</p>
      {stages.map((stage, index) => (
        <div key={`${stage}-${index}`} className="flex items-center gap-1">
          <span className="min-w-0 flex-1 truncate text-sm text-[var(--bb-cream)]">
            {fieldLabel(stage)}
          </span>
          <Button type="button" size="sm" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)}>
            ↑
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={index === stages.length - 1} onClick={() => move(index, 1)}>
            ↓
          </Button>
          <Button type="button" size="sm" variant="danger" onClick={() => onChange(stages.filter((_, item) => item !== index))}>
            ×
          </Button>
        </div>
      ))}
      <Select
        value=""
        onChange={(event) => {
          if (!event.target.value) return;
          onChange([...stages, event.target.value]);
        }}
      >
        <option value="">Adicionar etapa</option>
        {metrics
          .filter((metric) => !stages.includes(metric))
          .map((metric) => (
            <option key={metric} value={metric}>
              {fieldLabel(metric)}
            </option>
          ))}
      </Select>
    </div>
  );
}
