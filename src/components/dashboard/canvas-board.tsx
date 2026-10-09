"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { artboardHeight, clampFrame, snap } from "@/lib/canvas-layout";
import type { DashboardTheme } from "@/lib/dashboard-theme";
import type { DataRow } from "@/lib/mock-loader";
import { parseWidgetConfig, type WidgetFrame } from "@/lib/widget-config";
import type { WidgetDTO } from "./dashboard-viewer";
import { WidgetCard } from "./widget-card";

type DragMode = "move" | "n" | "s" | "e" | "w" | "se";

type DragState = {
  id: string;
  mode: DragMode;
  startX: number;
  startY: number;
  frame: WidgetFrame;
  bounds: { width: number; height: number };
};

const HANDLES: { mode: DragMode; className: string }[] = [
  { mode: "n", className: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize" },
  { mode: "s", className: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize" },
  { mode: "e", className: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize" },
  { mode: "w", className: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize" },
  { mode: "se", className: "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize" },
];

export function CanvasBoard({
  widgets,
  theme,
  rows,
  comparisonRows,
  rowsByView,
  comparisonByView,
  compare,
  editing,
  frozen,
  selectedId,
  onSelect,
  onFrame,
  onGestureStart,
}: {
  widgets: WidgetDTO[];
  theme: DashboardTheme;
  rows: DataRow[];
  comparisonRows: DataRow[];
  rowsByView?: Record<string, DataRow[]>;
  comparisonByView?: Record<string, DataRow[]>;
  compare: boolean;
  editing?: boolean;
  frozen?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onFrame?: (id: string, frame: WidgetFrame) => void;
  onGestureStart?: () => void;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const dragRef = useRef<DragState | null>(null);
  const [scale, setScale] = useState(1);
  const height = artboardHeight(widgets);
  const ordered = [...widgets].sort((a, b) => a.sortOrder - b.sortOrder);

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const measure = () => {
      const ratio = outer.clientWidth / theme.canvasWidth;
      const next = ratio;
      scaleRef.current = next || 1;
      setScale(next || 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [theme.canvasWidth]);

  useEffect(() => {
    function point(event: PointerEvent) {
      const board = boardRef.current;
      if (!board) return { x: 0, y: 0 };
      const rect = board.getBoundingClientRect();
      const current = scaleRef.current || 1;
      return {
        x: (event.clientX - rect.left) / current,
        y: (event.clientY - rect.top) / current,
      };
    }

    function onMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || !onFrame) return;
      const cursor = point(event);
      const dx = cursor.x - drag.startX;
      const dy = cursor.y - drag.startY;
      let { x, y, w, h } = drag.frame;
      if (drag.mode === "move") {
        x = snap(drag.frame.x + dx);
        y = snap(drag.frame.y + dy);
      }
      if (drag.mode === "e" || drag.mode === "se") {
        w = snap(Math.max(120, drag.frame.w + dx));
      }
      if (drag.mode === "s" || drag.mode === "se") {
        h = snap(Math.max(72, drag.frame.h + dy));
      }
      if (drag.mode === "w") {
        w = snap(Math.max(120, drag.frame.w - dx));
        x = snap(drag.frame.x + (drag.frame.w - w));
      }
      if (drag.mode === "n") {
        h = snap(Math.max(72, drag.frame.h - dy));
        y = snap(drag.frame.y + (drag.frame.h - h));
      }
      onFrame(drag.id, clampFrame({ x, y, w, h }, drag.bounds));
    }

    function onUp() {
      dragRef.current = null;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [onFrame]);

  function beginDrag(
    event: ReactPointerEvent,
    widget: WidgetDTO,
    mode: DragMode
  ) {
    if (!editing) return;
    event.stopPropagation();
    event.preventDefault();
    const rawFrame = parseWidgetConfig(widget.configJson).frame;
    if (!rawFrame) return;
    const frame = clampFrame(rawFrame, { width: theme.canvasWidth, height });
    onSelect?.(widget.id);
    onGestureStart?.();
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const current = scaleRef.current || 1;
    dragRef.current = {
      id: widget.id,
      mode,
      startX: (event.clientX - rect.left) / current,
      startY: (event.clientY - rect.top) / current,
      frame,
      bounds: { width: theme.canvasWidth, height },
    };
  }

  return (
    <div className={editing ? "w-full rounded-xl bg-[#0b0a0a] p-4" : "w-full"}>
      {editing ? (
        <p className="mb-3 text-xs uppercase tracking-[0.16em] text-[var(--bb-accent)]">
          Página · {theme.canvasWidth} × {height} px
        </p>
      ) : null}
      <div ref={outerRef} className="w-full">
      <div
        className="overflow-hidden"
        style={{
          width: "100%",
          height: height * scale,
          outline: editing ? "2px solid #DA9330" : undefined,
          boxShadow: editing ? "0 18px 50px rgba(0,0,0,0.45)" : undefined,
        }}
      >
        <div
          ref={boardRef}
          data-pdf-board=""
          className={`relative ${editing ? "select-none" : ""}`}
          style={{
            width: theme.canvasWidth,
            height,
            background: theme.background,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) onSelect?.(null);
          }}
        >
          {ordered.map((widget) => {
            const rawFrame = parseWidgetConfig(widget.configJson).frame;
            if (!rawFrame) return null;
            const frame = clampFrame(rawFrame, { width: theme.canvasWidth, height });
            const selected = editing && !frozen && selectedId === widget.id;
            return (
              <div
                key={widget.id}
                data-widget-id={widget.id}
                className="absolute"
                style={{
                  left: frame.x,
                  top: frame.y,
                  width: frame.w,
                  height: frame.h,
                  zIndex: widget.sortOrder + 1,
                  outline: selected ? "2px solid #DA9330" : undefined,
                  outlineOffset: selected ? 2 : undefined,
                  cursor: editing ? "grab" : "default",
                }}
                onPointerDown={(event) => beginDrag(event, widget, "move")}
              >
                <WidgetCard
                  widget={widget}
                  theme={theme}
                  rows={
                    rowsByView?.[parseWidgetConfig(widget.configJson).view || ""] || rows
                  }
                  comparisonRows={
                    comparisonByView?.[parseWidgetConfig(widget.configJson).view || ""] ||
                    comparisonRows
                  }
                  compare={compare}
                  width={frame.w}
                  height={frame.h}
                  frozen={frozen}
                />
                {selected
                  ? HANDLES.map((handle) => (
                      <button
                        key={handle.mode}
                        type="button"
                        aria-label={`Redimensionar ${handle.mode}`}
                        className={`absolute z-10 h-3 w-3 rounded-sm border border-[#141312] bg-[#DA9330] ${handle.className}`}
                        onPointerDown={(event) => beginDrag(event, widget, handle.mode)}
                      />
                    ))
                  : null}
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}
