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
import { fieldLabel, type WidgetFrame } from "@/lib/widget-config";
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

type Props = {
  rows: DataRow[];
  widgets: WidgetDTO[];
  theme?: DashboardTheme;
  title: string;
  subtitle?: string;
  readOnly?: boolean;
  edit?: WidgetEditApi;
};

export function DashboardViewer({
  rows,
  widgets,
  theme = BLACKBEANS_THEME,
  title,
  subtitle,
  readOnly,
  edit,
}: Props) {
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);

  const filtered = useMemo(
    () => filterDataset(rows, filters),
    [rows, filters]
  );
  const comparison = useMemo(
    () => filterComparison(rows, filters),
    [rows, filters]
  );

  const facets = useMemo(
    () =>
      filterFacets(rows).map((facet) => ({
        ...facet,
        label: fieldLabel(facet.key),
      })),
    [rows]
  );

  return (
    <div className="space-y-6">
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

      <FilterBar
        filters={filters}
        onChange={setFilters}
        facets={facets}
      />

      <CanvasBoard
        widgets={ensureFrames(widgets)}
        theme={theme}
        rows={filtered}
        comparisonRows={comparison}
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
