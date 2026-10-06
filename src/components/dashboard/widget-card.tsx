"use client";

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
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DataRow } from "@/lib/mock-loader";
import type { DashboardTheme } from "@/lib/dashboard-theme";
import { aggregateMetric, groupByDimension, sumMetric } from "@/lib/filter-engine";
import {
  fieldLabel,
  parseWidgetConfig,
  type WidgetConfig,
} from "@/lib/widget-config";
import type { WidgetDTO } from "./dashboard-viewer";

export type WidgetLook = {
  card: string;
  text: string;
  muted: string;
  palette: string[];
  title: string;
};

export function resolveLook(
  theme: DashboardTheme,
  config: WidgetConfig
): WidgetLook {
  return {
    card: config.style?.card || theme.card,
    text: theme.text,
    muted: theme.muted,
    palette: config.style?.palette?.length
      ? config.style.palette
      : theme.palette,
    title: config.style?.titleColor || theme.text,
  };
}

const chartTooltip = {
  contentStyle: {
    background: "#ffffff",
    border: "1px solid #e5e5e5",
    borderRadius: 8,
    color: "#000000",
  },
  labelStyle: { color: "#000000" },
  itemStyle: { color: "#000000" },
};

function formatValue(value: number, format?: string) {
  if (format === "currency") {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 2,
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

function axisFormat(format?: string) {
  return (value: number) =>
    format === "currency"
      ? value.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
          maximumFractionDigits: 2,
        })
      : value.toLocaleString("pt-BR");
}

