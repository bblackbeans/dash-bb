"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { Download } from "lucide-react";
import { domToJpeg } from "modern-screenshot";
import {
  filterDataset,
  resolveDateRange,
  uniqueValues,
  type DashboardFilters,
  type DatePreset,
} from "@/lib/filter-engine";
import type { DataRow } from "@/lib/mock-loader";
import type { DashboardTheme } from "@/lib/dashboard-theme";
import { fieldLabel, parseWidgetConfig } from "@/lib/widget-config";
import { formatTableCell } from "./widget-card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

const CAMPAIGN_LIMIT = 20;
const TABLE_ROW_LIMIT = 120;
const MARGIN = 12;

type PdfWidget = {
  id: string;
  type: string;
  title: string;
  configJson: string;
  sortOrder: number;
};
const PRESET_LABEL: Record<DatePreset, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  month: "Este mês",
  lastMonth: "Mês passado",
  year: "Este ano",
  all: "Todo o período",
  custom: "Período personalizado",
};

type Props = {
  title: string;
  clientName?: string;
  filters: DashboardFilters;
  pageRows: DataRow[];
  widgets: PdfWidget[];
  rowsByView?: Record<string, DataRow[]>;
  theme: DashboardTheme;
  onChange: (next: DashboardFilters) => void;
  onExporting: (value: boolean) => void;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function periodText(filters: DashboardFilters): string {
  if (filters.preset === "all") return "Todo o período";
  const name = PRESET_LABEL[filters.preset] || "Período";
  const range = resolveDateRange(filters);
  if (!range) return name;
  if (range.start === range.end) return `${name} (${formatDay(range.start)})`;
  return `${name} (${formatDay(range.start)} - ${formatDay(range.end)})`;
}

function fileName(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "dashboard"}.pdf`;
}

function availableCampaigns(rows: DataRow[], filters: DashboardFilters): string[] {
  const hasColumn = rows.some((row) => {
    const value = row.campaign_name;
    return value != null && value !== "";
  });
  if (!hasColumn) return [];
  const withoutCampaign: DashboardFilters = {
    ...filters,
    facets: { ...filters.facets },
  };
  delete withoutCampaign.facets.campaign_name;
  return uniqueValues(filterDataset(rows, withoutCampaign), "campaign_name").sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" })
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível ler a imagem do dashboard."));
    image.src = src;
  });
}

function paintPage(pdf: jsPDF) {
  pdf.setFillColor(244, 240, 237);
  pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), "F");
}

function byPosition(widgets: PdfWidget[]): PdfWidget[] {
  return [...widgets].sort((a, b) => {
    const frameA = parseWidgetConfig(a.configJson).frame;
    const frameB = parseWidgetConfig(b.configJson).frame;
    const dy = (frameA?.y || 0) - (frameB?.y || 0);
    if (Math.abs(dy) > 40) return dy;
    return (frameA?.x || 0) - (frameB?.x || 0) || a.sortOrder - b.sortOrder;
  });
}

function widgetRows(
  widget: PdfWidget,
  pageRows: DataRow[],
  rowsByView: Record<string, DataRow[]> | undefined,
  filters: DashboardFilters
): DataRow[] {
  const view = parseWidgetConfig(widget.configJson).view;
  const source = (view && rowsByView?.[view]) || pageRows;
  return filterDataset(source, filters);
}

async function captureWidget(id: string, background: string): Promise<{ url: string; width: number; height: number } | null> {
  const node = document.querySelector(`[data-widget-id="${CSS.escape(id)}"]`);
  if (!(node instanceof HTMLElement)) return null;
  document.documentElement.setAttribute("data-pdf-capture", "1");
  try {
    const url = await domToJpeg(node, {
      backgroundColor: background,
      quality: 0.9,
      scale: 1.5,
      filter: (el) => !(el instanceof Element && el.getAttribute("aria-label")?.startsWith("Redimensionar")),
    });
    const image = await loadImage(url);
    return { url, width: image.naturalWidth, height: image.naturalHeight };
  } catch {
    return null;
  } finally {
    document.documentElement.removeAttribute("data-pdf-capture");
  }
}

function drawHeader(
  pdf: jsPDF,
  contentWidth: number,
  margin: number,
  title: string,
  clientName: string | undefined,
  period: string,
  campaign: string | undefined,
  continued: boolean
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  pdf.setFillColor(244, 240, 237);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  let y = margin + 2;
  pdf.setTextColor(20, 19, 18);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(pdf.splitTextToSize(title, contentWidth).slice(0, 1), margin, y);
  y += 7;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(92, 91, 92);
  const meta = [clientName, period, continued ? "continuação" : ""].filter(Boolean).join("  ·  ");
  if (meta) {
    pdf.text(pdf.splitTextToSize(meta, contentWidth).slice(0, 1), margin, y);
    y += 6;
  }
  if (campaign) {
    pdf.setTextColor(20, 19, 18);
    pdf.setFont("helvetica", "bold");
    const lines = pdf.splitTextToSize(campaign, contentWidth).slice(0, 2);
    pdf.text(lines, margin, y);
    y += lines.length * 5;
  }
  y += 2;
  pdf.setDrawColor(218, 147, 48);
  pdf.setLineWidth(0.4);
  pdf.line(margin, y, margin + contentWidth, y);
  return y + 4;
}

type ReportHeader = {
  title: string;
  clientName?: string;
  period: string;
  campaign?: string;
};

function beginPage(pdf: jsPDF, header: ReportHeader, continued: boolean, first: boolean): number {
  if (!first) pdf.addPage();
  const contentWidth = pdf.internal.pageSize.getWidth() - MARGIN * 2;
  return drawHeader(pdf, contentWidth, MARGIN, header.title, header.clientName, header.period, header.campaign, continued);
}

function drawDataTable(
  pdf: jsPDF,
  widget: PdfWidget,
  rows: DataRow[],
  header: ReportHeader,
  startY: number
): number {
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pdf.internal.pageSize.getWidth() - MARGIN * 2;
  let y = startY;
  if (y > pageHeight - 40) y = beginPage(pdf, header, true, false);
  pdf.setTextColor(20, 19, 18);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(pdf.splitTextToSize(widget.title, contentWidth).slice(0, 1), MARGIN, y);
  y += 3;
  const config = parseWidgetConfig(widget.configJson);
  const columns = (config.columns?.length ? config.columns : Object.keys(rows[0] || {})).slice(0, 12);
  const shown = rows.slice(0, TABLE_ROW_LIMIT);
  if (!columns.length || !shown.length) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(92, 91, 92);
    pdf.text("Sem dados para esta seleção.", MARGIN, y + 5);
    return y + 12;
  }
  autoTable(pdf, {
    startY: y + 3,
    margin: { left: MARGIN, right: MARGIN, top: 32, bottom: MARGIN },
    head: [columns.map((column) => config.columnLabels?.[column] || fieldLabel(column))],
    body: shown.map((row) => columns.map((column) => formatTableCell(column, row[column]))),
    styles: {
      fontSize: columns.length > 7 ? 7 : 8,
      cellPadding: 1.4,
      overflow: "linebreak",
      textColor: [244, 240, 237],
      fillColor: [28, 27, 26],
      lineColor: [70, 68, 66],
      lineWidth: 0.1,
      valign: "middle",
    },
    headStyles: { fillColor: [20, 19, 18], textColor: [218, 147, 48], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [36, 35, 34] },
    willDrawPage: (data) => {
      if (data.pageNumber > 1) {
        paintPage(pdf);
        drawHeader(pdf, contentWidth, MARGIN, header.title, header.clientName, header.period, header.campaign, true);
      }
    },
  });
  const finalY = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y + 8;
  if (rows.length > shown.length) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(92, 91, 92);
    pdf.text(`Mostrando ${shown.length} de ${rows.length} linhas.`, MARGIN, finalY + 5);
    return finalY + 12;
  }
  return finalY + 8;
}

async function writeReport(
  pdf: jsPDF,
  input: {
    widgets: PdfWidget[];
    pageRows: DataRow[];
    rowsByView?: Record<string, DataRow[]>;
    filters: DashboardFilters;
    theme: DashboardTheme;
    header: ReportHeader;
    first: boolean;
  }
): Promise<void> {
  const contentWidth = pdf.internal.pageSize.getWidth() - MARGIN * 2;
  const pageHeight = pdf.internal.pageSize.getHeight();
  const canvasWidth = input.theme.canvasWidth || 1200;
  let y = beginPage(pdf, input.header, false, input.first);
  let cursorX = MARGIN;
  let rowHeight = 0;
  const visuals = byPosition(input.widgets.filter((widget) => widget.type !== "table"));
  for (const widget of visuals) {
    const shot = await captureWidget(widget.id, input.theme.background);
    if (!shot) continue;
    const frame = parseWidgetConfig(widget.configJson).frame;
    const share = Math.min(1, Math.max(0.3, (frame?.w || canvasWidth) / canvasWidth));
    const boxWidth = share >= 0.72 ? contentWidth : contentWidth * share;
    const boxHeight = (shot.height / shot.width) * boxWidth;
    if (cursorX > MARGIN && cursorX + boxWidth > MARGIN + contentWidth + 0.5) {
      cursorX = MARGIN;
      y += rowHeight + 4;
      rowHeight = 0;
    }
    if (y + boxHeight > pageHeight - MARGIN) {
      y = beginPage(pdf, input.header, true, false);
      cursorX = MARGIN;
      rowHeight = 0;
    }
    pdf.addImage(shot.url, "JPEG", cursorX, y, boxWidth, boxHeight);
    cursorX += boxWidth + 4;
    rowHeight = Math.max(rowHeight, boxHeight);
  }
  if (rowHeight) y += rowHeight + 8;
  for (const widget of byPosition(input.widgets.filter((widget) => widget.type === "table"))) {
    const rows = widgetRows(widget, input.pageRows, input.rowsByView, input.filters);
    y = drawDataTable(pdf, widget, rows, input.header, y);
  }
}

export function PdfExportButton({
  title,
  clientName,
  filters,
  pageRows,
  widgets,
  rowsByView,
  theme,
  onChange,
  onExporting,
}: Props) {
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const campaigns = availableCampaigns(pageRows, filters);
  const shown = campaigns.filter((name) => name.toLowerCase().includes(query.trim().toLowerCase()));

  function toggle(name: string) {
    setPicked((current) => {
      if (current.includes(name)) return current.filter((item) => item !== name);
      if (current.length >= CAMPAIGN_LIMIT) return current;
      return [...current, name];
    });
  }

  async function download(selected: string[]) {
    const previous = filters;
    const sections = selected.length ? selected.slice(0, CAMPAIGN_LIMIT) : [undefined];
    const period = periodText(filters);
    setOpen(false);
    setError("");
    setProgress(selected.length ? `Campanha 1 de ${sections.length}` : "Gerando PDF...");
    onExporting(true);
    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      let firstPage = true;
      for (let index = 0; index < sections.length; index += 1) {
        const campaign = sections[index];
        const nextFilters = campaign
          ? { ...previous, facets: { ...previous.facets, campaign_name: [campaign] } }
          : previous;
        if (campaign) {
          setProgress(`Campanha ${index + 1} de ${sections.length}`);
          onChange(nextFilters);
          await wait(280);
        } else {
          await wait(80);
        }
        await writeReport(pdf, {
          widgets,
          pageRows,
          rowsByView,
          filters: nextFilters,
          theme,
          header: { title, clientName, period, campaign },
          first: firstPage,
        });
        firstPage = false;
      }
      pdf.save(fileName(title));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar o PDF.");
    } finally {
      onChange(previous);
      onExporting(false);
      setProgress(null);
    }
  }

  return (
    <div className="shrink-0 space-y-1">
      <Button
        variant="secondary"
        size="md"
        className="h-10"
        disabled={progress != null}
        onClick={() => {
          const current = filters.facets.campaign_name || [];
          setPicked(current.filter((name) => campaigns.includes(name)).slice(0, CAMPAIGN_LIMIT));
          setQuery("");
          setOpen(true);
        }}
      >
        <Download className="h-4 w-4" aria-hidden />
        {progress || "Baixar PDF"}
      </Button>
      {error ? <p className="max-w-64 text-xs text-red-300">{error}</p> : null}
      <Modal
        open={open}
        title="Baixar PDF"
        description="Escolha a tela atual ou as campanhas que entram no arquivo."
        onClose={() => setOpen(false)}
        wide
      >
        <div className="space-y-4">
          <Button type="button" variant="secondary" className="h-10 w-full" onClick={() => void download([])}>
            Baixar a tela como está
          </Button>
          {campaigns.length ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-[var(--bb-cream)]">Campanhas</p>
                <button
                  type="button"
                  className="text-xs text-[var(--bb-accent)]"
                  onClick={() => setPicked(picked.length ? [] : campaigns.slice(0, CAMPAIGN_LIMIT))}
                >
                  {picked.length ? "Limpar" : "Marcar até 20"}
                </button>
              </div>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar campanha"
                className="h-10 w-full rounded-[var(--bb-radius)] border border-[var(--bb-border)] bg-[#141312] px-3 text-sm text-[var(--bb-cream)]"
              />
              <div className="max-h-64 space-y-1 overflow-auto rounded-[var(--bb-radius)] border border-[var(--bb-border)] p-2">
                {shown.map((name) => (
                  <label key={name} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm text-[var(--bb-cream)] hover:bg-white/5">
                    <input type="checkbox" checked={picked.includes(name)} onChange={() => toggle(name)} />
                    <span className="truncate">{name}</span>
                  </label>
                ))}
                {!shown.length ? <p className="px-1 py-2 text-xs text-[var(--bb-gray)]">Nenhuma campanha encontrada</p> : null}
              </div>
              <p className="text-xs text-[var(--bb-gray)]">
                {picked.length} selecionada{picked.length === 1 ? "" : "s"}. O arquivo aceita até {CAMPAIGN_LIMIT}.
              </p>
              {picked.length ? (
                <Button
                  type="button"
                  className="h-10 w-full"
                  onClick={() => void download(picked.slice(0, CAMPAIGN_LIMIT))}
                >
                  Baixar {Math.min(picked.length, CAMPAIGN_LIMIT)} campanha{picked.length === 1 ? "" : "s"}
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--bb-gray)]">Esta aba não tem a coluna de campanha, então o PDF sai com a tela atual.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
