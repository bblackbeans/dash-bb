"use client";

import { GripVertical, X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DataRow } from "@/lib/mock-loader";
import { groupByDimension, sumMetric } from "@/lib/filter-engine";
import {
  colSpanClass,
  fieldLabel,
  parseWidgetConfig,
  resolveColSpan,
  type WidgetConfig,
} from "@/lib/widget-config";
import type { WidgetDTO } from "./dashboard-viewer";

type WidgetEditApi = {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder: (from: number, to: number) => void;
};

const COLORS = ["#DA9330", "#F4F0ED", "#B1B0B1", "#8B6914", "#5C5B5C", "#C9A06A"];

function formatValue(value: number, format?: string) {
  if (format === "currency") {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  }
  if (format === "percent") {
    return value.toLocaleString("pt-BR", {
      style: "percent",
      maximumFractionDigits: 1,
    });
  }
  return value.toLocaleString("pt-BR");
}

function KpiCard({
  title,
  metric,
  format,
  rows,
  comparisonRows,
  compare,
}: {
  title: string;
  metric: string;
  format?: string;
  rows: DataRow[];
  comparisonRows: DataRow[];
  compare: boolean;
}) {
  const current = sumMetric(rows, metric);
  const previous = sumMetric(comparisonRows, metric);
  const delta =
    compare && previous !== 0
      ? ((current - previous) / previous) * 100
      : compare
        ? current > 0
          ? 100
          : 0
        : null;

  return (
    <div className="rounded-lg border border-[var(--bb-gray)]/30 bg-[var(--bb-black)]/80 p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--bb-gray)]">
        {title}
      </p>
      <p className="mt-2 text-3xl font-semibold text-[var(--bb-cream)]">
        {formatValue(current, format)}
      </p>
      {delta !== null ? (
        <p
          className={`mt-1 text-sm ${
            delta >= 0 ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(1)}% vs período anterior
        </p>
      ) : null}
    </div>
  );
}

function RateCard({
  title,
  numerator,
  denominator,
  rows,
  comparisonRows,
  compare,
}: {
  title: string;
  numerator: string;
  denominator: string;
  rows: DataRow[];
  comparisonRows: DataRow[];
  compare: boolean;
}) {
  const rate = (source: DataRow[]) => {
    const den = sumMetric(source, denominator);
    if (!den) return 0;
    return sumMetric(source, numerator) / den;
  };
  const current = rate(rows);
  const previous = rate(comparisonRows);
  const delta =
    compare && previous !== 0
      ? ((current - previous) / previous) * 100
      : null;

  return (
    <div className="rounded-lg border border-[var(--bb-gray)]/30 bg-[var(--bb-black)]/80 p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--bb-gray)]">
        {title}
      </p>
      <p className="mt-2 text-3xl font-semibold text-[var(--bb-cream)]">
        {formatValue(current, "percent")}
      </p>
      <p className="mt-1 text-xs text-[var(--bb-gray)]">
        {fieldLabel(numerator)} ÷ {fieldLabel(denominator)}
      </p>
      {delta !== null ? (
        <p
          className={`mt-1 text-sm ${
            delta >= 0 ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(1)}% vs período anterior
        </p>
      ) : null}
    </div>
  );
}

function FunnelChart({
  title,
  stages,
  rows,
}: {
  title: string;
  stages: string[];
  rows: DataRow[];
}) {
  const steps = stages.map((metric) => ({
    name: fieldLabel(metric),
    value: sumMetric(rows, metric),
  }));
  const max = Math.max(...steps.map((step) => step.value), 1);

  return (
    <div className="rounded-lg border border-[var(--bb-gray)]/30 bg-[var(--bb-black)]/80 p-4">
      <h3 className="text-sm font-medium text-[var(--bb-cream)]">{title}</h3>
      <p className="mb-4 text-xs text-[var(--bb-gray)]">
        Volume de cada etapa e a taxa em relação à anterior.
      </p>
      <div className="space-y-3">
        {steps.map((step, index) => {
          const width = Math.max(12, (step.value / max) * 100);
          const previous = steps[index - 1]?.value;
          const conversion =
            previous && previous > 0 ? (step.value / previous) * 100 : null;
          return (
            <div key={`${step.name}-${index}`}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs text-[var(--bb-cream)]">
                <span>{step.name}</span>
                <span className="text-[var(--bb-gray)]">
                  {formatValue(step.value)}
                  {conversion !== null
                    ? ` · ${conversion.toLocaleString("pt-BR", {
                        maximumFractionDigits: 1,
                      })}% da etapa anterior`
                    : ""}
                </span>
              </div>
              <div className="flex justify-center">
                <div
                  className="h-8 rounded bg-[var(--bb-accent)]"
                  style={{ width: `${width}%`, opacity: 1 - index * 0.12 }}
                />
              </div>
            </div>
          );
        })}
        {!steps.length ? (
          <p className="text-sm text-[var(--bb-gray)]">
            Escolha as etapas do funil.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--bb-gray)]/30 bg-[var(--bb-black)]/80 p-4">
      <h3 className="mb-3 text-sm font-medium text-[var(--bb-cream)]">{title}</h3>
      <div className="h-64">{children}</div>
    </div>
  );
}

function axisFormat(format?: string) {
  return (value: number) =>
    format === "currency"
      ? value.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
          maximumFractionDigits: 0,
        })
      : value.toLocaleString("pt-BR");
}

