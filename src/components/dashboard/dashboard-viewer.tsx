"use client";

import { useMemo, useState } from "react";
import { ensureFrames } from "@/lib/canvas-layout";
import { BLACKBEANS_THEME, type DashboardTheme } from "@/lib/dashboard-theme";
import type { DataRow } from "@/lib/mock-loader";
import {
  defaultFilters,
  filterComparison,
  filterDataset,
  filterFacets,
  type DashboardFilters,
} from "@/lib/filter-engine";
import { fieldLabel, parseWidgetConfig, type WidgetFrame } from "@/lib/widget-config";
import { CanvasBoard } from "./canvas-board";
import { FilterBar } from "./filter-bar";

export type WidgetDTO = {
  id: string;
  type: string;
  title: string;
  configJson: string;
  sortOrder: number;
};

export type WidgetEditApi = {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onFrame: (id: string, frame: WidgetFrame) => void;
  onGestureStart: () => void;
};

export type DashboardPageTab = {
  id: string;
  title: string;
  views: string[];
};

type Props = {
  rows: DataRow[];
  rowsByView?: Record<string, DataRow[]>;
  pages?: DashboardPageTab[];
  pageId?: string;
  onPageChange?: (pageId: string) => void;
  widgets: WidgetDTO[];
  theme?: DashboardTheme;
  title: string;
  subtitle?: string;
  readOnly?: boolean;
  edit?: WidgetEditApi;
};

export function DashboardViewer({
  rows,
  rowsByView,
  pages,
  pageId,
  onPageChange,
  widgets,
  theme = BLACKBEANS_THEME,
  title,
  subtitle,
  readOnly,
  edit,
}: Props) {
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [localPageId, setLocalPageId] = useState(pages?.[0]?.id || "");
  const activePageId = pageId || localPageId;
  const activePage = pages?.find((page) => page.id === activePageId) || pages?.[0];

  function selectPage(next: string) {
    setLocalPageId(next);
    onPageChange?.(next);
  }

  const pageRows = useMemo(() => {
    if (!activePage || !rowsByView) return rows;
    return activePage.views.flatMap((view) => rowsByView[view] || []);
  }, [activePage, rows, rowsByView]);

  const visibleWidgets = useMemo(() => {
    if (!activePage) return widgets;
    return widgets.filter((widget) => {
      const config = parseWidgetConfig(widget.configJson);
      return (config.pageId || pages?.[0]?.id) === activePage.id;
    });
  }, [activePage, pages, widgets]);

  const filtered = useMemo(
    () => filterDataset(activePage ? pageRows : rows, filters),
    [activePage, pageRows, rows, filters]
  );
  const filteredByView = useMemo(() => {
    if (!rowsByView) return undefined;
    const next: Record<string, DataRow[]> = {};
    for (const [view, viewRows] of Object.entries(rowsByView)) {
      next[view] = filterDataset(viewRows, filters);
    }
    return next;
  }, [rowsByView, filters]);
  const comparison = useMemo(
    () => filterComparison(activePage ? pageRows : rows, filters),
    [activePage, pageRows, rows, filters]
  );
  const comparisonByView = useMemo(() => {
    if (!rowsByView) return undefined;
    const next: Record<string, DataRow[]> = {};
    for (const [view, viewRows] of Object.entries(rowsByView)) {
      next[view] = filterComparison(viewRows, filters);
    }
    return next;
  }, [rowsByView, filters]);

  const facets = useMemo(
    () =>
      filterFacets(pageRows).map((facet) => ({
        ...facet,
        label: fieldLabel(facet.key),
      })),
    [pageRows]
  );

  return (
    <div className={edit ? "space-y-3" : "space-y-6"}>
      {edit ? null : (
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-[var(--bb-cream)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm text-[var(--bb-gray)]">{subtitle}</p>
          ) : null}
          {readOnly ? (
            <p className="text-xs uppercase tracking-wide text-[var(--bb-accent)]">
              Visualização pública
            </p>
          ) : null}
        </header>
      )}

      {pages && pages.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {pages.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => selectPage(page.id)}
              className={`cursor-pointer rounded-full border px-4 py-2 text-sm ${
                page.id === activePage?.id
                  ? "border-[var(--bb-accent)] bg-[var(--bb-accent)] text-[var(--bb-black)]"
                  : "border-[var(--bb-border)] text-[var(--bb-cream)] hover:border-[var(--bb-accent)]"
              }`}
            >
              {page.title}
            </button>
          ))}
        </div>
      ) : null}

      <FilterBar
        filters={filters}
        onChange={setFilters}
        facets={facets}
      />

      <CanvasBoard
        widgets={ensureFrames(visibleWidgets)}
        theme={theme}
        rows={filtered}
        comparisonRows={comparison}
        rowsByView={filteredByView}
        comparisonByView={comparisonByView}
        compare={filters.compare}
        editing={Boolean(edit)}
        selectedId={edit?.selectedId}
        onSelect={edit?.onSelect}
        onFrame={edit?.onFrame}
        onGestureStart={edit?.onGestureStart}
      />
    </div>
  );
}
