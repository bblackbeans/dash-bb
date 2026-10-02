"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  CalendarRange,
  FileText,
  GitBranch,
  GitCompareArrows,
  Megaphone,
  MonitorSmartphone,
  Search,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  resolveDateRange,
  type DashboardFilters,
  type DatePreset,
} from "@/lib/filter-engine";

type Facet = {
  key: string;
  label: string;
  values: string[];
};

type Props = {
  filters: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
  facets: Facet[];
};

const FACET_ICONS: Record<string, LucideIcon> = {
  campaign: Megaphone,
  utmSource: GitBranch,
  utmMedium: GitBranch,
  source: GitBranch,
  ageRange: Users,
  page: FileText,
  device: MonitorSmartphone,
};

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "7d", label: "Últimos 7 dias" },
  { id: "30d", label: "Últimos 30 dias" },
  { id: "90d", label: "Últimos 90 dias" },
  { id: "month", label: "Este mês" },
  { id: "lastMonth", label: "Mês passado" },
  { id: "year", label: "Este ano" },
  { id: "all", label: "Todo o período" },
];

function presetLabel(preset: DatePreset): string {
  return PRESETS.find((item) => item.id === preset)?.label || "Período personalizado";
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

function rangeLabel(filters: DashboardFilters): string {
  const range = resolveDateRange(filters);
  if (!range) return "Sem recorte de data";
  if (range.start === range.end) return formatDay(range.start);
  return `${formatDay(range.start)} – ${formatDay(range.end)}`;
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function FilterBar({ filters, onChange, facets }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function setFacet(key: string, values: string[]) {
    const next = { ...filters.facets };
    if (values.length) next[key] = values;
    else delete next[key];
    onChange({ ...filters, facets: next });
  }

  const chips = Object.entries(filters.facets).flatMap(([key, values]) =>
    values.map((value) => ({
      key: `${key}:${value}`,
      label: value,
      clear: () => setFacet(key, values.filter((item) => item !== value)),
    }))
  );
  const dirty =
    filters.preset !== "30d" ||
    filters.compare ||
    chips.length > 0;

  return (
    <div ref={rootRef} className="space-y-3 rounded-[var(--bb-radius-xl)] border border-[var(--bb-border)] bg-[var(--bb-surface)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            type="button"
            aria-expanded={open === "date"}
            onClick={() => setOpen(open === "date" ? null : "date")}
            className="inline-flex items-center gap-2 rounded-[var(--bb-radius)] border border-[var(--bb-border)] bg-[#141312] px-3 py-2 text-left text-sm text-[var(--bb-cream)]"
          >
            <CalendarRange className="h-4 w-4 text-[var(--bb-accent)]" aria-hidden />
            <span>
              <span className="block leading-none">{presetLabel(filters.preset)}</span>
              <span className="mt-1 block text-xs text-[var(--bb-gray)]">{rangeLabel(filters)}</span>
            </span>
          </button>
          {open === "date" ? (
            <div className="absolute left-0 z-30 mt-2 w-[320px] rounded-[var(--bb-radius-xl)] border border-[var(--bb-border)] bg-[#141312] p-3 shadow-xl">
              <div className="grid grid-cols-2 gap-1">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onChange({
                        ...filters,
                        preset: preset.id,
                        compare: preset.id === "all" ? false : filters.compare,
                      });
                      setOpen(null);
                    }}
                    className={`rounded-[var(--bb-radius)] px-2 py-1.5 text-left text-sm ${
                      filters.preset === preset.id
                        ? "bg-[var(--bb-accent)] text-[var(--bb-black)]"
                        : "text-[var(--bb-cream)] hover:bg-white/5"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
                <label className="space-y-1 text-xs text-[var(--bb-gray)]">
                  De
                  <input
                    type="date"
                    value={filters.startDate || resolveDateRange({ ...filters, preset: filters.preset === "all" ? "30d" : filters.preset })?.start || ""}
                    onChange={(event) =>
                      onChange({
                        ...filters,
                        preset: "custom",
                        startDate: event.target.value,
                        endDate: filters.endDate || event.target.value,
                      })
                    }
                    className="w-full rounded-[var(--bb-radius)] border border-[var(--bb-border)] bg-[#1c1b1a] px-2 py-1.5 text-sm text-[var(--bb-cream)]"
                  />
                </label>
                <label className="space-y-1 text-xs text-[var(--bb-gray)]">
                  Até
                  <input
                    type="date"
                    value={filters.endDate || resolveDateRange({ ...filters, preset: filters.preset === "all" ? "30d" : filters.preset })?.end || ""}
                    onChange={(event) =>
                      onChange({
                        ...filters,
                        preset: "custom",
                        startDate: filters.startDate || event.target.value,
                        endDate: event.target.value,
                      })
                    }
                    className="w-full rounded-[var(--bb-radius)] border border-[var(--bb-border)] bg-[#1c1b1a] px-2 py-1.5 text-sm text-[var(--bb-cream)]"
                  />
                </label>
              </div>
            </div>
          ) : null}
        </div>

        {facets.map((facet) => (
          <MultiFilter
            key={facet.key}
            id={facet.key}
            open={open}
            setOpen={setOpen}
            label={facet.label}
            icon={FACET_ICONS[facet.key] || FileText}
            values={facet.values}
            selected={filters.facets[facet.key] || []}
            onChange={(values) => setFacet(facet.key, values)}
          />
        ))}

        <button
          type="button"
          disabled={filters.preset === "all"}
          onClick={() => onChange({ ...filters, compare: !filters.compare })}
          className={`inline-flex items-center gap-2 rounded-[var(--bb-radius)] border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
            filters.compare
              ? "border-[var(--bb-accent)] bg-[var(--bb-accent)]/15 text-[var(--bb-accent)]"
              : "border-[var(--bb-border)] text-[var(--bb-cream)]"
          }`}
        >
          <GitCompareArrows className="h-4 w-4" aria-hidden />
          Período anterior
        </button>

        {dirty ? (
          <button
            type="button"
            onClick={() => onChange({ preset: "30d", facets: {}, compare: false })}
            className="inline-flex items-center gap-1 px-2 py-2 text-sm text-[var(--bb-gray)] hover:text-[var(--bb-cream)]"
          >
            <X className="h-3.5 w-3.5" />
            Limpar
          </button>
        ) : null}
      </div>

      {chips.length ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--bb-border)] bg-[#141312] px-2 py-1 text-xs text-[var(--bb-cream)]"
            >
              {chip.label}
              <X className="h-3 w-3 text-[var(--bb-gray)]" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MultiFilter({
  id,
  open,
  setOpen,
  label,
  icon: Icon,
  values,
  selected,
  onChange,
}: {
  id: string;
  open: string | null;
  setOpen: (id: string | null) => void;
  label: string;
  icon: LucideIcon;
  values: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const fieldId = useId();
  const shown = values.filter((value) => value.toLowerCase().includes(query.trim().toLowerCase()));
  const active = open === id;

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={active}
        onClick={() => setOpen(active ? null : id)}
        className={`inline-flex items-center gap-2 rounded-[var(--bb-radius)] border px-3 py-2 text-sm ${
          selected.length
            ? "border-[var(--bb-accent)] text-[var(--bb-cream)]"
            : "border-[var(--bb-border)] text-[var(--bb-cream)]"
        }`}
      >
        <Icon className="h-4 w-4 text-[var(--bb-accent)]" aria-hidden />
        {label}
        {selected.length ? (
          <span className="rounded-full bg-[var(--bb-accent)] px-1.5 text-xs text-[var(--bb-black)]">
            {selected.length}
          </span>
        ) : null}
      </button>
      {active ? (
        <div className="absolute left-0 z-30 mt-2 w-64 rounded-[var(--bb-radius-xl)] border border-[var(--bb-border)] bg-[#141312] p-2 shadow-xl">
          <label className="relative block" htmlFor={fieldId}>
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--bb-gray)]" />
            <input
              id={fieldId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar"
              className="w-full rounded-[var(--bb-radius)] border border-[var(--bb-border)] bg-[#1c1b1a] py-1.5 pl-7 pr-2 text-sm text-[var(--bb-cream)]"
            />
          </label>
          <div className="mt-2 flex items-center justify-between px-1 text-xs">
            <button type="button" className="text-[var(--bb-accent)]" onClick={() => onChange(values)}>
              Todos
            </button>
            <button type="button" className="text-[var(--bb-gray)]" onClick={() => onChange([])}>
              Limpar
            </button>
          </div>
          <div className="mt-1 max-h-48 space-y-0.5 overflow-auto">
            {shown.map((value) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-[var(--bb-cream)] hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={selected.includes(value)}
                  onChange={() => onChange(toggleValue(selected, value))}
                />
                <span className="truncate">{value}</span>
              </label>
            ))}
            {!shown.length ? <p className="px-1 py-2 text-xs text-[var(--bb-gray)]">Nada encontrado</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