function WidgetFrame({
  widget,
  config,
  edit,
  index,
  onDragStart,
  onDrop,
  children,
}: {
  widget: WidgetDTO;
  config: WidgetConfig;
  edit?: WidgetEditApi;
  index: number;
  onDragStart: (index: number) => void;
  onDrop: (index: number) => void;
  children: ReactNode;
}) {
  const span = resolveColSpan(widget.type, config);
  const selected = edit?.selectedId === widget.id;

  return (
    <div
      className={`${colSpanClass(span)} min-w-0 ${
        selected ? "rounded-lg ring-2 ring-[var(--bb-accent)]" : ""
      } ${edit ? "cursor-pointer" : ""}`}
      onClick={() => edit?.onSelect(widget.id)}
      draggable={Boolean(edit)}
      onDragStart={() => onDragStart(index)}
      onDragOver={(event) => {
        if (edit) event.preventDefault();
      }}
      onDrop={() => onDrop(index)}
    >
      {edit ? (
        <div className="mb-1 flex items-center gap-2 px-1 text-xs text-[var(--bb-gray)]">
          <span className="inline-flex cursor-grab items-center" aria-hidden>
            <GripVertical className="h-4 w-4" />
          </span>
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-[var(--bb-cream)]"
            onClick={() => edit.onSelect(widget.id)}
          >
            {widget.title}
          </button>
          <button
            type="button"
            className="text-[var(--bb-gray)] hover:text-red-300"
            aria-label={`Remover ${widget.title}`}
            onClick={() => edit.onRemove(widget.id)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function WidgetGrid({
  widgets,
  rows,
  comparisonRows,
  compare,
  edit,
}: {
  widgets: WidgetDTO[];
  rows: DataRow[];
  comparisonRows: DataRow[];
  compare: boolean;
  edit?: WidgetEditApi;
}) {
  const sorted = [...widgets].sort((a, b) => a.sortOrder - b.sortOrder);
  const dragFrom = useRef<number | null>(null);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {sorted.map((widget, index) => {
        const config = parseWidgetConfig(widget.configJson);
        const metric = config.metric || "leads";
        const dimension = config.dimension || "date";

        let body: ReactNode = null;

        if (widget.type === "kpi") {
          body = (
            <KpiCard
              title={widget.title}
              metric={metric}
              format={config.format}
              rows={rows}
              comparisonRows={comparisonRows}
              compare={compare}
            />
          );
        } else if (widget.type === "rate") {
          body = (
            <RateCard
              title={widget.title}
              numerator={config.numerator || "qualified"}
              denominator={config.denominator || "leads"}
              rows={rows}
              comparisonRows={comparisonRows}
              compare={compare}
            />
          );
        } else if (widget.type === "funnel") {
          body = (
            <FunnelChart
              title={widget.title}
              stages={
                config.stages || [
                  "clicks",
                  "leads",
                  "qualified",
                  "opportunities",
                  "won",
                ]
              }
              rows={rows}
            />
          );
        } else if (widget.type === "line" || widget.type === "bar") {
          const data = groupByDimension(rows, dimension, metric);
          const tick = axisFormat(config.format);
          body = (
            <ChartCard title={widget.title}>
              <ResponsiveContainer width="100%" height="100%">
                {widget.type === "line" ? (
                  <LineChart data={data}>
                    <CartesianGrid stroke="#B1B0B133" />
                    <XAxis dataKey="name" stroke="#B1B0B1" fontSize={11} />
                    <YAxis stroke="#B1B0B1" fontSize={11} tickFormatter={tick} />
                    <Tooltip formatter={(value) => tick(Number(value))} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#DA9330"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={data}>
                    <CartesianGrid stroke="#B1B0B133" />
                    <XAxis dataKey="name" stroke="#B1B0B1" fontSize={11} />
                    <YAxis stroke="#B1B0B1" fontSize={11} tickFormatter={tick} />
                    <Tooltip formatter={(value) => tick(Number(value))} />
                    <Bar dataKey="value" fill="#DA9330" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </ChartCard>
          );
        } else if (widget.type === "pie") {
          const data = groupByDimension(rows, dimension, metric);
          body = (
            <ChartCard title={widget.title}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" outerRadius={90} label>
                    {data.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          );
        } else if (widget.type === "table") {
          const columns = config.columns || Object.keys(rows[0] || {});
          body = (
            <div className="overflow-auto rounded-lg border border-[var(--bb-gray)]/30 bg-[var(--bb-black)]/80 p-4">
              <h3 className="mb-3 text-sm font-medium text-[var(--bb-cream)]">
                {widget.title}
              </h3>
              <table className="min-w-full text-left text-sm text-[var(--bb-cream)]">
                <thead className="text-xs uppercase text-[var(--bb-gray)]">
                  <tr>
                    {columns.map((column) => (
                      <th key={column} className="px-2 py-2 font-medium">
                        {fieldLabel(column)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className="border-t border-[var(--bb-gray)]/20">
                      {columns.map((column) => (
                        <td key={column} className="px-2 py-2 whitespace-nowrap">
                          {String(row[column] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (!body) return null;

        return (
          <WidgetFrame
            key={widget.id}
            widget={widget}
            config={config}
            edit={edit}
            index={index}
            onDragStart={(from) => {
              dragFrom.current = from;
            }}
            onDrop={(to) => {
              const from = dragFrom.current;
              dragFrom.current = null;
              if (from === null || from === to) return;
              edit?.onReorder(from, to);
            }}
          >
            {body}
          </WidgetFrame>
        );
      })}
    </div>
  );
}