export function WidgetCard({
  widget,
  theme,
  rows,
  comparisonRows,
  compare,
  width,
  height,
}: {
  widget: WidgetDTO;
  theme: DashboardTheme;
  rows: DataRow[];
  comparisonRows: DataRow[];
  compare: boolean;
  width: number;
  height: number;
}) {
  const config = parseWidgetConfig(widget.configJson);
  const look = resolveLook(theme, config);
  const shell = {
    background: look.card,
    color: look.text,
    borderColor: `${look.muted}55`,
    width,
    height,
  };

  if (widget.type === "text") {
    return (
      <div
        className="flex h-full w-full items-center overflow-hidden rounded-lg border px-4"
        style={shell}
      >
        <p
          className="w-full whitespace-pre-wrap leading-snug"
          style={{
            color: look.title,
            fontSize: config.fontSize || 22,
            textAlign: config.align || "left",
            fontWeight: config.bold ? 650 : 500,
          }}
        >
          {config.content || widget.title}
        </p>
      </div>
    );
  }

  if (widget.type === "image") {
    return (
      <div
        className="h-full w-full overflow-hidden rounded-lg border"
        style={shell}
      >
        {config.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={config.src}
            alt={widget.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm" style={{ color: look.muted }}>
            Envie uma imagem no painel Estilo.
          </div>
        )}
      </div>
    );
  }

  if (widget.type === "kpi" || widget.type === "rate") {
    return (
      <MetricCard
        widget={widget}
        config={config}
        look={look}
        shell={shell}
        rows={rows}
        comparisonRows={comparisonRows}
        compare={compare}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border p-4" style={shell}>
      <h3 className="mb-2 shrink-0 text-sm font-medium" style={{ color: look.title }}>
        {widget.title}
      </h3>
      <div className="min-h-0 flex-1">
        <ChartBody
          widget={widget}
          config={config}
          look={look}
          rows={rows}
          width={Math.max(80, width - 32)}
          height={Math.max(64, height - 56)}
        />
      </div>
    </div>
  );
}

function MetricCard({
  widget,
  config,
  look,
  shell,
  rows,
  comparisonRows,
  compare,
}: {
  widget: WidgetDTO;
  config: WidgetConfig;
  look: WidgetLook;
  shell: { background: string; color: string; borderColor: string; width: number; height: number };
  rows: DataRow[];
  comparisonRows: DataRow[];
  compare: boolean;
}) {
  const isRate = widget.type === "rate";
  const numerator = config.numerator || "qualified";
  const denominator = config.denominator || "leads";
  const shownFormat =
    config.format ||
    (/^(cpm|cpc|cpp|spend|revenue)$/.test(config.metric || "") ? "currency" : undefined);
  const current = isRate
    ? ratio(rows, numerator, denominator)
    : aggregateMetric(rows, config.metric || "leads");
  const previous = isRate
    ? ratio(comparisonRows, numerator, denominator)
    : aggregateMetric(comparisonRows, config.metric || "leads");
  const delta =
    compare && previous !== 0 ? ((current - previous) / previous) * 100 : null;

  return (
    <div className="flex h-full w-full flex-col justify-center overflow-hidden rounded-lg border p-4" style={shell}>
      <p className="text-xs uppercase tracking-wide" style={{ color: look.muted }}>
        {widget.title}
      </p>
      <p className="mt-2 text-3xl font-semibold" style={{ color: look.palette[0] || look.title }}>
        {formatValue(current, isRate ? "percent" : shownFormat)}
      </p>
      {isRate ? (
        <p className="mt-1 text-xs" style={{ color: look.muted }}>
          {fieldLabel(numerator)} ÷ {fieldLabel(denominator)}
        </p>
      ) : null}
      {delta !== null ? (
        <p className={`mt-1 text-sm ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(1)}% vs período anterior
        </p>
      ) : null}
    </div>
  );
}

function ratio(rows: DataRow[], numerator: string, denominator: string) {
  const den = sumMetric(rows, denominator);
  if (!den) return 0;
  return sumMetric(rows, numerator) / den;
}

function ChartBody({
  widget,
  config,
  look,
  rows,
  width,
  height,
}: {
  widget: WidgetDTO;
  config: WidgetConfig;
  look: WidgetLook;
  rows: DataRow[];
  width: number;
  height: number;
}) {
  const metric = config.metric || "leads";
  const dimension = config.dimension || "date";
  const accent = look.palette[0] || "#DA9330";
  const grid = `${look.muted}33`;

  if (widget.type === "funnel") {
    const stages = config.stages || ["clicks", "leads", "qualified", "opportunities", "won"];
    const steps = stages.map((item) => ({
      name: fieldLabel(item),
      value: sumMetric(rows, item),
    }));
    const max = Math.max(...steps.map((step) => step.value), 1);
    return (
      <div className="flex h-full flex-col justify-center gap-2 overflow-auto">
        {steps.map((step, index) => {
          const previous = steps[index - 1]?.value;
          const conversion = previous ? (step.value / previous) * 100 : null;
          return (
            <div key={`${step.name}-${index}`}>
              <div className="mb-1 flex justify-between gap-2 text-xs" style={{ color: look.text }}>
                <span>{step.name}</span>
                <span style={{ color: look.muted }}>
                  {formatValue(step.value)}
                  {conversion !== null
                    ? ` · ${conversion.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                    : ""}
                </span>
              </div>
              <div className="flex justify-center">
                <div
                  className="h-7 rounded"
                  style={{
                    width: `${Math.max(12, (step.value / max) * 100)}%`,
                    background: look.palette[index % look.palette.length] || accent,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (widget.type === "table") {
    const columns = config.columns || Object.keys(rows[0] || {});
    return (
      <div className="h-full overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase" style={{ color: look.muted }}>
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-2 py-2 font-medium">
                  {config.columnLabels?.[column] || fieldLabel(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 40).map((row, idx) => (
              <tr key={idx} style={{ borderTop: `1px solid ${look.muted}33` }}>
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

  if (widget.type === "pie") {
    const data = groupByDimension(rows, dimension, metric);
    return (
      <PieChart width={width} height={height}>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={Math.min(width, height) / 3.2} label>
          {data.map((_, index) => (
            <Cell key={index} fill={look.palette[index % look.palette.length] || accent} />
          ))}
        </Pie>
        <Tooltip {...chartTooltip} />
        <Legend />
      </PieChart>
    );
  }

  const chartFormat =
    config.format || (/^(cpm|cpc|cpp|spend|revenue)$/.test(metric) ? "currency" : undefined);
  const data = groupByDimension(rows, dimension, metric);
  const tick = axisFormat(chartFormat);
  if (widget.type === "line") {
    return (
      <LineChart width={width} height={height} data={data}>
        <CartesianGrid stroke={grid} />
        <XAxis dataKey="name" stroke={look.muted} fontSize={11} />
        <YAxis stroke={look.muted} fontSize={11} tickFormatter={tick} width={56} />
        <Tooltip {...chartTooltip} formatter={(value) => tick(Number(value))} />
        <Line type="monotone" dataKey="value" stroke={accent} strokeWidth={2} dot={false} />
      </LineChart>
    );
  }

  return (
    <BarChart width={width} height={height} data={data}>
      <CartesianGrid stroke={grid} />
      <XAxis dataKey="name" stroke={look.muted} fontSize={11} />
      <YAxis stroke={look.muted} fontSize={11} tickFormatter={tick} width={48} />
      <Tooltip {...chartTooltip} formatter={(value) => tick(Number(value))} />
      <Bar dataKey="value" fill={accent} radius={[4, 4, 0, 0]} />
    </BarChart>
  );
}
